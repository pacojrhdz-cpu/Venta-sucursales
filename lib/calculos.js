// ============================================================
//  LOGICA DE NEGOCIO: comisiones, objetivos y bonos
//  Funciones puras (sin dependencias) para poder probarlas.
// ============================================================

// ---- Formato de moneda MXN ----
export function mxn(n) {
  const v = Number(n || 0);
  return v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

export function pct(n) {
  return (Number(n || 0) * 100).toFixed(2) + '%';
}

// ---- Comision de la terminal sobre ventas con tarjeta ----
// tarjeta: monto cobrado con tarjeta; tasa: ej 0.035
export function comisionTarjeta(tarjeta, tasa) {
  return Number(tarjeta || 0) * Number(tasa || 0);
}

// ---- Nómina del mes de UNA sucursal ----
// Suma, sobre todas las semanas naturales del mes, el neto de cada colaborador
// (sueldo por semana + bono − deducciones). Devuelve total y total en efectivo.
export function nominaMensual({ anio, mes, metaMensual, ventas, colaboradores, registros = {}, regMes = {}, deducciones = {}, cfg }) {
  const ndMes = diasEnMes(anio, mes);
  const metaDiaria = ndMes > 0 ? Number(metaMensual || 0) / ndMes : 0;
  const p = `${anio}-${String(mes).padStart(2, '0')}`;
  const iniMesISO = `${p}-01`, finMesISO = `${p}-${String(ndMes).padStart(2, '0')}`;
  const tramos = semanasNaturalesQueTocan(anio, mes).map(sem => ({
    ...sem,
    start: sem.inicioISO > iniMesISO ? sem.inicioISO : iniMesISO,
    end:   sem.finISO   < finMesISO ? sem.finISO   : finMesISO,
    fragDays: sem.diasEnMesSel,
  }));
  const ventaEntre = (a, b) => (ventas || []).filter(v => v.fecha >= a && v.fecha <= b).reduce((s, v) => s + ventaBruta(v), 0);
  const diasDe = (cid, start, fd) => { const r = registros[`${cid}|${start}`]; const v = r?.dias; return (v == null || v === '') ? fd : Number(v); };
  const retDe = (cid, start) => Number(registros[`${cid}|${start}`]?.retardos || 0);
  let total = 0, totalEfectivo = 0;
  tramos.forEach((t, idx) => {
    const venta = ventaEntre(t.start, t.end);
    const cols = (colaboradores || []).map(c => ({ id: c.id, retardos: retDe(c.id, t.start), faltas: 0,
      factor: t.fragDays > 0 ? Math.min(1, diasDe(c.id, t.start, t.fragDays) / t.fragDays) : 1 }));
    const b = calcularBono({ ventaPeriodo: venta, meta: t.fragDays * metaDiaria, tipo: 'semanal', cfg, colaboradores: cols });
    (colaboradores || []).forEach(c => {
      // Sueldo proporcional a los días del tramo dentro del mes (evita contar
      // semanas partidas del cambio de mes como semanas completas).
      const sueldo = sueldoEfectivoSemana(c.id, idx, tramos, regMes, c.sueldo) * (t.fragDays / 7);
      const bono = b.detalle.find(d => d.id === c.id)?.bono || 0;
      const ded = Number(deducciones[`${c.id}|${t.start}`] || 0);
      const neto = sueldo + bono - ded;
      total += neto;
      if ((regMes[`${c.id}|${t.start}`]?.metodo || 'efectivo') === 'efectivo') totalEfectivo += neto;
    });
  });
  return { total, totalEfectivo };
}

// ---- Sueldo efectivo de una semana ----
// Busca el sueldo capturado para esa semana; si no hay, usa el de la semana
// anterior (hacia atrás); si tampoco, el sueldo base del colaborador.
// tramos: [{start,...}] ordenadas. regMes: { 'cid|start': {sueldo, metodo} }.
export function sueldoEfectivoSemana(cid, idx, tramos, regMes, base) {
  for (let i = idx; i >= 0; i--) {
    const r = regMes[`${cid}|${tramos[i]?.start}`];
    if (r && r.sueldo !== null && r.sueldo !== undefined && r.sueldo !== '') return Number(r.sueldo);
  }
  return Number(base || 0);
}

// ---- Tarjetas: suma de débito + crédito + otras de una fila de venta ----
export function sumaTarjetas(v) {
  return Number(v?.tarjeta_debito || 0) + Number(v?.tarjeta_credito || 0) + Number(v?.tarjeta_otras || 0);
}

// Venta bruta total de un día (efectivo + tarjetas + plataforma). NO incluye propinas.
export function ventaBruta(v) {
  return Number(v?.efectivo || 0) + sumaTarjetas(v) + Number(v?.plataforma || 0);
}

// Comisión total de una fila de venta según las tasas de su sucursal.
// s: objeto sucursal con comision_debito/credito/otras/plataforma.
export function comisionVenta(v, s) {
  return Number(v?.tarjeta_debito || 0) * Number(s?.comision_debito || 0)
       + Number(v?.tarjeta_credito || 0) * Number(s?.comision_credito || 0)
       + Number(v?.tarjeta_otras || 0) * Number(s?.comision_otras || 0)
       + Number(v?.plataforma || 0) * Number(s?.comision_plataforma || 0);
}

// Venta total del dia (efectivo + tarjeta bruto)
export function ventaTotal(efectivo, tarjeta) {
  return Number(efectivo || 0) + Number(tarjeta || 0);
}

// Lo que realmente entra despues de la comision de terminal
export function ventaNeta(efectivo, tarjeta, tasa) {
  return ventaTotal(efectivo, tarjeta) - comisionTarjeta(tarjeta, tasa);
}

// ---- Avance de objetivo ----
// Devuelve la fraccion 0..n (0.85 = 85%)
export function avance(venta, meta) {
  const m = Number(meta || 0);
  if (m <= 0) return 0;
  return Number(venta || 0) / m;
}

// ============================================================
//  BONO SEMANAL
//  Rangos por defecto:
//   70% - 89.99%  -> 0.5%
//   90% - 99.99%  -> 0.7%
//   100% +        -> 1%
//  Se aplica sobre la VENTA TOTAL de la semana.
// ============================================================
export function porcentajeBonoSemanal(fraccion, cfg) {
  const c = cfg || DEFAULT_CONFIG;
  if (fraccion >= c.bono_sem_r3_min) return Number(c.bono_sem_r3_pct);
  if (fraccion >= c.bono_sem_r2_min) return Number(c.bono_sem_r2_pct);
  if (fraccion >= c.bono_sem_r1_min) return Number(c.bono_sem_r1_pct);
  return 0;
}

// ============================================================
//  BONO MENSUAL
//   90% - 99.99% -> 0.7%
//   100% +       -> 1%
//  Se aplica sobre la VENTA TOTAL del mes.
// ============================================================
export function porcentajeBonoMensual(fraccion, cfg) {
  const c = cfg || DEFAULT_CONFIG;
  if (fraccion >= c.bono_mes_r2_min) return Number(c.bono_mes_r2_pct);
  if (fraccion >= c.bono_mes_r1_min) return Number(c.bono_mes_r1_pct);
  return 0;
}

// ============================================================
//  ELEGIBILIDAD por asistencia
//  Un colaborador PIERDE el bono si supera el limite de faltas
//  o el limite de retardos en el periodo.
//  asistencia = { faltas: int, retardos: int }
// ============================================================
export function esElegible(asistencia, cfg) {
  const c = cfg || DEFAULT_CONFIG;
  const faltas = Number(asistencia?.faltas || 0);
  const retardos = Number(asistencia?.retardos || 0);
  return faltas <= c.limite_faltas && retardos <= c.limite_retardos;
}

// ============================================================
//  CALCULO COMPLETO DEL BONO DE UN PERIODO
//  ventaPeriodo: venta total del periodo (semana o mes)
//  meta: meta del periodo
//  colaboradores: [{ id, nombre, faltas, retardos }]
//  tipo: 'semanal' | 'mensual'
//
//  Reglas:
//   - Se calcula el % segun el avance.
//   - La bolsa total del bono = ventaPeriodo * %.
//   - Solo participan los colaboradores ELEGIBLES.
//   - Semanal: cada elegible recibe (ventaPeriodo * %).  (bono individual)
//   - Mensual: la bolsa se REPARTE en partes iguales entre los elegibles.
//  (Ambos comportamientos configurables abajo con repartir=true/false.)
// ============================================================
export function calcularBono({ ventaPeriodo, meta, colaboradores = [], tipo = 'semanal', cfg }) {
  const c = cfg || DEFAULT_CONFIG;
  const frac = avance(ventaPeriodo, meta);
  const porcentaje = tipo === 'mensual'
    ? porcentajeBonoMensual(frac, c)
    : porcentajeBonoSemanal(frac, c);

  const montoBase = Number(ventaPeriodo || 0) * porcentaje; // bolsa / bono individual base
  // factor = proporcion de dias que trabaja el colaborador (1 = tiempo completo)
  const fac = (col) => (col.factor === undefined ? 1 : Number(col.factor) || 0);
  const elegibles = colaboradores.filter((col) => esElegible(col, c));

  let detalle;
  if (tipo === 'mensual') {
    // La bolsa se reparte entre los elegibles, proporcional a sus dias (factor)
    const sumaFac = elegibles.reduce((s, col) => s + fac(col), 0);
    detalle = colaboradores.map((col) => ({
      ...col,
      elegible: esElegible(col, c),
      bono: esElegible(col, c) && sumaFac > 0 ? montoBase * (fac(col) / sumaFac) : 0,
    }));
  } else {
    // Semanal: cada elegible recibe el bono (% de la venta) ajustado a sus dias
    detalle = colaboradores.map((col) => ({
      ...col,
      elegible: esElegible(col, c),
      bono: esElegible(col, c) ? montoBase * fac(col) : 0,
    }));
  }

  const totalPagar = detalle.reduce((s, d) => s + d.bono, 0);

  return {
    avance: frac,
    porcentaje,
    montoBase,
    bolsa: tipo === 'mensual' ? montoBase : montoBase * elegibles.length,
    totalPagar,
    elegibles: elegibles.length,
    detalle,
  };
}

// ---- Config por defecto (coincide con la tabla config) ----
export const DEFAULT_CONFIG = {
  bono_sem_r1_min: 0.70, bono_sem_r1_pct: 0.005,
  bono_sem_r2_min: 0.90, bono_sem_r2_pct: 0.007,
  bono_sem_r3_min: 1.00, bono_sem_r3_pct: 0.01,
  bono_mes_r1_min: 0.90, bono_mes_r1_pct: 0.007,
  bono_mes_r2_min: 1.00, bono_mes_r2_pct: 0.01,
  limite_faltas: 1, limite_retardos: 3,
};

// ============================================================
//  SEMANAS DE CALENDARIO (LUNES A DOMINGO) DENTRO DE UN MES
//  La semana 1 va del dia 1 hasta el primer domingo.
//  Las semanas siguientes son bloques lunes-domingo.
//  La ultima semana puede quedar incompleta (termina con el mes).
// ============================================================

const _pad = n => String(n).padStart(2, '0');

// Numero de semana del mes (1..6) al que pertenece una fecha (lunes-domingo).
export function semanaDelMes(fechaISO) {
  const d = new Date(fechaISO + 'T00:00:00');
  const dia = d.getDate();
  const primero = new Date(d.getFullYear(), d.getMonth(), 1);
  let dow1 = primero.getDay();      // 0=domingo .. 6=sabado
  dow1 = (dow1 + 6) % 7;            // 0=lunes .. 6=domingo
  return Math.ceil((dia + dow1) / 7);
}

// Devuelve la lista de semanas del mes con su rango de dias y cuantos dias tiene
// cada una. mes va de 1..12.
//  -> [{ semana, inicio, fin, numDias }]
export function semanasDelMes(anio, mes) {
  const totalDias = new Date(anio, mes, 0).getDate();
  const mapa = {};
  for (let d = 1; d <= totalDias; d++) {
    const w = semanaDelMes(`${anio}-${_pad(mes)}-${_pad(d)}`);
    if (!mapa[w]) mapa[w] = { semana: w, inicio: d, fin: d, numDias: 0 };
    mapa[w].fin = d;
    mapa[w].numDias += 1;
  }
  return Object.values(mapa).sort((a, b) => a.semana - b.semana);
}

// ============================================================
//  SEMANAS NATURALES (lunes a domingo COMPLETAS, aunque crucen de mes)
//  Para el calculo de bonos. Cada semana pertenece al mes donde CIERRA
//  (su domingo). La meta de la semana se arma dia por dia con la parte
//  proporcional de la meta mensual del mes de cada dia.
// ============================================================

function _fmt(d) {
  return `${d.getFullYear()}-${_pad(d.getMonth() + 1)}-${_pad(d.getDate())}`;
}
export function sumarDias(fechaISO, n) {
  const d = new Date(fechaISO + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return _fmt(d);
}
export function diasEnMes(anio, mes) {
  return new Date(anio, mes, 0).getDate();
}

// Lunes (inicio) de la semana natural a la que pertenece una fecha.
export function lunesISO(fechaISO) {
  const d = new Date(fechaISO + 'T00:00:00');
  const off = (d.getDay() + 6) % 7; // 0=lunes .. 6=domingo
  d.setDate(d.getDate() - off);
  return _fmt(d);
}

// Semanas naturales (lun-dom) que TOCAN el mes dado (tienen al menos 1 dia en el).
// Para cada una indica cuantos de sus 7 dias caen en el mes -> para pagar la
// parte proporcional del bono en ese mes.
//  -> [{ inicioISO, finISO, diasEnMesSel }]
export function semanasNaturalesQueTocan(anio, mes) {
  const total = diasEnMes(anio, mes);
  const inicios = {};
  for (let d = 1; d <= total; d++) {
    inicios[lunesISO(`${anio}-${_pad(mes)}-${_pad(d)}`)] = true;
  }
  return Object.keys(inicios).sort().map(inicioISO => {
    const finISO = sumarDias(inicioISO, 6);
    let diasEnMesSel = 0;
    for (let i = 0; i < 7; i++) {
      const f = sumarDias(inicioISO, i);
      if (Number(f.slice(0, 4)) === anio && Number(f.slice(5, 7)) === mes) diasEnMesSel++;
    }
    return { inicioISO, finISO, diasEnMesSel };
  });
}

// Meta de una semana natural: suma, por cada uno de sus 7 dias, la parte
// proporcional de la meta mensual del mes de ese dia.
//  metasPorMes: { 'anio-mes': metaMensual }
export function metaSemanaNatural(inicioISO, metasPorMes) {
  let t = 0;
  for (let i = 0; i < 7; i++) {
    const f = sumarDias(inicioISO, i);
    const y = Number(f.slice(0, 4)), m = Number(f.slice(5, 7));
    const meta = Number(metasPorMes[`${y}-${m}`] || 0);
    const dm = diasEnMes(y, m);
    if (dm > 0) t += meta / dm;
  }
  return t;
}

// Meta efectiva de una semana: la meta capturada se ajusta a los dias reales
// que la semana tiene dentro del mes (meta * numDias / 7). Semanas completas
// (7 dias) no cambian; semanas partidas se reducen proporcionalmente.
export function metaEfectivaSemana(metaSemanal, numDias) {
  return Number(metaSemanal || 0) * (Number(numDias || 0) / 7);
}

// Meta semanal EFECTIVA para bonos/avance.
//  - Si hay meta semanal capturada a mano (> 0), se usa esa (ajustada si es
//    semana partida).
//  - Si no, se reparte la meta MENSUAL entre las semanas segun sus dias
//    (meta_mensual * numDiasSemana / diasMes). Asi los bonos se calculan solos
//    con solo capturar la meta del mes.
export function metaSemanalEfectiva({ metaSemanalManual, metaMensual, numDiasSemana, diasMes }) {
  const manual = Number(metaSemanalManual || 0);
  if (manual > 0) {
    return Number(numDiasSemana) < 7 ? metaEfectivaSemana(manual, numDiasSemana) : manual;
  }
  if (!diasMes) return 0;
  return Number(metaMensual || 0) * (Number(numDiasSemana || 0) / Number(diasMes));
}

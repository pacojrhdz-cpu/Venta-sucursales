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
  const elegibles = colaboradores.filter((col) => esElegible(col, c));

  let detalle;
  if (tipo === 'mensual') {
    // La bolsa se reparte en partes iguales entre los elegibles
    const porPersona = elegibles.length > 0 ? montoBase / elegibles.length : 0;
    detalle = colaboradores.map((col) => ({
      ...col,
      elegible: esElegible(col, c),
      bono: esElegible(col, c) ? porPersona : 0,
    }));
  } else {
    // Semanal: cada elegible recibe el bono completo (% de la venta)
    detalle = colaboradores.map((col) => ({
      ...col,
      elegible: esElegible(col, c),
      bono: esElegible(col, c) ? montoBase : 0,
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

// ---- Utilidad: numero de semana del mes (1..6) para una fecha ----
export function semanaDelMes(fechaISO) {
  const d = new Date(fechaISO + 'T00:00:00');
  const dia = d.getDate();
  return Math.ceil(dia / 7);
}

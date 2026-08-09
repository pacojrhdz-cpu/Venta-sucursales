'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSucursales, useConfig } from '../../lib/hooks';
import { SelSucursal, SelMes, SelAnio } from '../../components/Selectores';
import { mxn, pct, avance, calcularBono, semanasNaturalesQueTocan, metaSemanaNatural, diasEnMes } from '../../lib/calculos';
import { MESES } from '../../lib/fechas';

const HOY = new Date();
const MESABR = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function etiqueta(iso){ const d=Number(iso.slice(8,10)), m=Number(iso.slice(5,7)); return `${d} ${MESABR[m-1]}`; }

export default function Bonos() {
  const { sucursales } = useSucursales();
  const { config } = useConfig();
  const [suc, setSuc] = useState('');
  const [anio, setAnio] = useState(HOY.getFullYear());
  const [mes, setMes] = useState(HOY.getMonth() + 1);
  const [ventas, setVentas] = useState([]);
  const [colabs, setColabs] = useState([]);
  const [inc, setInc] = useState([]);
  const [metasPorMes, setMetasPorMes] = useState({});

  // Semanas naturales (lun-dom) que TOCAN el mes, con cuántos días caen en él.
  const semanas = semanasNaturalesQueTocan(anio, mes);

  useEffect(() => { if (sucursales.length && !suc) setSuc(sucursales[0].id); }, [sucursales]);
  useEffect(() => { if (suc) cargar(); }, [suc, anio, mes]);

  async function cargar() {
    // Rango: del lunes de la primera semana al domingo de la última (cubre meses vecinos)
    const desde = semanas.length ? semanas[0].inicioISO : `${anio}-${String(mes).padStart(2,'0')}-01`;
    const hasta = semanas.length ? semanas[semanas.length-1].finISO
                                 : `${anio}-${String(mes).padStart(2,'0')}-${String(diasEnMes(anio,mes)).padStart(2,'0')}`;

    const { data: v } = await supabase.from('ventas_diarias').select('fecha,efectivo,tarjeta,plataforma')
      .eq('sucursal_id',suc).gte('fecha',desde).lte('fecha',hasta);
    setVentas(v||[]);
    const { data: c } = await supabase.from('colaboradores').select('*').eq('sucursal_id',suc).eq('activo',true).order('nombre');
    setColabs(c||[]);
    const ids = (c||[]).map(x=>x.id);
    let incid = [];
    if (ids.length) {
      const { data: a } = await supabase.from('asistencia').select('*')
        .in('colaborador_id',ids).gte('fecha',desde).lte('fecha',hasta).neq('estatus','presente');
      incid = a||[];
    }
    setInc(incid);
    // Todas las metas mensuales de la sucursal (para armar metas de semanas que cruzan meses)
    const { data: obj } = await supabase.from('objetivos').select('anio,mes,meta_mensual').eq('sucursal_id',suc);
    const mp={}; (obj||[]).forEach(o=>{ mp[`${o.anio}-${o.mes}`]=Number(o.meta_mensual||0); }); setMetasPorMes(mp);
  }

  const ventaEntre = (a,b) => ventas.filter(v=>v.fecha>=a && v.fecha<=b)
    .reduce((s,v)=>s+Number(v.efectivo||0)+Number(v.tarjeta||0)+Number(v.plataforma||0),0);

  // Referencia de jornada completa = el que mas dias trabaja del equipo
  const refDias = colabs.length ? Math.max(...colabs.map(c=>Number(c.dias_semana||6))) : 6;
  function colabsEntre(a,b){
    return colabs.map(c=>{
      const dias = Number(c.dias_semana||6);
      return {
        id:c.id, nombre:c.nombre, dias,
        factor: refDias>0 ? Math.min(1, dias/refDias) : 1,
        faltas: inc.filter(i=>i.colaborador_id===c.id && i.estatus==='falta' && i.fecha>=a && i.fecha<=b).length,
        retardos: inc.filter(i=>i.colaborador_id===c.id && i.estatus==='retardo' && i.fecha>=a && i.fecha<=b).length,
      };
    });
  }

  // Bono mensual (mes calendario completo)
  const pmes = `${anio}-${String(mes).padStart(2,'0')}`;
  const ventaMes = ventas.filter(v=>v.fecha.startsWith(pmes))
    .reduce((s,v)=>s+Number(v.efectivo||0)+Number(v.tarjeta||0)+Number(v.plataforma||0),0);
  const metaMes = Number(metasPorMes[`${anio}-${mes}`]||0);

  // Metas para el cálculo semanal: si un mes vecino no tiene meta capturada,
  // usa la del mes seleccionado (evita metas bajas en la semana que cruza de mes).
  const prev = mes===1 ? {a:anio-1,m:12} : {a:anio,m:mes-1};
  const next = mes===12 ? {a:anio+1,m:1} : {a:anio,m:mes+1};
  const metasCalc = { ...metasPorMes };
  [`${prev.a}-${prev.m}`, `${next.a}-${next.m}`, `${anio}-${mes}`].forEach(k=>{
    if (!metasCalc[k]) metasCalc[k] = metaMes;
  });
  const finMes = `${pmes}-${String(diasEnMes(anio,mes)).padStart(2,'0')}`;
  const iniMes = `${pmes}-01`;
  const bonoMensual = calcularBono({
    ventaPeriodo: ventaMes, meta: metaMes, tipo:'mensual', cfg: config,
    colaboradores: colabsEntre(iniMes, finMes),
  });

  return (
    <>
      <div className="topbar"><h1>🏆 Bonos</h1></div>
      <div className="card" style={{marginBottom:18}}>
        <div className="row">
          <SelSucursal sucursales={sucursales} value={suc} onChange={setSuc} />
          <SelAnio value={anio} onChange={setAnio} />
          <SelMes value={mes} onChange={setMes} />
        </div>
      </div>

      <p className="section-title">Bono semanal · semana natural (lun–dom); si cruza de mes, se paga la parte proporcional de cada mes</p>
      {semanas.length===0 && <div className="card muted">Aún no hay semanas para este mes.</div>}
      {semanas.map((sem,idx)=>{
        const venta = ventaEntre(sem.inicioISO, sem.finISO);
        const meta = metaSemanaNatural(sem.inicioISO, metasCalc);
        const cruzaMes = sem.diasEnMesSel < 7;
        const fracMes = sem.diasEnMesSel / 7; // proporción que se paga en este mes
        const b = calcularBono({ ventaPeriodo:venta, meta, tipo:'semanal', cfg:config,
          colaboradores: colabsEntre(sem.inicioISO, sem.finISO) });
        const totalMesSem = b.totalPagar * fracMes;
        return (
          <div className="card" key={idx} style={{marginBottom:14}}>
            <div className="row" style={{justifyContent:'space-between'}}>
              <h2 style={{margin:0}}>Semana {idx+1} <span className="hint">({etiqueta(sem.inicioISO)} – {etiqueta(sem.finISO)}{cruzaMes?` · ${sem.diasEnMesSel} de 7 días en ${MESES[mes-1]}`:''})</span></h2>
              <div className="muted">Venta {mxn(venta)} · Meta {mxn(meta)} ·
                Avance <b className={b.avance>=1?'up':''}>{meta>0?pct(b.avance):'—'}</b> ·
                Paga <b>{pct(b.porcentaje)}</b>{cruzaMes && <span className="hint"> · este mes paga {sem.diasEnMesSel}/7</span>}</div>
            </div>
            <table style={{marginTop:10}}>
              <thead><tr><th>Colaborador</th><th className="num">Días/sem</th><th className="num">Faltas</th><th className="num">Retardos</th><th>Estado</th>
                {cruzaMes && <th className="num">Bono semana</th>}<th className="num">A pagar {MESES[mes-1]}</th></tr></thead>
              <tbody>
                {b.detalle.map(d=>(
                  <tr key={d.id}><td>{d.nombre}</td><td className="num">{d.dias}</td><td className="num">{d.faltas}</td><td className="num">{d.retardos}</td>
                    <td>{d.elegible?<span className="tag g">Elegible</span>:<span className="tag r">Sin bono</span>}</td>
                    {cruzaMes && <td className="num muted">{mxn(d.bono)}</td>}
                    <td className="num"><b>{mxn(d.bono*fracMes)}</b></td></tr>
                ))}
                {b.detalle.length===0 && <tr><td colSpan={cruzaMes?7:6} className="muted">Sin colaboradores.</td></tr>}
              </tbody>
              <tfoot><tr><td colSpan={cruzaMes?6:5}><b>Total a pagar en {MESES[mes-1]} (semana {idx+1})</b></td><td className="num"><b>{mxn(totalMesSem)}</b></td></tr></tfoot>
            </table>
          </div>
        );
      })}

      <p className="section-title">Bono mensual · la bolsa se reparte entre elegibles, proporcional a sus días</p>
      <div className="card">
        <div className="row" style={{justifyContent:'space-between'}}>
          <h2 style={{margin:0}}>Mes completo ({MESES[mes-1]})</h2>
          <div className="muted">Venta {mxn(ventaMes)} · Meta {mxn(metaMes)} ·
            Avance <b className={bonoMensual.avance>=1?'up':''}>{metaMes>0?pct(bonoMensual.avance):'—'}</b> ·
            Paga <b>{pct(bonoMensual.porcentaje)}</b> · Bolsa <b>{mxn(bonoMensual.montoBase)}</b></div>
        </div>
        <table style={{marginTop:10}}>
          <thead><tr><th>Colaborador</th><th className="num">Días/sem</th><th className="num">Faltas</th><th className="num">Retardos</th><th>Estado</th><th className="num">Bono</th></tr></thead>
          <tbody>
            {bonoMensual.detalle.map(d=>(
              <tr key={d.id}><td>{d.nombre}</td><td className="num">{d.dias}</td><td className="num">{d.faltas}</td><td className="num">{d.retardos}</td>
                <td>{d.elegible?<span className="tag g">Elegible</span>:<span className="tag r">Sin bono</span>}</td>
                <td className="num"><b>{mxn(d.bono)}</b></td></tr>
            ))}
            {bonoMensual.detalle.length===0 && <tr><td colSpan={6} className="muted">Sin colaboradores.</td></tr>}
          </tbody>
          <tfoot><tr><td colSpan={5}><b>Total a pagar mensual</b></td><td className="num"><b>{mxn(bonoMensual.totalPagar)}</b></td></tr></tfoot>
        </table>
      </div>
    </>
  );
}

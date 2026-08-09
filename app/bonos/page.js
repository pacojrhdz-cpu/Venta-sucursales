'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSucursales, useConfig } from '../../lib/hooks';
import { SelSucursal, SelMes, SelAnio } from '../../components/Selectores';
import { mxn, pct, avance, calcularBono, semanasNaturalesQueTocan, diasEnMes } from '../../lib/calculos';
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
  const [metaMes, setMetaMes] = useState(0);

  // Semanas naturales (lun-dom) que TOCAN el mes, con cuántos días caen en él.
  const semanas = semanasNaturalesQueTocan(anio, mes);
  const ndMes = diasEnMes(anio, mes);
  const pmes = `${anio}-${String(mes).padStart(2,'0')}`;
  const iniMesISO = `${pmes}-01`;
  const finMesISO = `${pmes}-${String(ndMes).padStart(2,'0')}`;
  const metaDiaria = ndMes>0 ? metaMes/ndMes : 0;

  useEffect(() => { if (sucursales.length && !suc) setSuc(sucursales[0].id); }, [sucursales]);
  useEffect(() => { if (suc) cargar(); }, [suc, anio, mes]);

  async function cargar() {
    const desde = semanas.length ? semanas[0].inicioISO : iniMesISO;
    const hasta = semanas.length ? semanas[semanas.length-1].finISO : finMesISO;
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
    const { data: om } = await supabase.from('objetivos').select('meta_mensual')
      .eq('sucursal_id',suc).eq('anio',anio).eq('mes',mes).maybeSingle();
    setMetaMes(Number(om?.meta_mensual||0));
  }

  const ventaEntre = (a,b) => ventas.filter(v=>v.fecha>=a && v.fecha<=b)
    .reduce((s,v)=>s+Number(v.efectivo||0)+Number(v.tarjeta||0)+Number(v.plataforma||0),0);

  // Referencia de jornada completa = el que mas dias trabaja del equipo
  const refDias = colabs.length ? Math.max(...colabs.map(c=>Number(c.dias_semana||6))) : 6;
  // El factor se mide contra los dias del periodo evaluado (periodDias). Si el
  // periodo es corto (ej. fin de semana de 2 dias), quien trabaja >= esos dias
  // recibe el bono completo. En una semana completa se prorratea.
  function colabsEntre(a, b, periodDias){
    // El proporcional se calcula sobre los DÍAS DEL PERIODO (7 en semana completa,
    // 2 en un fin de semana, etc.). Se topa en 1 (nadie cobra más del 100%).
    const denom = (periodDias && periodDias > 0) ? periodDias : refDias;
    return colabs.map(c=>{
      const dias = Number(c.dias_semana||6);
      return {
        id:c.id, nombre:c.nombre, dias,
        factor: Math.min(1, dias/denom),
        faltas: inc.filter(i=>i.colaborador_id===c.id && i.estatus==='falta' && i.fecha>=a && i.fecha<=b).length,
        retardos: inc.filter(i=>i.colaborador_id===c.id && i.estatus==='retardo' && i.fecha>=a && i.fecha<=b).length,
      };
    });
  }

  // Bono mensual (mes calendario completo)
  const ventaMes = ventaEntre(iniMesISO, finMesISO);
  const bonoMensual = calcularBono({
    ventaPeriodo: ventaMes, meta: metaMes, tipo:'mensual', cfg: config,
    colaboradores: colabsEntre(iniMesISO, finMesISO, ndMes),
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

      <p className="section-title">Bono semanal · cada mes evalúa sus propios días de la semana contra su objetivo proporcional</p>
      {semanas.length===0 && <div className="card muted">Aún no hay semanas para este mes.</div>}
      {semanas.map((sem,idx)=>{
        // Solo la parte de la semana que cae en el mes seleccionado
        const start = sem.inicioISO > iniMesISO ? sem.inicioISO : iniMesISO;
        const end   = sem.finISO   < finMesISO ? sem.finISO   : finMesISO;
        const venta = ventaEntre(start, end);
        const meta  = sem.diasEnMesSel * metaDiaria;   // objetivo proporcional a los días en este mes
        const cruzaMes = sem.diasEnMesSel < 7;
        const b = calcularBono({ ventaPeriodo:venta, meta, tipo:'semanal', cfg:config,
          colaboradores: colabsEntre(start, end, sem.diasEnMesSel) });
        return (
          <div className="card" key={idx} style={{marginBottom:14}}>
            <div className="row" style={{justifyContent:'space-between'}}>
              <h2 style={{margin:0}}>Semana {idx+1} <span className="hint">({etiqueta(sem.inicioISO)} – {etiqueta(sem.finISO)}{cruzaMes?` · ${sem.diasEnMesSel} de 7 días en ${MESES[mes-1]}`:''})</span></h2>
              <div className="muted">Venta {mxn(venta)} · Meta {mxn(meta)}
                {cruzaMes && <span className="hint"> ({sem.diasEnMesSel} días)</span>} ·
                Avance <b className={b.avance>=1?'up':''}>{meta>0?pct(b.avance):'—'}</b> ·
                Paga <b>{pct(b.porcentaje)}</b></div>
            </div>
            {cruzaMes && <p className="hint" style={{marginTop:6}}>El resto de esta semana ({7-sem.diasEnMesSel} días) se paga en el otro mes.</p>}
            <table style={{marginTop:10}}>
              <thead><tr><th>Colaborador</th><th className="num">Días/sem</th><th className="num">Faltas</th><th className="num">Retardos</th><th>Estado</th><th className="num">Bono</th></tr></thead>
              <tbody>
                {b.detalle.map(d=>(
                  <tr key={d.id}><td>{d.nombre}</td><td className="num">{d.dias}</td><td className="num">{d.faltas}</td><td className="num">{d.retardos}</td>
                    <td>{d.elegible?<span className="tag g">Elegible</span>:<span className="tag r">Sin bono</span>}</td>
                    <td className="num"><b>{mxn(d.bono)}</b></td></tr>
                ))}
                {b.detalle.length===0 && <tr><td colSpan={6} className="muted">Sin colaboradores.</td></tr>}
              </tbody>
              <tfoot><tr><td colSpan={5}><b>Total a pagar semana {idx+1}</b></td><td className="num"><b>{mxn(b.totalPagar)}</b></td></tr></tfoot>
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

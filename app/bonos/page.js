'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSucursales, useConfig } from '../../lib/hooks';
import { SelSucursal, SelMes, SelAnio } from '../../components/Selectores';
import { mxn, pct, calcularBono, semanasNaturalesQueTocan, diasEnMes } from '../../lib/calculos';
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
  const [metaMes, setMetaMes] = useState(0);
  const [registros, setRegistros] = useState({}); // "colabId|fechaInicio" -> {dias, retardos}

  const semanas = semanasNaturalesQueTocan(anio, mes);
  const ndMes = diasEnMes(anio, mes);
  const pmes = `${anio}-${String(mes).padStart(2,'0')}`;
  const iniMesISO = `${pmes}-01`;
  const finMesISO = `${pmes}-${String(ndMes).padStart(2,'0')}`;
  const metaDiaria = ndMes>0 ? metaMes/ndMes : 0;
  const limRet = Number(config.limite_retardos ?? 3);

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
    if (ids.length) {
      const { data: dt } = await supabase.from('dias_trabajados').select('*')
        .in('colaborador_id',ids).gte('fecha_inicio',iniMesISO).lte('fecha_inicio',finMesISO);
      const mp={}; (dt||[]).forEach(r=>{ mp[`${r.colaborador_id}|${r.fecha_inicio}`]={dias:r.dias, retardos:r.retardos}; });
      setRegistros(mp);
    } else setRegistros({});
    const { data: om } = await supabase.from('objetivos').select('meta_mensual')
      .eq('sucursal_id',suc).eq('anio',anio).eq('mes',mes).maybeSingle();
    setMetaMes(Number(om?.meta_mensual||0));
  }

  const ventaEntre = (a,b) => ventas.filter(v=>v.fecha>=a && v.fecha<=b)
    .reduce((s,v)=>s+Number(v.efectivo||0)+Number(v.tarjeta||0)+Number(v.plataforma||0),0);

  const k = (cid,start) => `${cid}|${start}`;
  const diasDe = (cid,start,fragDays) => {
    const r = registros[k(cid,start)];
    const v = r?.dias;
    return (v===undefined || v===null || v==='') ? fragDays : Number(v);
  };
  const retDe = (cid,start) => Number(registros[k(cid,start)]?.retardos || 0);

  function setCampo(cid, start, campo, valor) {
    setRegistros(prev => ({ ...prev, [k(cid,start)]: { ...(prev[k(cid,start)]||{}), [campo]: valor } }));
  }
  async function guardar(cid, start, fragDays) {
    const r = registros[k(cid,start)] || {};
    const dias = (r.dias===undefined || r.dias==='') ? fragDays : Number(r.dias);
    const retardos = Number(r.retardos||0);
    await supabase.from('dias_trabajados').upsert(
      { colaborador_id: cid, fecha_inicio: start, dias, retardos, actualizado_en: new Date().toISOString() },
      { onConflict: 'colaborador_id,fecha_inicio' });
  }

  // ---- Bono mensual: peso = suma de días trabajados en los tramos del mes ----
  const tramos = semanas.map(sem => {
    const start = sem.inicioISO > iniMesISO ? sem.inicioISO : iniMesISO;
    const end   = sem.finISO   < finMesISO ? sem.finISO   : finMesISO;
    return { ...sem, start, end, fragDays: sem.diasEnMesSel };
  });
  const ventaMes = ventaEntre(iniMesISO, finMesISO);
  const pesoMes = c => tramos.reduce((s,t)=>s + diasDe(c.id, t.start, t.fragDays), 0);
  const bonoMensual = calcularBono({
    ventaPeriodo: ventaMes, meta: metaMes, tipo:'mensual', cfg: config,
    colaboradores: colabs.map(c=>({ id:c.id, nombre:c.nombre, diasMes:pesoMes(c), faltas:0, retardos:0, factor:pesoMes(c) })),
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

      <p className="section-title">Bono semanal · captura los días que trabajó cada quien; el bono es proporcional a los días del periodo</p>
      {semanas.length===0 && <div className="card muted">Aún no hay semanas para este mes.</div>}
      {tramos.map((t,idx)=>{
        const venta = ventaEntre(t.start, t.end);
        const meta  = t.fragDays * metaDiaria;
        const cruzaMes = t.diasEnMesSel < 7;
        const colsB = colabs.map(c=>{
          const dias = diasDe(c.id, t.start, t.fragDays);
          const retardos = retDe(c.id, t.start);
          return { id:c.id, nombre:c.nombre, retardos, faltas:0,
            factor: t.fragDays>0 ? Math.min(1, dias/t.fragDays) : 1 };
        });
        const b = calcularBono({ ventaPeriodo:venta, meta, tipo:'semanal', cfg:config, colaboradores: colsB });
        const bonoDe = id => b.detalle.find(d=>d.id===id) || {};
        return (
          <div className="card" key={idx} style={{marginBottom:14}}>
            <div className="row" style={{justifyContent:'space-between'}}>
              <h2 style={{margin:0}}>Semana {idx+1} <span className="hint">({etiqueta(t.inicioISO)} – {etiqueta(t.finISO)}{cruzaMes?` · ${t.diasEnMesSel} de 7 días en ${MESES[mes-1]}`:''})</span></h2>
              <div className="muted">Venta {mxn(venta)} · Meta {mxn(meta)} ({t.fragDays} días) ·
                Avance <b className={b.avance>=1?'up':''}>{meta>0?pct(b.avance):'—'}</b> · Paga <b>{pct(b.porcentaje)}</b></div>
            </div>
            {cruzaMes && <p className="hint" style={{marginTop:6}}>El resto de esta semana ({7-t.diasEnMesSel} días) se paga en el otro mes.</p>}
            <table style={{marginTop:10}}>
              <thead><tr><th>Colaborador</th><th className="num">Días trab. (de {t.fragDays})</th><th className="num">Retardos</th><th>Estado</th><th className="num">Bono</th></tr></thead>
              <tbody>
                {colabs.map(c=>{
                  const d = bonoDe(c.id);
                  return (
                    <tr key={c.id}><td>{c.nombre}</td>
                      <td className="num"><input type="number" min="0" max={t.fragDays} style={{width:80,textAlign:'right'}}
                        placeholder={String(t.fragDays)}
                        value={registros[k(c.id,t.start)]?.dias ?? ''}
                        onChange={e=>setCampo(c.id,t.start,'dias',e.target.value)}
                        onBlur={()=>guardar(c.id,t.start,t.fragDays)} /></td>
                      <td className="num"><input type="number" min="0" style={{width:70,textAlign:'right'}}
                        placeholder="0"
                        value={registros[k(c.id,t.start)]?.retardos ?? ''}
                        onChange={e=>setCampo(c.id,t.start,'retardos',e.target.value)}
                        onBlur={()=>guardar(c.id,t.start,t.fragDays)} /></td>
                      <td>{d.elegible?<span className="tag g">Elegible</span>:<span className="tag r">Sin bono{retDe(c.id,t.start)>limRet?' (retardos)':''}</span>}</td>
                      <td className="num"><b>{mxn(d.bono||0)}</b></td></tr>
                  );
                })}
                {colabs.length===0 && <tr><td colSpan={5} className="muted">Sin colaboradores.</td></tr>}
              </tbody>
              <tfoot><tr><td colSpan={4}><b>Total a pagar semana {idx+1}</b></td><td className="num"><b>{mxn(b.totalPagar)}</b></td></tr></tfoot>
            </table>
          </div>
        );
      })}

      <p className="section-title">Bono mensual · la bolsa se reparte entre elegibles, proporcional a sus días trabajados en el mes</p>
      <div className="card">
        <div className="row" style={{justifyContent:'space-between'}}>
          <h2 style={{margin:0}}>Mes completo ({MESES[mes-1]})</h2>
          <div className="muted">Venta {mxn(ventaMes)} · Meta {mxn(metaMes)} ·
            Avance <b className={bonoMensual.avance>=1?'up':''}>{metaMes>0?pct(bonoMensual.avance):'—'}</b> ·
            Paga <b>{pct(bonoMensual.porcentaje)}</b> · Bolsa <b>{mxn(bonoMensual.montoBase)}</b></div>
        </div>
        <table style={{marginTop:10}}>
          <thead><tr><th>Colaborador</th><th className="num">Días trab. (mes)</th><th>Estado</th><th className="num">Bono</th></tr></thead>
          <tbody>
            {bonoMensual.detalle.map(d=>(
              <tr key={d.id}><td>{d.nombre}</td><td className="num">{d.diasMes}</td>
                <td>{d.elegible?<span className="tag g">Elegible</span>:<span className="tag n">—</span>}</td>
                <td className="num"><b>{mxn(d.bono)}</b></td></tr>
            ))}
            {bonoMensual.detalle.length===0 && <tr><td colSpan={4} className="muted">Sin colaboradores.</td></tr>}
          </tbody>
          <tfoot><tr><td colSpan={3}><b>Total a pagar mensual</b></td><td className="num"><b>{mxn(bonoMensual.totalPagar)}</b></td></tr></tfoot>
        </table>
      </div>
    </>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSucursales, useConfig } from '../../lib/hooks';
import { SelSucursal, SelMes, SelAnio } from '../../components/Selectores';
import { mxn, calcularBono, semanasNaturalesQueTocan, diasEnMes, ventaBruta, sueldoEfectivoSemana } from '../../lib/calculos';
import { MESES } from '../../lib/fechas';

const HOY = new Date();
const MESABR = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function etiqueta(iso){ const d=Number(iso.slice(8,10)), m=Number(iso.slice(5,7)); return `${d} ${MESABR[m-1]}`; }

export default function Nomina() {
  const { sucursales } = useSucursales();
  const { config } = useConfig();
  const [suc, setSuc] = useState('');
  const [anio, setAnio] = useState(HOY.getFullYear());
  const [mes, setMes] = useState(HOY.getMonth() + 1);
  const [semIdx, setSemIdx] = useState(0);
  const [ventas, setVentas] = useState([]);
  const [colabs, setColabs] = useState([]);
  const [registros, setRegistros] = useState({});   // días trabajados
  const [metaMes, setMetaMes] = useState(0);
  const [deducs, setDeducs] = useState([]);
  const [ded, setDed] = useState({ colaborador_id:'', concepto:'', monto:'' });
  const [regMes, setRegMes] = useState({});          // cid|start -> {sueldo, metodo}
  const [sueldoInp, setSueldoInp] = useState({});    // cid -> sueldo de la semana actual
  const [metodoInp, setMetodoInp] = useState({});    // cid -> metodo de la semana actual

  const ndMes = diasEnMes(anio, mes);
  const pmes = `${anio}-${String(mes).padStart(2,'0')}`;
  const iniMesISO = `${pmes}-01`;
  const finMesISO = `${pmes}-${String(ndMes).padStart(2,'0')}`;
  const metaDiaria = ndMes>0 ? metaMes/ndMes : 0;

  const tramos = semanasNaturalesQueTocan(anio, mes).map(sem => ({
    ...sem,
    start: sem.inicioISO > iniMesISO ? sem.inicioISO : iniMesISO,
    end:   sem.finISO   < finMesISO ? sem.finISO   : finMesISO,
    fragDays: sem.diasEnMesSel,
  }));
  const t = tramos[semIdx] || tramos[0];

  useEffect(() => { if (sucursales.length && !suc) setSuc(sucursales[0].id); }, [sucursales]);
  useEffect(() => { if (suc) cargar(); }, [suc, anio, mes]);
  useEffect(() => { if (suc && t) cargarDeducs(); }, [suc, t?.start]);
  useEffect(() => {
    if (tramos.length && anio===HOY.getFullYear() && mes===(HOY.getMonth()+1)) {
      const hoyISO = `${pmes}-${String(HOY.getDate()).padStart(2,'0')}`;
      const i = tramos.findIndex(x => hoyISO>=x.start && hoyISO<=x.end);
      if (i>=0) setSemIdx(i);
    }
  }, [mes, anio, suc]);
  // Prellenar sueldo y método de la semana seleccionada
  useEffect(() => {
    const s={}, m={};
    colabs.forEach(c=>{
      s[c.id] = sueldoEfectivoSemana(c.id, semIdx, tramos, regMes, c.sueldo);
      m[c.id] = regMes[`${c.id}|${t?.start}`]?.metodo || 'efectivo';
    });
    setSueldoInp(s); setMetodoInp(m);
  }, [semIdx, colabs, regMes]);

  async function cargar() {
    const desde = tramos.length ? tramos[0].inicioISO : iniMesISO;
    const hasta = tramos.length ? tramos[tramos.length-1].finISO : finMesISO;
    const { data: v } = await supabase.from('ventas_diarias').select('fecha,efectivo,tarjeta_debito,tarjeta_credito,tarjeta_otras,plataforma')
      .eq('sucursal_id',suc).gte('fecha',desde).lte('fecha',hasta);
    setVentas(v||[]);
    const { data: c } = await supabase.from('colaboradores').select('*').eq('sucursal_id',suc).eq('activo',true).order('nombre');
    setColabs(c||[]);
    const ids = (c||[]).map(x=>x.id);
    if (ids.length) {
      const { data: dt } = await supabase.from('dias_trabajados').select('*')
        .in('colaborador_id',ids).gte('fecha_inicio',iniMesISO).lte('fecha_inicio',finMesISO);
      const mp={}; (dt||[]).forEach(r=>{ mp[`${r.colaborador_id}|${r.fecha_inicio}`]={dias:r.dias, retardos:r.retardos}; }); setRegistros(mp);
      const { data: nm } = await supabase.from('nomina_metodo').select('*')
        .in('colaborador_id',ids).gte('fecha_inicio',iniMesISO).lte('fecha_inicio',finMesISO);
      const mp2={}; (nm||[]).forEach(r=>{ mp2[`${r.colaborador_id}|${r.fecha_inicio}`]={sueldo:r.sueldo, metodo:r.metodo}; }); setRegMes(mp2);
    } else { setRegistros({}); setRegMes({}); }
    const { data: om } = await supabase.from('objetivos').select('meta_mensual').eq('sucursal_id',suc).eq('anio',anio).eq('mes',mes).maybeSingle();
    setMetaMes(Number(om?.meta_mensual||0));
  }
  async function cargarDeducs() {
    if (!t) return;
    const ids = colabs.map(c=>c.id);
    if (!ids.length) { setDeducs([]); return; }
    const { data } = await supabase.from('deducciones').select('*').in('colaborador_id', ids).eq('fecha_inicio', t.start).order('creado_en');
    setDeducs(data||[]);
  }

  // Guarda SOLO la semana actual (fecha_inicio = t.start). No toca otras semanas.
  async function guardarFila(cid, sueldoVal, metodoVal) {
    const sueldo = Number((sueldoVal !== undefined ? sueldoVal : sueldoInp[cid]) || 0);
    const metodo = (metodoVal !== undefined ? metodoVal : metodoInp[cid]) || 'efectivo';
    setRegMes(prev=>({ ...prev, [`${cid}|${t.start}`]: { sueldo, metodo } }));
    await supabase.from('nomina_metodo').upsert(
      { colaborador_id:cid, fecha_inicio:t.start, sueldo, metodo },
      { onConflict:'colaborador_id,fecha_inicio' });
  }
  function setSueldoLocal(cid, val){ setSueldoInp(prev=>({ ...prev, [cid]: val })); }
  async function cambiarMetodo(cid, val){ setMetodoInp(prev=>({ ...prev, [cid]: val })); await guardarFila(cid, undefined, val); }

  async function agregarDed(e){ e.preventDefault();
    if(!ded.colaborador_id || !ded.monto) return;
    await supabase.from('deducciones').insert({ colaborador_id:ded.colaborador_id, fecha_inicio:t.start, concepto:ded.concepto||null, monto:Number(ded.monto) });
    setDed({ colaborador_id:ded.colaborador_id, concepto:'', monto:'' }); cargarDeducs();
  }
  async function borrarDed(id){ await supabase.from('deducciones').delete().eq('id',id); cargarDeducs(); }

  const ventaEntre = (a,b) => ventas.filter(v=>v.fecha>=a && v.fecha<=b).reduce((s,v)=>s+ventaBruta(v),0);
  const diasDe = (cid,start,fragDays) => { const r=registros[`${cid}|${start}`]; const v=r?.dias; return (v===undefined||v===null||v==='')?fragDays:Number(v); };
  const retDe = (cid,start) => Number(registros[`${cid}|${start}`]?.retardos||0);

  // Bono de la semana
  let bono = { detalle: [] };
  if (t) {
    const venta = ventaEntre(t.start, t.end);
    const cols = colabs.map(c=>({ id:c.id, nombre:c.nombre, retardos:retDe(c.id,t.start), faltas:0,
      factor: t.fragDays>0 ? Math.min(1, diasDe(c.id,t.start,t.fragDays)/t.fragDays) : 1 }));
    bono = calcularBono({ ventaPeriodo:venta, meta:t.fragDays*metaDiaria, tipo:'semanal', cfg:config, colaboradores:cols });
  }
  const bonoDe = id => bono.detalle.find(d=>d.id===id)?.bono || 0;
  const dedDe = id => deducs.filter(d=>d.colaborador_id===id).reduce((s,d)=>s+Number(d.monto),0);
  const nombreDe = id => colabs.find(c=>c.id===id)?.nombre || '';

  // Semana partida: solo se paga la parte proporcional del sueldo (días del mes / 7)
  const factor7 = t ? t.fragDays/7 : 1;
  const parcial = t ? t.fragDays < 7 : false;
  const filas = colabs.map(c=>{
    const sueldoSem = Number(sueldoInp[c.id]||0);      // sueldo semanal (rate)
    const sueldo = sueldoSem * factor7;                // proporcional a los días del mes
    const b=bonoDe(c.id), d=dedDe(c.id), metodo=metodoInp[c.id]||'efectivo';
    return { id:c.id, nombre:c.nombre, sueldoSem, sueldo, bono:b, deducciones:d, neto: sueldo+b-d, metodo };
  });
  const tot = filas.reduce((o,f)=>({sueldo:o.sueldo+f.sueldo, bono:o.bono+f.bono, ded:o.ded+f.deducciones, neto:o.neto+f.neto}), {sueldo:0,bono:0,ded:0,neto:0});
  const totEfectivo = filas.filter(f=>f.metodo==='efectivo').reduce((s,f)=>s+f.neto,0);

  return (
    <>
      <div className="topbar"><h1>💰 Nómina semanal</h1>
        <button className="btn no-print" onClick={()=>window.print()}>Descargar / imprimir PDF</button></div>

      <div className="card no-print" style={{marginBottom:18}}>
        <div className="row">
          <SelSucursal sucursales={sucursales} value={suc} onChange={setSuc} />
          <SelAnio value={anio} onChange={setAnio} />
          <SelMes value={mes} onChange={setMes} />
          <div className="field"><label>Semana</label>
            <select value={semIdx} onChange={e=>setSemIdx(Number(e.target.value))}>
              {tramos.map((x,i)=><option key={i} value={i}>Semana {i+1} ({etiqueta(x.start)}–{etiqueta(x.end)})</option>)}
            </select></div>
        </div>
      </div>

      <div className="card" style={{marginBottom:16}}>
        <h2 style={{marginBottom:4}}>Nómina — {sucursales.find(s=>s.id===suc)?.nombre||''}</h2>
        <p className="muted" style={{margin:0}}>{t ? `Semana ${semIdx+1} · ${etiqueta(t.start)} – ${etiqueta(t.end)} · ${MESES[mes-1]} ${anio}` : ''}
          {parcial && <span style={{color:'#fbbf24'}}> · semana partida: solo {t.fragDays} de 7 días son de {MESES[mes-1]}, el sueldo se paga proporcional ({t.fragDays}/7)</span>}</p>
      </div>

      <div className="card" style={{marginBottom:16}}>
        <div style={{overflowX:'auto'}}>
        <table>
          <thead><tr><th>Colaborador</th><th className="num">Sueldo</th><th className="num">Bono</th><th className="num">Deducciones</th><th className="num">Neto a pagar</th><th>Se pagó con</th></tr></thead>
          <tbody>
            {filas.map(f=>(
              <tr key={f.id}><td>{f.nombre}</td>
                <td className="num"><input type="number" style={{width:110,textAlign:'right'}}
                  value={sueldoInp[f.id] ?? ''} placeholder="0"
                  onChange={e=>setSueldoLocal(f.id, e.target.value)}
                  onBlur={e=>guardarFila(f.id, e.target.value)} />
                  {parcial && <div className="hint">× {t.fragDays}/7 = {mxn(f.sueldo)}</div>}</td>
                <td className="num up">{mxn(f.bono)}</td>
                <td className="num down">{f.deducciones>0?'−'+mxn(f.deducciones):'—'}</td>
                <td className="num"><b>{mxn(f.neto)}</b></td>
                <td><select value={f.metodo} onChange={e=>cambiarMetodo(f.id, e.target.value)}>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="tarjeta">Tarjeta</option>
                </select></td></tr>
            ))}
            {filas.length===0 && <tr><td colSpan={6} className="muted">Sin colaboradores.</td></tr>}
          </tbody>
          <tfoot><tr style={{borderTop:'2px solid var(--line)'}}>
            <td><b>TOTAL</b></td>
            <td className="num"><b>{mxn(tot.sueldo)}</b></td>
            <td className="num"><b>{mxn(tot.bono)}</b></td>
            <td className="num"><b>−{mxn(tot.ded)}</b></td>
            <td className="num"><b>{mxn(tot.neto)}</b></td>
            <td className="muted">Efectivo: {mxn(totEfectivo)}</td>
          </tr></tfoot>
        </table>
        </div>
        <p className="hint">El sueldo es <b>independiente por semana</b>: cada semana arranca con el sueldo base y editar una <b>no</b> afecta a las demás. Lo pagado en efectivo sale de caja y se resta en el Reporte semanal. Nómina en efectivo esta semana: <b>{mxn(totEfectivo)}</b>.</p>
      </div>

      <div className="card no-print">
        <h2>Deducciones de la semana</h2>
        <form className="row" onSubmit={agregarDed}>
          <div className="field" style={{minWidth:170}}><label>Colaborador</label>
            <select value={ded.colaborador_id} onChange={e=>setDed({...ded,colaborador_id:e.target.value})}>
              <option value="">Elegir…</option>
              {colabs.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select></div>
          <div className="field" style={{flex:1}}><label>Concepto</label>
            <input value={ded.concepto} onChange={e=>setDed({...ded,concepto:e.target.value})} placeholder="Ej. Préstamo, uniforme…" /></div>
          <div className="field"><label>Monto</label>
            <input type="number" step="0.01" value={ded.monto} onChange={e=>setDed({...ded,monto:e.target.value})} placeholder="0.00" /></div>
          <button className="btn" type="submit">Agregar</button>
        </form>
        <table style={{marginTop:12}}>
          <thead><tr><th>Colaborador</th><th>Concepto</th><th className="num">Monto</th><th></th></tr></thead>
          <tbody>
            {deducs.map(d=>(
              <tr key={d.id}><td>{nombreDe(d.colaborador_id)}</td><td>{d.concepto||'—'}</td>
                <td className="num">{mxn(d.monto)}</td>
                <td className="num"><button className="btn danger sm" onClick={()=>borrarDed(d.id)}>✕</button></td></tr>
            ))}
            {deducs.length===0 && <tr><td colSpan={4} className="muted">Sin deducciones esta semana.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

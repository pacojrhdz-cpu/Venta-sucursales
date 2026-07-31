'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSucursales } from '../../lib/hooks';
import { SelSucursal, SelMes, SelAnio } from '../../components/Selectores';
import { hoyISO } from '../../lib/fechas';

const HOY = new Date();
function diasDelMes(a,m){ return new Date(a,m,0).getDate(); }
function iso(a,m,d){ return `${a}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }

export default function Colaboradores() {
  const { sucursales } = useSucursales();
  const [suc, setSuc] = useState('');
  const [anio, setAnio] = useState(HOY.getFullYear());
  const [mes, setMes] = useState(HOY.getMonth() + 1);
  const [colabs, setColabs] = useState([]);
  const [incidencias, setInc] = useState([]);
  const [nombre, setNombre] = useState('');
  const [inc, setIncForm] = useState({ colaborador_id:'', fecha: hoyISO(), estatus:'falta' });

  useEffect(() => { if (sucursales.length && !suc) setSuc(sucursales[0].id); }, [sucursales]);
  useEffect(() => { if (suc) { cargarColabs(); } }, [suc]);
  useEffect(() => { if (suc) cargarInc(); }, [suc, anio, mes, colabs]);

  async function cargarColabs() {
    const { data } = await supabase.from('colaboradores').select('*').eq('sucursal_id',suc).order('nombre');
    setColabs(data||[]);
    if (data?.length) setIncForm(f => ({...f, colaborador_id: f.colaborador_id || data[0].id}));
  }
  async function cargarInc() {
    if (!colabs.length) { setInc([]); return; }
    const ids = colabs.map(c=>c.id);
    const desde = iso(anio,mes,1), hasta = iso(anio,mes,diasDelMes(anio,mes));
    const { data } = await supabase.from('asistencia').select('*')
      .in('colaborador_id', ids).gte('fecha',desde).lte('fecha',hasta).neq('estatus','presente').order('fecha');
    setInc(data||[]);
  }
  async function agregarColab(e){ e.preventDefault(); if(!nombre.trim())return;
    await supabase.from('colaboradores').insert({sucursal_id:suc,nombre:nombre.trim()});
    setNombre(''); cargarColabs(); }
  async function borrarColab(id){ if(!confirm('¿Eliminar colaborador?'))return;
    await supabase.from('colaboradores').delete().eq('id',id); cargarColabs(); }
  async function agregarInc(e){ e.preventDefault(); if(!inc.colaborador_id)return;
    await supabase.from('asistencia').upsert(inc,{onConflict:'colaborador_id,fecha'}); cargarInc(); }
  async function borrarInc(id){ await supabase.from('asistencia').delete().eq('id',id); cargarInc(); }

  const resumen = colabs.map(c => ({
    ...c,
    faltas: incidencias.filter(i=>i.colaborador_id===c.id && i.estatus==='falta').length,
    retardos: incidencias.filter(i=>i.colaborador_id===c.id && i.estatus==='retardo').length,
  }));
  const nombreDe = id => colabs.find(c=>c.id===id)?.nombre || '';

  return (
    <>
      <div className="topbar"><h1>👥 Colaboradores y asistencia</h1></div>
      <div className="card" style={{marginBottom:18}}>
        <div className="row">
          <SelSucursal sucursales={sucursales} value={suc} onChange={setSuc} />
          <SelAnio value={anio} onChange={setAnio} />
          <SelMes value={mes} onChange={setMes} />
        </div>
      </div>

      <div className="grid" style={{gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
        <div className="card">
          <h2>Agregar colaborador</h2>
          <form className="row" onSubmit={agregarColab}>
            <div className="field" style={{flex:1}}><label>Nombre</label>
              <input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Nombre del colaborador" /></div>
            <button className="btn" type="submit">Agregar</button>
          </form>
          <table style={{marginTop:12}}><thead><tr><th>Nombre</th><th></th></tr></thead>
            <tbody>
              {colabs.map(c=>(<tr key={c.id}><td>{c.nombre}</td>
                <td className="num"><button className="btn danger sm" onClick={()=>borrarColab(c.id)}>Eliminar</button></td></tr>))}
              {colabs.length===0 && <tr><td colSpan={2} className="muted">Sin colaboradores.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2>Registrar falta o retardo</h2>
          <form className="row" onSubmit={agregarInc}>
            <div className="field" style={{flex:1,minWidth:160}}><label>Colaborador</label>
              <select value={inc.colaborador_id} onChange={e=>setIncForm({...inc,colaborador_id:e.target.value})}>
                {colabs.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select></div>
            <div className="field"><label>Fecha</label>
              <input type="date" value={inc.fecha} onChange={e=>setIncForm({...inc,fecha:e.target.value})} /></div>
            <div className="field"><label>Tipo</label>
              <select value={inc.estatus} onChange={e=>setIncForm({...inc,estatus:e.target.value})}>
                <option value="falta">Falta</option><option value="retardo">Retardo</option>
              </select></div>
            <button className="btn" type="submit">Registrar</button>
          </form>
          <p className="hint">Solo registras faltas y retardos. Los días normales cuentan como asistencia.</p>
        </div>
      </div>

      <div className="grid" style={{gridTemplateColumns:'1fr 1fr',gap:16}}>
        <div className="card">
          <h2>Resumen del mes</h2>
          <table><thead><tr><th>Colaborador</th><th className="num">Faltas</th><th className="num">Retardos</th></tr></thead>
            <tbody>
              {resumen.map(c=>(<tr key={c.id}><td>{c.nombre}</td>
                <td className="num">{c.faltas}</td><td className="num">{c.retardos}</td></tr>))}
              {resumen.length===0 && <tr><td colSpan={3} className="muted">Sin datos.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>Incidencias registradas</h2>
          <table><thead><tr><th>Fecha</th><th>Colaborador</th><th>Tipo</th><th></th></tr></thead>
            <tbody>
              {incidencias.map(i=>(<tr key={i.id}><td>{i.fecha}</td><td>{nombreDe(i.colaborador_id)}</td>
                <td><span className={'tag '+(i.estatus==='falta'?'r':'a')}>{i.estatus}</span></td>
                <td className="num"><button className="btn danger sm" onClick={()=>borrarInc(i.id)}>✕</button></td></tr>))}
              {incidencias.length===0 && <tr><td colSpan={4} className="muted">Sin incidencias este mes.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

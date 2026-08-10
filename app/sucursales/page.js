'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function Sucursales() {
  const [rows, setRows] = useState([]);      // todas (activas e inactivas)
  const [nombre, setNombre] = useState('');
  const [comision, setComision] = useState('3.5');
  const [comisionPlat, setComisionPlat] = useState('30');
  const [msg, setMsg] = useState('');

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const { data, error } = await supabase.from('sucursales').select('*').order('nombre');
    if (error) { setMsg('Error al cargar: ' + error.message); return; }
    // Guardamos valores editables como texto (%), para que se vea lo que escribes
    setRows((data||[]).map(s => ({
      ...s,
      _t: (Number(s.comision_tarjeta)*100).toFixed(2),
      _p: (Number(s.comision_plataforma||0)*100).toFixed(2),
      _estado: '',
    })));
  }

  function setCampo(id, campo, val) {
    setRows(rows.map(r => r.id===id ? { ...r, [campo]: val, _estado:'' } : r));
  }

  async function guardar(id) {
    const r = rows.find(x => x.id===id);
    const payload = {
      comision_tarjeta: Number(r._t)/100,
      comision_plataforma: Number(r._p)/100,
    };
    const { error } = await supabase.from('sucursales').update(payload).eq('id', id);
    setRows(rows.map(x => x.id===id ? { ...x, _estado: error ? 'error:'+error.message : 'ok' } : x));
  }

  async function agregar(e) {
    e.preventDefault(); setMsg('');
    if (!nombre.trim()) return;
    const { error } = await supabase.from('sucursales').insert({
      nombre: nombre.trim(),
      comision_tarjeta: Number(comision)/100,
      comision_plataforma: Number(comisionPlat)/100,
    });
    if (error) { setMsg('No se pudo agregar: ' + error.message); return; }
    setNombre(''); setComision('3.5'); setComisionPlat('30'); cargar();
  }

  async function toggleActiva(id, activa) {
    const { error } = await supabase.from('sucursales').update({ activa: !activa }).eq('id', id);
    if (error) setMsg(error.message); else cargar();
  }

  async function eliminar(id, activa, nombreSuc) {
    if (activa) { alert('Primero desactiva la sucursal. Eliminar borra TODAS sus ventas, gastos y objetivos y no se puede deshacer.'); return; }
    const escrito = prompt(
      `Esto borrará PERMANENTEMENTE la sucursal "${nombreSuc}" y TODOS sus datos (ventas, gastos, objetivos, colaboradores, nómina).\n\n` +
      `Para confirmar, escribe el nombre exacto de la sucursal:`);
    if (escrito === null) return;                 // canceló
    if (escrito.trim() !== nombreSuc) { alert('El nombre no coincide. No se borró nada.'); return; }
    const { error } = await supabase.from('sucursales').delete().eq('id', id);
    if (error) setMsg(error.message); else { setMsg(`Sucursal "${nombreSuc}" eliminada.`); cargar(); }
  }

  return (
    <>
      <div className="topbar"><h1>🏬 Sucursales</h1></div>

      {msg && <div className="notice">{msg}</div>}

      <div className="card" style={{marginBottom:20}}>
        <h2>Agregar sucursal</h2>
        <form className="row" onSubmit={agregar}>
          <div className="field" style={{flex:1}}>
            <label>Nombre</label>
            <input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Ej. Sucursal Centro" />
          </div>
          <div className="field" style={{minWidth:150}}>
            <label>Comisión terminal (%)</label>
            <input type="number" step="0.01" value={comision} onChange={e=>setComision(e.target.value)} />
          </div>
          <div className="field" style={{minWidth:160}}>
            <label>Comisión plataforma (%)</label>
            <input type="number" step="0.01" value={comisionPlat} onChange={e=>setComisionPlat(e.target.value)} />
          </div>
          <button className="btn" type="submit">Agregar</button>
        </form>
      </div>

      <div className="card">
        <h2>Mis sucursales</h2>
        <div style={{overflowX:'auto'}}>
        <table>
          <thead><tr>
            <th>Nombre</th><th className="num">Comisión terminal (%)</th><th className="num">Comisión plataforma (%)</th>
            <th>Estado</th><th></th><th></th>
          </tr></thead>
          <tbody>
            {rows.map(s => (
              <tr key={s.id} style={{opacity: s.activa?1:0.5}}>
                <td>{s.nombre}</td>
                <td className="num"><input type="number" step="0.01" style={{width:90,textAlign:'right'}}
                  value={s._t} onChange={e=>setCampo(s.id,'_t',e.target.value)} /></td>
                <td className="num"><input type="number" step="0.01" style={{width:90,textAlign:'right'}}
                  value={s._p} onChange={e=>setCampo(s.id,'_p',e.target.value)} /></td>
                <td>{s.activa ? <span className="tag g">Activa</span> : <span className="tag n">Inactiva</span>}</td>
                <td className="num">
                  <button className="btn sm" onClick={()=>guardar(s.id)}>Guardar</button>
                  {s._estado==='ok' && <span className="tag g" style={{marginLeft:6}}>✓ Guardado</span>}
                  {s._estado?.startsWith('error') && <span className="tag r" style={{marginLeft:6}}>{s._estado.slice(6)}</span>}
                </td>
                <td className="num">
                  <button className="btn ghost sm" onClick={()=>toggleActiva(s.id, s.activa)}>{s.activa?'Desactivar':'Activar'}</button>
                  {!s.activa && <button className="btn danger sm" style={{marginLeft:6}} onClick={()=>eliminar(s.id, s.activa, s.nombre)}>Eliminar</button>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="muted">Sin sucursales todavía.</td></tr>}
          </tbody>
        </table>
        </div>
        <p className="hint">Cambia el % y presiona <b>Guardar</b> — te confirma con "✓ Guardado". Para quitar una sucursal, primero <b>Desactívala</b> (conserva sus datos); el botón Eliminar (que sí borra todo) solo aparece en las inactivas.</p>
      </div>
    </>
  );
}

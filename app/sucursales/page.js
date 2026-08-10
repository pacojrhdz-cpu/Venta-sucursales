'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function Sucursales() {
  const [rows, setRows] = useState([]);
  const [nombre, setNombre] = useState('');
  const [nd, setNd] = useState('2');    // débito
  const [nc, setNc] = useState('3.5');  // crédito
  const [no, setNo] = useState('3.5');  // otras
  const [np, setNp] = useState('30');   // plataforma
  const [msg, setMsg] = useState('');

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const { data, error } = await supabase.from('sucursales').select('*').order('nombre');
    if (error) { setMsg('Error al cargar: ' + error.message); return; }
    setRows((data||[]).map(s => ({
      ...s,
      _d: (Number(s.comision_debito||0)*100).toFixed(2),
      _c: (Number(s.comision_credito||0)*100).toFixed(2),
      _o: (Number(s.comision_otras||0)*100).toFixed(2),
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
      comision_debito:  Number(r._d)/100,
      comision_credito: Number(r._c)/100,
      comision_otras:   Number(r._o)/100,
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
      comision_debito: Number(nd)/100, comision_credito: Number(nc)/100,
      comision_otras: Number(no)/100, comision_plataforma: Number(np)/100,
    });
    if (error) { setMsg('No se pudo agregar: ' + error.message); return; }
    setNombre(''); setNd('2'); setNc('3.5'); setNo('3.5'); setNp('30'); cargar();
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
    if (escrito === null) return;
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
          <div className="field" style={{flex:1,minWidth:160}}>
            <label>Nombre</label>
            <input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Ej. Sucursal Centro" />
          </div>
          <div className="field" style={{minWidth:110}}><label>Débito (%)</label>
            <input type="number" step="0.01" value={nd} onChange={e=>setNd(e.target.value)} /></div>
          <div className="field" style={{minWidth:110}}><label>Crédito (%)</label>
            <input type="number" step="0.01" value={nc} onChange={e=>setNc(e.target.value)} /></div>
          <div className="field" style={{minWidth:110}}><label>Otras (%)</label>
            <input type="number" step="0.01" value={no} onChange={e=>setNo(e.target.value)} /></div>
          <div className="field" style={{minWidth:120}}><label>Plataforma (%)</label>
            <input type="number" step="0.01" value={np} onChange={e=>setNp(e.target.value)} /></div>
          <button className="btn" type="submit">Agregar</button>
        </form>
      </div>

      <div className="card">
        <h2>Mis sucursales</h2>
        <div style={{overflowX:'auto'}}>
        <table>
          <thead><tr>
            <th>Nombre</th><th className="num">Débito %</th><th className="num">Crédito %</th>
            <th className="num">Otras %</th><th className="num">Plataforma %</th>
            <th>Estado</th><th></th><th></th>
          </tr></thead>
          <tbody>
            {rows.map(s => (
              <tr key={s.id} style={{opacity: s.activa?1:0.5}}>
                <td>{s.nombre}</td>
                <td className="num"><input type="number" step="0.01" style={{width:75,textAlign:'right'}}
                  value={s._d} onChange={e=>setCampo(s.id,'_d',e.target.value)} /></td>
                <td className="num"><input type="number" step="0.01" style={{width:75,textAlign:'right'}}
                  value={s._c} onChange={e=>setCampo(s.id,'_c',e.target.value)} /></td>
                <td className="num"><input type="number" step="0.01" style={{width:75,textAlign:'right'}}
                  value={s._o} onChange={e=>setCampo(s.id,'_o',e.target.value)} /></td>
                <td className="num"><input type="number" step="0.01" style={{width:75,textAlign:'right'}}
                  value={s._p} onChange={e=>setCampo(s.id,'_p',e.target.value)} /></td>
                <td>{s.activa ? <span className="tag g">Activa</span> : <span className="tag n">Inactiva</span>}</td>
                <td className="num">
                  <button className="btn sm" onClick={()=>guardar(s.id)}>Guardar</button>
                  {s._estado==='ok' && <span className="tag g" style={{marginLeft:6}}>✓</span>}
                  {s._estado?.startsWith('error') && <span className="tag r" style={{marginLeft:6}}>{s._estado.slice(6)}</span>}
                </td>
                <td className="num">
                  <button className="btn ghost sm" onClick={()=>toggleActiva(s.id, s.activa)}>{s.activa?'Desactivar':'Activar'}</button>
                  {!s.activa && <button className="btn danger sm" style={{marginLeft:6}} onClick={()=>eliminar(s.id, s.activa, s.nombre)}>Eliminar</button>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="muted">Sin sucursales todavía.</td></tr>}
          </tbody>
        </table>
        </div>
        <p className="hint">Cada tipo de tarjeta tiene su comisión. Cambia el % y presiona <b>Guardar</b> (te confirma con ✓). Para quitar una sucursal, primero <b>Desactívala</b>; Eliminar (que borra todo) solo aparece en inactivas y pide escribir el nombre.</p>
      </div>
    </>
  );
}

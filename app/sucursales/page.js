'use client';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSucursales } from '../../lib/hooks';
import { pct } from '../../lib/calculos';

export default function Sucursales() {
  const { sucursales, recargar } = useSucursales();
  const [nombre, setNombre] = useState('');
  const [comision, setComision] = useState('3.5');
  const [comisionPlat, setComisionPlat] = useState('30');

  async function agregar(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    await supabase.from('sucursales').insert({
      nombre: nombre.trim(),
      comision_tarjeta: Number(comision) / 100,
      comision_plataforma: Number(comisionPlat) / 100,
    });
    setNombre(''); setComision('3.5'); setComisionPlat('30'); recargar();
  }
  async function actualizarCampo(id, campo, valorPorc) {
    await supabase.from('sucursales').update({ [campo]: Number(valorPorc) / 100 }).eq('id', id);
    recargar();
  }
  async function borrar(id) {
    if (!confirm('¿Eliminar sucursal? Se borrarán también sus ventas, gastos y objetivos.')) return;
    await supabase.from('sucursales').delete().eq('id', id);
    recargar();
  }

  return (
    <>
      <div className="topbar"><h1>🏬 Sucursales</h1></div>

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
          <thead><tr><th>Nombre</th><th>Comisión terminal</th><th>Comisión plataforma</th><th></th></tr></thead>
          <tbody>
            {sucursales.map(s => (
              <tr key={s.id}>
                <td>{s.nombre}</td>
                <td>
                  <input type="number" step="0.01" defaultValue={(Number(s.comision_tarjeta)*100).toFixed(2)}
                    style={{width:90,display:'inline-block'}}
                    onBlur={e=>actualizarCampo(s.id, 'comision_tarjeta', e.target.value)} /> %
                </td>
                <td>
                  <input type="number" step="0.01" defaultValue={(Number(s.comision_plataforma||0)*100).toFixed(2)}
                    style={{width:90,display:'inline-block'}}
                    onBlur={e=>actualizarCampo(s.id, 'comision_plataforma', e.target.value)} /> %
                </td>
                <td className="num"><button className="btn danger sm" onClick={()=>borrar(s.id)}>Eliminar</button></td>
              </tr>
            ))}
            {sucursales.length === 0 && <tr><td colSpan={4} className="muted">Sin sucursales todavía.</td></tr>}
          </tbody>
        </table>
        </div>
        <p className="hint">Las comisiones se aplican automáticamente a lo que captures en tarjeta y en plataforma. Escribe el % y sal del campo para guardar.</p>
      </div>
    </>
  );
}

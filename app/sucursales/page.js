'use client';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSucursales } from '../../lib/hooks';
import { pct } from '../../lib/calculos';

export default function Sucursales() {
  const { sucursales, recargar } = useSucursales();
  const [nombre, setNombre] = useState('');
  const [comision, setComision] = useState('3.5');

  async function agregar(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    await supabase.from('sucursales').insert({
      nombre: nombre.trim(),
      comision_tarjeta: Number(comision) / 100,
    });
    setNombre(''); setComision('3.5'); recargar();
  }
  async function actualizarComision(id, valorPorc) {
    await supabase.from('sucursales').update({ comision_tarjeta: Number(valorPorc) / 100 }).eq('id', id);
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
          <div className="field" style={{minWidth:170}}>
            <label>Comisión terminal (%)</label>
            <input type="number" step="0.01" value={comision} onChange={e=>setComision(e.target.value)} />
          </div>
          <button className="btn" type="submit">Agregar</button>
        </form>
      </div>

      <div className="card">
        <h2>Mis sucursales</h2>
        <table>
          <thead><tr><th>Nombre</th><th>Comisión terminal</th><th></th></tr></thead>
          <tbody>
            {sucursales.map(s => (
              <tr key={s.id}>
                <td>{s.nombre}</td>
                <td>
                  <input type="number" step="0.01" defaultValue={(s.comision_tarjeta*100).toFixed(2)}
                    style={{width:110,display:'inline-block'}}
                    onBlur={e=>actualizarComision(s.id, e.target.value)} /> %
                  <span className="hint"> (actual: {pct(s.comision_tarjeta)})</span>
                </td>
                <td className="num"><button className="btn danger sm" onClick={()=>borrar(s.id)}>Eliminar</button></td>
              </tr>
            ))}
            {sucursales.length === 0 && <tr><td colSpan={3} className="muted">Sin sucursales todavía.</td></tr>}
          </tbody>
        </table>
        <p className="hint">La comisión se aplica automáticamente al monto en tarjeta que captures en Ventas.</p>
      </div>
    </>
  );
}

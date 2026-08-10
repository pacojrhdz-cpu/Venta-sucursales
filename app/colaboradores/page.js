'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSucursales } from '../../lib/hooks';
import { SelSucursal } from '../../components/Selectores';

export default function Colaboradores() {
  const { sucursales } = useSucursales();
  const [suc, setSuc] = useState('');
  const [colabs, setColabs] = useState([]);
  const [nombre, setNombre] = useState('');

  useEffect(() => { if (sucursales.length && !suc) setSuc(sucursales[0].id); }, [sucursales]);
  useEffect(() => { if (suc) cargar(); }, [suc]);

  async function cargar() {
    const { data } = await supabase.from('colaboradores').select('*').eq('sucursal_id',suc).order('nombre');
    setColabs(data||[]);
  }
  async function agregar(e){ e.preventDefault(); if(!nombre.trim())return;
    await supabase.from('colaboradores').insert({sucursal_id:suc, nombre:nombre.trim()});
    setNombre(''); cargar(); }
  async function borrar(id){ if(!confirm('¿Eliminar colaborador?'))return;
    await supabase.from('colaboradores').delete().eq('id',id); cargar(); }

  return (
    <>
      <div className="topbar"><h1>👥 Colaboradores</h1></div>
      <div className="card" style={{marginBottom:18}}>
        <div className="row">
          <SelSucursal sucursales={sucursales} value={suc} onChange={setSuc} />
        </div>
      </div>

      <div className="card">
        <h2>Agregar colaborador</h2>
        <form className="row" onSubmit={agregar}>
          <div className="field" style={{flex:1}}><label>Nombre</label>
            <input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Nombre del colaborador" /></div>
          <button className="btn" type="submit">Agregar</button>
        </form>
        <table style={{marginTop:12}}>
          <thead><tr><th>Nombre</th><th></th></tr></thead>
          <tbody>
            {colabs.map(c=>(<tr key={c.id}><td>{c.nombre}</td>
              <td className="num"><button className="btn danger sm" onClick={()=>borrar(c.id)}>Eliminar</button></td></tr>))}
            {colabs.length===0 && <tr><td colSpan={2} className="muted">Sin colaboradores.</td></tr>}
          </tbody>
        </table>
        <p className="hint">Los días trabajados y retardos de cada semana se capturan en la sección de <b>Bonos</b>.</p>
      </div>
    </>
  );
}

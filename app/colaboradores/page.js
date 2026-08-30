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
    // Todos (activos e inactivos) para poder gestionarlos
    const { data } = await supabase.from('colaboradores').select('*').eq('sucursal_id',suc).order('activo',{ascending:false}).order('nombre');
    setColabs(data||[]);
  }
  async function agregar(e){ e.preventDefault(); if(!nombre.trim())return;
    await supabase.from('colaboradores').insert({sucursal_id:suc, nombre:nombre.trim()});
    setNombre(''); cargar(); }
  async function toggleActivo(id, activo){
    await supabase.from('colaboradores').update({activo:!activo}).eq('id',id); cargar(); }
  async function borrar(id, nombreC, activo){
    if (activo) { alert('Primero desactiva al colaborador. Eliminar borra TODO su historial (días, bonos, sueldos, deducciones) y no se puede deshacer.'); return; }
    const escrito = prompt(`Esto borra PERMANENTEMENTE a "${nombreC}" y todo su historial.\n\nPara confirmar, escribe su nombre exacto:`);
    if (escrito === null) return;
    if (escrito.trim() !== nombreC) { alert('El nombre no coincide. No se borró nada.'); return; }
    await supabase.from('colaboradores').delete().eq('id',id); cargar(); }

  const activos = colabs.filter(c=>c.activo);
  const inactivos = colabs.filter(c=>!c.activo);

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
          <thead><tr><th>Nombre</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {colabs.map(c=>(
              <tr key={c.id} style={{opacity:c.activo?1:0.55}}>
                <td>{c.nombre}</td>
                <td>{c.activo ? <span className="tag g">Activo</span> : <span className="tag n">Inactivo</span>}</td>
                <td className="num">
                  <button className="btn ghost sm" onClick={()=>toggleActivo(c.id, c.activo)}>{c.activo?'Desactivar':'Reactivar'}</button>
                  {!c.activo && <button className="btn danger sm" style={{marginLeft:6}} onClick={()=>borrar(c.id, c.nombre, c.activo)}>Eliminar</button>}
                </td>
              </tr>
            ))}
            {colabs.length===0 && <tr><td colSpan={3} className="muted">Sin colaboradores.</td></tr>}
          </tbody>
        </table>
        <p className="hint">
          {activos.length} activo(s){inactivos.length>0?` · ${inactivos.length} inactivo(s)`:''}.
          Al <b>desactivar</b>, la persona deja de aparecer y de sumar en Nómina y Bonos, pero <b>se conserva todo su historial</b>.
          El botón Eliminar (que sí borra el historial) solo aparece en inactivos y pide escribir el nombre.
        </p>
      </div>
    </>
  );
}

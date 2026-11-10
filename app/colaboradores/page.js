'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSucursales } from '../../lib/hooks';
import { SelSucursal } from '../../components/Selectores';

const hoyISO = () => new Date().toISOString().slice(0,10);

export default function Colaboradores() {
  const { sucursales } = useSucursales();
  const [suc, setSuc] = useState('');
  const [colabs, setColabs] = useState([]);
  const [nombre, setNombre] = useState('');
  const [ingreso, setIngreso] = useState(hoyISO());

  useEffect(() => { if (sucursales.length && !suc) setSuc(sucursales[0].id); }, [sucursales]);
  useEffect(() => { if (suc) cargar(); }, [suc]);

  async function cargar() {
    const { data } = await supabase.from('colaboradores').select('*').eq('sucursal_id',suc).order('activo',{ascending:false}).order('nombre');
    setColabs(data||[]);
  }
  async function agregar(e){ e.preventDefault(); if(!nombre.trim())return;
    await supabase.from('colaboradores').insert({sucursal_id:suc, nombre:nombre.trim(), fecha_ingreso: ingreso || null});
    setNombre(''); setIngreso(hoyISO()); cargar(); }
  async function toggleActivo(c){
    if (c.activo) {
      await supabase.from('colaboradores').update({activo:false, fecha_baja: c.fecha_baja || hoyISO()}).eq('id',c.id);
    } else {
      await supabase.from('colaboradores').update({activo:true, fecha_baja: null}).eq('id',c.id);
    }
    cargar(); }
  async function guardarFecha(id, campo, val){
    await supabase.from('colaboradores').update({[campo]: val || null}).eq('id',id); cargar(); }
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
          <div className="field"><label>Fecha de ingreso</label>
            <input type="date" value={ingreso} onChange={e=>setIngreso(e.target.value)} /></div>
          <button className="btn" type="submit">Agregar</button>
        </form>
        <table style={{marginTop:12}}>
          <thead><tr><th>Nombre</th><th>Ingreso</th><th>Baja</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {colabs.map(c=>(
              <tr key={c.id} style={{opacity:c.activo?1:0.55}}>
                <td>{c.nombre}</td>
                <td><input type="date" defaultValue={c.fecha_ingreso || ''} style={{width:150}}
                  onBlur={e=>{ if(e.target.value!==(c.fecha_ingreso||'')) guardarFecha(c.id,'fecha_ingreso',e.target.value); }} /></td>
                <td><input type="date" defaultValue={c.fecha_baja || ''} style={{width:150}}
                  onBlur={e=>{ if(e.target.value!==(c.fecha_baja||'')) guardarFecha(c.id,'fecha_baja',e.target.value); }} /></td>
                <td>{c.activo ? <span className="tag g">Activo</span> : <span className="tag n">Inactivo</span>}</td>
                <td className="num">
                  <button className="btn ghost sm" onClick={()=>toggleActivo(c)}>{c.activo?'Desactivar':'Reactivar'}</button>
                  {!c.activo && <button className="btn danger sm" style={{marginLeft:6}} onClick={()=>borrar(c.id, c.nombre, c.activo)}>Eliminar</button>}
                </td>
              </tr>
            ))}
            {colabs.length===0 && <tr><td colSpan={5} className="muted">Sin colaboradores.</td></tr>}
          </tbody>
        </table>
        <p className="hint">
          {activos.length} activo(s){inactivos.length>0?` · ${inactivos.length} inactivo(s)`:''}.
          La <b>fecha de ingreso</b> hace que la persona solo cuente en Nómina y Bonos desde ese mes en adelante, así que agregar a alguien nuevo <b>ya no afecta los meses anteriores</b>. La <b>fecha de baja</b> hace que deje de contar después de esa fecha (al Desactivar se pone hoy automáticamente).
          Déjalas vacías para que cuente siempre. Eliminar (que sí borra el historial) solo aparece en inactivos y pide escribir el nombre.
        </p>
      </div>
    </>
  );
}

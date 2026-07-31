'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSucursales } from '../../lib/hooks';
import { SelSucursal, SelMes, SelAnio } from '../../components/Selectores';
import { mxn } from '../../lib/calculos';

const HOY = new Date();

export default function Objetivos() {
  const { sucursales } = useSucursales();
  const [suc, setSuc] = useState('');
  const [anio, setAnio] = useState(HOY.getFullYear());
  const [mes, setMes] = useState(HOY.getMonth() + 1);
  const [metaMensual, setMetaMensual] = useState('');
  const [semanas, setSemanas] = useState({ 1:'',2:'',3:'',4:'',5:'' });
  const [guardado, setGuardado] = useState(false);

  useEffect(() => { if (sucursales.length && !suc) setSuc(sucursales[0].id); }, [sucursales]);

  useEffect(() => { if (suc) cargar(); }, [suc, anio, mes]);

  async function cargar() {
    setGuardado(false);
    const { data: m } = await supabase.from('objetivos')
      .select('meta_mensual').eq('sucursal_id', suc).eq('anio', anio).eq('mes', mes).maybeSingle();
    setMetaMensual(m?.meta_mensual ?? '');
    const { data: sm } = await supabase.from('objetivos_semanales')
      .select('semana, meta_semanal').eq('sucursal_id', suc).eq('anio', anio).eq('mes', mes);
    const base = { 1:'',2:'',3:'',4:'',5:'' };
    (sm||[]).forEach(r => base[r.semana] = r.meta_semanal);
    setSemanas(base);
  }

  async function guardar() {
    await supabase.from('objetivos').upsert(
      { sucursal_id: suc, anio, mes, meta_mensual: Number(metaMensual||0) },
      { onConflict: 'sucursal_id,anio,mes' });
    for (const s of [1,2,3,4,5]) {
      const val = semanas[s];
      if (val === '' || val === null) continue;
      await supabase.from('objetivos_semanales').upsert(
        { sucursal_id: suc, anio, mes, semana: s, meta_semanal: Number(val||0) },
        { onConflict: 'sucursal_id,anio,mes,semana' });
    }
    setGuardado(true);
  }

  const sumaSem = [1,2,3,4,5].reduce((a,s)=>a+Number(semanas[s]||0),0);

  return (
    <>
      <div className="topbar"><h1>🎯 Objetivos</h1>
        <button className="btn" onClick={guardar}>Guardar objetivos</button></div>

      <div className="card" style={{marginBottom:18}}>
        <div className="row">
          <SelSucursal sucursales={sucursales} value={suc} onChange={setSuc} />
          <SelAnio value={anio} onChange={setAnio} />
          <SelMes value={mes} onChange={setMes} />
        </div>
      </div>

      {guardado && <div className="notice" style={{borderColor:'rgba(34,197,94,.4)',color:'#4ade80',background:'rgba(34,197,94,.1)'}}>Objetivos guardados.</div>}

      <div className="grid" style={{gridTemplateColumns:'1fr 1fr',gap:16}}>
        <div className="card">
          <h2>Meta mensual</h2>
          <label>Meta de venta del mes</label>
          <input type="number" value={metaMensual} onChange={e=>setMetaMensual(e.target.value)} placeholder="0.00" />
          <p className="hint">Sobre esta meta se calcula el bono mensual.</p>
        </div>
        <div className="card">
          <h2>Metas semanales</h2>
          {[1,2,3,4,5].map(s => (
            <div key={s} style={{marginBottom:8}}>
              <label>Semana {s}</label>
              <input type="number" value={semanas[s]}
                onChange={e=>setSemanas({...semanas,[s]:e.target.value})} placeholder="0.00" />
            </div>
          ))}
          <p className="hint">Suma de metas semanales: <b>{mxn(sumaSem)}</b></p>
        </div>
      </div>
    </>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSucursales } from '../../lib/hooks';
import { SelSucursal, SelMes, SelAnio } from '../../components/Selectores';
import { mxn, semanasDelMes, metaEfectivaSemana } from '../../lib/calculos';

const HOY = new Date();
const MESABR = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

export default function Objetivos() {
  const { sucursales } = useSucursales();
  const [suc, setSuc] = useState('');
  const [anio, setAnio] = useState(HOY.getFullYear());
  const [mes, setMes] = useState(HOY.getMonth() + 1);
  const [metaMensual, setMetaMensual] = useState('');
  const [semanas, setSemanas] = useState({});
  const [guardado, setGuardado] = useState(false);

  const semanasMes = semanasDelMes(anio, mes); // [{semana,inicio,fin,numDias}]

  useEffect(() => { if (sucursales.length && !suc) setSuc(sucursales[0].id); }, [sucursales]);
  useEffect(() => { if (suc) cargar(); }, [suc, anio, mes]);

  async function cargar() {
    setGuardado(false);
    const { data: m } = await supabase.from('objetivos')
      .select('meta_mensual').eq('sucursal_id', suc).eq('anio', anio).eq('mes', mes).maybeSingle();
    setMetaMensual(m?.meta_mensual ?? '');
    const { data: sm } = await supabase.from('objetivos_semanales')
      .select('semana, meta_semanal').eq('sucursal_id', suc).eq('anio', anio).eq('mes', mes);
    const base = {};
    (sm||[]).forEach(r => base[r.semana] = r.meta_semanal);
    setSemanas(base);
  }

  async function guardar() {
    await supabase.from('objetivos').upsert(
      { sucursal_id: suc, anio, mes, meta_mensual: Number(metaMensual||0) },
      { onConflict: 'sucursal_id,anio,mes' });
    for (const s of semanasMes) {
      const val = semanas[s.semana];
      if (val === '' || val === null || val === undefined) continue;
      await supabase.from('objetivos_semanales').upsert(
        { sucursal_id: suc, anio, mes, semana: s.semana, meta_semanal: Number(val||0) },
        { onConflict: 'sucursal_id,anio,mes,semana' });
    }
    setGuardado(true);
  }

  const sumaSem = semanasMes.reduce((a,s)=>a+Number(semanas[s.semana]||0),0);

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
          <h2>Metas semanales <span className="hint">(lunes a domingo)</span></h2>
          {semanasMes.map(s => {
            const parcial = s.numDias < 7;
            const base = Number(semanas[s.semana]||0);
            return (
              <div key={s.semana} style={{marginBottom:10}}>
                <label>Semana {s.semana} · {s.inicio}–{s.fin} {MESABR[mes-1]}
                  {parcial && <span style={{color:'#fbbf24'}}> · {s.numDias} días (semana partida)</span>}</label>
                <input type="number" value={semanas[s.semana] ?? ''}
                  onChange={e=>setSemanas({...semanas,[s.semana]:e.target.value})} placeholder="0.00" />
                {parcial && base>0 &&
                  <p className="hint">Para el bono, esta semana se ajusta a {s.numDias}/7:
                    meta efectiva ≈ <b>{mxn(metaEfectivaSemana(base, s.numDias))}</b></p>}
              </div>
            );
          })}
          <p className="hint">Captura la meta de una semana completa; las semanas partidas se ajustan solas. Suma capturada: <b>{mxn(sumaSem)}</b></p>
        </div>
      </div>
    </>
  );
}

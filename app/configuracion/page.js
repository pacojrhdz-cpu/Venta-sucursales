'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const CAMPOS = [
  ['Bono semanal', [
    ['bono_sem_r1_min','Rango 1 desde %'], ['bono_sem_r1_pct','Rango 1 paga %'],
    ['bono_sem_r2_min','Rango 2 desde %'], ['bono_sem_r2_pct','Rango 2 paga %'],
    ['bono_sem_r3_min','Rango 3 desde %'], ['bono_sem_r3_pct','Rango 3 paga %'],
  ]],
  ['Bono mensual', [
    ['bono_mes_r1_min','Rango 1 desde %'], ['bono_mes_r1_pct','Rango 1 paga %'],
    ['bono_mes_r2_min','Rango 2 desde %'], ['bono_mes_r2_pct','Rango 2 paga %'],
  ]],
];

export default function Configuracion() {
  const [c, setC] = useState(null);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    supabase.from('config').select('*').eq('id',1).single().then(({data})=>setC(data));
  }, []);
  if (!c) return <p className="muted">Cargando…</p>;

  function set(k, v) { setC({ ...c, [k]: v }); setGuardado(false); }
  async function guardar() {
    const payload = { ...c, actualizado_en: new Date().toISOString() };
    await supabase.from('config').update(payload).eq('id',1);
    setGuardado(true);
  }

  return (
    <>
      <div className="topbar"><h1>⚙️ Configuración de bonos</h1>
        <button className="btn" onClick={guardar}>Guardar cambios</button></div>
      {guardado && <div className="notice" style={{borderColor:'rgba(34,197,94,.4)',color:'#4ade80',background:'rgba(34,197,94,.1)'}}>Configuración guardada.</div>}
      <p className="muted">Los porcentajes se escriben como número. Ej: <b>70</b> para 70% de avance, y <b>0.5</b> para pagar 0.5% de la venta.</p>

      {CAMPOS.map(([titulo, campos]) => (
        <div className="card" key={titulo} style={{marginBottom:16}}>
          <h2>{titulo}</h2>
          <div className="grid kpis">
            {campos.map(([k, label]) => (
              <div key={k} className="field">
                <label>{label}</label>
                <input type="number" step="0.001"
                  value={c[k]*100}
                  onChange={e=>set(k, Number(e.target.value)/100)} />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="card">
        <h2>Límites de asistencia (pierde el bono si los supera)</h2>
        <div className="row">
          <div className="field"><label>Máximo de faltas permitidas</label>
            <input type="number" value={c.limite_faltas} onChange={e=>set('limite_faltas',Number(e.target.value))} /></div>
          <div className="field"><label>Máximo de retardos permitidos</label>
            <input type="number" value={c.limite_retardos} onChange={e=>set('limite_retardos',Number(e.target.value))} /></div>
        </div>
        <p className="hint">Un colaborador que supere cualquiera de estos límites en el periodo NO recibe bono.</p>
      </div>
    </>
  );
}

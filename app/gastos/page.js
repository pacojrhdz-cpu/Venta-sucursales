'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSucursales } from '../../lib/hooks';
import { SelSucursal, SelMes, SelAnio } from '../../components/Selectores';
import { mxn, semanaDelMes } from '../../lib/calculos';
import { hoyISO } from '../../lib/fechas';

const HOY = new Date();
function diasDelMes(anio, mes){ return new Date(anio, mes, 0).getDate(); }
function iso(a,m,d){ return `${a}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }

export default function Gastos() {
  const { sucursales } = useSucursales();
  const [suc, setSuc] = useState('');
  const [anio, setAnio] = useState(HOY.getFullYear());
  const [mes, setMes] = useState(HOY.getMonth() + 1);
  const [lista, setLista] = useState([]);
  const [f, setF] = useState({ fecha: hoyISO(), monto:'', categoria:'', descripcion:'' });

  useEffect(() => { if (sucursales.length && !suc) setSuc(sucursales[0].id); }, [sucursales]);
  useEffect(() => { if (suc) cargar(); }, [suc, anio, mes]);

  async function cargar() {
    const desde = iso(anio,mes,1), hasta = iso(anio,mes,diasDelMes(anio,mes));
    const { data } = await supabase.from('gastos').select('*')
      .eq('sucursal_id',suc).gte('fecha',desde).lte('fecha',hasta).order('fecha');
    setLista(data||[]);
  }
  async function agregar(e) {
    e.preventDefault();
    if (!f.monto) return;
    await supabase.from('gastos').insert({
      sucursal_id: suc, fecha: f.fecha, monto: Number(f.monto),
      categoria: f.categoria || null, descripcion: f.descripcion || null,
    });
    setF({ ...f, monto:'', categoria:'', descripcion:'' });
    cargar();
  }
  async function borrar(id) { await supabase.from('gastos').delete().eq('id',id); cargar(); }

  const porSemana = {};
  lista.forEach(g => { const s = semanaDelMes(g.fecha); porSemana[s]=(porSemana[s]||0)+Number(g.monto); });
  const totalMes = lista.reduce((a,g)=>a+Number(g.monto),0);

  return (
    <>
      <div className="topbar"><h1>🧾 Gastos</h1></div>

      <div className="card" style={{marginBottom:18}}>
        <div className="row">
          <SelSucursal sucursales={sucursales} value={suc} onChange={setSuc} />
          <SelAnio value={anio} onChange={setAnio} />
          <SelMes value={mes} onChange={setMes} />
        </div>
      </div>

      <div className="card" style={{marginBottom:18}}>
        <h2>Registrar gasto</h2>
        <form className="row" onSubmit={agregar}>
          <div className="field"><label>Fecha</label>
            <input type="date" value={f.fecha} onChange={e=>setF({...f,fecha:e.target.value})} /></div>
          <div className="field"><label>Monto</label>
            <input type="number" step="0.01" value={f.monto} onChange={e=>setF({...f,monto:e.target.value})} placeholder="0.00" /></div>
          <div className="field"><label>Categoría</label>
            <input value={f.categoria} onChange={e=>setF({...f,categoria:e.target.value})} placeholder="Ej. Nómina" /></div>
          <div className="field" style={{flex:1}}><label>Descripción</label>
            <input value={f.descripcion} onChange={e=>setF({...f,descripcion:e.target.value})} /></div>
          <button className="btn" type="submit">Agregar</button>
        </form>
      </div>

      <div className="grid" style={{gridTemplateColumns:'1fr 2fr',gap:16}}>
        <div className="card">
          <h2>Resumen semanal</h2>
          <table><thead><tr><th>Semana</th><th className="num">Gastos</th></tr></thead>
            <tbody>
              {[1,2,3,4,5,6].filter(s=>porSemana[s]!==undefined).map(s=>(
                <tr key={s}><td>Semana {s}</td><td className="num">{mxn(porSemana[s])}</td></tr>
              ))}
              {lista.length===0 && <tr><td colSpan={2} className="muted">Sin gastos.</td></tr>}
            </tbody>
            <tfoot><tr><td><b>Total mes</b></td><td className="num"><b>{mxn(totalMes)}</b></td></tr></tfoot>
          </table>
        </div>

        <div className="card">
          <h2>Detalle</h2>
          <div style={{overflowX:'auto'}}>
          <table><thead><tr><th>Fecha</th><th>Sem</th><th>Categoría</th><th>Descripción</th><th className="num">Monto</th><th></th></tr></thead>
            <tbody>
              {lista.map(g=>(
                <tr key={g.id}>
                  <td>{g.fecha}</td><td className="muted">{semanaDelMes(g.fecha)}</td>
                  <td>{g.categoria||'—'}</td><td>{g.descripcion||'—'}</td>
                  <td className="num">{mxn(g.monto)}</td>
                  <td className="num"><button className="btn danger sm" onClick={()=>borrar(g.id)}>✕</button></td>
                </tr>
              ))}
              {lista.length===0 && <tr><td colSpan={6} className="muted">Sin gastos este mes.</td></tr>}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </>
  );
}

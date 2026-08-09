'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSucursales } from '../../lib/hooks';
import { SelSucursal, SelMes, SelAnio } from '../../components/Selectores';
import { mxn, pct, avance, semanaDelMes, semanasDelMes, metaSemanalEfectiva } from '../../lib/calculos';
import { MESES } from '../../lib/fechas';

const HOY = new Date();
const MESABR = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function diasDelMes(a,m){ return new Date(a,m,0).getDate(); }
function iso(a,m,d){ return `${a}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }

export default function Reporte() {
  const { sucursales } = useSucursales();
  const [suc, setSuc] = useState('');
  const [anio, setAnio] = useState(HOY.getFullYear());
  const [mes, setMes] = useState(HOY.getMonth() + 1);
  const [semana, setSemana] = useState(0);
  const [tasa, setTasa] = useState(0.035);
  const [tasaPlat, setTasaPlat] = useState(0);
  const [ventas, setVentas] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [metaMes, setMetaMes] = useState(0);
  const [metasSem, setMetasSem] = useState({});

  const semanasMes = semanasDelMes(anio, mes);
  const nombreSuc = sucursales.find(s=>s.id===suc)?.nombre || '';

  useEffect(() => { if (sucursales.length && !suc) setSuc(sucursales[0].id); }, [sucursales]);
  useEffect(() => { if (suc) cargar(); }, [suc, anio, mes]);
  useEffect(() => {
    // semana por defecto: la de hoy si es el mes actual, si no la 1
    if (!semana && semanasMes.length) {
      const esMesActual = anio===HOY.getFullYear() && mes===(HOY.getMonth()+1);
      setSemana(esMesActual ? semanaDelMes(iso(anio,mes,HOY.getDate())) : semanasMes[0].semana);
    }
  }, [semanasMes]);

  async function cargar() {
    const s = sucursales.find(x=>x.id===suc);
    setTasa(s?Number(s.comision_tarjeta):0.035);
    setTasaPlat(s?Number(s.comision_plataforma||0):0);
    const desde = iso(anio,mes,1), hasta = iso(anio,mes,diasDelMes(anio,mes));
    const { data: v } = await supabase.from('ventas_diarias')
      .select('fecha,efectivo,tarjeta,plataforma,propinas').eq('sucursal_id',suc).gte('fecha',desde).lte('fecha',hasta);
    setVentas(v||[]);
    const { data: g } = await supabase.from('gastos')
      .select('fecha,monto,metodo,categoria,descripcion').eq('sucursal_id',suc).gte('fecha',desde).lte('fecha',hasta).order('fecha');
    setGastos(g||[]);
    const { data: om } = await supabase.from('objetivos')
      .select('meta_mensual').eq('sucursal_id',suc).eq('anio',anio).eq('mes',mes).maybeSingle();
    setMetaMes(Number(om?.meta_mensual||0));
    const { data: os } = await supabase.from('objetivos_semanales')
      .select('semana,meta_semanal').eq('sucursal_id',suc).eq('anio',anio).eq('mes',mes);
    const ms={}; (os||[]).forEach(r=>ms[r.semana]=Number(r.meta_semanal)); setMetasSem(ms);
  }

  const info = semanasMes.find(s=>s.semana===semana) || { inicio:0, fin:0, numDias:7 };

  // --- Datos de la semana seleccionada ---
  const vSem = ventas.filter(v=>semanaDelMes(v.fecha)===semana);
  const efeSem = vSem.reduce((a,v)=>a+Number(v.efectivo||0),0);
  const tarSem = vSem.reduce((a,v)=>a+Number(v.tarjeta||0),0);
  const platSem = vSem.reduce((a,v)=>a+Number(v.plataforma||0),0);
  const propSem = vSem.reduce((a,v)=>a+Number(v.propinas||0),0);
  const totalSem = efeSem+tarSem+platSem;
  const comSem = tarSem*tasa + platSem*tasaPlat;

  const gSem = gastos.filter(g=>semanaDelMes(g.fecha)===semana);
  const gastosEfeSem = gSem.filter(g=>(g.metodo||'efectivo')==='efectivo').reduce((a,g)=>a+Number(g.monto),0);
  const gastosTotSem = gSem.reduce((a,g)=>a+Number(g.monto),0);
  // Las propinas salen de la caja en efectivo (aunque entren por terminal),
  // por eso reducen el efectivo restante, pero NO son gasto ni afectan la utilidad.
  const efectivoRestante = efeSem - gastosEfeSem - propSem;

  const ndMes = diasDelMes(anio,mes);
  const metaSemAjust = metaSemanalEfectiva({ metaSemanalManual: Number(metasSem[semana]||0), metaMensual: metaMes, numDiasSemana: info.numDias, diasMes: ndMes });
  const avSem = avance(totalSem, metaSemAjust);

  // --- Proyeccion del mes ---
  const totalMes = ventas.reduce((a,v)=>a+Number(v.efectivo||0)+Number(v.tarjeta||0)+Number(v.plataforma||0),0);
  const esMesActual = anio===HOY.getFullYear() && mes===(HOY.getMonth()+1);
  const diasTrans = esMesActual ? HOY.getDate() : ndMes;
  const proyeccion = diasTrans>0 ? (totalMes/diasTrans)*ndMes : totalMes;
  const avMes = avance(totalMes, metaMes);
  const avProy = avance(proyeccion, metaMes);

  const rango = `${info.inicio}–${info.fin} ${MESABR[mes-1]} ${anio}`;

  return (
    <>
      <div className="topbar">
        <h1>📄 Reporte semanal</h1>
        <button className="btn no-print" onClick={()=>window.print()}>Descargar / compartir PDF</button>
      </div>

      <div className="card no-print" style={{marginBottom:18}}>
        <div className="row">
          <SelSucursal sucursales={sucursales} value={suc} onChange={setSuc} />
          <SelAnio value={anio} onChange={setAnio} />
          <SelMes value={mes} onChange={setMes} />
          <div className="field"><label>Semana</label>
            <select value={semana} onChange={e=>setSemana(Number(e.target.value))}>
              {semanasMes.map(s=><option key={s.semana} value={s.semana}>
                Semana {s.semana} ({s.inicio}–{s.fin} {MESABR[mes-1]}){s.numDias<7?' · partida':''}
              </option>)}
            </select></div>
        </div>
        <p className="hint">Usa "Descargar / compartir PDF" y elige "Guardar como PDF" en el destino de impresión.</p>
      </div>

      {/* ===== Contenido imprimible ===== */}
      <div className="card" style={{marginBottom:16,display:'flex',alignItems:'center',gap:16}}>
        <img src="/logo.png" className="reporte-logo" alt="Logo" />
        <div>
          <h2 style={{marginBottom:4}}>Reporte semanal — {nombreSuc}</h2>
          <p className="muted" style={{margin:0}}>Semana {semana} · {rango} · {info.numDias} días{info.numDias<7?' (semana partida)':''}</p>
        </div>
      </div>

      <div className="grid kpis" style={{marginBottom:16}}>
        <div className="card kpi"><div className="label">Venta de la semana</div><div className="value">{mxn(totalSem)}</div>
          <div className="delta muted">Efe {mxn(efeSem)} · Tar {mxn(tarSem)} · Plat {mxn(platSem)}</div></div>
        <div className="card kpi"><div className="label">Ventas en efectivo</div><div className="value">{mxn(efeSem)}</div></div>
        <div className="card kpi"><div className="label">Gastos en efectivo</div><div className="value down">−{mxn(gastosEfeSem)}</div></div>
        <div className="card kpi"><div className="label">Propinas pagadas (efectivo)</div><div className="value down">−{mxn(propSem)}</div>
          <div className="delta muted">salen de caja · no es gasto ni utilidad</div></div>
        <div className="card kpi"><div className="label">Efectivo restante</div>
          <div className={'value '+(efectivoRestante>=0?'up':'down')}>{mxn(efectivoRestante)}</div>
          <div className="delta muted">efectivo − gastos efectivo − propinas</div></div>
      </div>

      <div className="grid" style={{gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
        <div className="card">
          <h2>Alcance del objetivo (semana)</h2>
          <table><tbody>
            <tr><td>Meta semanal{info.numDias<7?' (ajustada)':''}</td><td className="num">{mxn(metaSemAjust)}</td></tr>
            <tr><td>Venta de la semana</td><td className="num">{mxn(totalSem)}</td></tr>
            <tr><td><b>Avance</b></td><td className="num"><b>{metaSemAjust>0?pct(avSem):'—'}</b></td></tr>
          </tbody></table>
          {metaSemAjust>0 && <div className="bar"><span style={{width:Math.min(100,avSem*100)+'%',
            background:avSem>=1?'var(--green)':avSem>=0.7?'var(--amber)':'var(--red)'}}></span></div>}
        </div>
        <div className="card">
          <h2>Proyección del mes ({MESES[mes-1]})</h2>
          <table><tbody>
            <tr><td>Venta acumulada ({diasTrans} de {ndMes} días)</td><td className="num">{mxn(totalMes)}</td></tr>
            <tr><td><b>Proyección fin de mes</b></td><td className="num"><b>{mxn(proyeccion)}</b></td></tr>
            <tr><td>Meta mensual</td><td className="num">{mxn(metaMes)}</td></tr>
            <tr><td>Avance actual</td><td className="num">{metaMes>0?pct(avMes):'—'}</td></tr>
            <tr><td>Avance proyectado</td><td className="num">{metaMes>0?pct(avProy):'—'}</td></tr>
          </tbody></table>
        </div>
      </div>

      <div className="card">
        <h2>Gastos en efectivo de la semana</h2>
        <table>
          <thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th className="num">Monto</th></tr></thead>
          <tbody>
            {gSem.filter(g=>(g.metodo||'efectivo')==='efectivo').map((g,i)=>(
              <tr key={i}><td>{g.fecha}</td><td>{g.categoria||'—'}</td><td>{g.descripcion||'—'}</td>
                <td className="num">{mxn(g.monto)}</td></tr>
            ))}
            {gSem.filter(g=>(g.metodo||'efectivo')==='efectivo').length===0 &&
              <tr><td colSpan={4} className="muted">Sin gastos en efectivo esta semana.</td></tr>}
          </tbody>
          <tfoot><tr><td colSpan={3}><b>Total gastos en efectivo</b></td><td className="num"><b>{mxn(gastosEfeSem)}</b></td></tr>
            <tr><td colSpan={3} className="muted">Total gastos (todos los métodos)</td><td className="num">{mxn(gastosTotSem)}</td></tr></tfoot>
        </table>
      </div>
    </>
  );
}

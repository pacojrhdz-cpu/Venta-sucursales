'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSucursales, useConfig } from '../../lib/hooks';
import { SelSucursal, SelMes, SelAnio } from '../../components/Selectores';
import { mxn, pct, avance, calcularBono, semanasNaturalesQueTocan, diasEnMes, ventaBruta, sueldoEfectivoSemana } from '../../lib/calculos';
import { MESES } from '../../lib/fechas';

const HOY = new Date();
const MESABR = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function etiqueta(iso){ const d=Number(iso.slice(8,10)), m=Number(iso.slice(5,7)); return `${d} ${MESABR[m-1]}`; }

export default function Reporte() {
  const { sucursales } = useSucursales();
  const { config } = useConfig();
  const [suc, setSuc] = useState('');
  const [anio, setAnio] = useState(HOY.getFullYear());
  const [mes, setMes] = useState(HOY.getMonth() + 1);
  const [semIdx, setSemIdx] = useState(0);
  const [ventas, setVentas] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [colabs, setColabs] = useState([]);
  const [registros, setRegistros] = useState({});
  const [deducs, setDeducs] = useState([]);
  const [metodos, setMetodos] = useState({});
  const [metaMes, setMetaMes] = useState(0);

  const ndMes = diasEnMes(anio, mes);
  const pmes = `${anio}-${String(mes).padStart(2,'0')}`;
  const iniMesISO = `${pmes}-01`;
  const finMesISO = `${pmes}-${String(ndMes).padStart(2,'0')}`;
  const metaDiaria = ndMes>0 ? metaMes/ndMes : 0;

  const tramos = semanasNaturalesQueTocan(anio, mes).map(sem => ({
    ...sem,
    start: sem.inicioISO > iniMesISO ? sem.inicioISO : iniMesISO,
    end:   sem.finISO   < finMesISO ? sem.finISO   : finMesISO,
    fragDays: sem.diasEnMesSel,
  }));
  const t = tramos[semIdx] || tramos[0];
  const nombreSuc = sucursales.find(s=>s.id===suc)?.nombre || '';

  useEffect(() => { if (sucursales.length && !suc) setSuc(sucursales[0].id); }, [sucursales]);
  useEffect(() => { if (suc) cargar(); }, [suc, anio, mes]);
  useEffect(() => {
    if (tramos.length && anio===HOY.getFullYear() && mes===(HOY.getMonth()+1)) {
      const hoyISO = `${pmes}-${String(HOY.getDate()).padStart(2,'0')}`;
      const i = tramos.findIndex(x => hoyISO>=x.start && hoyISO<=x.end);
      if (i>=0) setSemIdx(i);
    }
  }, [mes, anio, suc]);

  async function cargar() {
    const desde = tramos.length ? tramos[0].inicioISO : iniMesISO;
    const hasta = tramos.length ? tramos[tramos.length-1].finISO : finMesISO;
    const { data: v } = await supabase.from('ventas_diarias')
      .select('fecha,efectivo,tarjeta_debito,tarjeta_credito,tarjeta_otras,plataforma,propinas')
      .eq('sucursal_id',suc).gte('fecha',desde).lte('fecha',hasta);
    setVentas(v||[]);
    const { data: g } = await supabase.from('gastos').select('fecha,monto,metodo,categoria,descripcion')
      .eq('sucursal_id',suc).gte('fecha',desde).lte('fecha',hasta).order('fecha');
    setGastos(g||[]);
    const { data: c } = await supabase.from('colaboradores').select('*').eq('sucursal_id',suc).eq('activo',true).order('nombre');
    setColabs(c||[]);
    const ids = (c||[]).map(x=>x.id);
    if (ids.length) {
      const { data: dt } = await supabase.from('dias_trabajados').select('*')
        .in('colaborador_id',ids).gte('fecha_inicio',iniMesISO).lte('fecha_inicio',finMesISO);
      const mp={}; (dt||[]).forEach(r=>{ mp[`${r.colaborador_id}|${r.fecha_inicio}`]={dias:r.dias, retardos:r.retardos}; }); setRegistros(mp);
      const { data: dd } = await supabase.from('deducciones').select('*')
        .in('colaborador_id',ids).gte('fecha_inicio',iniMesISO).lte('fecha_inicio',finMesISO);
      setDeducs(dd||[]);
      const { data: mm } = await supabase.from('nomina_metodo').select('*')
        .in('colaborador_id',ids).gte('fecha_inicio',iniMesISO).lte('fecha_inicio',finMesISO);
      const mp2={}; (mm||[]).forEach(r=>{ mp2[`${r.colaborador_id}|${r.fecha_inicio}`]={sueldo:r.sueldo, metodo:r.metodo}; }); setMetodos(mp2);
    } else { setRegistros({}); setDeducs([]); setMetodos({}); }
    const { data: om } = await supabase.from('objetivos').select('meta_mensual')
      .eq('sucursal_id',suc).eq('anio',anio).eq('mes',mes).maybeSingle();
    setMetaMes(Number(om?.meta_mensual||0));
  }

  const ventaEntre = (a,b) => ventas.filter(v=>v.fecha>=a && v.fecha<=b).reduce((s,v)=>s+ventaBruta(v),0);
  const diasDe = (cid,start,fragDays) => { const r=registros[`${cid}|${start}`]; const v=r?.dias; return (v===undefined||v===null||v==='')?fragDays:Number(v); };
  const retDe = (cid,start) => Number(registros[`${cid}|${start}`]?.retardos||0);

  // ----- Datos de la semana -----
  const inRango = f => t && f>=t.start && f<=t.end;
  const vSem = ventas.filter(v=>inRango(v.fecha));
  const efeSem = vSem.reduce((a,v)=>a+Number(v.efectivo||0),0);
  const tarSem = vSem.reduce((a,v)=>a+Number(v.tarjeta_debito||0)+Number(v.tarjeta_credito||0)+Number(v.tarjeta_otras||0),0);
  const platSem = vSem.reduce((a,v)=>a+Number(v.plataforma||0),0);
  const propSem = vSem.reduce((a,v)=>a+Number(v.propinas||0),0);
  const totalSem = efeSem+tarSem+platSem;

  const gSem = gastos.filter(g=>inRango(g.fecha));
  const gastosEfeSem = gSem.filter(g=>(g.metodo||'efectivo')==='efectivo').reduce((a,g)=>a+Number(g.monto),0);
  const gastosTotSem = gSem.reduce((a,g)=>a+Number(g.monto),0);
  const gastosOtroSem = gastosTotSem - gastosEfeSem;
  const tagMet = { efectivo:'g', tarjeta:'a', transferencia:'n' };

  // ----- Nómina de la semana -----
  const bonoSem = t ? calcularBono({
    ventaPeriodo: totalSem, meta: t.fragDays*metaDiaria, tipo:'semanal', cfg:config,
    colaboradores: colabs.map(c=>({ id:c.id, nombre:c.nombre, retardos:retDe(c.id,t.start), faltas:0,
      factor: t.fragDays>0 ? Math.min(1, diasDe(c.id,t.start,t.fragDays)/t.fragDays) : 1 })),
  }) : { detalle:[] };
  const bonoDe = id => bonoSem.detalle.find(d=>d.id===id)?.bono || 0;
  const dedDe = id => deducs.filter(d=>d.colaborador_id===id && d.fecha_inicio===t?.start).reduce((s,d)=>s+Number(d.monto),0);
  const metDe = id => metodos[`${id}|${t?.start}`]?.metodo || 'efectivo';
  const factor7 = t ? t.fragDays/7 : 1;   // semana partida: sueldo proporcional
  const nomina = colabs.map(c=>{
    const sueldo = sueldoEfectivoSemana(c.id, semIdx, tramos, metodos, c.sueldo) * factor7;
    const b=bonoDe(c.id), d=dedDe(c.id);
    return { id:c.id, nombre:c.nombre, sueldo, bono:b, ded:d, neto:sueldo+b-d, metodo:metDe(c.id) }; });
  const nominaEfectivo = nomina.filter(n=>n.metodo==='efectivo').reduce((s,n)=>s+n.neto,0);
  const nominaTotal = nomina.reduce((s,n)=>s+n.neto,0);

  const efectivoRestante = efeSem - gastosEfeSem - propSem - nominaEfectivo;

  const metaSem = t ? t.fragDays*metaDiaria : 0;
  const avSem = avance(totalSem, metaSem);

  // ----- Proyección del mes -----
  const totalMes = ventas.filter(v=>v.fecha.startsWith(pmes)).reduce((a,v)=>a+ventaBruta(v),0);
  const esMesActual = anio===HOY.getFullYear() && mes===(HOY.getMonth()+1);
  const diasTrans = esMesActual ? HOY.getDate() : ndMes;
  const proyeccion = diasTrans>0 ? (totalMes/diasTrans)*ndMes : totalMes;

  return (
    <>
      <div className="topbar no-print">
        <button className="btn" onClick={()=>window.print()}>Descargar / compartir PDF</button></div>

      <div className="card no-print" style={{marginBottom:18}}>
        <div className="row">
          <SelSucursal sucursales={sucursales} value={suc} onChange={setSuc} />
          <SelAnio value={anio} onChange={setAnio} />
          <SelMes value={mes} onChange={setMes} />
          <div className="field"><label>Semana</label>
            <select value={semIdx} onChange={e=>setSemIdx(Number(e.target.value))}>
              {tramos.map((x,i)=><option key={i} value={i}>Semana {i+1} ({etiqueta(x.start)}–{etiqueta(x.end)})</option>)}
            </select></div>
        </div>
        <p className="hint">Usa "Descargar / compartir PDF" y elige "Guardar como PDF".</p>
      </div>

      <div className="card reporte-header" style={{marginBottom:16,display:'flex',alignItems:'center',gap:16}}>
        <img src="/logo.png" className="reporte-logo" alt="Logo" />
        <div>
          <h2 style={{marginBottom:4}}>Reporte semanal — {nombreSuc}</h2>
          <p className="muted" style={{margin:0}}>{t ? `Semana ${semIdx+1} · ${etiqueta(t.start)} – ${etiqueta(t.end)} · ${t.fragDays} días · ${MESES[mes-1]} ${anio}` : ''}</p>
        </div>
      </div>

      <div className="grid kpis" style={{marginBottom:16}}>
        <div className="card kpi"><div className="label">Venta de la semana</div><div className="value">{mxn(totalSem)}</div>
          <div className="delta muted">Efe {mxn(efeSem)} · Tar {mxn(tarSem)} · Plat {mxn(platSem)}</div></div>
        <div className="card kpi"><div className="label">Ventas en efectivo</div><div className="value">{mxn(efeSem)}</div></div>
        <div className="card kpi"><div className="label">Gastos de la semana</div><div className="value down">−{mxn(gastosTotSem)}</div>
          <div className="delta muted">Efectivo {mxn(gastosEfeSem)} · Otros {mxn(gastosOtroSem)}</div></div>
        <div className="card kpi"><div className="label">Propinas (efectivo)</div><div className="value down">−{mxn(propSem)}</div></div>
        <div className="card kpi"><div className="label">Nómina en efectivo</div><div className="value down">−{mxn(nominaEfectivo)}</div></div>
        <div className="card kpi"><div className="label">Efectivo restante</div>
          <div className={'value '+(efectivoRestante>=0?'up':'down')}>{mxn(efectivoRestante)}</div>
          <div className="delta muted">efectivo − gastos − propinas − nómina</div></div>
      </div>

      <div className="grid" style={{gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
        <div className="card">
          <h2>Alcance del objetivo (semana)</h2>
          <table><tbody>
            <tr><td>Meta semanal ({t?.fragDays||0} días)</td><td className="num">{mxn(metaSem)}</td></tr>
            <tr><td>Venta de la semana</td><td className="num">{mxn(totalSem)}</td></tr>
            <tr><td><b>Avance</b></td><td className="num"><b>{metaSem>0?pct(avSem):'—'}</b></td></tr>
          </tbody></table>
          {metaSem>0 && <div className="bar"><span style={{width:Math.min(100,avSem*100)+'%',background:avSem>=1?'var(--green)':avSem>=0.7?'var(--amber)':'var(--red)'}}></span></div>}
        </div>
        <div className="card">
          <h2>Proyección del mes ({MESES[mes-1]})</h2>
          <table><tbody>
            <tr><td>Venta acumulada ({diasTrans} de {ndMes} días)</td><td className="num">{mxn(totalMes)}</td></tr>
            <tr><td><b>Proyección fin de mes</b></td><td className="num"><b>{mxn(proyeccion)}</b></td></tr>
            <tr><td>Meta mensual</td><td className="num">{mxn(metaMes)}</td></tr>
            <tr><td>Avance actual</td><td className="num">{metaMes>0?pct(avance(totalMes,metaMes)):'—'}</td></tr>
            <tr><td>Avance proyectado</td><td className="num">{metaMes>0?pct(avance(proyeccion,metaMes)):'—'}</td></tr>
          </tbody></table>
        </div>
      </div>

      <div className="card" style={{marginBottom:16}}>
        <h2>Desglose de nómina de la semana</h2>
        <div style={{overflowX:'auto'}}>
        <table>
          <thead><tr><th>Colaborador</th><th className="num">Sueldo</th><th className="num">Bono</th><th className="num">Deducciones</th><th className="num">Neto</th><th>Se pagó con</th></tr></thead>
          <tbody>
            {nomina.map(n=>(
              <tr key={n.id}><td>{n.nombre}</td><td className="num">{mxn(n.sueldo)}</td><td className="num">{mxn(n.bono)}</td>
                <td className="num down">{n.ded>0?'−'+mxn(n.ded):'—'}</td><td className="num"><b>{mxn(n.neto)}</b></td>
                <td><span className={'tag '+(n.metodo==='efectivo'?'g':'n')}>{n.metodo}</span></td></tr>
            ))}
            {nomina.length===0 && <tr><td colSpan={6} className="muted">Sin colaboradores.</td></tr>}
          </tbody>
          <tfoot>
            <tr style={{borderTop:'2px solid var(--line)'}}><td colSpan={4}><b>Total nómina</b></td><td className="num"><b>{mxn(nominaTotal)}</b></td><td></td></tr>
            <tr><td colSpan={4} className="muted">Pagada en efectivo (sale de caja)</td><td className="num down"><b>−{mxn(nominaEfectivo)}</b></td><td></td></tr>
          </tfoot>
        </table>
        </div>
        <p className="hint">El método de pago se define en la sección de Nómina. Solo la nómina en efectivo baja el efectivo restante.</p>
      </div>

      <div className="card">
        <h2>Gastos de la semana</h2>
        <table>
          <thead><tr><th>Fecha</th><th>Método</th><th>Categoría</th><th>Descripción</th><th className="num">Monto</th></tr></thead>
          <tbody>
            {gSem.map((g,i)=>{ const met=g.metodo||'efectivo'; return (
              <tr key={i}><td>{g.fecha}</td>
                <td><span className={'tag '+(tagMet[met]||'n')}>{met}</span></td>
                <td>{g.categoria||'—'}</td><td>{g.descripcion||'—'}</td><td className="num">{mxn(g.monto)}</td></tr>
            );})}
            {gSem.length===0 && <tr><td colSpan={5} className="muted">Sin gastos esta semana.</td></tr>}
          </tbody>
          <tfoot>
            <tr><td colSpan={4} className="muted">En efectivo (baja la caja)</td><td className="num">{mxn(gastosEfeSem)}</td></tr>
            <tr><td colSpan={4} className="muted">Otros métodos (tarjeta / transferencia)</td><td className="num">{mxn(gastosOtroSem)}</td></tr>
            <tr style={{borderTop:'2px solid var(--line)'}}><td colSpan={4}><b>Total gastos de la semana</b></td><td className="num"><b>{mxn(gastosTotSem)}</b></td></tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}

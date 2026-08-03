'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSucursales, useConfig } from '../../lib/hooks';
import { SelSucursal, SelMes, SelAnio } from '../../components/Selectores';
import { mxn, pct, avance, semanaDelMes, semanasDelMes, metaEfectivaSemana, calcularBono } from '../../lib/calculos';
import { MESES } from '../../lib/fechas';

const HOY = new Date();
const MESABR = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function diasDelMes(a,m){ return new Date(a,m,0).getDate(); }
function iso(a,m,d){ return `${a}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }

export default function Bonos() {
  const { sucursales } = useSucursales();
  const { config } = useConfig();
  const [suc, setSuc] = useState('');
  const [anio, setAnio] = useState(HOY.getFullYear());
  const [mes, setMes] = useState(HOY.getMonth() + 1);
  const [ventas, setVentas] = useState([]);
  const [colabs, setColabs] = useState([]);
  const [inc, setInc] = useState([]);
  const [metaMes, setMetaMes] = useState(0);
  const [metasSem, setMetasSem] = useState({});

  useEffect(() => { if (sucursales.length && !suc) setSuc(sucursales[0].id); }, [sucursales]);
  useEffect(() => { if (suc) cargar(); }, [suc, anio, mes]);

  async function cargar() {
    const desde = iso(anio,mes,1), hasta = iso(anio,mes,diasDelMes(anio,mes));
    const { data: v } = await supabase.from('ventas_diarias').select('fecha,efectivo,tarjeta')
      .eq('sucursal_id',suc).gte('fecha',desde).lte('fecha',hasta);
    setVentas(v||[]);
    const { data: c } = await supabase.from('colaboradores').select('*').eq('sucursal_id',suc).eq('activo',true).order('nombre');
    setColabs(c||[]);
    const ids = (c||[]).map(x=>x.id);
    let incid = [];
    if (ids.length) {
      const { data: a } = await supabase.from('asistencia').select('*')
        .in('colaborador_id',ids).gte('fecha',desde).lte('fecha',hasta).neq('estatus','presente');
      incid = a||[];
    }
    setInc(incid);
    const { data: om } = await supabase.from('objetivos').select('meta_mensual')
      .eq('sucursal_id',suc).eq('anio',anio).eq('mes',mes).maybeSingle();
    setMetaMes(Number(om?.meta_mensual||0));
    const { data: os } = await supabase.from('objetivos_semanales').select('semana,meta_semanal')
      .eq('sucursal_id',suc).eq('anio',anio).eq('mes',mes);
    const ms={}; (os||[]).forEach(r=>ms[r.semana]=Number(r.meta_semanal)); setMetasSem(ms);
  }

  function ventaDeSemana(w){
    return ventas.filter(v=>semanaDelMes(v.fecha)===w)
      .reduce((a,v)=>a+Number(v.efectivo||0)+Number(v.tarjeta||0),0);
  }
  function colabsConAsistencia(rangoFiltro){
    return colabs.map(c=>({
      id:c.id, nombre:c.nombre,
      faltas: inc.filter(i=>i.colaborador_id===c.id && i.estatus==='falta' && rangoFiltro(i.fecha)).length,
      retardos: inc.filter(i=>i.colaborador_id===c.id && i.estatus==='retardo' && rangoFiltro(i.fecha)).length,
    }));
  }

  const semanasMes = semanasDelMes(anio, mes);
  const semanas = semanasMes.map(s=>s.semana);
  const infoSemana = w => semanasMes.find(s=>s.semana===w) || { inicio:0, fin:0, numDias:7 };
  const ventaMes = ventas.reduce((a,v)=>a+Number(v.efectivo||0)+Number(v.tarjeta||0),0);
  const bonoMensual = calcularBono({
    ventaPeriodo: ventaMes, meta: metaMes, tipo:'mensual', cfg: config,
    colaboradores: colabsConAsistencia(()=>true),
  });

  return (
    <>
      <div className="topbar"><h1>🏆 Bonos</h1></div>
      <div className="card" style={{marginBottom:18}}>
        <div className="row">
          <SelSucursal sucursales={sucursales} value={suc} onChange={setSuc} />
          <SelAnio value={anio} onChange={setAnio} />
          <SelMes value={mes} onChange={setMes} />
        </div>
      </div>

      <p className="section-title">Bono semanal · cada colaborador elegible recibe el % de la venta de la semana</p>
      {semanas.length===0 && <div className="card muted">Aún no hay ventas capturadas este mes.</div>}
      {semanas.map(w=>{
        const venta = ventaDeSemana(w);
        const info = infoSemana(w);
        const metaBase = metasSem[w]||0;
        const parcial = info.numDias < 7;
        const meta = parcial ? metaEfectivaSemana(metaBase, info.numDias) : metaBase;
        const b = calcularBono({ ventaPeriodo:venta, meta, tipo:'semanal', cfg:config,
          colaboradores: colabsConAsistencia(f=>semanaDelMes(f)===w) });
        const rango = `${info.inicio}–${info.fin} ${MESABR[mes-1]}`;
        return (
          <div className="card" key={w} style={{marginBottom:14}}>
            <div className="row" style={{justifyContent:'space-between'}}>
              <h2 style={{margin:0}}>Semana {w} <span className="hint">({rango} · {info.numDias} días{parcial?', semana partida':''})</span></h2>
              <div className="muted">Venta {mxn(venta)} · Meta {mxn(meta)}
                {parcial && <span className="hint"> (ajustada de {mxn(metaBase)})</span>} ·
                Avance <b className={b.avance>=1?'up':''}>{meta>0?pct(b.avance):'—'}</b> ·
                Paga <b>{pct(b.porcentaje)}</b></div>
            </div>
            <table style={{marginTop:10}}>
              <thead><tr><th>Colaborador</th><th className="num">Faltas</th><th className="num">Retardos</th><th>Estado</th><th className="num">Bono</th></tr></thead>
              <tbody>
                {b.detalle.map(d=>(
                  <tr key={d.id}><td>{d.nombre}</td><td className="num">{d.faltas}</td><td className="num">{d.retardos}</td>
                    <td>{d.elegible?<span className="tag g">Elegible</span>:<span className="tag r">Sin bono</span>}</td>
                    <td className="num"><b>{mxn(d.bono)}</b></td></tr>
                ))}
                {b.detalle.length===0 && <tr><td colSpan={5} className="muted">Sin colaboradores.</td></tr>}
              </tbody>
              <tfoot><tr><td colSpan={4}><b>Total a pagar semana {w}</b></td><td className="num"><b>{mxn(b.totalPagar)}</b></td></tr></tfoot>
            </table>
          </div>
        );
      })}

      <p className="section-title">Bono mensual · la bolsa se reparte en partes iguales entre elegibles</p>
      <div className="card">
        <div className="row" style={{justifyContent:'space-between'}}>
          <h2 style={{margin:0}}>Mes completo</h2>
          <div className="muted">Venta {mxn(ventaMes)} · Meta {mxn(metaMes)} ·
            Avance <b className={bonoMensual.avance>=1?'up':''}>{metaMes>0?pct(bonoMensual.avance):'—'}</b> ·
            Paga <b>{pct(bonoMensual.porcentaje)}</b> · Bolsa <b>{mxn(bonoMensual.montoBase)}</b></div>
        </div>
        <table style={{marginTop:10}}>
          <thead><tr><th>Colaborador</th><th className="num">Faltas</th><th className="num">Retardos</th><th>Estado</th><th className="num">Bono</th></tr></thead>
          <tbody>
            {bonoMensual.detalle.map(d=>(
              <tr key={d.id}><td>{d.nombre}</td><td className="num">{d.faltas}</td><td className="num">{d.retardos}</td>
                <td>{d.elegible?<span className="tag g">Elegible</span>:<span className="tag r">Sin bono</span>}</td>
                <td className="num"><b>{mxn(d.bono)}</b></td></tr>
            ))}
            {bonoMensual.detalle.length===0 && <tr><td colSpan={5} className="muted">Sin colaboradores.</td></tr>}
          </tbody>
          <tfoot><tr><td colSpan={4}><b>Total a pagar mensual</b></td><td className="num"><b>{mxn(bonoMensual.totalPagar)}</b></td></tr></tfoot>
        </table>
      </div>
    </>
  );
}

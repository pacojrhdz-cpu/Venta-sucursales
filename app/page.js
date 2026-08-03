'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useSucursales } from '../lib/hooks';
import { SelSucursal, SelMes, SelAnio } from '../components/Selectores';
import { mxn, pct, avance, comisionTarjeta } from '../lib/calculos';
import { MESES } from '../lib/fechas';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const HOY = new Date();
function diasDelMes(a,m){ return new Date(a,m,0).getDate(); }
function iso(a,m,d){ return `${a}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
function mesAnterior(a,m){ return m===1 ? {a:a-1,m:12} : {a,m:m-1}; }

export default function Dashboard() {
  const { sucursales } = useSucursales();
  const [suc, setSuc] = useState('');           // '' = todas
  const [anio, setAnio] = useState(HOY.getFullYear());
  const [mes, setMes] = useState(HOY.getMonth() + 1);
  const [datos, setDatos] = useState(null);

  useEffect(() => { if (sucursales.length) cargar(); }, [sucursales, suc, anio, mes]);

  async function cargar() {
    const tasaDe = id => Number(sucursales.find(s=>s.id===id)?.comision_tarjeta||0.035);
    const filtroSuc = q => suc ? q.eq('sucursal_id', suc) : q;

    // Rango de 6 meses para la tendencia
    let ini = { a: anio, m: mes };
    for (let i=0;i<5;i++) ini = mesAnterior(ini.a, ini.m);
    const desdeRango = iso(ini.a, ini.m, 1);
    const hastaRango = iso(anio, mes, diasDelMes(anio,mes));

    const { data: vRange } = await filtroSuc(
      supabase.from('ventas_diarias').select('sucursal_id,fecha,efectivo,tarjeta')
        .gte('fecha',desdeRango).lte('fecha',hastaRango));

    // Tendencia por mes
    const trend = [];
    let cur = { a: ini.a, m: ini.m };
    for (let i=0;i<6;i++) {
      const tot = (vRange||[]).filter(v=>{
        const y=Number(v.fecha.slice(0,4)), mm=Number(v.fecha.slice(5,7));
        return y===cur.a && mm===cur.m;
      }).reduce((a,v)=>a+Number(v.efectivo||0)+Number(v.tarjeta||0),0);
      trend.push({ mes: MESES[cur.m-1].slice(0,3), total: Math.round(tot) });
      cur = cur.m===12 ? {a:cur.a+1,m:1} : {a:cur.a,m:cur.m+1};
    }

    // Mes actual y anterior
    const prev = mesAnterior(anio, mes);
    const enMes = (v,a,m)=> Number(v.fecha.slice(0,4))===a && Number(v.fecha.slice(5,7))===m;
    const vAct = (vRange||[]).filter(v=>enMes(v,anio,mes));
    const vPrev = (vRange||[]).filter(v=>enMes(v,prev.a,prev.m));

    const sum = arr => arr.reduce((o,v)=>{
      o.efe+=Number(v.efectivo||0); o.tar+=Number(v.tarjeta||0);
      o.com+=comisionTarjeta(Number(v.tarjeta||0), tasaDe(v.sucursal_id));
      return o;
    }, {efe:0,tar:0,com:0});
    const act = sum(vAct), pre = sum(vPrev);
    const totalAct = act.efe+act.tar, totalPre = pre.efe+pre.tar;

    // Gastos mes actual
    const { data: gAct } = await filtroSuc(
      supabase.from('gastos').select('sucursal_id,monto')
        .gte('fecha',iso(anio,mes,1)).lte('fecha',iso(anio,mes,diasDelMes(anio,mes))));
    const gastosAct = (gAct||[]).reduce((a,g)=>a+Number(g.monto),0);

    // Objetivos mes actual
    const { data: obj } = await filtroSuc(
      supabase.from('objetivos').select('sucursal_id,meta_mensual').eq('anio',anio).eq('mes',mes));
    const metaTotal = (obj||[]).reduce((a,o)=>a+Number(o.meta_mensual),0);

    // Desglose por sucursal (mes actual)
    const porSuc = (suc ? sucursales.filter(s=>s.id===suc) : sucursales).map(s=>{
      const vv = vAct.filter(v=>v.sucursal_id===s.id);
      const efe = vv.reduce((a,v)=>a+Number(v.efectivo||0),0);
      const tar = vv.reduce((a,v)=>a+Number(v.tarjeta||0),0);
      const com = comisionTarjeta(tar, Number(s.comision_tarjeta));
      const gs = (gAct||[]).filter(g=>g.sucursal_id===s.id).reduce((a,g)=>a+Number(g.monto),0);
      const meta = (obj||[]).find(o=>o.sucursal_id===s.id)?.meta_mensual || 0;
      return { nombre:s.nombre, efe, tar, com, total:efe+tar, gastos:gs, meta:Number(meta) };
    });

    setDatos({ trend, totalAct, totalPre, act, gastosAct, metaTotal, porSuc, prev });
  }

  if (!datos) return <p className="muted">Cargando panel…</p>;
  const { trend, totalAct, totalPre, act, gastosAct, metaTotal, porSuc, prev } = datos;
  const delta = totalPre>0 ? (totalAct-totalPre)/totalPre : null;
  // Utilidad bruta = venta total − comisión terminal − gastos
  const utilidadAct = totalAct - act.com - gastosAct;
  const margenAct = totalAct>0 ? utilidadAct/totalAct : null;

  return (
    <>
      <div className="topbar"><h1>📊 Panel de control</h1></div>
      <div className="card" style={{marginBottom:18}}>
        <div className="row">
          <SelSucursal sucursales={sucursales} value={suc} onChange={setSuc} todas />
          <SelAnio value={anio} onChange={setAnio} />
          <SelMes value={mes} onChange={setMes} />
        </div>
      </div>

      <div className="grid kpis" style={{marginBottom:18}}>
        <div className="card kpi"><div className="label">Venta {MESES[mes-1]}</div>
          <div className="value">{mxn(totalAct)}</div>
          {delta!==null && <div className={'delta '+(delta>=0?'up':'down')}>
            {delta>=0?'▲':'▼'} {pct(Math.abs(delta))} vs {MESES[prev.m-1]}</div>}
        </div>
        <div className="card kpi"><div className="label">Mes anterior</div><div className="value">{mxn(totalPre)}</div>
          <div className="delta muted">{MESES[prev.m-1]} {prev.a}</div></div>
        <div className="card kpi"><div className="label">Comisión terminal</div><div className="value down">−{mxn(act.com)}</div>
          <div className="delta muted">Tarjeta: {mxn(act.tar)}</div></div>
        <div className="card kpi"><div className="label">Gastos del mes</div><div className="value">{mxn(gastosAct)}</div></div>
        <div className="card kpi"><div className="label">Utilidad bruta</div>
          <div className={'value '+(utilidadAct>=0?'up':'down')}>{mxn(utilidadAct)}</div>
          <div className="delta muted">Venta − comisión − gastos{margenAct!==null?` · margen ${pct(margenAct)}`:''}</div></div>
        <div className="card kpi"><div className="label">Avance del objetivo</div>
          <div className="value">{metaTotal>0?pct(avance(totalAct,metaTotal)):'—'}</div>
          <div className="delta muted">Meta: {mxn(metaTotal)}</div>
          {metaTotal>0 && <div className="bar"><span style={{width:Math.min(100,avance(totalAct,metaTotal)*100)+'%',
            background: avance(totalAct,metaTotal)>=1?'var(--green)':'var(--brand)'}}></span></div>}
        </div>
      </div>

      <div className="card" style={{marginBottom:18}}>
        <h2>Tendencia de ventas (últimos 6 meses)</h2>
        <div style={{width:'100%',height:260}}>
          <ResponsiveContainer>
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#243352" />
              <XAxis dataKey="mes" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" tickFormatter={v=>'$'+(v/1000)+'k'} />
              <Tooltip formatter={v=>mxn(v)} contentStyle={{background:'#16223d',border:'1px solid #243352',borderRadius:8}} />
              <Bar dataKey="total" fill="#3b82f6" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2>Desglose por sucursal — {MESES[mes-1]} {anio}</h2>
        <div style={{overflowX:'auto'}}>
        <table>
          <thead><tr><th>Sucursal</th><th className="num">Efectivo</th><th className="num">Tarjeta</th>
            <th className="num">Comisión</th><th className="num">Venta total</th><th className="num">Gastos</th>
            <th className="num">Utilidad bruta</th><th className="num">Meta</th><th className="num">Avance</th></tr></thead>
          <tbody>
            {porSuc.map((s,i)=>{
              const av = avance(s.total, s.meta);
              const util = s.total - s.com - s.gastos;
              return (
                <tr key={i}><td><b>{s.nombre}</b></td>
                  <td className="num">{mxn(s.efe)}</td><td className="num">{mxn(s.tar)}</td>
                  <td className="num down">−{mxn(s.com)}</td><td className="num"><b>{mxn(s.total)}</b></td>
                  <td className="num">{mxn(s.gastos)}</td>
                  <td className={'num '+(util>=0?'up':'down')}><b>{mxn(util)}</b></td>
                  <td className="num">{mxn(s.meta)}</td>
                  <td className="num">{s.meta>0
                    ? <span className={'tag '+(av>=1?'g':av>=0.7?'a':'r')}>{pct(av)}</span>
                    : <span className="tag n">—</span>}</td>
                </tr>
              );
            })}
            {porSuc.length===0 && <tr><td colSpan={9} className="muted">Sin sucursales.</td></tr>}
          </tbody>
        </table>
        </div>
      </div>
    </>
  );
}

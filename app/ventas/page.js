'use client';
import { Fragment, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSucursales } from '../../lib/hooks';
import { SelSucursal, SelMes, SelAnio } from '../../components/Selectores';
import { mxn, pct, avance, semanaDelMes, semanasDelMes, metaEfectivaSemana } from '../../lib/calculos';

const HOY = new Date();
function diasDelMes(anio, mes){ return new Date(anio, mes, 0).getDate(); }
function iso(anio,mes,dia){ return `${anio}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`; }

export default function Ventas() {
  const { sucursales } = useSucursales();
  const [suc, setSuc] = useState('');
  const [anio, setAnio] = useState(HOY.getFullYear());
  const [mes, setMes] = useState(HOY.getMonth() + 1);
  const [tasa, setTasa] = useState(0.035);       // comisión terminal
  const [tasaPlat, setTasaPlat] = useState(0);   // comisión plataforma
  const [ventas, setVentas] = useState({});      // dia -> {efectivo,tarjeta,plataforma}
  const [gastos, setGastos] = useState({});      // dia -> monto
  const [metaMes, setMetaMes] = useState(0);
  const [metasSem, setMetasSem] = useState({});

  useEffect(() => { if (sucursales.length && !suc) setSuc(sucursales[0].id); }, [sucursales]);
  useEffect(() => { if (suc) cargar(); }, [suc, anio, mes]);

  async function cargar() {
    const s = sucursales.find(x => x.id === suc);
    setTasa(s ? Number(s.comision_tarjeta) : 0.035);
    setTasaPlat(s ? Number(s.comision_plataforma||0) : 0);
    const desde = iso(anio,mes,1), hasta = iso(anio,mes,diasDelMes(anio,mes));

    const { data: v } = await supabase.from('ventas_diarias')
      .select('fecha,efectivo,tarjeta,plataforma').eq('sucursal_id',suc).gte('fecha',desde).lte('fecha',hasta);
    const mv = {}; (v||[]).forEach(r => { mv[Number(r.fecha.slice(8,10))] = { efectivo:r.efectivo, tarjeta:r.tarjeta, plataforma:r.plataforma }; });
    setVentas(mv);

    const { data: g } = await supabase.from('gastos')
      .select('fecha,monto').eq('sucursal_id',suc).gte('fecha',desde).lte('fecha',hasta);
    const mg = {}; (g||[]).forEach(r => { const d=Number(r.fecha.slice(8,10)); mg[d]=(mg[d]||0)+Number(r.monto); });
    setGastos(mg);

    const { data: om } = await supabase.from('objetivos')
      .select('meta_mensual').eq('sucursal_id',suc).eq('anio',anio).eq('mes',mes).maybeSingle();
    setMetaMes(Number(om?.meta_mensual||0));
    const { data: os } = await supabase.from('objetivos_semanales')
      .select('semana,meta_semanal').eq('sucursal_id',suc).eq('anio',anio).eq('mes',mes);
    const ms={}; (os||[]).forEach(r=>ms[r.semana]=Number(r.meta_semanal)); setMetasSem(ms);
  }

  async function guardarDia(dia, campo, valor) {
    const actual = ventas[dia] || { efectivo:0, tarjeta:0, plataforma:0 };
    const nuevo = { ...actual, [campo]: Number(valor||0) };
    setVentas({ ...ventas, [dia]: nuevo });
    await supabase.from('ventas_diarias').upsert({
      sucursal_id: suc, fecha: iso(anio,mes,dia),
      efectivo: Number(nuevo.efectivo||0), tarjeta: Number(nuevo.tarjeta||0), plataforma: Number(nuevo.plataforma||0),
    }, { onConflict: 'sucursal_id,fecha' });
  }

  const comisionDia = (tar, plat) => Number(tar||0)*tasa + Number(plat||0)*tasaPlat;

  const ndias = diasDelMes(anio, mes);
  const dias = Array.from({length:ndias}, (_,i)=>i+1);

  // Totales por semana y mes
  let totEfe=0, totTar=0, totPlat=0, totCom=0, totGas=0;
  const semAcum = {};
  dias.forEach(d => {
    const v = ventas[d] || {}; const efe=Number(v.efectivo||0), tar=Number(v.tarjeta||0), plat=Number(v.plataforma||0);
    const com = comisionDia(tar, plat); const tot = efe+tar+plat; const gas=Number(gastos[d]||0);
    totEfe+=efe; totTar+=tar; totPlat+=plat; totCom+=com; totGas+=gas;
    const sem = semanaDelMes(iso(anio,mes,d));
    semAcum[sem] = (semAcum[sem]||0) + tot;
  });
  const totalVenta = totEfe + totTar + totPlat;

  // Info de semanas (lunes-domingo) del mes, para metas ajustadas
  const infoSem = {};
  semanasDelMes(anio, mes).forEach(s => infoSem[s.semana] = s);
  const metaSemAjustada = w => {
    const base = Number(metasSem[w]||0); const nd = infoSem[w]?.numDias || 7;
    return nd < 7 ? metaEfectivaSemana(base, nd) : base;
  };

  return (
    <>
      <div className="topbar"><h1>💵 Ventas diarias</h1></div>

      <div className="card" style={{marginBottom:18}}>
        <div className="row">
          <SelSucursal sucursales={sucursales} value={suc} onChange={setSuc} />
          <SelAnio value={anio} onChange={setAnio} />
          <SelMes value={mes} onChange={setMes} />
          <div className="field"><label>Com. terminal</label><input value={pct(tasa)} disabled /></div>
          <div className="field"><label>Com. plataforma</label><input value={pct(tasaPlat)} disabled /></div>
        </div>
      </div>

      <div className="grid kpis" style={{marginBottom:18}}>
        <div className="card kpi"><div className="label">Venta total mes</div><div className="value">{mxn(totalVenta)}</div>
          <div className="delta muted">Meta: {mxn(metaMes)} · {metaMes>0?pct(avance(totalVenta,metaMes)):'—'}</div></div>
        <div className="card kpi"><div className="label">Efectivo</div><div className="value">{mxn(totEfe)}</div></div>
        <div className="card kpi"><div className="label">Tarjeta</div><div className="value">{mxn(totTar)}</div></div>
        <div className="card kpi"><div className="label">Plataforma</div><div className="value">{mxn(totPlat)}</div></div>
        <div className="card kpi"><div className="label">Comisiones</div><div className="value down">−{mxn(totCom)}</div>
          <div className="delta muted">terminal + plataforma</div></div>
        <div className="card kpi"><div className="label">Gastos mes</div><div className="value">{mxn(totGas)}</div></div>
      </div>

      <div className="card">
        <h2>Captura por día — las comisiones se calculan automáticamente</h2>
        <div style={{overflowX:'auto'}}>
        <table>
          <thead><tr>
            <th>Día</th><th>Sem</th><th className="num">Efectivo</th><th className="num">Tarjeta</th>
            <th className="num">Plataforma</th><th className="num">Comisión</th><th className="num">Total</th><th className="num">Gastos</th>
          </tr></thead>
          <tbody>
            {dias.map(d => {
              const v = ventas[d] || {}; const tar=Number(v.tarjeta||0), plat=Number(v.plataforma||0);
              const com = comisionDia(tar, plat); const tot=Number(v.efectivo||0)+tar+plat;
              const sem = semanaDelMes(iso(anio,mes,d));
              const finSemana = d===ndias || semanaDelMes(iso(anio,mes,d+1))!==sem;
              return (
                <Fragment key={d}>
                <tr>
                  <td><b>{d}</b></td><td className="muted">{sem}</td>
                  <td className="num"><input type="number" style={{width:100,textAlign:'right'}}
                    defaultValue={v.efectivo??''} placeholder="0"
                    onBlur={e=>guardarDia(d,'efectivo',e.target.value)} /></td>
                  <td className="num"><input type="number" style={{width:100,textAlign:'right'}}
                    defaultValue={v.tarjeta??''} placeholder="0"
                    onBlur={e=>guardarDia(d,'tarjeta',e.target.value)} /></td>
                  <td className="num"><input type="number" style={{width:100,textAlign:'right'}}
                    defaultValue={v.plataforma??''} placeholder="0"
                    onBlur={e=>guardarDia(d,'plataforma',e.target.value)} /></td>
                  <td className="num down">{com>0?'−'+mxn(com):'—'}</td>
                  <td className="num"><b>{tot>0?mxn(tot):'—'}</b></td>
                  <td className="num muted">{gastos[d]?mxn(gastos[d]):'—'}</td>
                </tr>
                {finSemana && (
                  <tr style={{background:'#0c1730'}}>
                    <td colSpan={6} className="muted"><b>Subtotal semana {sem}</b>
                      {infoSem[sem]?.numDias<7 && <span className="hint"> · semana partida ({infoSem[sem].numDias} días)</span>}
                      {metaSemAjustada(sem)>0 && <span className="hint"> · Meta {mxn(metaSemAjustada(sem))} · Avance {pct(avance(semAcum[sem],metaSemAjustada(sem)))}</span>}</td>
                    <td className="num"><b>{mxn(semAcum[sem]||0)}</b></td><td></td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot><tr style={{borderTop:'2px solid var(--line)'}}>
            <td colSpan={2}><b>TOTAL MES</b></td>
            <td className="num"><b>{mxn(totEfe)}</b></td>
            <td className="num"><b>{mxn(totTar)}</b></td>
            <td className="num"><b>{mxn(totPlat)}</b></td>
            <td className="num down"><b>−{mxn(totCom)}</b></td>
            <td className="num"><b>{mxn(totalVenta)}</b></td>
            <td className="num"><b>{mxn(totGas)}</b></td>
          </tr></tfoot>
        </table>
        </div>
        <p className="hint">Escribe el monto y sal del campo (clic fuera) para guardar. Comisión = tarjeta × {pct(tasa)} + plataforma × {pct(tasaPlat)}.</p>
      </div>
    </>
  );
}

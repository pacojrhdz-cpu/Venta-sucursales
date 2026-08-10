'use client';
import { Fragment, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSucursales } from '../../lib/hooks';
import { SelSucursal, SelMes, SelAnio } from '../../components/Selectores';
import { mxn, pct, avance, semanaDelMes, semanasDelMes, metaSemanalEfectiva } from '../../lib/calculos';

const HOY = new Date();
function diasDelMes(anio, mes){ return new Date(anio, mes, 0).getDate(); }
function iso(anio,mes,dia){ return `${anio}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`; }

export default function Ventas() {
  const { sucursales } = useSucursales();
  const [suc, setSuc] = useState('');
  const [anio, setAnio] = useState(HOY.getFullYear());
  const [mes, setMes] = useState(HOY.getMonth() + 1);
  const [tasas, setTasas] = useState({ d:0.02, c:0.035, o:0.035, p:0 });
  const [ventas, setVentas] = useState({});   // dia -> {efectivo, tarjeta_debito, tarjeta_credito, tarjeta_otras, plataforma, propinas}
  const [gastos, setGastos] = useState({});
  const [metaMes, setMetaMes] = useState(0);
  const [metasSem, setMetasSem] = useState({});

  useEffect(() => { if (sucursales.length && !suc) setSuc(sucursales[0].id); }, [sucursales]);
  useEffect(() => { if (suc) cargar(); }, [suc, anio, mes]);

  async function cargar() {
    const s = sucursales.find(x => x.id === suc);
    setTasas({ d:Number(s?.comision_debito||0), c:Number(s?.comision_credito||0), o:Number(s?.comision_otras||0), p:Number(s?.comision_plataforma||0) });
    const desde = iso(anio,mes,1), hasta = iso(anio,mes,diasDelMes(anio,mes));

    const { data: v } = await supabase.from('ventas_diarias')
      .select('fecha,efectivo,tarjeta_debito,tarjeta_credito,tarjeta_otras,plataforma,propinas')
      .eq('sucursal_id',suc).gte('fecha',desde).lte('fecha',hasta);
    const mv = {}; (v||[]).forEach(r => { mv[Number(r.fecha.slice(8,10))] = r; });
    setVentas(mv);

    const { data: g } = await supabase.from('gastos').select('fecha,monto').eq('sucursal_id',suc).gte('fecha',desde).lte('fecha',hasta);
    const mg = {}; (g||[]).forEach(r => { const d=Number(r.fecha.slice(8,10)); mg[d]=(mg[d]||0)+Number(r.monto); });
    setGastos(mg);

    const { data: om } = await supabase.from('objetivos').select('meta_mensual').eq('sucursal_id',suc).eq('anio',anio).eq('mes',mes).maybeSingle();
    setMetaMes(Number(om?.meta_mensual||0));
    const { data: os } = await supabase.from('objetivos_semanales').select('semana,meta_semanal').eq('sucursal_id',suc).eq('anio',anio).eq('mes',mes);
    const ms={}; (os||[]).forEach(r=>ms[r.semana]=Number(r.meta_semanal)); setMetasSem(ms);
  }

  async function guardarDia(dia, campo, valor) {
    const actual = ventas[dia] || {};
    const nuevo = { ...actual, [campo]: Number(valor||0) };
    setVentas({ ...ventas, [dia]: nuevo });
    await supabase.from('ventas_diarias').upsert({
      sucursal_id: suc, fecha: iso(anio,mes,dia),
      efectivo: Number(nuevo.efectivo||0),
      tarjeta_debito: Number(nuevo.tarjeta_debito||0),
      tarjeta_credito: Number(nuevo.tarjeta_credito||0),
      tarjeta_otras: Number(nuevo.tarjeta_otras||0),
      plataforma: Number(nuevo.plataforma||0),
      propinas: Number(nuevo.propinas||0),
    }, { onConflict: 'sucursal_id,fecha' });
  }

  const comDia = v => Number(v?.tarjeta_debito||0)*tasas.d + Number(v?.tarjeta_credito||0)*tasas.c
                    + Number(v?.tarjeta_otras||0)*tasas.o + Number(v?.plataforma||0)*tasas.p;
  const totDia = v => Number(v?.efectivo||0)+Number(v?.tarjeta_debito||0)+Number(v?.tarjeta_credito||0)+Number(v?.tarjeta_otras||0)+Number(v?.plataforma||0);

  const ndias = diasDelMes(anio, mes);
  const diasMes = ndias;
  const dias = Array.from({length:ndias}, (_,i)=>i+1);

  let T={efe:0,deb:0,cre:0,otr:0,plat:0,prop:0,com:0,gas:0};
  const semAcum = {};
  dias.forEach(d => {
    const v = ventas[d] || {};
    T.efe+=Number(v.efectivo||0); T.deb+=Number(v.tarjeta_debito||0); T.cre+=Number(v.tarjeta_credito||0);
    T.otr+=Number(v.tarjeta_otras||0); T.plat+=Number(v.plataforma||0); T.prop+=Number(v.propinas||0);
    T.com+=comDia(v); T.gas+=Number(gastos[d]||0);
    semAcum[semanaDelMes(iso(anio,mes,d))] = (semAcum[semanaDelMes(iso(anio,mes,d))]||0) + totDia(v);
  });
  const totalVenta = T.efe+T.deb+T.cre+T.otr+T.plat;

  const infoSem = {};
  semanasDelMes(anio, mes).forEach(s => infoSem[s.semana] = s);
  const metaSemAjustada = w => metaSemanalEfectiva({ metaSemanalManual: Number(metasSem[w]||0), metaMensual: metaMes, numDiasSemana: infoSem[w]?.numDias || 7, diasMes });

  const inp = (d, campo) => (
    <input type="number" style={{width:88,textAlign:'right'}} placeholder="0"
      defaultValue={ventas[d]?.[campo] ?? ''} onBlur={e=>guardarDia(d,campo,e.target.value)} />
  );

  return (
    <>
      <div className="topbar"><h1>💵 Ventas diarias</h1></div>

      <div className="card" style={{marginBottom:18}}>
        <div className="row">
          <SelSucursal sucursales={sucursales} value={suc} onChange={setSuc} />
          <SelAnio value={anio} onChange={setAnio} />
          <SelMes value={mes} onChange={setMes} />
          <div className="field"><label>Com. débito / crédito / otras</label><input value={`${pct(tasas.d)} / ${pct(tasas.c)} / ${pct(tasas.o)}`} disabled /></div>
        </div>
      </div>

      <div className="grid kpis" style={{marginBottom:18}}>
        <div className="card kpi"><div className="label">Venta total mes</div><div className="value">{mxn(totalVenta)}</div>
          <div className="delta muted">Meta: {mxn(metaMes)} · {metaMes>0?pct(avance(totalVenta,metaMes)):'—'}</div></div>
        <div className="card kpi"><div className="label">Efectivo</div><div className="value">{mxn(T.efe)}</div></div>
        <div className="card kpi"><div className="label">Tarjetas (D/C/O)</div><div className="value">{mxn(T.deb+T.cre+T.otr)}</div>
          <div className="delta muted">{mxn(T.deb)} · {mxn(T.cre)} · {mxn(T.otr)}</div></div>
        <div className="card kpi"><div className="label">Plataforma</div><div className="value">{mxn(T.plat)}</div></div>
        <div className="card kpi"><div className="label">Propinas</div><div className="value">{mxn(T.prop)}</div><div className="delta muted">no es venta</div></div>
        <div className="card kpi"><div className="label">Comisiones</div><div className="value down">−{mxn(T.com)}</div></div>
      </div>

      <div className="card">
        <h2>Captura por día — las comisiones se calculan automáticamente por tipo</h2>
        <div style={{overflowX:'auto'}}>
        <table>
          <thead><tr>
            <th>Día</th><th>Sem</th><th className="num">Efectivo</th><th className="num">Débito</th><th className="num">Crédito</th>
            <th className="num">Otras</th><th className="num">Plataforma</th><th className="num">Propinas</th><th className="num">Comisión</th><th className="num">Total</th><th className="num">Gastos</th>
          </tr></thead>
          <tbody>
            {dias.map(d => {
              const v = ventas[d] || {};
              const sem = semanaDelMes(iso(anio,mes,d));
              const finSemana = d===ndias || semanaDelMes(iso(anio,mes,d+1))!==sem;
              const com = comDia(v), tot = totDia(v);
              return (
                <Fragment key={d}>
                <tr>
                  <td><b>{d}</b></td><td className="muted">{sem}</td>
                  <td className="num">{inp(d,'efectivo')}</td>
                  <td className="num">{inp(d,'tarjeta_debito')}</td>
                  <td className="num">{inp(d,'tarjeta_credito')}</td>
                  <td className="num">{inp(d,'tarjeta_otras')}</td>
                  <td className="num">{inp(d,'plataforma')}</td>
                  <td className="num">{inp(d,'propinas')}</td>
                  <td className="num down">{com>0?'−'+mxn(com):'—'}</td>
                  <td className="num"><b>{tot>0?mxn(tot):'—'}</b></td>
                  <td className="num muted">{gastos[d]?mxn(gastos[d]):'—'}</td>
                </tr>
                {finSemana && (
                  <tr style={{background:'#0c1730'}}>
                    <td colSpan={9} className="muted"><b>Subtotal semana {sem}</b>
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
            <td className="num"><b>{mxn(T.efe)}</b></td>
            <td className="num"><b>{mxn(T.deb)}</b></td>
            <td className="num"><b>{mxn(T.cre)}</b></td>
            <td className="num"><b>{mxn(T.otr)}</b></td>
            <td className="num"><b>{mxn(T.plat)}</b></td>
            <td className="num"><b>{mxn(T.prop)}</b></td>
            <td className="num down"><b>−{mxn(T.com)}</b></td>
            <td className="num"><b>{mxn(totalVenta)}</b></td>
            <td className="num"><b>{mxn(T.gas)}</b></td>
          </tr></tfoot>
        </table>
        </div>
        <p className="hint">Escribe el monto y sal del campo para guardar. Comisión = débito×{pct(tasas.d)} + crédito×{pct(tasas.c)} + otras×{pct(tasas.o)} + plataforma×{pct(tasas.p)}. Las propinas no cuentan como venta ni comisión.</p>
      </div>
    </>
  );
}

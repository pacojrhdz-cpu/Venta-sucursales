'use client';
import { MESES } from '../lib/fechas';

export function SelSucursal({ sucursales, value, onChange, todas = false }) {
  return (
    <div className="field">
      <label>Sucursal</label>
      <select value={value} onChange={e => onChange(e.target.value)}>
        {todas && <option value="">Todas</option>}
        {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
      </select>
    </div>
  );
}

export function SelMes({ value, onChange }) {
  return (
    <div className="field">
      <label>Mes</label>
      <select value={value} onChange={e => onChange(Number(e.target.value))}>
        {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
      </select>
    </div>
  );
}

export function SelAnio({ value, onChange }) {
  const y = new Date().getFullYear();
  const anios = [y - 2, y - 1, y, y + 1];
  return (
    <div className="field" style={{minWidth:110}}>
      <label>Año</label>
      <select value={value} onChange={e => onChange(Number(e.target.value))}>
        {anios.map(a => <option key={a} value={a}>{a}</option>)}
      </select>
    </div>
  );
}

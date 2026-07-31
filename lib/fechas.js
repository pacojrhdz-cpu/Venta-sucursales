// Utilidades de fecha en horario local (evita corrimientos por UTC)
export function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function primerDiaMes(anio, mes) {
  return `${anio}-${String(mes).padStart(2,'0')}-01`;
}
export function ultimoDiaMes(anio, mes) {
  const d = new Date(anio, mes, 0).getDate();
  return `${anio}-${String(mes).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
export const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

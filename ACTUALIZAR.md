# Cómo dejar tu plataforma 100% al día

Sigue estos 2 pasos en orden. No pierdes datos.

## Paso 1 — Base de datos (una sola vez)
1. Entra a Supabase → tu proyecto → **SQL Editor → New query**.
2. Abre `supabase/actualizacion_completa.sql`, copia TODO y pégalo.
3. Presiona **Run**. Debe decir *Success*.
   - Incluye todas las actualizaciones (plataforma, propinas, método de gasto,
     días trabajados, nómina). Es seguro aunque ya hayas corrido algunas.

## Paso 2 — Subir el código
En GitHub, en la raíz del repositorio: **Add file → Upload files** y arrastra
estas carpetas completas (sobrescriben lo que cambió):

- `app`
- `components`
- `lib`
- `public`

⚠️ NO subas `node_modules`. Luego **Commit changes**. Vercel redespliega solo.

## Qué incluye esta versión
- Ventas con canal **Plataforma** (comisión propia) y **Propinas** (informativas).
- **Gastos** con método de pago (efectivo / tarjeta / transferencia).
- **Reporte semanal** en PDF (efectivo restante, objetivo, proyección del mes).
- **Bonos**: semanas naturales, captura de **días trabajados** y **retardos** por semana,
  bono proporcional a los días del periodo.
- **Nómina** semanal: sueldo + bonos − deducciones = neto, con PDF.
- **Sucursales** a prueba de accidentes: la comisión se guarda con confirmación,
  "Eliminar" pide escribir el nombre y solo funciona en sucursales desactivadas.
- Tu **logo** en el menú y en los PDF.

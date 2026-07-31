# 📊 Plataforma de Ventas por Sucursal

Panel administrativo para visualizar y dar seguimiento a las ventas diarias de todas tus
sucursales, con comparativo mensual, cálculo automático de la comisión de la terminal,
objetivos semanales y mensuales, control de gastos y cálculo de bonos para colaboradores.

Hecha con **Next.js** (se despliega en **Vercel**) y **Supabase** (base de datos).

---

## ¿Qué incluye?

- **Panel:** KPIs del mes, comparativo contra el mes anterior, tendencia de 6 meses y desglose por sucursal.
- **Ventas diarias:** captura efectivo y tarjeta por día; la **comisión de la terminal se calcula sola**. Subtotales por semana y avance del objetivo.
- **Gastos:** registro diario que se suma automáticamente por semana y por mes.
- **Objetivos:** meta mensual y meta semanal por sucursal.
- **Colaboradores y asistencia:** alta de colaboradores y registro de faltas/retardos.
- **Bonos:** cálculo automático del bono semanal y mensual según los rangos que definiste.
- **Configuración:** ajusta los porcentajes de bono y los límites de faltas/retardos.

### Reglas de bono ya configuradas
**Semanal** (sobre la venta total de la semana), cada colaborador elegible recibe:
- 70% – 89.99% → 0.5%
- 90% – 99.99% → 0.7%
- 100% o más → 1%

**Mensual** (sobre la venta total del mes), la bolsa se reparte en partes iguales entre elegibles:
- 90% – 99.99% → 0.7%
- 100% o más → 1%

**Asistencia:** un colaborador **pierde el bono** si supera el límite de faltas (por defecto 1)
o de retardos (por defecto 3). Todo esto es configurable desde la pantalla **Configuración**.

---

## Cómo ponerla en marcha (paso a paso)

### 1) Crea la base de datos en Supabase
1. Entra a https://supabase.com y crea una cuenta (gratis).
2. Crea un proyecto nuevo. Guarda la contraseña de la base de datos.
3. En el menú lateral, abre **SQL Editor → New query**.
4. Copia TODO el contenido de `supabase/schema.sql`, pégalo y presiona **Run**.
   Esto crea las tablas, la seguridad y 4 sucursales de ejemplo.
5. Ve a **Project Settings → API** y copia dos valores:
   - **Project URL**
   - **anon public** (la llave anónima)

### 2) Sube el proyecto a GitHub
1. Crea un repositorio nuevo en https://github.com (por ejemplo `ventas-sucursales`).
2. Sube esta carpeta. Si usas la terminal:
   ```bash
   cd ventas-sucursales
   git init
   git add .
   git commit -m "Plataforma de ventas por sucursal"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/ventas-sucursales.git
   git push -u origin main
   ```
   > La carpeta `node_modules` se ignora sola (está en `.gitignore`). No hace falta subirla.

### 3) Despliega en Vercel
1. Entra a https://vercel.com e inicia sesión con tu cuenta de GitHub.
2. **Add New → Project** y elige tu repositorio `ventas-sucursales`.
3. En **Environment Variables** agrega estas dos (de Supabase, paso 1.5):
   | Nombre | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | tu Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | tu llave anon public |
4. Presiona **Deploy**. En 1–2 minutos tendrás tu plataforma en línea con una URL.

### 4) Crea tu usuario
- Abre la URL de Vercel. Verás la pantalla de acceso.
- Haz clic en **"Crear una"**, registra tu correo y contraseña, y entra.
- (Opcional) En Supabase → **Authentication** puedes desactivar el registro para que nadie
  más pueda crear cuentas.

---

## Probarla en tu computadora (opcional)
Necesitas tener instalado Node.js.
```bash
cd ventas-sucursales
npm install
# crea el archivo .env.local (copia .env.local.example) con tus llaves de Supabase
npm run dev
```
Abre http://localhost:3000

---

## Estructura del proyecto
```
ventas-sucursales/
├─ app/                     Pantallas (panel, ventas, gastos, objetivos, etc.)
├─ components/              Componentes compartidos (menú, selectores)
├─ lib/                     Lógica de negocio (comisiones y bonos) y conexión a Supabase
├─ supabase/schema.sql      Script para crear la base de datos
├─ .env.local.example       Ejemplo de variables de entorno
└─ package.json
```

La lógica de comisiones y bonos vive en `lib/calculos.js` y está probada con casos
de prueba (comisión, rangos de bono, elegibilidad por faltas/retardos y repartos).

---

## Notas
- Es una herramienta **interna de administración**: solo usuarios autenticados ven los datos.
- Puedes cambiar el nombre y la comisión de cada sucursal desde la pantalla **Sucursales**.
- Borra las 4 sucursales de ejemplo cuando ya tengas las tuyas.

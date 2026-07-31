-- ============================================================
--  PLATAFORMA DE VENTAS POR SUCURSAL
--  Esquema de base de datos para Supabase (PostgreSQL)
--  Ejecuta este archivo completo en:  Supabase > SQL Editor > New query
-- ============================================================

-- ============================================================
--  1. SUCURSALES
-- ============================================================
create table if not exists sucursales (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null,
  -- Comision que cobra la terminal sobre ventas con tarjeta (0.035 = 3.5%)
  comision_tarjeta numeric(6,4) not null default 0.035,
  activa           boolean not null default true,
  creada_en        timestamptz not null default now()
);

-- ============================================================
--  2. COLABORADORES
-- ============================================================
create table if not exists colaboradores (
  id           uuid primary key default gen_random_uuid(),
  sucursal_id  uuid not null references sucursales(id) on delete cascade,
  nombre       text not null,
  activo       boolean not null default true,
  creado_en    timestamptz not null default now()
);

-- ============================================================
--  3. OBJETIVOS MENSUALES (meta por sucursal / mes)
-- ============================================================
create table if not exists objetivos (
  id            uuid primary key default gen_random_uuid(),
  sucursal_id   uuid not null references sucursales(id) on delete cascade,
  anio          int  not null,
  mes           int  not null check (mes between 1 and 12),
  meta_mensual  numeric(14,2) not null default 0,
  unique (sucursal_id, anio, mes)
);

-- ============================================================
--  4. OBJETIVOS SEMANALES (meta por sucursal / mes / semana)
-- ============================================================
create table if not exists objetivos_semanales (
  id            uuid primary key default gen_random_uuid(),
  sucursal_id   uuid not null references sucursales(id) on delete cascade,
  anio          int  not null,
  mes           int  not null check (mes between 1 and 12),
  semana        int  not null check (semana between 1 and 6),
  meta_semanal  numeric(14,2) not null default 0,
  unique (sucursal_id, anio, mes, semana)
);

-- ============================================================
--  5. VENTAS DIARIAS
-- ============================================================
create table if not exists ventas_diarias (
  id           uuid primary key default gen_random_uuid(),
  sucursal_id  uuid not null references sucursales(id) on delete cascade,
  fecha        date not null,
  efectivo     numeric(14,2) not null default 0,
  tarjeta      numeric(14,2) not null default 0,
  nota         text,
  creado_en    timestamptz not null default now(),
  unique (sucursal_id, fecha)
);

-- ============================================================
--  6. GASTOS DIARIOS
-- ============================================================
create table if not exists gastos (
  id           uuid primary key default gen_random_uuid(),
  sucursal_id  uuid not null references sucursales(id) on delete cascade,
  fecha        date not null,
  monto        numeric(14,2) not null default 0,
  categoria    text,
  descripcion  text,
  creado_en    timestamptz not null default now()
);

-- ============================================================
--  7. ASISTENCIA (para checar faltas y retardos)
-- ============================================================
create table if not exists asistencia (
  id              uuid primary key default gen_random_uuid(),
  colaborador_id  uuid not null references colaboradores(id) on delete cascade,
  fecha           date not null,
  estatus         text not null check (estatus in ('presente','falta','retardo')),
  unique (colaborador_id, fecha)
);

-- ============================================================
--  8. CONFIGURACION GLOBAL (una sola fila, id = 1)
-- ============================================================
create table if not exists config (
  id                int primary key default 1 check (id = 1),
  bono_sem_r1_min   numeric(5,4) not null default 0.7000,
  bono_sem_r1_pct   numeric(6,5) not null default 0.00500,
  bono_sem_r2_min   numeric(5,4) not null default 0.9000,
  bono_sem_r2_pct   numeric(6,5) not null default 0.00700,
  bono_sem_r3_min   numeric(5,4) not null default 1.0000,
  bono_sem_r3_pct   numeric(6,5) not null default 0.01000,
  bono_mes_r1_min   numeric(5,4) not null default 0.9000,
  bono_mes_r1_pct   numeric(6,5) not null default 0.00700,
  bono_mes_r2_min   numeric(5,4) not null default 1.0000,
  bono_mes_r2_pct   numeric(6,5) not null default 0.01000,
  limite_faltas     int not null default 1,
  limite_retardos   int not null default 3,
  actualizado_en    timestamptz not null default now()
);

insert into config (id) values (1) on conflict (id) do nothing;

-- ============================================================
--  INDICES
-- ============================================================
create index if not exists idx_ventas_sucursal_fecha on ventas_diarias (sucursal_id, fecha);
create index if not exists idx_gastos_sucursal_fecha  on gastos (sucursal_id, fecha);
create index if not exists idx_asistencia_fecha       on asistencia (fecha);

-- ============================================================
--  SEGURIDAD (RLS) - solo usuarios autenticados
-- ============================================================
alter table sucursales          enable row level security;
alter table colaboradores       enable row level security;
alter table objetivos           enable row level security;
alter table objetivos_semanales enable row level security;
alter table ventas_diarias      enable row level security;
alter table gastos              enable row level security;
alter table asistencia          enable row level security;
alter table config              enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'sucursales','colaboradores','objetivos','objetivos_semanales',
    'ventas_diarias','gastos','asistencia','config'
  ]
  loop
    execute format('drop policy if exists acceso_autenticados on %I;', t);
    execute format('create policy acceso_autenticados on %I for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- ============================================================
--  DATOS DE EJEMPLO (borralos cuando quieras)
-- ============================================================
insert into sucursales (nombre, comision_tarjeta) values
  ('Sucursal Centro',  0.035),
  ('Sucursal Norte',   0.035),
  ('Sucursal Sur',     0.035),
  ('Sucursal Poniente',0.035)
on conflict do nothing;

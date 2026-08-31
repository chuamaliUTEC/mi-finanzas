-- ===========================================================================
--  ARREGLO: las tablas existen pero la API de Supabase no las encuentra
-- ===========================================================================
--
--  Síntoma: el SQL Editor ve la tabla, pero la aplicación responde
--  "Could not find the table in the schema cache".
--
--  Causa: PostgREST (la API REST de Supabase) solo expone las tablas sobre
--  las que los roles `anon` y `authenticated` tienen permisos concedidos.
--  Una tabla creada sin esos permisos es invisible para la API aunque
--  exista en la base de datos. Recargar el caché no ayuda: no es que el
--  caché esté viejo, es que la tabla nunca fue visible.
--
--  ¿Es seguro conceder estos permisos? Sí, y es el modelo de Supabase:
--  los permisos amplios se combinan con Row Level Security restrictiva.
--  El permiso deja pasar la petición; la política RLS decide qué filas
--  puede ver cada persona. Por eso este script COMPRUEBA PRIMERO que
--  todas las tablas tengan RLS activo, y lo activa si falta, ANTES de
--  conceder nada.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Red de seguridad: ninguna tabla puede quedar sin RLS.
-- ---------------------------------------------------------------------------
do $$
declare
  t record;
  sin_rls int := 0;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public' and not rowsecurity
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
    sin_rls := sin_rls + 1;
    raise notice 'RLS activado en %', t.tablename;
  end loop;

  if sin_rls = 0 then
    raise notice 'Todas las tablas ya tenían RLS activo.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Permisos para los roles de la API.
--    Sin esto, PostgREST no incluye la tabla en su esquema.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public
  to anon, authenticated;
grant all on all tables in schema public to service_role;

grant usage, select on all sequences in schema public
  to anon, authenticated, service_role;

grant execute on all functions in schema public
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Que las tablas futuras hereden estos permisos automáticamente.
--    Evita que vuelva a pasar con la próxima migración.
-- ---------------------------------------------------------------------------
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Pedirle a PostgREST que relea el esquema con los permisos ya puestos.
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- 5. Verificación: las tres columnas deben coincidir.
-- ---------------------------------------------------------------------------
select
  (select count(*) from pg_tables
     where schemaname = 'public') as tablas,
  (select count(*) from pg_tables
     where schemaname = 'public' and rowsecurity) as con_rls,
  (select count(distinct table_name) from information_schema.role_table_grants
     where table_schema = 'public' and grantee = 'anon') as visibles_para_la_api,
  (select count(distinct table_name) from information_schema.role_table_grants
     where table_schema = 'public' and grantee = 'anon'
       and table_name in ('financial_rules','pending_verifications','spending_ranges')
  ) as las_tres_que_faltaban;

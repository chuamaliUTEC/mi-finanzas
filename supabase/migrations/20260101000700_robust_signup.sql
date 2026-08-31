-- El registro de usuario nunca debe fallar por los datos de cortesía.
--
-- Al registrarse se disparan tres funciones en cadena: crear el perfil,
-- sembrar las categorías por defecto y sembrar las reglas. Si CUALQUIERA
-- lanza una excepción, Postgres aborta toda la transacción y Supabase
-- devuelve "Database error saving new user": la persona se queda sin
-- cuenta por no haber podido crearle una categoría.
--
-- Las categorías y las reglas son una comodidad; la cuenta es lo esencial.
-- Aquí se invierte esa prioridad: los seeds se envuelven en un manejador
-- de excepciones, de modo que si fallan se registra un aviso y el usuario
-- queda creado igual. Siempre podrá crear sus categorías a mano.

-- ---------------------------------------------------------------------------
-- 1. Crear el perfil: si algo sale mal, el usuario se crea igualmente.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  begin
    insert into public.profiles (user_id) values (new.id)
    on conflict (user_id) do nothing;
  exception when others then
    raise warning 'No se pudo crear el perfil de %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Categorías por defecto.
--    Corrige además un error sutil: `returning ... into` no modifica la
--    variable cuando el INSERT no inserta nada (por conflicto), así que
--    cat_id conservaba el id de la categoría ANTERIOR y las subcategorías
--    terminaban colgadas de la categoría equivocada. Ahora se limpia en
--    cada vuelta y se resuelve por consulta si hubo conflicto.
-- ---------------------------------------------------------------------------
create or replace function public.create_default_categories()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  cat record;
  cat_id uuid;
begin
  for cat in
    select * from (values
      ('Alimentación', '🍽️', 1, array['supermercado','restaurante','delivery','almuerzo laboral','snacks']),
      ('Transporte', '🚌', 2, array['taxi','Uber','Didi','colectivo','bus','combustible']),
      ('Mascotas', '🐱', 3, array['comida','veterinaria','accesorios']),
      ('Vivienda', '🏠', 4, array['internet','gas','luz','agua','mantenimiento']),
      ('Ocio', '🎉', 5, array['salidas','cine','conciertos']),
      ('Ropa', '👗', 6, array[]::text[]),
      ('Limpieza', '🧼', 7, array[]::text[]),
      ('Salud', '🩺', 8, array['medicinas','consultas']),
      ('Maquillaje', '💄', 9, array[]::text[]),
      ('Suscripciones', '📺', 10, array['streaming','apps','IA']),
      ('Educación', '📚', 11, array['cursos','libros']),
      ('Viajes', '✈️', 12, array[]::text[]),
      ('Compras', '🛍️', 13, array[]::text[]),
      ('Deudas', '💳', 14, array[]::text[]),
      ('Ahorro', '💰', 15, array[]::text[]),
      ('Otros', '📦', 16, array[]::text[])
    ) as t(name, icon, sort_order, subs)
  loop
    begin
      cat_id := null;  -- imprescindible: si no, arrastra el id anterior

      insert into public.expense_categories (user_id, name, icon, sort_order)
      values (new.user_id, cat.name, cat.icon, cat.sort_order::smallint)
      on conflict (user_id, name) do nothing
      returning id into cat_id;

      -- Si ya existía, recuperamos su id en lugar de saltar las subcategorías.
      if cat_id is null then
        select id into cat_id from public.expense_categories
        where user_id = new.user_id and name = cat.name;
      end if;

      if cat_id is not null and array_length(cat.subs, 1) > 0 then
        insert into public.expense_subcategories (user_id, category_id, name)
        select new.user_id, cat_id, unnest(cat.subs)
        on conflict (category_id, name) do nothing;
      end if;
    exception when others then
      raise warning 'No se pudo sembrar la categoría % para %: %', cat.name, new.user_id, sqlerrm;
    end;
  end loop;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Reglas y planes por defecto, con el mismo blindaje.
-- ---------------------------------------------------------------------------
create or replace function public.create_default_rules()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  begin
    insert into public.financial_rules
      (user_id, name, description, condition_type, condition_params, severity,
       message_template, is_system, is_manual, sort_order)
    values
      (new.user_id, 'Deuda cara', 'Una deuda con tasa alta debe atacarse primero.',
       'debt_rate_above', '{"threshold": 20}'::jsonb, 'riesgo',
       'Tu deuda {name} tiene una tasa de {rate} % anual: es la más cara que tienes.',
       true, false, 1),
      (new.user_id, 'Utilización de tarjeta alta',
       'Usar más del 30 % de la línea presiona tu perfil crediticio.',
       'card_utilization_above', '{"threshold": 0.3}'::jsonb, 'riesgo',
       'La utilización de {name} está en {utilization} %. Pagando {payment} bajaría a 30 %.',
       true, false, 2),
      (new.user_id, 'Presupuesto excedido',
       'Cuando una categoría supera lo planificado.',
       'budget_category_exceeded', '{}'::jsonb, 'atencion',
       'Gastaste {spent} en {name}: {over} por encima de tu presupuesto.',
       true, false, 3),
      (new.user_id, 'Proyección por encima del presupuesto',
       'El ritmo actual llevaría a exceder la categoría al cierre del mes.',
       'budget_category_projected_over', '{}'::jsonb, 'atencion',
       'Vas camino a gastar {projected} en {name}, por encima de tus {planned}.',
       true, false, 4),
      (new.user_id, 'Saldo insuficiente para pagos próximos',
       'El dinero disponible no cubre las obligaciones que vienen.',
       'balance_below_upcoming', '{"horizon_days": 15}'::jsonb, 'critico',
       'Tu dinero disponible ({available}) no cubre tus pagos próximos ({upcoming}).',
       true, false, 5),
      (new.user_id, 'Ingreso extraordinario sin asignar',
       'Todo ingreso extraordinario se asigna antes de gastarse.',
       'extraordinary_unallocated', '{}'::jsonb, 'atencion',
       'Tienes {name} ({amount}) sin destino asignado. Decide su uso antes de recibirlo.',
       true, false, 6),
      (new.user_id, 'Gasto muy por encima del promedio',
       'Detecta desviaciones significativas frente a tu historial.',
       'category_spike', '{"threshold_pct": 30, "min_months": 2}'::jsonb, 'atencion',
       'Tu gasto en {name} subió {change} % respecto a tu promedio.',
       true, false, 7),
      (new.user_id, 'Nueva deuda con deuda cara vigente',
       'No conviene endeudarse más mientras exista deuda de tasa alta.',
       'new_debt_while_expensive', '{"threshold": 20}'::jsonb, 'riesgo',
       'Ya tienes deuda cara ({name}, {rate} %): evita tomar deuda nueva.',
       true, false, 8),
      (new.user_id, 'Nunca pagar una línea de crédito con otra', null,
       'manual', '{}'::jsonb, 'info', 'Nunca pagar una línea de crédito con otra.', true, true, 20),
      (new.user_id, 'Línea liberada no significa dinero disponible', null,
       'manual', '{}'::jsonb, 'info',
       'Línea liberada no significa dinero disponible.', true, true, 21),
      (new.user_id, 'Los ingresos extraordinarios se asignan antes de gastarse', null,
       'manual', '{}'::jsonb, 'info',
       'Los ingresos extraordinarios se asignan antes de gastarse.', true, true, 22),
      (new.user_id, 'Trabajar con ciclos financieros de 30 días', null,
       'manual', '{}'::jsonb, 'info', 'Trabajar con ciclos financieros de 30 días.', true, true, 23);
  exception when others then
    raise warning 'No se pudieron sembrar las reglas de %: %', new.user_id, sqlerrm;
  end;

  begin
    insert into public.if_then_plans (user_id, trigger_text, steps, sort_order)
    values
      (new.user_id, 'SI recibo dinero extraordinario',
       array['Registrar el ingreso', 'Separar obligaciones', 'Asignar a deuda',
             'Separar ahorro', 'Recién entonces calcular dinero libre'], 1),
      (new.user_id, 'SI estoy a punto de comprar algo no presupuestado',
       array['Esperar 24 horas', 'Volver a evaluar la compra'], 2),
      (new.user_id, 'SI estoy triste y quiero gastar',
       array['Registrar la compra como gasto emocional',
             'Ver su impacto mensual antes de confirmar'], 3);
  exception when others then
    raise warning 'No se pudieron sembrar los planes de %: %', new.user_id, sqlerrm;
  end;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Reparación: crea el perfil, las categorías y las reglas de cualquier
--    usuario que ya exista en auth.users pero se haya quedado sin ellos por
--    un fallo anterior.
-- ---------------------------------------------------------------------------
do $$
declare
  u record;
  p record;
begin
  for u in select id from auth.users loop
    insert into public.profiles (user_id) values (u.id)
    on conflict (user_id) do nothing;
  end loop;

  -- Dispara el sembrado para los perfiles que quedaron sin categorías.
  for p in
    select pr.user_id from public.profiles pr
    where not exists (
      select 1 from public.expense_categories c where c.user_id = pr.user_id
    )
  loop
    insert into public.expense_categories (user_id, name, icon, sort_order)
    values
      (p.user_id, 'Alimentación', '🍽️', 1), (p.user_id, 'Transporte', '🚌', 2),
      (p.user_id, 'Mascotas', '🐱', 3), (p.user_id, 'Vivienda', '🏠', 4),
      (p.user_id, 'Ocio', '🎉', 5), (p.user_id, 'Ropa', '👗', 6),
      (p.user_id, 'Limpieza', '🧼', 7), (p.user_id, 'Salud', '🩺', 8),
      (p.user_id, 'Maquillaje', '💄', 9), (p.user_id, 'Suscripciones', '📺', 10),
      (p.user_id, 'Educación', '📚', 11), (p.user_id, 'Viajes', '✈️', 12),
      (p.user_id, 'Compras', '🛍️', 13), (p.user_id, 'Deudas', '💳', 14),
      (p.user_id, 'Ahorro', '💰', 15), (p.user_id, 'Otros', '📦', 16)
    on conflict (user_id, name) do nothing;
  end loop;
end $$;

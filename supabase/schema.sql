-- MatchField · esquema de Supabase (Postgres + RLS + Auth)
-- Ejecutar completo en: Supabase > SQL Editor > New query > Run.
-- Es re-ejecutable: usa "if not exists" / "or replace" / "on conflict".
--
-- Decisiones:
--  * El correo y la contraseña viven en Supabase Auth (auth.users). RN-01 (correo único) lo garantiza Auth.
--  * jugadores.id_jugador = auth.users.id (uuid).
--  * Las escrituras de reservas, solicitudes y horarios NO tienen política RLS: solo se hacen
--    mediante las funciones de abajo (security definer), que aplican RN-02 a RN-07 de forma atómica.
--  * Zona horaria de las franjas: America/Bogota.

-- ============================================================ Tablas

create table if not exists public.ciudades (
  id_ciudad   int primary key,
  nombre      text not null
);

create table if not exists public.localidades (
  id_localidad int primary key,
  id_ciudad    int not null references public.ciudades(id_ciudad),
  nombre       text not null
);

create table if not exists public.canchas (
  id_cancha    int primary key,
  id_localidad int not null references public.localidades(id_localidad),
  nombre       text not null,
  direccion    text not null,
  tipo_cancha  text not null check (tipo_cancha in ('F5','F7','F11')),
  precio_hora  int  not null check (precio_hora > 0),
  activa       boolean not null default true
);

create table if not exists public.jugadores (
  id_jugador         uuid primary key references auth.users(id) on delete cascade,
  nombre             text not null check (char_length(nombre) between 2 and 60),
  telefono           text not null default '' check (telefono = '' or telefono ~ '^3[0-9]{9}$'),
  posicion_preferida text not null check (posicion_preferida in ('PORTERO','DEFENSA','MEDIOCAMPISTA','DELANTERO')),
  id_localidad       int  not null references public.localidades(id_localidad),
  fecha_registro     timestamptz not null default now()
);

create table if not exists public.disponibilidades (
  id_disponibilidad bigint generated always as identity primary key,
  id_jugador        uuid not null references public.jugadores(id_jugador) on delete cascade,
  dia_semana        smallint not null check (dia_semana between 1 and 7),   -- 1 = lunes ... 7 = domingo
  hora_inicio       time not null,
  hora_fin          time not null,
  check (hora_fin > hora_inicio),
  unique (id_jugador, dia_semana)
);

create table if not exists public.horarios (
  id_horario  bigint generated always as identity primary key,
  id_cancha   int  not null references public.canchas(id_cancha),
  fecha       date not null,
  hora_inicio time not null,
  hora_fin    time not null,
  estado      text not null default 'DISPONIBLE' check (estado in ('DISPONIBLE','RESERVADO')),
  unique (id_cancha, fecha, hora_inicio)
);

create table if not exists public.reservas (
  id_reserva          bigint generated always as identity primary key,
  id_horario          bigint not null references public.horarios(id_horario),
  id_organizador      uuid   not null references public.jugadores(id_jugador),
  cupos_totales       smallint not null check (cupos_totales >= 2),
  cupos_ocupados      smallint not null default 1 check (cupos_ocupados >= 1),
  estado              text not null default 'ACTIVA' check (estado in ('ACTIVA','CANCELADA')),
  posicion_organizador text not null check (posicion_organizador in ('PORTERO','DEFENSA','MEDIOCAMPISTA','DELANTERO')),
  fecha_creacion      timestamptz not null default now(),
  check (cupos_ocupados <= cupos_totales)                                   -- RN-03
);
-- RN-02: una sola reserva ACTIVA por franja (permite re-reservar una franja cancelada).
create unique index if not exists reservas_una_activa_por_horario
  on public.reservas (id_horario) where estado = 'ACTIVA';

create table if not exists public.solicitudes (
  id_solicitud   bigint generated always as identity primary key,
  id_reserva     bigint not null references public.reservas(id_reserva) on delete cascade,
  id_jugador     uuid   not null references public.jugadores(id_jugador),
  tipo           text   not null check (tipo in ('SOLICITUD','INVITACION')),
  estado         text   not null default 'PENDIENTE' check (estado in ('PENDIENTE','ACEPTADA','RECHAZADA','CANCELADA')),
  mensaje        text   not null default '',
  fecha_creacion timestamptz not null default now(),
  unique (id_reserva, id_jugador)                                           -- RN-04
);

create index if not exists horarios_cancha_fecha on public.horarios (id_cancha, fecha);
create index if not exists solicitudes_jugador   on public.solicitudes (id_jugador);
create index if not exists reservas_organizador  on public.reservas (id_organizador);

-- ============================================================ RLS

alter table public.ciudades          enable row level security;
alter table public.localidades       enable row level security;
alter table public.canchas           enable row level security;
alter table public.jugadores         enable row level security;
alter table public.disponibilidades  enable row level security;
alter table public.horarios          enable row level security;
alter table public.reservas          enable row level security;
alter table public.solicitudes       enable row level security;

-- Catálogo y franjas: lectura pública (se puede explorar sin iniciar sesión).
drop policy if exists "catalogo_lectura" on public.ciudades;
create policy "catalogo_lectura" on public.ciudades for select to anon, authenticated using (true);
drop policy if exists "catalogo_lectura" on public.localidades;
create policy "catalogo_lectura" on public.localidades for select to anon, authenticated using (true);
drop policy if exists "catalogo_lectura" on public.canchas;
create policy "catalogo_lectura" on public.canchas for select to anon, authenticated using (true);
drop policy if exists "horarios_lectura" on public.horarios;
create policy "horarios_lectura" on public.horarios for select to anon, authenticated using (true);

-- Jugadores y disponibilidad: los usuarios con sesión pueden verlos (RF-10); solo el dueño escribe.
drop policy if exists "jugadores_lectura" on public.jugadores;
create policy "jugadores_lectura" on public.jugadores for select to authenticated using (true);
drop policy if exists "jugadores_insert_propio" on public.jugadores;
create policy "jugadores_insert_propio" on public.jugadores for insert to authenticated with check (id_jugador = auth.uid());
drop policy if exists "jugadores_update_propio" on public.jugadores;
create policy "jugadores_update_propio" on public.jugadores for update to authenticated
  using (id_jugador = auth.uid()) with check (id_jugador = auth.uid());

drop policy if exists "disp_lectura" on public.disponibilidades;
create policy "disp_lectura" on public.disponibilidades for select to authenticated using (true);
drop policy if exists "disp_insert_propia" on public.disponibilidades;
create policy "disp_insert_propia" on public.disponibilidades for insert to authenticated with check (id_jugador = auth.uid());
drop policy if exists "disp_update_propia" on public.disponibilidades;
create policy "disp_update_propia" on public.disponibilidades for update to authenticated
  using (id_jugador = auth.uid()) with check (id_jugador = auth.uid());
drop policy if exists "disp_delete_propia" on public.disponibilidades;
create policy "disp_delete_propia" on public.disponibilidades for delete to authenticated using (id_jugador = auth.uid());

-- Reservas: visibles para usuarios con sesión (partidas abiertas). Sin políticas de escritura.
drop policy if exists "reservas_lectura" on public.reservas;
create policy "reservas_lectura" on public.reservas for select to authenticated using (true);

-- Solicitudes: las aceptadas son públicas (lista de participantes);
-- el resto solo las ve quien la creó o recibió (el jugador o el organizador).
drop policy if exists "solicitudes_lectura" on public.solicitudes;
create policy "solicitudes_lectura" on public.solicitudes for select to authenticated using (
  estado = 'ACEPTADA'
  or id_jugador = auth.uid()
  or exists (select 1 from public.reservas r where r.id_reserva = solicitudes.id_reserva and r.id_organizador = auth.uid())
);

-- ============================================================ Funciones auxiliares

create or replace function public.hoy_bogota() returns date
language sql stable as $$ select (now() at time zone 'America/Bogota')::date $$;

create or replace function public.cupos_maximos(p_tipo text) returns int
language sql immutable as $$
  select case p_tipo when 'F5' then 10 when 'F7' then 14 when 'F11' then 22 end
$$;

-- Una reserva está "vigente" si es ACTIVA y la franja no ha terminado.
create or replace function public.reserva_vigente(p_id_reserva bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from reservas r join horarios h on h.id_horario = r.id_horario
    where r.id_reserva = p_id_reserva and r.estado = 'ACTIVA'
      and ((h.fecha + h.hora_fin) at time zone 'America/Bogota') > now()
  )
$$;

-- ============================================================ Franjas

-- Crea las franjas de los próximos 7 días (idempotente). El cliente la llama al abrir la app.
create or replace function public.generar_horarios() returns void
language plpgsql security definer set search_path = public as $$
declare
  d int; v_fecha date; v_finde boolean; v_desde int; v_hasta int; hr int; c record;
begin
  for d in 0..6 loop
    v_fecha := hoy_bogota() + d;
    v_finde := extract(isodow from v_fecha) >= 6;
    v_desde := case when v_finde then 8 else 17 end;
    v_hasta := case when v_finde then 21 else 22 end;
    for c in select id_cancha from canchas where activa loop
      for hr in v_desde..(v_hasta - 1) loop
        insert into horarios (id_cancha, fecha, hora_inicio, hora_fin)
        values (c.id_cancha, v_fecha, make_time(hr, 0, 0), make_time(hr + 1, 0, 0))
        on conflict (id_cancha, fecha, hora_inicio) do nothing;
      end loop;
    end loop;
  end loop;

  -- Limpieza: franjas anteriores a ayer sin reservas.
  delete from horarios h
  where h.fecha < hoy_bogota() - 1
    and not exists (select 1 from reservas r where r.id_horario = h.id_horario);
end $$;

-- ============================================================ Reservas (RF-08, RF-09)

create or replace function public.reservar(p_id_horario bigint, p_cupos int, p_posicion text default null)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_jug jugadores%rowtype;
  v_h horarios%rowtype;
  v_tipo text; v_max int; v_id bigint;
begin
  if v_uid is null then raise exception 'Inicia sesión para reservar.'; end if;
  select * into v_jug from jugadores where id_jugador = v_uid;
  if not found then raise exception 'Necesitas un perfil activo para reservar.'; end if;

  select * into v_h from horarios where id_horario = p_id_horario for update;
  if not found then raise exception 'La franja no existe.'; end if;
  if ((v_h.fecha + v_h.hora_inicio) at time zone 'America/Bogota') <= now() then
    raise exception 'Esta franja ya no está disponible.';                                -- RN-06
  end if;
  if v_h.estado <> 'DISPONIBLE'
     or exists (select 1 from reservas where id_horario = v_h.id_horario and estado = 'ACTIVA') then
    raise exception 'Esta franja ya fue reservada.';                                     -- RN-02
  end if;

  select tipo_cancha into v_tipo from canchas where id_cancha = v_h.id_cancha;
  v_max := cupos_maximos(v_tipo);
  if p_cupos is null or p_cupos < 2 or p_cupos > v_max then
    raise exception 'Los cupos deben estar entre 2 y %.', v_max;
  end if;

  insert into reservas (id_horario, id_organizador, cupos_totales, cupos_ocupados, posicion_organizador)
  values (v_h.id_horario, v_uid, p_cupos, 1,
          case when p_posicion in ('PORTERO','DEFENSA','MEDIOCAMPISTA','DELANTERO') then p_posicion else v_jug.posicion_preferida end)
  returning id_reserva into v_id;

  update horarios set estado = 'RESERVADO' where id_horario = v_h.id_horario;
  return v_id;
end $$;

create or replace function public.cancelar_reserva(p_id_reserva bigint) returns void
language plpgsql security definer set search_path = public as $$
declare v_r reservas%rowtype;
begin
  if auth.uid() is null then raise exception 'Inicia sesión.'; end if;
  select * into v_r from reservas where id_reserva = p_id_reserva for update;
  if not found then raise exception 'La reserva no existe.'; end if;
  if v_r.id_organizador <> auth.uid() then raise exception 'Solo el organizador puede cancelar la reserva.'; end if;
  if v_r.estado <> 'ACTIVA' then raise exception 'La reserva ya no está activa.'; end if;

  update reservas set estado = 'CANCELADA' where id_reserva = p_id_reserva;
  update horarios set estado = 'DISPONIBLE' where id_horario = v_r.id_horario;
  update solicitudes set estado = 'CANCELADA' where id_reserva = p_id_reserva and estado = 'PENDIENTE';
end $$;

-- ============================================================ Solicitudes (RF-12 a RF-14)

create or replace function public._crear_solicitud(p_id_reserva bigint, p_id_jugador uuid, p_tipo text)
returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if exists (select 1 from solicitudes where id_reserva = p_id_reserva and id_jugador = p_id_jugador) then
    raise exception 'Ya existe una solicitud o invitación para esta partida.';           -- RN-04
  end if;
  insert into solicitudes (id_reserva, id_jugador, tipo) values (p_id_reserva, p_id_jugador, p_tipo)
  returning id_solicitud into v_id;
  return v_id;
end $$;
revoke all on function public._crear_solicitud(bigint, uuid, text) from public, anon, authenticated;

create or replace function public.solicitar_unirse(p_id_reserva bigint) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_r reservas%rowtype;
begin
  if auth.uid() is null then raise exception 'Inicia sesión.'; end if;
  if not exists (select 1 from jugadores where id_jugador = auth.uid()) then
    raise exception 'Necesitas un perfil activo para solicitar unirte.';
  end if;
  select * into v_r from reservas where id_reserva = p_id_reserva for update;
  if not found or not reserva_vigente(p_id_reserva) then raise exception 'Esta partida ya no está activa.'; end if;
  if v_r.id_organizador = auth.uid() then raise exception 'No puedes solicitar unirte a tu propia reserva.'; end if; -- RN-05
  if v_r.cupos_ocupados >= v_r.cupos_totales then raise exception 'La partida no tiene cupos disponibles.'; end if;
  return _crear_solicitud(p_id_reserva, auth.uid(), 'SOLICITUD');
end $$;

create or replace function public.invitar(p_id_reserva bigint, p_id_jugador uuid) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_r reservas%rowtype;
begin
  if auth.uid() is null then raise exception 'Inicia sesión.'; end if;
  select * into v_r from reservas where id_reserva = p_id_reserva for update;
  if not found or not reserva_vigente(p_id_reserva) then raise exception 'Esta partida ya no está activa.'; end if;
  if v_r.id_organizador <> auth.uid() then raise exception 'Solo el organizador puede invitar jugadores.'; end if;
  if p_id_jugador = auth.uid() then raise exception 'No puedes invitarte a ti mismo.'; end if;
  if not exists (select 1 from jugadores where id_jugador = p_id_jugador) then raise exception 'El jugador no existe.'; end if;
  if v_r.cupos_ocupados >= v_r.cupos_totales then raise exception 'La partida no tiene cupos disponibles.'; end if;
  return _crear_solicitud(p_id_reserva, p_id_jugador, 'INVITACION');
end $$;

-- Aceptar/rechazar: la solicitud la responde el organizador; la invitación, el invitado.
create or replace function public.responder_solicitud(p_id_solicitud bigint, p_aceptar boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_s solicitudes%rowtype; v_r reservas%rowtype; v_ok boolean;
begin
  if auth.uid() is null then raise exception 'Inicia sesión.'; end if;
  select * into v_s from solicitudes where id_solicitud = p_id_solicitud for update;
  if not found then raise exception 'La solicitud no existe.'; end if;
  if v_s.estado <> 'PENDIENTE' then raise exception 'Esta solicitud ya fue respondida.'; end if;

  select * into v_r from reservas where id_reserva = v_s.id_reserva for update;
  if not reserva_vigente(v_s.id_reserva) then raise exception 'La partida ya no está activa.'; end if;

  v_ok := case v_s.tipo when 'SOLICITUD' then v_r.id_organizador = auth.uid() else v_s.id_jugador = auth.uid() end;
  if not v_ok then raise exception 'No tienes permiso para responder esta solicitud.'; end if;

  if p_aceptar then
    if v_r.cupos_ocupados >= v_r.cupos_totales then raise exception 'No hay cupos disponibles: no se puede aceptar.'; end if; -- RN-03
    update reservas set cupos_ocupados = cupos_ocupados + 1 where id_reserva = v_r.id_reserva;
    update solicitudes set estado = 'ACEPTADA' where id_solicitud = p_id_solicitud;
  else
    update solicitudes set estado = 'RECHAZADA' where id_solicitud = p_id_solicitud;
  end if;
end $$;

-- Quien creó la solicitud/invitación puede retirarla mientras esté pendiente.
create or replace function public.cancelar_solicitud(p_id_solicitud bigint) returns void
language plpgsql security definer set search_path = public as $$
declare v_s solicitudes%rowtype; v_org uuid; v_creador uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión.'; end if;
  select * into v_s from solicitudes where id_solicitud = p_id_solicitud for update;
  if not found then raise exception 'La solicitud no existe.'; end if;
  if v_s.estado <> 'PENDIENTE' then raise exception 'Solo se pueden cancelar solicitudes pendientes.'; end if;
  select id_organizador into v_org from reservas where id_reserva = v_s.id_reserva;
  v_creador := case v_s.tipo when 'SOLICITUD' then v_s.id_jugador else v_org end;
  if v_creador <> auth.uid() then raise exception 'No tienes permiso para cancelar esta solicitud.'; end if;
  update solicitudes set estado = 'CANCELADA' where id_solicitud = p_id_solicitud;
end $$;

-- Permisos de ejecución: las funciones de escritura exigen sesión; generar_horarios es pública e idempotente.
revoke all on function public.reservar(bigint, int, text)        from public, anon;
revoke all on function public.cancelar_reserva(bigint)           from public, anon;
revoke all on function public.solicitar_unirse(bigint)           from public, anon;
revoke all on function public.invitar(bigint, uuid)              from public, anon;
revoke all on function public.responder_solicitud(bigint, boolean) from public, anon;
revoke all on function public.cancelar_solicitud(bigint)         from public, anon;
grant execute on function public.reservar(bigint, int, text)        to authenticated;
grant execute on function public.cancelar_reserva(bigint)           to authenticated;
grant execute on function public.solicitar_unirse(bigint)           to authenticated;
grant execute on function public.invitar(bigint, uuid)              to authenticated;
grant execute on function public.responder_solicitud(bigint, boolean) to authenticated;
grant execute on function public.cancelar_solicitud(bigint)         to authenticated;
grant execute on function public.generar_horarios()                 to anon, authenticated;
grant execute on function public.reserva_vigente(bigint)            to authenticated;

-- ============================================================ Datos semilla (catálogo)

insert into public.ciudades (id_ciudad, nombre) values
  (1,'Bogotá'), (2,'Medellín'), (3,'Cali')
on conflict (id_ciudad) do nothing;

insert into public.localidades (id_localidad, id_ciudad, nombre) values
  (1,1,'Bosa'), (2,1,'Kennedy'), (3,1,'Suba'), (4,1,'Engativá'), (5,1,'Fontibón'), (6,1,'Usaquén'),
  (7,2,'El Poblado'), (8,2,'Laureles'), (9,3,'San Fernando')
on conflict (id_localidad) do nothing;

insert into public.canchas (id_cancha, id_localidad, nombre, direccion, tipo_cancha, precio_hora, activa) values
  (1, 1, 'Canchas El Recreo',      'Calle 65 Sur # 78-20',      'F5',   60000, true),
  (2, 1, 'Golazo Bosa',            'Carrera 80 # 63 Sur-45',    'F7',  110000, true),
  (3, 2, 'Kennedy Soccer Park',    'Avenida 1 de Mayo # 72-10', 'F7',  120000, true),
  (4, 2, 'La Pradera Sintética',   'Calle 38 Sur # 78-33',      'F5',   70000, true),
  (5, 3, 'Suba Arena Fútbol',      'Calle 145 # 91-15',         'F7',  130000, true),
  (6, 3, 'Club Los Cerros',        'Carrera 111 # 152-40',      'F11', 280000, true),
  (7, 4, 'Engativá Fútbol 5',      'Calle 80 # 100-12',         'F5',   65000, true),
  (8, 5, 'Fontibón Champions',     'Carrera 99 # 17-30',        'F7',  115000, true),
  (9, 7, 'Poblado Fútbol Club',    'Carrera 35 # 10-25',        'F7',  150000, true),
  (10,8, 'Laureles Sintética',     'Circular 4 # 70-18',        'F5',   80000, true),
  (11,9, 'San Fernando Fútbol',    'Calle 5 # 38-20',           'F7',  100000, true)
on conflict (id_cancha) do nothing;

select public.generar_horarios();

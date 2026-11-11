/* Capa de lógica de MatchField (RF-01 a RF-17).
   Habla solo con la capa de datos (MF.Store) y no toca el DOM.
   Las reglas RN-02 a RN-07 se aplican en el servidor (supabase/schema.sql); aquí solo se
   valida lo necesario para dar mensajes claros y se arma la información para las vistas.

   Convenciones:
     - Consultas: devuelven los datos y LANZAN Error (mensaje en español) si fallan.
     - Acciones: devuelven { ok: true, ... } o { ok: false, error } (el perfil: { ok: false, errores }). */
(function (MF) {
  'use strict';

  const D = MF.Dates;
  const { run, must } = MF.Store;
  const db = () => MF.Store.db;

  const POSICIONES = ['PORTERO', 'DEFENSA', 'MEDIOCAMPISTA', 'DELANTERO'];
  const TIPOS = {
    F5: { label: 'Fútbol 5', cupos: 10 },
    F7: { label: 'Fútbol 7', cupos: 14 },
    F11: { label: 'Fútbol 11', cupos: 22 },
  };
  const DIAS_VISIBLES = 7;

  const fail = (error) => ({ ok: false, error });
  const limpiar = (s, max) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max || 120);
  const hm = (t) => (t ? String(t).slice(0, 5) : t); // 'HH:MM:SS' → 'HH:MM'
  const normHorario = (h) => Object.assign({}, h, { hora_inicio: hm(h.hora_inicio), hora_fin: hm(h.hora_fin) });

  /* Catálogos (casi estáticos) y sesión, en memoria. */
  const cache = { ciudades: [], localidades: [], canchas: [] };
  const sesion = { user: null, jugador: null };

  /* ----------------------------------------------------------------- Arranque */

  async function init() {
    if (!MF.Store.listo) throw new Error(MF.Store.errorInicio);
    const [ci, lo, ca] = await Promise.all([
      must(db().from('ciudades').select('*').order('id_ciudad')),
      must(db().from('localidades').select('*').order('nombre')),
      must(db().from('canchas').select('*').eq('activa', true).order('nombre')),
    ]);
    cache.ciudades = ci;
    cache.localidades = lo;
    cache.canchas = ca;
    await run(db().rpc('generar_horarios')); // idempotente: asegura las franjas de los próximos 7 días
    await cargarSesion();
  }

  /* --------------------------------------------------------------- Catálogos */

  const ciudades = () => cache.ciudades;
  const localidades = (idCiudad) => cache.localidades.filter((l) => !idCiudad || l.id_ciudad === idCiudad);
  const getLocalidad = (id) => cache.localidades.find((l) => l.id_localidad === id) || null;
  const getCiudad = (id) => cache.ciudades.find((c) => c.id_ciudad === id) || null;
  const getCancha = (id) => cache.canchas.find((c) => c.id_cancha === id) || null;

  /* ------------------------------------------------------------------ Sesión */

  const getUsuario = () => sesion.user;
  const getActivo = () => sesion.jugador;

  async function leerJugador(id) {
    const r = await run(db().from('jugadores').select('*').eq('id_jugador', id).maybeSingle());
    return r.ok && r.data ? Object.assign({}, r.data, { correo: sesion.user ? sesion.user.email : '' }) : null;
  }

  async function cargarSesion() {
    sesion.user = null;
    sesion.jugador = null;
    let res;
    try {
      res = await db().auth.getSession();
    } catch (e) {
      return;
    }
    const s = res && res.data && res.data.session;
    if (!s) return;
    sesion.user = s.user;
    let j = await leerJugador(s.user.id);
    if (!j && (await crearPerfilPendiente())) j = await leerJugador(s.user.id);
    sesion.jugador = j;
  }

  /** Si el registro no devolvió sesión (correo por confirmar), el perfil viaja en user_metadata y se crea al ingresar. */
  async function crearPerfilPendiente() {
    const meta = sesion.user && sesion.user.user_metadata && sesion.user.user_metadata.perfil;
    if (!meta || Object.keys(validarPerfil(meta)).length) return false;
    const r = await insertarPerfil(sesion.user.id, meta);
    return r.ok;
  }

  async function ingresar(correo, clave) {
    const email = limpiar(correo, 100).toLowerCase();
    if (!email || !clave) return fail('Escribe tu correo y tu contraseña.');
    const r = await run(db().auth.signInWithPassword({ email, password: clave }));
    if (!r.ok) return r;
    await cargarSesion();
    return { ok: true, jugador: sesion.jugador };
  }

  async function salir() {
    await run(db().auth.signOut());
    sesion.user = null;
    sesion.jugador = null;
    return { ok: true };
  }

  /* ---------------------------------------------------------------- Jugadores */

  async function disponibilidadDe(idJugador) {
    const rows = await must(db().from('disponibilidades').select('*').eq('id_jugador', idJugador).order('dia_semana'));
    return rows.map((d) => Object.assign({}, d, { hora_inicio: hm(d.hora_inicio), hora_fin: hm(d.hora_fin) }));
  }

  /** RF-02: devuelve un objeto de errores por campo (vacío si todo es válido).
      opts.conCuenta: además valida correo y contraseña (registro). */
  function validarPerfil(data, opts) {
    opts = opts || {};
    const e = {};
    const nombre = limpiar(data.nombre, 60);
    if (nombre.length < 2) e.nombre = 'Escribe tu nombre (mínimo 2 caracteres).';

    if (opts.conCuenta) {
      const correo = limpiar(data.correo, 100).toLowerCase();
      if (!correo) e.correo = 'El correo es obligatorio.';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) e.correo = 'Escribe un correo válido, por ejemplo nombre@correo.com.';
      if (String(data.clave || '').length < 6) e.clave = 'La contraseña debe tener al menos 6 caracteres.';
    }

    const tel = String(data.telefono || '').replace(/[\s-]/g, '');
    if (tel && !/^3\d{9}$/.test(tel)) e.telefono = 'Usa un celular colombiano de 10 dígitos que empiece por 3.';

    if (!POSICIONES.includes(data.posicion)) e.posicion = 'Selecciona tu posición preferida.';
    if (!getLocalidad(data.id_localidad)) e.id_localidad = 'Selecciona tu ciudad y localidad.';

    const disp = data.disponibilidad || [];
    if (!disp.length) e.disponibilidad = 'Marca al menos un día en el que puedas jugar.';
    const dias = {};
    disp.forEach((d) => {
      if (!d.hora_inicio || !d.hora_fin) dias[d.dia_semana] = 'Indica la hora de inicio y de fin.';
      else if (d.hora_fin <= d.hora_inicio) dias[d.dia_semana] = 'La hora de fin debe ser posterior a la de inicio.';
    });
    if (Object.keys(dias).length) e.dias = dias;
    return e;
  }

  const normalizarPerfil = (data) => ({
    nombre: limpiar(data.nombre, 60),
    telefono: String(data.telefono || '').replace(/[\s-]/g, ''),
    posicion_preferida: data.posicion,
    id_localidad: data.id_localidad,
  });

  async function guardarDisponibilidad(idJugador, disp) {
    const del = await run(db().from('disponibilidades').delete().eq('id_jugador', idJugador));
    if (!del.ok) return del;
    return run(
      db().from('disponibilidades').insert(
        disp.map((d) => ({ id_jugador: idJugador, dia_semana: d.dia_semana, hora_inicio: d.hora_inicio, hora_fin: d.hora_fin }))
      )
    );
  }

  async function insertarPerfil(idJugador, data) {
    const r = await run(db().from('jugadores').insert(Object.assign({ id_jugador: idJugador }, normalizarPerfil(data))));
    if (!r.ok) return r;
    return guardarDisponibilidad(idJugador, data.disponibilidad);
  }

  /** RF-01, RN-01: crea la cuenta (correo único lo garantiza Supabase Auth) y el perfil. */
  async function registrar(data) {
    const errores = validarPerfil(data, { conCuenta: true });
    if (Object.keys(errores).length) return { ok: false, errores };
    const perfil = {
      nombre: data.nombre, telefono: data.telefono, posicion: data.posicion,
      id_localidad: data.id_localidad, disponibilidad: data.disponibilidad,
    };
    const r = await run(
      db().auth.signUp({ email: limpiar(data.correo, 100).toLowerCase(), password: data.clave, options: { data: { perfil } } })
    );
    if (!r.ok) return /Ya existe un perfil/.test(r.error) ? { ok: false, errores: { correo: r.error } } : r;
    if (!r.data.session) return { ok: true, confirmar: true }; // el proyecto exige confirmar el correo
    await cargarSesion();
    if (!sesion.jugador) return fail('Tu cuenta se creó, pero no se pudo guardar el perfil. Ingresa de nuevo e inténtalo otra vez.');
    return { ok: true, jugador: sesion.jugador };
  }

  /** Para quien ya tiene cuenta pero aún no tiene perfil. */
  async function completarPerfil(data) {
    if (!sesion.user) return fail('Inicia sesión primero.');
    const errores = validarPerfil(data);
    if (Object.keys(errores).length) return { ok: false, errores };
    const r = await insertarPerfil(sesion.user.id, data);
    if (!r.ok) return r;
    await cargarSesion();
    return { ok: true, jugador: sesion.jugador };
  }

  /** RF-03 */
  async function actualizarJugador(data) {
    const j = sesion.jugador;
    if (!j) return fail('Inicia sesión para editar tu perfil.');
    const errores = validarPerfil(data);
    if (Object.keys(errores).length) return { ok: false, errores };
    const r = await run(db().from('jugadores').update(normalizarPerfil(data)).eq('id_jugador', j.id_jugador));
    if (!r.ok) return r;
    const d = await guardarDisponibilidad(j.id_jugador, data.disponibilidad);
    if (!d.ok) return d;
    await cargarSesion();
    return { ok: true, jugador: sesion.jugador };
  }

  /* ----------------------------------------------------------------- Canchas */

  const fechasDisponibles = () => Array.from({ length: DIAS_VISIBLES }, (_, i) => D.addDias(D.hoy(), i));

  function estadoHorario(h) {
    const ahora = new Date();
    if (h.estado === 'RESERVADO') return D.at(h.fecha, h.hora_fin) <= ahora ? 'FINALIZADO' : 'RESERVADO';
    if (h.estado === 'DISPONIBLE') return D.at(h.fecha, h.hora_inicio) <= ahora ? 'FINALIZADO' : 'DISPONIBLE';
    return h.estado;
  }

  /** RF-05, RF-06 */
  async function buscarCanchas(f) {
    f = f || {};
    const fechas = f.fecha ? [f.fecha] : fechasDisponibles();
    let lista = cache.canchas.slice();
    if (f.id_localidad) lista = lista.filter((c) => c.id_localidad === f.id_localidad);
    else if (f.id_ciudad) {
      const ids = cache.localidades.filter((l) => l.id_ciudad === f.id_ciudad).map((l) => l.id_localidad);
      lista = lista.filter((c) => ids.includes(c.id_localidad));
    }
    if (f.tipo) lista = lista.filter((c) => c.tipo_cancha === f.tipo);

    const rows = await must(db().from('horarios').select('id_horario,id_cancha,fecha,hora_inicio,hora_fin,estado').in('fecha', fechas).limit(2000));
    const libres = {};
    rows.map(normHorario).forEach((h) => {
      if (estadoHorario(h) === 'DISPONIBLE') libres[h.id_cancha] = (libres[h.id_cancha] || 0) + 1;
    });

    lista = lista.map((c) => {
      const loc = getLocalidad(c.id_localidad);
      return Object.assign({}, c, { localidad: loc, ciudad: loc ? getCiudad(loc.id_ciudad) : null, libres: libres[c.id_cancha] || 0 });
    });
    if (f.fecha) lista = lista.filter((c) => c.libres > 0);

    if (f.orden === 'precio_desc') lista.sort((a, b) => b.precio_hora - a.precio_hora);
    else if (f.orden === 'precio') lista.sort((a, b) => a.precio_hora - b.precio_hora);
    else lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    return lista;
  }

  /** RF-07: franjas de una cancha en una fecha, con su estado y reserva activa. */
  async function horariosDe(idCancha, fecha) {
    const hs = (await must(db().from('horarios').select('*').eq('id_cancha', idCancha).eq('fecha', fecha).order('hora_inicio'))).map(normHorario);
    const ids = hs.filter((h) => h.estado === 'RESERVADO').map((h) => h.id_horario);
    const reservas = ids.length ? await reservasDetalle((q) => q.in('id_horario', ids).eq('estado', 'ACTIVA')) : [];
    return hs.map((h) => Object.assign({}, h, { estado: estadoHorario(h), reserva: reservas.find((r) => r.id_horario === h.id_horario) || null }));
  }

  /* ---------------------------------------------------------------- Reservas */

  const RESERVA_SELECT =
    '*, horario:horarios(*, cancha:canchas(*)), organizador:jugadores!id_organizador(*), solicitudes(*, jugador:jugadores(*))';

  function detalleReserva(r) {
    const horario = r.horario ? normHorario(r.horario) : null;
    const cancha = horario ? horario.cancha || null : null;
    const sols = r.solicitudes || [];
    const finalizada = r.estado === 'ACTIVA' && horario && D.at(horario.fecha, horario.hora_fin) <= new Date();
    return Object.assign({}, r, {
      estado: finalizada ? 'FINALIZADA' : r.estado,
      horario,
      cancha,
      localidad: cancha ? getLocalidad(cancha.id_localidad) : null,
      organizador: r.organizador || null,
      participantes: sols.filter((s) => s.estado === 'ACEPTADA').map((s) => s.jugador).filter(Boolean),
      solicitudes: sols,
      cuposLibres: r.cupos_totales - r.cupos_ocupados,
    });
  }

  async function reservasDetalle(filtro) {
    let q = db().from('reservas').select(RESERVA_SELECT);
    if (filtro) q = filtro(q);
    return (await must(q)).map(detalleReserva);
  }

  const cmpPartida = (a, b) => (a.horario.fecha + a.horario.hora_inicio).localeCompare(b.horario.fecha + b.horario.hora_inicio);

  /** RF-15 (las reservas solo las ve quien tiene sesión: RLS). */
  async function partidasAbiertas(f) {
    f = f || {};
    return (await reservasDetalle((q) => q.eq('estado', 'ACTIVA')))
      .filter((p) => p.estado === 'ACTIVA' && p.cuposLibres > 0 && p.horario && p.cancha)
      .filter((p) => !f.id_localidad || p.cancha.id_localidad === f.id_localidad)
      .sort(cmpPartida)
      .slice(0, f.limit || 50);
  }

  /** RF-08. RN-02, RN-03 y RN-06 se validan en el servidor. El organizador es el usuario con sesión. */
  async function reservar(p) {
    const r = await run(db().rpc('reservar', { p_id_horario: p.id_horario, p_cupos: Number(p.cupos_totales), p_posicion: p.posicion || null }));
    return r.ok ? { ok: true, id_reserva: r.data } : r;
  }

  /** RF-09 */
  const cancelarReserva = (idReserva) => run(db().rpc('cancelar_reserva', { p_id_reserva: idReserva }));

  /** RF-10, RN-07: misma localidad y disponibilidad que cubra la franja. */
  async function jugadoresDisponibles(h, reserva, idExcluir) {
    const cancha = getCancha(h.id_cancha);
    if (!cancha) return [];
    const dow = D.dow7(h.fecha);
    const rows = await must(db().from('jugadores').select('*, disponibilidades(*)').eq('id_localidad', cancha.id_localidad));
    return rows
      .filter(
        (j) =>
          (!reserva || j.id_jugador !== reserva.id_organizador) &&
          j.id_jugador !== idExcluir &&
          j.disponibilidades.some((d) => d.dia_semana === dow && hm(d.hora_inicio) <= h.hora_inicio && hm(d.hora_fin) >= h.hora_fin)
      )
      .map((j) => {
        const { disponibilidades, ...resto } = j;
        return resto;
      });
  }

  /** Relación de un jugador con una partida: organizador, solicitante o ninguna. */
  function relacion(reserva, idJugador) {
    if (!reserva || idJugador == null) return null;
    if (reserva.id_organizador === idJugador) return { rol: 'ORGANIZADOR' };
    const s = reserva.solicitudes.find((x) => x.id_jugador === idJugador);
    return s ? { rol: 'SOLICITANTE', solicitud: s } : null;
  }

  /* ------------------------------------------------------------- Solicitudes */

  /** RF-13, RN-03, RN-04, RN-05 (en el servidor). */
  const solicitarUnirse = (idReserva) => run(db().rpc('solicitar_unirse', { p_id_reserva: idReserva }));

  /** RF-12 */
  const invitar = (idReserva, idJugador) => run(db().rpc('invitar', { p_id_reserva: idReserva, p_id_jugador: idJugador }));

  /** RF-14, RN-03: aceptar/rechazar solicitudes (organizador) o invitaciones (invitado). */
  const responder = (idSolicitud, aceptar) => run(db().rpc('responder_solicitud', { p_id_solicitud: idSolicitud, p_aceptar: !!aceptar }));

  /** Quien creó la solicitud puede retirarla mientras esté pendiente. */
  const cancelarSolicitud = (idSolicitud) => run(db().rpc('cancelar_solicitud', { p_id_solicitud: idSolicitud }));

  const cmpSolicitud = (a, b) => {
    const pa = a.estado === 'PENDIENTE' ? 0 : 1;
    const pb = b.estado === 'PENDIENTE' ? 0 : 1;
    return pa - pb || b.fecha_creacion.localeCompare(a.fecha_creacion);
  };

  /** RF-16: todo lo que necesita el panel "Mis partidas" (una sola consulta; RLS limita lo visible). */
  async function misPartidas(idJugador) {
    const reservas = (await reservasDetalle()).filter((r) => r.horario && r.cancha);
    const solicitudes = [];
    reservas.forEach((r) => r.solicitudes.forEach((s) => solicitudes.push(Object.assign({}, s, { reserva: r }))));

    const mias = reservas.filter((r) => r.id_organizador === idJugador).sort((a, b) => -cmpPartida(a, b));
    const jugando = reservas
      .filter((r) => r.id_organizador !== idJugador && r.participantes.some((p) => p.id_jugador === idJugador))
      .sort((a, b) => -cmpPartida(a, b));
    const porResponder = solicitudes
      .filter((s) => (s.tipo === 'SOLICITUD' && s.reserva.id_organizador === idJugador) || (s.tipo === 'INVITACION' && s.id_jugador === idJugador))
      .sort(cmpSolicitud);
    const enviadas = solicitudes
      .filter((s) => (s.tipo === 'SOLICITUD' && s.id_jugador === idJugador) || (s.tipo === 'INVITACION' && s.reserva.id_organizador === idJugador))
      .sort(cmpSolicitud);

    const vigente = (s) => s.estado === 'PENDIENTE' && s.reserva.estado === 'ACTIVA';
    return {
      mias,
      jugando,
      porResponder,
      enviadas,
      pendientes: porResponder.filter(vigente).length,
      enviadasPendientes: enviadas.filter(vigente).length,
    };
  }

  async function pendientesDe(idJugador) {
    return idJugador == null ? 0 : (await misPartidas(idJugador)).pendientes;
  }

  MF.Svc = {
    POSICIONES, TIPOS, DIAS_VISIBLES,
    init,
    ciudades, localidades, getLocalidad, getCiudad,
    getUsuario, getActivo, ingresar, salir, registrar, completarPerfil, actualizarJugador, validarPerfil, disponibilidadDe,
    getCancha, fechasDisponibles, buscarCanchas, horariosDe,
    detalleReserva, partidasAbiertas, reservar, cancelarReserva, jugadoresDisponibles, relacion,
    solicitarUnirse, invitar, responder, cancelarSolicitud, misPartidas, pendientesDe,
  };
})((window.MF = window.MF || {}));

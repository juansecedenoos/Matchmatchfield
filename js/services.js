/* Capa de lógica: reglas de negocio de MatchField (RF-01 a RF-17, RN-01 a RN-07).
   Solo habla con la capa de datos (MF.Store); no toca el DOM. */
(function (MF) {
  'use strict';

  const D = MF.Dates;
  const Store = MF.Store;

  const POSICIONES = ['PORTERO', 'DEFENSA', 'MEDIOCAMPISTA', 'DELANTERO'];
  const TIPOS = {
    F5: { label: 'Fútbol 5', cupos: 10 },
    F7: { label: 'Fútbol 7', cupos: 14 },
    F11: { label: 'Fútbol 11', cupos: 22 },
  };
  const DIAS_VISIBLES = 7;

  const fail = (error) => ({ ok: false, error });
  const col = (name) => Store.get(name, []);
  const save = (name, arr) => Store.set(name, arr);
  const nextId = (arr, key) => arr.reduce((m, x) => Math.max(m, x[key]), 0) + 1;
  const limpiar = (s, max) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max || 120);

  /** Guarda varias colecciones; si alguna falla (p. ej. cuota llena) restaura todas. */
  function commit(changes) {
    const prev = {};
    Object.keys(changes).forEach((k) => (prev[k] = col(k)));
    for (const k of Object.keys(changes)) {
      if (!save(k, changes[k]).ok) {
        Object.keys(prev).forEach((p) => save(p, prev[p]));
        return false;
      }
    }
    return true;
  }

  /* ---------------------------------------------------------------- Inicio */

  function generarHorarios(sembrarReservas) {
    const canchas = col('canchas').filter((c) => c.activa);
    let horarios = col('horarios');
    const existentes = new Set(horarios.map((h) => `${h.id_cancha}|${h.fecha}|${h.hora_inicio}`));
    let id = nextId(horarios, 'id_horario');
    const nuevos = [];
    const hoy = D.hoy();

    for (let d = 0; d < DIAS_VISIBLES; d++) {
      const fecha = D.addDias(hoy, d);
      const finde = D.dow7(fecha) >= 6;
      const desde = finde ? 8 : 17;
      const hasta = finde ? 21 : 22;
      canchas.forEach((c) => {
        for (let hr = desde; hr < hasta; hr++) {
          const inicio = D.hh(hr);
          if (existentes.has(`${c.id_cancha}|${fecha}|${inicio}`)) continue;
          nuevos.push({ id_horario: id++, id_cancha: c.id_cancha, fecha, hora_inicio: inicio, hora_fin: D.hh(hr + 1), estado: 'DISPONIBLE' });
        }
      });
    }

    // Limpieza: franjas de días anteriores a ayer que no tengan reserva.
    const conReserva = new Set(col('reservas').map((r) => r.id_horario));
    const ayer = D.addDias(hoy, -1);
    horarios = horarios.filter((h) => h.fecha >= ayer || conReserva.has(h.id_horario)).concat(nuevos);

    if (sembrarReservas) {
      const jugadores = col('jugadores');
      const reservas = [];
      const solicitudes = [];
      const limite = D.addDias(hoy, 2);
      horarios.forEach((h) => {
        if (h.fecha > limite || D.at(h.fecha, h.hora_inicio) <= new Date()) return;
        if ((h.id_horario * 7) % 5 !== 0) return;
        const cancha = canchas.find((c) => c.id_cancha === h.id_cancha);
        const locales = jugadores.filter((j) => j.id_localidad === cancha.id_localidad);
        if (locales.length < 2) return;
        const org = locales[h.id_horario % locales.length];
        const otros = locales.filter((j) => j.id_jugador !== org.id_jugador).slice(0, (h.id_horario % 3) + 1);
        const idReserva = reservas.length + 1;
        reservas.push({
          id_reserva: idReserva,
          id_horario: h.id_horario,
          id_organizador: org.id_jugador,
          cupos_totales: TIPOS[cancha.tipo_cancha].cupos,
          cupos_ocupados: 1 + otros.length,
          estado: 'ACTIVA',
          fecha_creacion: new Date().toISOString(),
          posicion_organizador: org.posicion_preferida,
        });
        otros.forEach((j) =>
          solicitudes.push({
            id_solicitud: solicitudes.length + 1,
            id_reserva: idReserva,
            id_jugador: j.id_jugador,
            tipo: 'SOLICITUD',
            estado: 'ACEPTADA',
            mensaje: '',
            fecha_creacion: new Date().toISOString(),
          })
        );
        h.estado = 'RESERVADO';
      });
      save('reservas', reservas);
      save('solicitudes', solicitudes);
    }

    save('horarios', horarios);
  }

  function cargarSemilla() {
    const s = MF.SEED;
    Store.clearAll();
    save('ciudades', s.ciudades);
    save('localidades', s.localidades);
    save('jugadores', s.jugadores);
    save('disponibilidades', s.disponibilidades);
    save('canchas', s.canchas);
    save('horarios', []);
    save('reservas', []);
    save('solicitudes', []);
    generarHorarios(true);
    Store.set('version', s.version);
  }

  function init() {
    if (Store.get('version', 0) !== MF.SEED.version || !col('canchas').length) {
      cargarSemilla();
    } else {
      generarHorarios(false);
    }
  }

  function reset() {
    cargarSemilla();
  }

  /* ------------------------------------------------------------- Catálogos */

  const ciudades = () => col('ciudades');
  const localidades = (idCiudad) => col('localidades').filter((l) => !idCiudad || l.id_ciudad === idCiudad);
  const getLocalidad = (id) => col('localidades').find((l) => l.id_localidad === id) || null;
  const getCiudad = (id) => col('ciudades').find((c) => c.id_ciudad === id) || null;

  /* --------------------------------------------------------------- Jugadores */

  const jugadores = () => col('jugadores');
  const getJugador = (id) => col('jugadores').find((j) => j.id_jugador === id) || null;
  const disponibilidadDe = (id) =>
    col('disponibilidades').filter((d) => d.id_jugador === id).sort((a, b) => a.dia_semana - b.dia_semana);

  function getActivo() {
    const id = Store.get('sesion', null);
    return id == null ? null : getJugador(id);
  }
  function setActivo(id) {
    return Store.set('sesion', id).ok;
  }

  /** RF-02, RN-01: devuelve un objeto de errores por campo (vacío si todo es válido). */
  function validarPerfil(data, idExcluir) {
    const e = {};
    const nombre = limpiar(data.nombre, 60);
    if (nombre.length < 2) e.nombre = 'Escribe tu nombre (mínimo 2 caracteres).';

    const correo = limpiar(data.correo, 100).toLowerCase();
    if (!correo) e.correo = 'El correo es obligatorio.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) e.correo = 'Escribe un correo válido, por ejemplo nombre@correo.com.';
    else if (col('jugadores').some((j) => j.correo === correo && j.id_jugador !== idExcluir)) e.correo = 'Ya existe un perfil con este correo.';

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

  function normalizarPerfil(data) {
    return {
      nombre: limpiar(data.nombre, 60),
      correo: limpiar(data.correo, 100).toLowerCase(),
      telefono: String(data.telefono || '').replace(/[\s-]/g, ''),
      posicion_preferida: data.posicion,
      id_localidad: data.id_localidad,
    };
  }

  function guardarDisponibilidad(idJugador, disp) {
    const resto = col('disponibilidades').filter((d) => d.id_jugador !== idJugador);
    let id = nextId(col('disponibilidades'), 'id_disponibilidad');
    const nuevas = disp.map((d) => ({
      id_disponibilidad: id++,
      id_jugador: idJugador,
      dia_semana: d.dia_semana,
      hora_inicio: d.hora_inicio,
      hora_fin: d.hora_fin,
    }));
    return resto.concat(nuevas);
  }

  /** RF-01 */
  function crearJugador(data) {
    const errores = validarPerfil(data, null);
    if (Object.keys(errores).length) return { ok: false, errores };
    const todos = col('jugadores');
    const jugador = Object.assign({ id_jugador: nextId(todos, 'id_jugador'), fecha_registro: new Date().toISOString() }, normalizarPerfil(data));
    const ok = commit({ jugadores: todos.concat(jugador), disponibilidades: guardarDisponibilidad(jugador.id_jugador, data.disponibilidad) });
    if (!ok) return fail('No se pudo guardar el perfil: el almacenamiento del navegador está lleno.');
    setActivo(jugador.id_jugador);
    return { ok: true, jugador };
  }

  /** RF-03 */
  function actualizarJugador(id, data) {
    const errores = validarPerfil(data, id);
    if (Object.keys(errores).length) return { ok: false, errores };
    const todos = col('jugadores');
    const i = todos.findIndex((j) => j.id_jugador === id);
    if (i < 0) return fail('El perfil ya no existe.');
    todos[i] = Object.assign({}, todos[i], normalizarPerfil(data));
    const ok = commit({ jugadores: todos, disponibilidades: guardarDisponibilidad(id, data.disponibilidad) });
    if (!ok) return fail('No se pudo guardar el perfil: el almacenamiento del navegador está lleno.');
    return { ok: true, jugador: todos[i] };
  }

  /* ---------------------------------------------------------------- Canchas */

  const getCancha = (id) => col('canchas').find((c) => c.id_cancha === id) || null;
  const fechasDisponibles = () => Array.from({ length: DIAS_VISIBLES }, (_, i) => D.addDias(D.hoy(), i));

  function estadoHorario(h) {
    const ahora = new Date();
    if (h.estado === 'RESERVADO') return D.at(h.fecha, h.hora_fin) <= ahora ? 'FINALIZADO' : 'RESERVADO';
    if (h.estado === 'DISPONIBLE') return D.at(h.fecha, h.hora_inicio) <= ahora ? 'FINALIZADO' : 'DISPONIBLE';
    return h.estado;
  }

  /** RF-05, RF-06 */
  function buscarCanchas(f) {
    f = f || {};
    const locs = col('localidades');
    const horarios = col('horarios');
    const fechas = f.fecha ? [f.fecha] : fechasDisponibles();
    let lista = col('canchas').filter((c) => c.activa);
    if (f.id_localidad) lista = lista.filter((c) => c.id_localidad === f.id_localidad);
    else if (f.id_ciudad) {
      const ids = locs.filter((l) => l.id_ciudad === f.id_ciudad).map((l) => l.id_localidad);
      lista = lista.filter((c) => ids.includes(c.id_localidad));
    }
    if (f.tipo) lista = lista.filter((c) => c.tipo_cancha === f.tipo);

    lista = lista.map((c) => {
      const libres = horarios.filter((h) => h.id_cancha === c.id_cancha && fechas.includes(h.fecha) && estadoHorario(h) === 'DISPONIBLE').length;
      const loc = locs.find((l) => l.id_localidad === c.id_localidad);
      return Object.assign({}, c, { localidad: loc, ciudad: loc ? getCiudad(loc.id_ciudad) : null, libres });
    });
    if (f.fecha) lista = lista.filter((c) => c.libres > 0);

    if (f.orden === 'precio_desc') lista.sort((a, b) => b.precio_hora - a.precio_hora);
    else if (f.orden === 'precio') lista.sort((a, b) => a.precio_hora - b.precio_hora);
    else lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    return lista;
  }

  /** RF-07: franjas de una cancha en una fecha, con su estado y reserva activa. */
  function horariosDe(idCancha, fecha) {
    return col('horarios')
      .filter((h) => h.id_cancha === idCancha && h.fecha === fecha)
      .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))
      .map((h) => {
        const r = reservaActivaDeHorario(h.id_horario);
        return Object.assign({}, h, { estado: estadoHorario(h), reserva: r ? detalleReserva(r) : null });
      });
  }

  /* --------------------------------------------------------------- Reservas */

  const reservaActivaDeHorario = (idHorario) =>
    col('reservas').find((r) => r.id_horario === idHorario && r.estado === 'ACTIVA') || null;

  function detalleReserva(r) {
    if (typeof r === 'number') r = col('reservas').find((x) => x.id_reserva === r);
    if (!r) return null;
    const horario = col('horarios').find((h) => h.id_horario === r.id_horario) || null;
    const cancha = horario ? getCancha(horario.id_cancha) : null;
    const sols = col('solicitudes').filter((s) => s.id_reserva === r.id_reserva);
    const finalizada = r.estado === 'ACTIVA' && horario && D.at(horario.fecha, horario.hora_fin) <= new Date();
    return Object.assign({}, r, {
      estado: finalizada ? 'FINALIZADA' : r.estado,
      horario,
      cancha,
      localidad: cancha ? getLocalidad(cancha.id_localidad) : null,
      organizador: getJugador(r.id_organizador),
      participantes: sols.filter((s) => s.estado === 'ACEPTADA').map((s) => getJugador(s.id_jugador)).filter(Boolean),
      solicitudes: sols,
      cuposLibres: r.cupos_totales - r.cupos_ocupados,
    });
  }

  const cmpPartida = (a, b) =>
    (a.horario.fecha + a.horario.hora_inicio).localeCompare(b.horario.fecha + b.horario.hora_inicio);

  /** RF-15 */
  function partidasAbiertas(f) {
    f = f || {};
    return col('reservas')
      .filter((r) => r.estado === 'ACTIVA')
      .map(detalleReserva)
      .filter((p) => p && p.estado === 'ACTIVA' && p.cuposLibres > 0 && p.horario && p.cancha)
      .filter((p) => !f.id_localidad || p.cancha.id_localidad === f.id_localidad)
      .sort(cmpPartida)
      .slice(0, f.limit || 50);
  }

  /** RF-08, RN-02, RN-03, RN-06 */
  function reservar(p) {
    const org = getJugador(p.id_organizador);
    if (!org) return fail('Necesitas un perfil activo para reservar.');
    const horarios = col('horarios');
    const h = horarios.find((x) => x.id_horario === p.id_horario);
    if (!h) return fail('La franja no existe.');
    if (estadoHorario(h) !== 'DISPONIBLE') return fail('Esta franja ya no está disponible.');
    if (reservaActivaDeHorario(h.id_horario)) return fail('Esta franja ya fue reservada.');
    const cancha = getCancha(h.id_cancha);
    const max = TIPOS[cancha.tipo_cancha].cupos;
    const cupos = Number(p.cupos_totales);
    if (!Number.isInteger(cupos) || cupos < 2 || cupos > max) return fail(`Los cupos deben estar entre 2 y ${max}.`);

    const reservas = col('reservas');
    const reserva = {
      id_reserva: nextId(reservas, 'id_reserva'),
      id_horario: h.id_horario,
      id_organizador: org.id_jugador,
      cupos_totales: cupos,
      cupos_ocupados: 1,
      estado: 'ACTIVA',
      fecha_creacion: new Date().toISOString(),
      posicion_organizador: POSICIONES.includes(p.posicion) ? p.posicion : org.posicion_preferida,
    };
    h.estado = 'RESERVADO';
    if (!commit({ reservas: reservas.concat(reserva), horarios })) return fail('No se pudo guardar la reserva: el almacenamiento del navegador está lleno.');
    return { ok: true, reserva: detalleReserva(reserva) };
  }

  /** RF-09 */
  function cancelarReserva(idReserva, idActor) {
    const reservas = col('reservas');
    const r = reservas.find((x) => x.id_reserva === idReserva);
    if (!r) return fail('La reserva no existe.');
    if (r.id_organizador !== idActor) return fail('Solo el organizador puede cancelar la reserva.');
    if (r.estado !== 'ACTIVA') return fail('La reserva ya no está activa.');
    r.estado = 'CANCELADA';
    const horarios = col('horarios');
    const h = horarios.find((x) => x.id_horario === r.id_horario);
    if (h) h.estado = 'DISPONIBLE';
    const solicitudes = col('solicitudes');
    solicitudes.forEach((s) => {
      if (s.id_reserva === idReserva && s.estado === 'PENDIENTE') s.estado = 'CANCELADA';
    });
    if (!commit({ reservas, horarios, solicitudes })) return fail('No se pudo cancelar: el almacenamiento del navegador está lleno.');
    return { ok: true };
  }

  /** RF-10, RN-07: misma localidad y disponibilidad que cubra la franja. */
  function jugadoresDisponibles(idHorario) {
    const h = col('horarios').find((x) => x.id_horario === idHorario);
    if (!h) return [];
    const cancha = getCancha(h.id_cancha);
    const dow = D.dow7(h.fecha);
    const disp = col('disponibilidades');
    const reserva = reservaActivaDeHorario(idHorario);
    return col('jugadores').filter(
      (j) =>
        j.id_localidad === cancha.id_localidad &&
        (!reserva || j.id_jugador !== reserva.id_organizador) &&
        disp.some((d) => d.id_jugador === j.id_jugador && d.dia_semana === dow && d.hora_inicio <= h.hora_inicio && d.hora_fin >= h.hora_fin)
    );
  }

  /** Relación de un jugador con una partida: organizador, solicitante o ninguna. */
  function relacion(reserva, idJugador) {
    if (!reserva || idJugador == null) return null;
    if (reserva.id_organizador === idJugador) return { rol: 'ORGANIZADOR' };
    const s = reserva.solicitudes.find((x) => x.id_jugador === idJugador);
    return s ? { rol: 'SOLICITANTE', solicitud: s } : null;
  }

  /* ------------------------------------------------------------ Solicitudes */

  function crearSolicitud(reserva, idJugador, tipo) {
    const solicitudes = col('solicitudes');
    if (solicitudes.some((s) => s.id_reserva === reserva.id_reserva && s.id_jugador === idJugador)) {
      return fail('Ya existe una solicitud o invitación para esta partida.'); // RN-04
    }
    const s = {
      id_solicitud: nextId(solicitudes, 'id_solicitud'),
      id_reserva: reserva.id_reserva,
      id_jugador: idJugador,
      tipo,
      estado: 'PENDIENTE',
      mensaje: '',
      fecha_creacion: new Date().toISOString(),
    };
    if (!commit({ solicitudes: solicitudes.concat(s) })) return fail('No se pudo guardar: el almacenamiento del navegador está lleno.');
    return { ok: true, solicitud: s };
  }

  /** RF-13, RN-03, RN-04, RN-05 */
  function solicitarUnirse(idReserva, idJugador) {
    const r = detalleReserva(idReserva);
    if (!r || r.estado !== 'ACTIVA') return fail('Esta partida ya no está activa.');
    if (!getJugador(idJugador)) return fail('Necesitas un perfil activo para solicitar unirte.');
    if (r.id_organizador === idJugador) return fail('No puedes solicitar unirte a tu propia reserva.');
    if (r.cuposLibres <= 0) return fail('La partida no tiene cupos disponibles.');
    return crearSolicitud(r, idJugador, 'SOLICITUD');
  }

  /** RF-12 */
  function invitar(idReserva, idOrganizador, idJugador) {
    const r = detalleReserva(idReserva);
    if (!r || r.estado !== 'ACTIVA') return fail('Esta partida ya no está activa.');
    if (r.id_organizador !== idOrganizador) return fail('Solo el organizador puede invitar jugadores.');
    if (idJugador === idOrganizador) return fail('No puedes invitarte a ti mismo.');
    if (r.cuposLibres <= 0) return fail('La partida no tiene cupos disponibles.');
    return crearSolicitud(r, idJugador, 'INVITACION');
  }

  /** RF-14, RN-03: aceptar/rechazar solicitudes (organizador) o invitaciones (invitado). */
  function responder(idSolicitud, idActor, aceptar) {
    const solicitudes = col('solicitudes');
    const s = solicitudes.find((x) => x.id_solicitud === idSolicitud);
    if (!s) return fail('La solicitud no existe.');
    if (s.estado !== 'PENDIENTE') return fail('Esta solicitud ya fue respondida.');
    const reservas = col('reservas');
    const r = reservas.find((x) => x.id_reserva === s.id_reserva);
    const det = r && detalleReserva(r);
    if (!det || det.estado !== 'ACTIVA') return fail('La partida ya no está activa.');
    const autorizado = s.tipo === 'SOLICITUD' ? r.id_organizador === idActor : s.id_jugador === idActor;
    if (!autorizado) return fail('No tienes permiso para responder esta solicitud.');
    if (aceptar) {
      if (r.cupos_ocupados >= r.cupos_totales) return fail('No hay cupos disponibles: no se puede aceptar.');
      r.cupos_ocupados += 1;
      s.estado = 'ACEPTADA';
    } else {
      s.estado = 'RECHAZADA';
    }
    if (!commit({ solicitudes, reservas })) return fail('No se pudo guardar: el almacenamiento del navegador está lleno.');
    return { ok: true };
  }

  /** Quien creó la solicitud puede retirarla mientras esté pendiente. */
  function cancelarSolicitud(idSolicitud, idActor) {
    const solicitudes = col('solicitudes');
    const s = solicitudes.find((x) => x.id_solicitud === idSolicitud);
    if (!s) return fail('La solicitud no existe.');
    if (s.estado !== 'PENDIENTE') return fail('Solo se pueden cancelar solicitudes pendientes.');
    const r = col('reservas').find((x) => x.id_reserva === s.id_reserva);
    const creador = s.tipo === 'SOLICITUD' ? s.id_jugador : r && r.id_organizador;
    if (creador !== idActor) return fail('No tienes permiso para cancelar esta solicitud.');
    s.estado = 'CANCELADA';
    if (!commit({ solicitudes })) return fail('No se pudo guardar: el almacenamiento del navegador está lleno.');
    return { ok: true };
  }

  const cmpSolicitud = (a, b) => {
    const pa = a.estado === 'PENDIENTE' ? 0 : 1;
    const pb = b.estado === 'PENDIENTE' ? 0 : 1;
    return pa - pb || b.fecha_creacion.localeCompare(a.fecha_creacion);
  };

  function enriquecerSolicitud(s) {
    return Object.assign({}, s, { reserva: detalleReserva(s.id_reserva), jugador: getJugador(s.id_jugador) });
  }

  /** RF-16: todo lo que necesita el panel "Mis partidas". */
  function misPartidas(idJugador) {
    const reservas = col('reservas').map(detalleReserva).filter((r) => r && r.horario && r.cancha);
    const solicitudes = col('solicitudes').map(enriquecerSolicitud).filter((s) => s.reserva && s.reserva.horario && s.reserva.cancha);

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

  function pendientesDe(idJugador) {
    return idJugador == null ? 0 : misPartidas(idJugador).pendientes;
  }

  MF.Svc = {
    POSICIONES, TIPOS, DIAS_VISIBLES,
    init, reset,
    ciudades, localidades, getLocalidad, getCiudad,
    jugadores, getJugador, disponibilidadDe, getActivo, setActivo,
    validarPerfil, crearJugador, actualizarJugador,
    getCancha, fechasDisponibles, buscarCanchas, horariosDe,
    detalleReserva, partidasAbiertas, reservar, cancelarReserva, jugadoresDisponibles, relacion,
    solicitarUnirse, invitar, responder, cancelarSolicitud, misPartidas, pendientesDe,
  };
})((window.MF = window.MF || {}));

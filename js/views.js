/* Vistas: Inicio, Canchas, Detalle de cancha, Mis partidas y Perfil (ingreso / registro / edición).
   Cada vista es una función async que devuelve un nodo; el router espera el resultado. */
(function (MF) {
  'use strict';

  const { h, toast, badge, select, avatar, waLink, openDialog, POSICION_LABEL } = MF.UI;
  const D = MF.Dates;
  const Svc = MF.Svc;
  const V = (MF.Views = {});

  const go = (hash) => { location.hash = hash; };
  const refresh = () => MF.App.render();
  /** Navega a un hash; si ya estamos ahí, solo refresca. */
  const irA = (hash) => { if (location.hash === hash) refresh(); else go(hash); };
  const titulo = (nodo, t) => { nodo.dataset.title = t; return nodo; };

  /** Ejecuta una acción del servicio (promesa de { ok, error }) y muestra el resultado. */
  async function accion(promesa, okMsg) {
    const r = await promesa;
    if (r.ok) {
      if (okMsg) toast(okMsg);
      refresh();
    } else {
      toast(r.error, 'bad');
    }
    return r.ok;
  }

  /** Envuelve un manejador async para que un fallo se muestre como aviso en vez de perderse. */
  const seguro = (fn) => async (...args) => {
    try { return await fn(...args); } catch (e) { toast(e.message, 'bad'); }
  };

  function requierePerfil() {
    const a = Svc.getActivo();
    if (!a) {
      toast('Primero inicia sesión o crea tu perfil de jugador.', 'bad');
      go('#/perfil');
    }
    return a;
  }

  const horaRango = (hr) => `${hr.hora_inicio} – ${hr.hora_fin}`;
  const linkCancha = (idCancha, fecha, idHorario) =>
    `#/cancha/${idCancha}?fecha=${fecha}${idHorario ? `&horario=${idHorario}` : ''}`;

  function vacio(titulo, texto, cta) {
    return h('div', { class: 'empty' }, h('h3', null, titulo), texto && h('p', null, texto), cta);
  }

  V.notFound = (msg) =>
    titulo(h('section', { class: 'page' }, vacio(msg, 'La dirección no existe o ya no está disponible.', h('a', { class: 'btn', href: '#/' }, 'Ir al inicio'))), 'No encontrado');

  V.error = (msg, reintentar) =>
    titulo(h('section', { class: 'page' },
      vacio('No pudimos cargar la información', msg || 'Ocurrió un error inesperado.',
        h('button', { type: 'button', class: 'btn btn--primary', onclick: reintentar || refresh }, 'Reintentar'))), 'Error');

  /* ----------------------------------------------------- Filtros de búsqueda */

  function filtrosForm(valores, conOrden) {
    const ciudades = [{ value: '', label: 'Todas las ciudades' }].concat(Svc.ciudades().map((c) => ({ value: c.id_ciudad, label: c.nombre })));
    const optsLoc = (idCiudad) =>
      [{ value: '', label: 'Todas las localidades' }].concat(Svc.localidades(idCiudad).map((l) => ({ value: l.id_localidad, label: l.nombre })));

    const selCiudad = select({ id: 'f-ciudad', name: 'ciudad' }, ciudades, valores.ciudad);
    const selLoc = select({ id: 'f-loc', name: 'localidad' }, optsLoc(Number(valores.ciudad) || null), valores.localidad);
    selCiudad.addEventListener('change', () => {
      selLoc.replaceChildren(...optsLoc(Number(selCiudad.value) || null).map((o) => h('option', { value: o.value }, o.label)));
    });

    const hoy = D.hoy();
    const campo = (label, id, control) => h('div', { class: 'field' }, h('label', { for: id }, label), control);

    const form = h('form', { class: 'filters', novalidate: true },
      campo('Ciudad', 'f-ciudad', selCiudad),
      campo('Localidad', 'f-loc', selLoc),
      campo('Fecha', 'f-fecha', h('input', { type: 'date', id: 'f-fecha', name: 'fecha', min: hoy, max: D.addDias(hoy, Svc.DIAS_VISIBLES - 1), value: valores.fecha || '' })),
      campo('Tipo de cancha', 'f-tipo', select({ id: 'f-tipo', name: 'tipo' },
        [{ value: '', label: 'Todos' }].concat(Object.entries(Svc.TIPOS).map(([k, t]) => ({ value: k, label: `${k} · ${t.label}` }))), valores.tipo)),
      conOrden && campo('Ordenar por', 'f-orden', select({ id: 'f-orden', name: 'orden' },
        [{ value: '', label: 'Nombre' }, { value: 'precio', label: 'Precio: menor a mayor' }, { value: 'precio_desc', label: 'Precio: mayor a menor' }], valores.orden)),
      h('div', { class: 'field field--btn' }, h('button', { type: 'submit', class: 'btn btn--primary' }, 'Buscar canchas'))
    );

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const p = new URLSearchParams();
      ['ciudad', 'localidad', 'fecha', 'tipo', 'orden'].forEach((k) => { if (fd.get(k)) p.set(k, fd.get(k)); });
      irA(`#/canchas${p.toString() ? `?${p.toString()}` : ''}`);
    });
    return form;
  }

  /* ---------------------------------------------------------- Tarjeta partida */

  function partidaCard(p, activo) {
    const rel = Svc.relacion(p, activo && activo.id_jugador);
    const pct = Math.round((p.cupos_ocupados / p.cupos_totales) * 100);
    let cta;
    if (rel && rel.rol === 'ORGANIZADOR') cta = h('span', { class: 'badge badge--ok' }, 'Tu partida');
    else if (rel) cta = badge(rel.solicitud.estado);
    else cta = h('button', {
      type: 'button', class: 'btn btn--small btn--primary',
      onclick: () => { if (requierePerfil()) accion(Svc.solicitarUnirse(p.id_reserva), 'Solicitud enviada al organizador.'); },
    }, 'Solicitar unirme');

    return h('article', { class: 'card card--match' },
      h('div', { class: 'card__row' },
        h('div', null,
          h('h3', { class: 'card__title' }, p.cancha.nombre),
          h('p', { class: 'muted' }, `${p.localidad.nombre} · ${p.cancha.tipo_cancha}`)),
        h('div', { class: 'when' }, h('strong', null, D.fmtCorto(p.horario.fecha)), h('span', null, p.horario.hora_inicio))),
      h('div', { class: 'progress', role: 'img', 'aria-label': `${p.cupos_ocupados} de ${p.cupos_totales} cupos ocupados` }, h('span', { style: `width:${pct}%` })),
      h('p', { class: 'muted small' }, `${p.cupos_ocupados}/${p.cupos_totales} cupos · ${p.cuposLibres} libres · Organiza ${p.organizador ? p.organizador.nombre : '—'}`),
      h('div', { class: 'card__actions' }, cta, h('a', { class: 'btn btn--small', href: linkCancha(p.cancha.id_cancha, p.horario.fecha, p.horario.id_horario) }, 'Ver cancha'))
    );
  }

  /* ------------------------------------------------------------------ Inicio */

  V.home = async function () {
    const activo = Svc.getActivo();
    const loc = activo ? Svc.getLocalidad(activo.id_localidad) : null;
    const valores = loc ? { ciudad: loc.id_ciudad, localidad: loc.id_localidad } : {};
    // Las partidas solo las ve quien tiene sesión (RLS).
    const partidas = activo ? await Svc.partidasAbiertas({ id_localidad: loc ? loc.id_localidad : null, limit: 9 }) : [];

    let abiertas;
    if (!activo) {
      abiertas = vacio('Ingresa para ver las partidas abiertas', 'Crea tu perfil o inicia sesión para ver las partidas con cupos y unirte.', h('a', { class: 'btn btn--primary', href: '#/perfil' }, 'Ingresar o crear perfil'));
    } else if (partidas.length) {
      abiertas = h('div', { class: 'grid' }, partidas.map((p) => partidaCard(p, activo)));
    } else {
      abiertas = vacio('No hay partidas abiertas por ahora', loc ? `Todavía no hay partidas con cupos en ${loc.nombre}. Reserva una cancha y crea la tuya.` : 'Reserva una cancha y crea la primera partida.', h('a', { class: 'btn btn--primary', href: '#/canchas' }, 'Ver canchas'));
    }

    return titulo(h('div', null,
      h('section', { class: 'hero' },
        h('h1', null, 'Reserva tu cancha y arma tu equipo'),
        h('p', null, 'Encuentra canchas sintéticas por localidad, mira quién está disponible para jugar y únete a partidas con cupos abiertos.'),
        filtrosForm(valores, false)),

      h('section', { class: 'page' },
        h('div', { class: 'section-head' },
          h('h2', null, loc ? `Partidas con cupos abiertos en ${loc.nombre}` : 'Partidas con cupos abiertos'),
          !activo && h('a', { class: 'link', href: '#/perfil' }, 'Ingresa para unirte')),
        abiertas),

      h('section', { class: 'page steps' },
        h('h2', null, 'Cómo funciona'),
        h('ol', { class: 'steps__list' },
          h('li', null, h('strong', null, '1. Crea tu perfil'), h('span', null, 'Cuéntanos tu posición, tu zona y cuándo puedes jugar.')),
          h('li', null, h('strong', null, '2. Reserva una cancha'), h('span', null, 'Busca por localidad, elige la franja y define los cupos.')),
          h('li', null, h('strong', null, '3. Arma el equipo'), h('span', null, 'Invita jugadores disponibles o acepta solicitudes de quienes quieren unirse.')))
      )), 'Inicio');
  };

  /* ----------------------------------------------------------------- Canchas */

  V.canchas = async function (_, q) {
    const valores = {
      ciudad: q.get('ciudad') || '',
      localidad: q.get('localidad') || '',
      fecha: q.get('fecha') || '',
      tipo: q.get('tipo') || '',
      orden: q.get('orden') || '',
    };
    const lista = await Svc.buscarCanchas({
      id_ciudad: Number(valores.ciudad) || null,
      id_localidad: Number(valores.localidad) || null,
      fecha: valores.fecha || null,
      tipo: valores.tipo || null,
      orden: valores.orden || null,
    });

    return titulo(h('section', { class: 'page' },
      h('h1', null, 'Canchas'),
      filtrosForm(valores, true),
      h('p', { class: 'muted result-count', 'aria-live': 'polite' },
        `${lista.length} ${lista.length === 1 ? 'cancha encontrada' : 'canchas encontradas'}${valores.fecha ? ` con horarios el ${D.fmtFecha(valores.fecha)}` : ''}`),
      lista.length
        ? h('div', { class: 'grid' }, lista.map((c) => canchaCard(c, valores.fecha)))
        : vacio('No encontramos canchas con esos filtros', 'Prueba con otra localidad, otra fecha o quita algún filtro.', h('a', { class: 'btn', href: '#/canchas' }, 'Quitar filtros'))
    ), 'Canchas');
  };

  function canchaCard(c, fecha) {
    const link = `#/cancha/${c.id_cancha}${fecha ? `?fecha=${fecha}` : ''}`;
    return h('article', { class: 'card' },
      h('div', { class: 'card__row' },
        h('div', null, h('h3', { class: 'card__title' }, h('a', { href: link }, c.nombre)), h('p', { class: 'muted' }, `${c.localidad.nombre}, ${c.ciudad.nombre}`)),
        h('span', { class: 'tag' }, c.tipo_cancha)),
      h('p', { class: 'small' }, c.direccion),
      h('p', { class: 'price' }, D.fmtCOP(c.precio_hora), h('span', null, ' / hora')),
      h('p', { class: 'muted small' }, c.libres ? `${c.libres} horarios libres ${fecha ? 'ese día' : 'en los próximos 7 días'}` : 'Sin horarios libres'),
      h('div', { class: 'card__actions' }, h('a', { class: 'btn btn--small btn--primary', href: link }, 'Ver horarios'))
    );
  }

  /* -------------------------------------------------------- Detalle de cancha */

  V.cancha = async function (params, q) {
    const cancha = Svc.getCancha(Number(params[0]));
    if (!cancha) return V.notFound('Cancha no encontrada');
    const activo = Svc.getActivo();
    const loc = Svc.getLocalidad(cancha.id_localidad);
    const ciudad = Svc.getCiudad(loc.id_ciudad);
    const fechas = Svc.fechasDisponibles();
    const fecha = fechas.includes(q.get('fecha')) ? q.get('fecha') : fechas[0];
    const horarios = await Svc.horariosDe(cancha.id_cancha, fecha);
    const sel = horarios.find((x) => x.id_horario === Number(q.get('horario'))) || null;
    const panel = await panelHorario(cancha, sel, activo);

    const chips = h('nav', { class: 'chips', 'aria-label': 'Fecha' },
      fechas.map((f) => h('a', { class: 'chip-date', href: linkCancha(cancha.id_cancha, f), 'aria-current': f === fecha ? 'date' : null }, D.fmtCorto(f))));

    const slots = h('div', { class: 'slots' },
      horarios.length
        ? horarios.map((s) => {
            const cupos = s.reserva ? `${s.reserva.cupos_ocupados}/${s.reserva.cupos_totales}` : null;
            const clickable = s.estado !== 'FINALIZADO';
            const inner = [h('strong', null, horaRango(s)), h('span', null, s.estado === 'RESERVADO' && cupos ? `Reservado · ${cupos} cupos` : MF.UI.ESTADO_LABEL[s.estado])];
            const cls = `slot slot--${s.estado.toLowerCase()}${sel && sel.id_horario === s.id_horario ? ' slot--sel' : ''}`;
            return clickable
              ? h('a', { class: cls, href: linkCancha(cancha.id_cancha, fecha, s.id_horario), 'aria-current': sel && sel.id_horario === s.id_horario ? 'true' : null }, inner)
              : h('span', { class: cls, 'aria-disabled': 'true' }, inner);
          })
        : h('p', { class: 'muted' }, 'No hay franjas para esta fecha.'));

    return titulo(h('section', { class: 'page' },
      h('a', { class: 'link back', href: '#/canchas' }, '← Volver a canchas'),
      h('div', { class: 'detail-head' },
        h('div', null,
          h('h1', null, cancha.nombre),
          h('p', { class: 'muted' }, `${cancha.direccion} · ${loc.nombre}, ${ciudad.nombre}`)),
        h('div', { class: 'detail-meta' }, h('span', { class: 'tag' }, `${cancha.tipo_cancha} · ${Svc.TIPOS[cancha.tipo_cancha].label}`), h('span', { class: 'price' }, D.fmtCOP(cancha.precio_hora), h('span', null, ' / hora')))),
      h('div', { class: 'detail' },
        h('div', { class: 'detail__main' }, h('h2', null, 'Horarios'), chips, slots),
        h('aside', { class: 'detail__side', 'aria-live': 'polite' }, panel))
    ), cancha.nombre);
  };

  async function panelHorario(cancha, sel, activo) {
    if (!sel) return h('div', { class: 'panel' }, h('h2', null, 'Reserva y equipo'), h('p', { class: 'muted' }, 'Selecciona un horario para reservarlo, solicitar unirte o ver los jugadores disponibles.'));
    const cab = h('div', { class: 'panel__head' }, h('h2', null, `${D.fmtCorto(sel.fecha)} · ${horaRango(sel)}`), badge(sel.estado));

    if (sel.estado === 'FINALIZADO') return h('div', { class: 'panel' }, cab, h('p', { class: 'muted' }, 'Esta franja ya pasó y no se puede reservar.'));

    if (sel.estado === 'DISPONIBLE') {
      return h('div', { class: 'panel' }, cab, formReserva(cancha, sel, activo), await listaJugadores(sel, null, activo));
    }

    const r = sel.reserva;
    if (!r) return h('div', { class: 'panel' }, cab, h('p', { class: 'muted' }, 'Esta franja está reservada.'));
    const rel = Svc.relacion(r, activo && activo.id_jugador);
    const esOrg = rel && rel.rol === 'ORGANIZADOR';

    let cta;
    if (esOrg) {
      cta = h('button', {
        type: 'button', class: 'btn btn--danger',
        onclick: () => { if (window.confirm('¿Cancelar esta reserva? Se liberará la franja y se cancelarán las solicitudes pendientes.')) accion(Svc.cancelarReserva(r.id_reserva), 'Reserva cancelada.'); },
      }, 'Cancelar reserva');
    } else if (rel) {
      cta = h('p', null, 'Tu solicitud: ', badge(rel.solicitud.estado));
    } else if (r.cuposLibres > 0) {
      cta = h('button', {
        type: 'button', class: 'btn btn--primary',
        onclick: () => { if (requierePerfil()) accion(Svc.solicitarUnirse(r.id_reserva), 'Solicitud enviada al organizador.'); },
      }, 'Solicitar unirme');
    } else {
      cta = h('p', { class: 'muted' }, 'La partida no tiene cupos disponibles.');
    }

    return h('div', { class: 'panel' }, cab,
      h('p', null, h('strong', null, 'Organiza: '), r.organizador ? r.organizador.nombre : '—', esOrg ? ' (tú)' : ''),
      h('p', null, h('strong', null, 'Cupos: '), `${r.cupos_ocupados} de ${r.cupos_totales} ocupados`),
      h('p', { class: 'small muted' }, 'Jugadores: ', [r.organizador].concat(r.participantes).filter(Boolean).map((j) => j.nombre).join(', ')),
      cta,
      await listaJugadores(sel, r, activo));
  }

  function formReserva(cancha, sel, activo) {
    if (!activo) {
      return h('div', { class: 'note' }, h('p', null, 'Necesitas iniciar sesión para reservar.'), h('a', { class: 'btn btn--primary', href: '#/perfil' }, 'Ingresar o crear perfil'));
    }
    const max = Svc.TIPOS[cancha.tipo_cancha].cupos;
    const cupos = h('input', { type: 'number', id: 'r-cupos', min: 2, max, value: max, inputmode: 'numeric', required: true });
    const pos = select({ id: 'r-pos' }, Svc.POSICIONES.map((p) => ({ value: p, label: POSICION_LABEL[p] })), activo.posicion_preferida);
    const err = h('p', { class: 'error', id: 'r-err', role: 'alert' });
    const btn = h('button', { type: 'submit', class: 'btn btn--primary btn--block' }, `Confirmar reserva · ${D.fmtCOP(cancha.precio_hora)}`);
    const form = h('form', { class: 'form', novalidate: true },
      h('div', { class: 'field' }, h('label', { for: 'r-cupos' }, `Cupos totales de la partida (2 a ${max})`), cupos),
      h('div', { class: 'field' }, h('label', { for: 'r-pos' }, 'Tu posición en la partida'), pos),
      err, btn);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.textContent = '';
      btn.disabled = true;
      const res = await Svc.reservar({ id_horario: sel.id_horario, cupos_totales: Number(cupos.value), posicion: pos.value });
      btn.disabled = false;
      if (res.ok) { toast('¡Reserva confirmada! Ahora puedes invitar jugadores.'); refresh(); }
      else { err.textContent = res.error; cupos.focus(); }
    });
    return form;
  }

  async function listaJugadores(sel, reserva, activo) {
    let jugadores;
    try {
      jugadores = await Svc.jugadoresDisponibles(sel, reserva, activo && activo.id_jugador);
    } catch (e) {
      return h('div', { class: 'players' }, h('h3', null, 'Jugadores disponibles'), h('p', { class: 'error' }, e.message));
    }
    if (!activo) {
      return h('div', { class: 'players' }, h('h3', null, 'Jugadores disponibles'), h('p', { class: 'muted' }, 'Inicia sesión para ver quién está disponible en esta localidad.'));
    }
    const esOrg = reserva && reserva.id_organizador === activo.id_jugador;
    return h('div', { class: 'players' },
      h('h3', null, `Jugadores disponibles (${jugadores.length})`),
      !reserva && jugadores.length > 0 && h('p', { class: 'muted small' }, 'Reserva la franja para poder invitarlos.'),
      jugadores.length
        ? h('ul', { class: 'list' }, jugadores.map((j) => {
            const s = reserva && reserva.solicitudes.find((x) => x.id_jugador === j.id_jugador);
            let accion_;
            if (s) accion_ = badge(s.estado);
            else if (esOrg && reserva.cuposLibres > 0) {
              accion_ = h('button', { type: 'button', class: 'btn btn--small btn--primary', onclick: () => accion(Svc.invitar(reserva.id_reserva, j.id_jugador), `Invitación enviada a ${j.nombre}.`) }, 'Invitar');
            }
            return h('li', { class: 'list__item' },
              avatar(j.nombre),
              h('div', { class: 'list__body' }, h('strong', null, j.nombre), h('span', { class: 'muted small' }, POSICION_LABEL[j.posicion_preferida])),
              h('div', { class: 'list__actions' },
                h('button', { type: 'button', class: 'btn btn--small', onclick: () => verJugador(j) }, 'Ver perfil'),
                accion_));
          }))
        : h('p', { class: 'muted' }, 'Nadie con disponibilidad en esta localidad para esa franja.'));
  }

  const verJugador = seguro(async function (j) {
    const loc = Svc.getLocalidad(j.id_localidad);
    const ciudad = Svc.getCiudad(loc.id_ciudad);
    const disp = await Svc.disponibilidadDe(j.id_jugador);
    const activo = Svc.getActivo();
    openDialog(j.nombre, h('div', { class: 'profile-view' },
      h('div', { class: 'profile-view__top' }, avatar(j.nombre), h('div', null, h('p', null, h('strong', null, POSICION_LABEL[j.posicion_preferida])), h('p', { class: 'muted' }, `${loc.nombre}, ${ciudad.nombre}`))),
      h('h3', null, 'Disponibilidad'),
      h('ul', { class: 'plain' }, disp.map((d) => h('li', null, h('strong', null, D.DIAS[d.dia_semana - 1]), ` ${d.hora_inicio} – ${d.hora_fin}`))),
      j.telefono && activo && activo.id_jugador !== j.id_jugador &&
        h('a', { class: 'btn btn--primary', href: waLink(j.telefono, `Hola ${j.nombre.split(' ')[0]}, te escribo desde MatchField para invitarte a una partida.`), target: '_blank', rel: 'noopener noreferrer' }, 'Contactar por WhatsApp')));
  });

  /* ------------------------------------------------------------ Mis partidas */

  const TABS = [['reservas', 'Mis reservas'], ['responder', 'Por responder'], ['enviadas', 'Enviadas']];

  V['mis-partidas'] = async function (_, q) {
    const activo = Svc.getActivo();
    if (!activo) {
      return titulo(h('section', { class: 'page' }, h('h1', null, 'Mis partidas'),
        vacio('Aún no has iniciado sesión', 'Ingresa o crea tu perfil para ver tus reservas, solicitudes e invitaciones.', h('a', { class: 'btn btn--primary', href: '#/perfil' }, 'Ingresar o crear perfil'))), 'Mis partidas');
    }
    const data = await Svc.misPartidas(activo.id_jugador);
    const tab = TABS.some((t) => t[0] === q.get('tab')) ? q.get('tab') : 'reservas';
    const conteo = { reservas: data.mias.length + data.jugando.length, responder: data.pendientes, enviadas: data.enviadasPendientes };

    const tabs = h('nav', { class: 'tabs', 'aria-label': 'Secciones de Mis partidas' }, TABS.map(([k, label]) =>
      h('a', { class: 'tab', href: `#/mis-partidas?tab=${k}`, 'aria-current': k === tab ? 'page' : null },
        label, conteo[k] > 0 && h('b', { class: 'count' }, String(conteo[k])))));

    let contenido;
    if (tab === 'reservas') contenido = tabReservas(data, activo);
    else if (tab === 'responder') contenido = tabResponder(data, activo);
    else contenido = tabEnviadas(data, activo);

    return titulo(h('section', { class: 'page' }, h('h1', null, 'Mis partidas'), h('p', { class: 'muted' }, `Perfil activo: ${activo.nombre}`), tabs, contenido), 'Mis partidas');
  };

  function resumenPartida(p) {
    return h('div', null,
      h('h3', { class: 'card__title' }, p.cancha.nombre),
      h('p', { class: 'muted small' }, `${D.fmtFecha(p.horario.fecha)} · ${horaRango(p.horario)} · ${p.localidad.nombre}`));
  }

  function tabReservas(data) {
    const tarjeta = (p, propia) => h('article', { class: 'card' },
      h('div', { class: 'card__row' }, resumenPartida(p), badge(p.estado)),
      h('p', { class: 'small' }, `${p.cupos_ocupados}/${p.cupos_totales} cupos`, !propia && p.organizador ? ` · Organiza ${p.organizador.nombre}` : ''),
      h('p', { class: 'muted small' }, 'Jugadores: ', [p.organizador].concat(p.participantes).filter(Boolean).map((j) => j.nombre).join(', ')),
      h('div', { class: 'card__actions' },
        h('a', { class: 'btn btn--small', href: linkCancha(p.cancha.id_cancha, p.horario.fecha, p.horario.id_horario) }, propia ? 'Ver y invitar' : 'Ver cancha'),
        propia && p.estado === 'ACTIVA' && h('button', {
          type: 'button', class: 'btn btn--small btn--danger',
          onclick: () => { if (window.confirm('¿Cancelar esta reserva? Se liberará la franja y se cancelarán las solicitudes pendientes.')) accion(Svc.cancelarReserva(p.id_reserva), 'Reserva cancelada.'); },
        }, 'Cancelar')));

    return h('div', null,
      h('h2', null, 'Reservas que organizo'),
      data.mias.length ? h('div', { class: 'grid' }, data.mias.map((p) => tarjeta(p, true))) : vacio('No has reservado canchas', 'Busca una cancha y reserva tu primera franja.', h('a', { class: 'btn btn--primary', href: '#/canchas' }, 'Buscar canchas')),
      data.jugando.length > 0 && [h('h2', null, 'Partidas en las que juego'), h('div', { class: 'grid' }, data.jugando.map((p) => tarjeta(p, false)))]);
  }

  function filaSolicitud(s, modo) {
    const p = s.reserva;
    const activa = s.estado === 'PENDIENTE' && p.estado === 'ACTIVA';
    let titulo_;
    if (modo === 'recibida') titulo_ = s.tipo === 'SOLICITUD' ? `${s.jugador ? s.jugador.nombre : 'Un jugador'} quiere unirse` : `${p.organizador ? p.organizador.nombre : 'Un organizador'} te invitó a jugar`;
    else titulo_ = s.tipo === 'SOLICITUD' ? 'Solicitaste unirte a esta partida' : `Invitaste a ${s.jugador ? s.jugador.nombre : 'un jugador'}`;

    const acciones = [];
    if (modo === 'recibida' && activa) {
      acciones.push(
        h('button', { type: 'button', class: 'btn btn--small btn--primary', onclick: () => accion(Svc.responder(s.id_solicitud, true), 'Solicitud aceptada.') }, 'Aceptar'),
        h('button', { type: 'button', class: 'btn btn--small', onclick: () => accion(Svc.responder(s.id_solicitud, false), 'Solicitud rechazada.') }, 'Rechazar'));
    }
    if (modo === 'enviada' && activa) {
      acciones.push(h('button', { type: 'button', class: 'btn btn--small', onclick: () => accion(Svc.cancelarSolicitud(s.id_solicitud), 'Solicitud cancelada.') }, 'Cancelar'));
    }

    return h('article', { class: 'card' },
      h('div', { class: 'card__row' }, h('div', null, h('p', null, h('strong', null, titulo_)), resumenPartida(p)), badge(s.estado)),
      h('p', { class: 'muted small' }, `${p.cupos_ocupados}/${p.cupos_totales} cupos ocupados${p.estado !== 'ACTIVA' ? ` · Partida ${MF.UI.ESTADO_LABEL[p.estado].toLowerCase()}` : ''}`),
      acciones.length > 0 && h('div', { class: 'card__actions' }, acciones));
  }

  function tabResponder(data) {
    return data.porResponder.length
      ? h('div', { class: 'grid' }, data.porResponder.map((s) => filaSolicitud(s, 'recibida')))
      : vacio('No tienes nada por responder', 'Aquí verás las solicitudes a tus partidas y las invitaciones que recibas.');
  }

  function tabEnviadas(data) {
    return data.enviadas.length
      ? h('div', { class: 'grid' }, data.enviadas.map((s) => filaSolicitud(s, 'enviada')))
      : vacio('Aún no has enviado solicitudes ni invitaciones', 'Pide unirte a una partida desde el inicio o invita jugadores desde una cancha que reservaste.', h('a', { class: 'btn btn--primary', href: '#/' }, 'Ver partidas abiertas'));
  }

  /* ------------------------------------------------- Perfil: ingreso / registro */

  V.perfil = async function (_, q) {
    const usuario = Svc.getUsuario();
    const activo = Svc.getActivo();

    if (!usuario) {
      const registro = q.get('modo') === 'registro';
      return titulo(h('section', { class: 'page auth' },
        h('h1', null, registro ? 'Crear perfil de jugador' : 'Ingresar'),
        registro
          ? [
              h('p', { class: 'muted' }, 'Crea tu cuenta para reservar canchas y unirte a partidas.'),
              formPerfil(null, 'registro'),
              h('p', null, '¿Ya tienes cuenta? ', h('a', { class: 'link', href: '#/perfil' }, 'Ingresa aquí')),
            ]
          : [
              formLogin(),
              h('p', null, '¿No tienes cuenta? ', h('a', { class: 'link', href: '#/perfil?modo=registro' }, 'Crea tu perfil')),
            ]
      ), registro ? 'Crear perfil' : 'Ingresar');
    }

    if (!activo) {
      return titulo(h('section', { class: 'page auth' },
        h('h1', null, 'Completa tu perfil'),
        h('p', { class: 'muted' }, 'Tu cuenta ya existe, pero falta tu perfil de jugador.'),
        formPerfil(null, 'completar', usuario.email),
        botonSalir()), 'Perfil');
    }

    const disp = await Svc.disponibilidadDe(activo.id_jugador);
    return titulo(h('section', { class: 'page auth' },
      h('h1', null, 'Mi perfil'),
      formPerfil(activo, 'editar', activo.correo, disp),
      botonSalir()), 'Perfil');
  };

  function botonSalir() {
    return h('button', {
      type: 'button', class: 'btn btn--block',
      onclick: async () => { await Svc.salir(); toast('Cerraste sesión.'); irA('#/'); },
    }, 'Cerrar sesión');
  }

  function formLogin() {
    const err = h('p', { class: 'error', id: 'e-login', role: 'alert' });
    const btn = h('button', { type: 'submit', class: 'btn btn--primary' }, 'Ingresar');
    const form = h('form', { class: 'form card', novalidate: true },
      h('div', { class: 'field' }, h('label', { for: 'l-correo' }, 'Correo electrónico'),
        h('input', { type: 'email', id: 'l-correo', name: 'correo', autocomplete: 'email', maxlength: 100 })),
      h('div', { class: 'field' }, h('label', { for: 'l-clave' }, 'Contraseña'),
        h('input', { type: 'password', id: 'l-clave', name: 'clave', autocomplete: 'current-password' })),
      err,
      h('div', { class: 'form__actions' }, btn));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.textContent = '';
      const fd = new FormData(form);
      btn.disabled = true;
      const res = await Svc.ingresar(fd.get('correo'), fd.get('clave'));
      btn.disabled = false;
      if (res.ok) { toast('¡Bienvenido de nuevo!'); irA(Svc.getActivo() ? '#/' : '#/perfil'); }
      else err.textContent = res.error;
    });
    return form;
  }

  /** modo: 'registro' (cuenta nueva), 'completar' (cuenta sin perfil) o 'editar'. */
  function formPerfil(jug, modo, correo, disp) {
    disp = disp || [];
    const loc = jug ? Svc.getLocalidad(jug.id_localidad) : null;
    const ciudadSel = loc ? loc.id_ciudad : '';

    const opcLoc = (idCiudad) => [{ value: '', label: idCiudad ? 'Selecciona…' : 'Primero elige la ciudad' }].concat(idCiudad ? Svc.localidades(idCiudad).map((l) => ({ value: l.id_localidad, label: l.nombre })) : []);
    const selCiudad = select({ id: 'p-ciudad', name: 'ciudad', 'aria-describedby': 'e-id_localidad' }, [{ value: '', label: 'Selecciona…' }].concat(Svc.ciudades().map((c) => ({ value: c.id_ciudad, label: c.nombre }))), ciudadSel);
    const selLoc = select({ id: 'p-loc', name: 'id_localidad', 'aria-describedby': 'e-id_localidad' }, opcLoc(ciudadSel || null), jug ? jug.id_localidad : '');
    selCiudad.addEventListener('change', () => selLoc.replaceChildren(...opcLoc(Number(selCiudad.value) || null).map((o) => h('option', { value: o.value }, o.label))));

    const campo = (id, label, control, ayuda) => h('div', { class: 'field' },
      h('label', { for: id }, label), control, ayuda && h('p', { class: 'hint' }, ayuda), h('p', { class: 'error', id: `e-${control.name || id}` }));

    const dias = D.DIAS.map((nombre, i) => {
      const n = i + 1;
      const d = disp.find((x) => x.dia_semana === n);
      const finde = n >= 6;
      return h('div', { class: 'day' },
        h('label', { class: 'day__check' }, h('input', { type: 'checkbox', name: `dia_${n}`, checked: !!d }), h('span', null, nombre)),
        h('div', { class: 'day__times' },
          h('input', { type: 'time', name: `ini_${n}`, 'aria-label': `${nombre}: hora de inicio`, value: d ? d.hora_inicio : finde ? '09:00' : '18:00' }),
          h('span', { 'aria-hidden': 'true' }, 'a'),
          h('input', { type: 'time', name: `fin_${n}`, 'aria-label': `${nombre}: hora de fin`, value: d ? d.hora_fin : finde ? '20:00' : '22:00' })),
        h('p', { class: 'error', id: `e-dia_${n}` }));
    });

    const btn = h('button', { type: 'submit', class: 'btn btn--primary' }, modo === 'editar' ? 'Guardar cambios' : modo === 'registro' ? 'Crear perfil' : 'Guardar perfil');

    const form = h('form', { class: 'form card', novalidate: true },
      campo('p-nombre', 'Nombre completo', h('input', { type: 'text', id: 'p-nombre', name: 'nombre', maxlength: 60, autocomplete: 'name', value: jug ? jug.nombre : '', 'aria-describedby': 'e-nombre' })),
      modo === 'registro'
        ? [
            campo('p-correo', 'Correo electrónico', h('input', { type: 'email', id: 'p-correo', name: 'correo', maxlength: 100, autocomplete: 'email', 'aria-describedby': 'e-correo' })),
            campo('p-clave', 'Contraseña', h('input', { type: 'password', id: 'p-clave', name: 'clave', autocomplete: 'new-password', 'aria-describedby': 'e-clave' }), 'Mínimo 6 caracteres.'),
          ]
        : campo('p-correo', 'Correo electrónico', h('input', { type: 'email', id: 'p-correo', name: 'correo', value: correo || '', readonly: true, 'aria-describedby': 'e-correo' }), 'El correo es el de tu cuenta y no se puede cambiar aquí.'),
      campo('p-tel', 'Celular (opcional)', h('input', { type: 'tel', id: 'p-tel', name: 'telefono', maxlength: 13, inputmode: 'numeric', autocomplete: 'tel', value: jug ? jug.telefono : '', 'aria-describedby': 'e-telefono' }), 'Permite que te contacten por WhatsApp. 10 dígitos, empieza por 3.'),
      campo('p-pos', 'Posición preferida', select({ id: 'p-pos', name: 'posicion', 'aria-describedby': 'e-posicion' }, [{ value: '', label: 'Selecciona…' }].concat(Svc.POSICIONES.map((p) => ({ value: p, label: POSICION_LABEL[p] }))), jug ? jug.posicion_preferida : '')),
      h('div', { class: 'row-2' },
        h('div', { class: 'field' }, h('label', { for: 'p-ciudad' }, 'Ciudad'), selCiudad),
        h('div', { class: 'field' }, h('label', { for: 'p-loc' }, 'Localidad'), selLoc)),
      h('p', { class: 'error', id: 'e-id_localidad' }),
      h('fieldset', { class: 'fieldset' },
        h('legend', null, 'Disponibilidad semanal'),
        h('p', { class: 'hint' }, 'Marca los días que puedes jugar y la franja en que estás libre.'),
        dias,
        h('p', { class: 'error', id: 'e-disponibilidad' })),
      h('div', { class: 'form__actions' }, btn, modo === 'editar' && h('a', { class: 'btn', href: '#/' }, 'Volver al inicio')));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const data = {
        nombre: fd.get('nombre'),
        correo: fd.get('correo'),
        clave: fd.get('clave'),
        telefono: fd.get('telefono'),
        posicion: fd.get('posicion'),
        id_localidad: Number(fd.get('id_localidad')) || null,
        disponibilidad: D.DIAS.map((_, i) => i + 1)
          .filter((n) => fd.get(`dia_${n}`) === 'on')
          .map((n) => ({ dia_semana: n, hora_inicio: fd.get(`ini_${n}`), hora_fin: fd.get(`fin_${n}`) })),
      };
      limpiarErrores(form);
      btn.disabled = true;
      let res;
      if (modo === 'registro') res = await Svc.registrar(data);
      else if (modo === 'completar') res = await Svc.completarPerfil(data);
      else res = await Svc.actualizarJugador(data);
      btn.disabled = false;

      if (res.ok && res.confirmar) {
        toast('Te enviamos un correo para confirmar tu cuenta. Confírmalo e ingresa para terminar.');
        irA('#/perfil');
      } else if (res.ok) {
        toast(modo === 'editar' ? 'Perfil actualizado.' : '¡Perfil creado! Ya puedes reservar y unirte a partidas.');
        if (modo === 'editar') refresh();
        else irA('#/');
      } else if (res.errores) {
        mostrarErrores(form, res.errores);
      } else {
        toast(res.error, 'bad');
      }
    });
    return form;
  }

  function limpiarErrores(form) {
    form.querySelectorAll('.error').forEach((p) => (p.textContent = ''));
    form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  }

  function mostrarErrores(form, errores) {
    let primero = null;
    const poner = (campo, msg, nombreInput) => {
      const p = form.querySelector(`#e-${campo}`);
      if (p) p.textContent = msg;
      const input = form.querySelector(`[name="${nombreInput || campo}"]`);
      if (input) { input.setAttribute('aria-invalid', 'true'); if (!primero) primero = input; }
    };
    ['nombre', 'correo', 'clave', 'telefono', 'posicion'].forEach((c) => { if (errores[c]) poner(c, errores[c]); });
    if (errores.id_localidad) poner('id_localidad', errores.id_localidad);
    if (errores.disponibilidad) poner('disponibilidad', errores.disponibilidad, 'dia_1');
    if (errores.dias) Object.keys(errores.dias).forEach((n) => poner(`dia_${n}`, errores.dias[n], `fin_${n}`));
    if (primero) primero.focus();
  }
})((window.MF = window.MF || {}));

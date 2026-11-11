/* Punto de entrada: router por hash, navegación y arranque. */
(function (MF) {
  'use strict';

  const { h } = MF.UI;
  const Svc = MF.Svc;

  const ROUTES = {
    '': 'home',
    canchas: 'canchas',
    cancha: 'cancha',
    'mis-partidas': 'mis-partidas',
    perfil: 'perfil',
  };
  const NAV_ACTIVO = { cancha: 'canchas' };

  let ultimaRuta = null;
  let ticket = 0; // evita que una respuesta lenta pise una vista más reciente

  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, query] = raw.split('?');
    const parts = path.split('/').filter(Boolean);
    return { name: parts[0] || '', params: parts.slice(1), query: new URLSearchParams(query || '') };
  }

  const cargando = () => h('p', { class: 'loading', role: 'status' }, 'Cargando…');

  function actualizarNav(ruta) {
    const activa = NAV_ACTIVO[ruta] || ruta || 'home';
    document.querySelectorAll('#nav a').forEach((a) => {
      const on = a.dataset.route === activa || (activa === '' && a.dataset.route === 'home');
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });

    const jugador = Svc.getActivo();
    const chip = document.getElementById('chip');
    chip.replaceChildren();
    if (jugador) {
      chip.append(MF.UI.avatar(jugador.nombre), h('span', { class: 'chip__txt' }, jugador.nombre.split(' ')[0]));
      chip.setAttribute('aria-label', `Perfil activo: ${jugador.nombre}`);
    } else {
      chip.append(h('span', { class: 'chip__txt' }, Svc.getUsuario() ? 'Completar perfil' : 'Ingresar'));
      chip.setAttribute('aria-label', Svc.getUsuario() ? 'Completar tu perfil de jugador' : 'Ingresar o crear perfil');
    }

    // El contador de pendientes requiere una consulta: se actualiza cuando llega.
    const badge = document.getElementById('nav-badge');
    badge.hidden = true;
    if (jugador) {
      Svc.pendientesDe(jugador.id_jugador)
        .then((n) => {
          badge.hidden = n === 0;
          badge.textContent = String(n);
        })
        .catch(() => {});
    }
  }

  async function render() {
    const mio = ++ticket;
    const { name, params, query } = parseHash();
    const viewName = ROUTES[name];
    const view = viewName && MF.Views[viewName];
    const app = document.getElementById('app');

    const clave = name + params.join('/');
    if (ultimaRuta !== clave) {
      // Cambio de pantalla: se muestra "Cargando…". Al refrescar la misma pantalla se conserva el contenido.
      ultimaRuta = clave;
      app.replaceChildren(cargando());
      window.scrollTo(0, 0);
    }
    app.setAttribute('aria-busy', 'true');
    actualizarNav(name);

    let nodo;
    try {
      nodo = view ? await view(params, query) : MF.Views.notFound('Página no encontrada');
    } catch (e) {
      nodo = MF.Views.error(e && e.message, render);
    }
    if (mio !== ticket) return;
    app.replaceChildren(nodo);
    app.removeAttribute('aria-busy');
    document.title = `${(nodo.dataset && nodo.dataset.title) || 'MatchField'} · MatchField`;
  }

  MF.App = { render };

  let iniciado = false;
  async function start() {
    if (iniciado) return;
    iniciado = true;
    const app = document.getElementById('app');
    app.replaceChildren(cargando());
    try {
      await Svc.init();
    } catch (e) {
      app.replaceChildren(MF.Views.error(e && e.message, () => location.reload()));
      return;
    }
    window.addEventListener('hashchange', render);
    render();
  }

  document.addEventListener('DOMContentLoaded', start);
  if (document.readyState !== 'loading') start();
})((window.MF = window.MF || {}));

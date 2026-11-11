/* Punto de entrada: router por hash, navegación y arranque. */
(function (MF) {
  'use strict';

  const { h, toast } = MF.UI;
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

  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, query] = raw.split('?');
    const parts = path.split('/').filter(Boolean);
    return { name: parts[0] || '', params: parts.slice(1), query: new URLSearchParams(query || '') };
  }

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
      chip.append(h('span', { class: 'chip__txt' }, 'Crear perfil'));
      chip.setAttribute('aria-label', 'Crear perfil de jugador');
    }

    const badge = document.getElementById('nav-badge');
    const n = Svc.pendientesDe(jugador && jugador.id_jugador);
    badge.hidden = n === 0;
    badge.textContent = String(n);
  }

  function render() {
    const { name, params, query } = parseHash();
    const viewName = ROUTES[name];
    const view = viewName && MF.Views[viewName];
    const app = document.getElementById('app');
    const nodo = view ? view(params, query) : MF.Views.notFound('Página no encontrada');
    app.replaceChildren(nodo);
    actualizarNav(name);
    document.title = `${(nodo.dataset && nodo.dataset.title) || 'MatchField'} · MatchField`;
    if (ultimaRuta !== name + params.join('/')) {
      window.scrollTo(0, 0);
      ultimaRuta = name + params.join('/');
    }
  }

  MF.App = { render };

  MF.onStorageError = (quota) =>
    toast(quota ? 'El almacenamiento del navegador está lleno. Libera espacio o restablece los datos de ejemplo.' : 'No se pudo guardar en el navegador. Revisa que no estés en modo privado.', 'bad');

  let iniciado = false;
  function start() {
    if (iniciado) return;
    iniciado = true;
    Svc.init();
    window.addEventListener('hashchange', render);
    document.getElementById('btn-reset').addEventListener('click', () => {
      if (window.confirm('Esto borra tus perfiles, reservas y solicitudes y vuelve a cargar los datos de ejemplo. ¿Continuar?')) {
        Svc.reset();
        location.hash = '#/';
        render();
        toast('Datos de ejemplo restablecidos.');
      }
    });
    render();
  }

  document.addEventListener('DOMContentLoaded', start);
  if (document.readyState !== 'loading') start();
})((window.MF = window.MF || {}));

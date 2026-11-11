/* Helpers de interfaz. Los nodos se construyen con createElement/textContent,
   nunca con innerHTML, para evitar XSS con datos del usuario (RNF-07). */
(function (MF) {
  'use strict';

  function append(el, children) {
    for (const c of children.flat(Infinity)) {
      if (c === null || c === undefined || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
  }

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, String(v));
      }
    }
    append(el, children);
    return el;
  }

  function toast(message, type) {
    const box = document.getElementById('toasts');
    if (!box) return;
    const t = h('div', { class: `toast toast--${type || 'ok'}` }, message);
    box.append(t);
    setTimeout(() => {
      t.classList.add('toast--out');
      setTimeout(() => t.remove(), 300);
    }, 3800);
  }

  const ESTADO_LABEL = {
    DISPONIBLE: 'Disponible',
    RESERVADO: 'Reservado',
    FINALIZADO: 'Finalizado',
    ACTIVA: 'Activa',
    CANCELADA: 'Cancelada',
    FINALIZADA: 'Finalizada',
    PENDIENTE: 'Pendiente',
    ACEPTADA: 'Aceptada',
    RECHAZADA: 'Rechazada',
  };
  const ESTADO_TONO = {
    DISPONIBLE: 'ok', ACTIVA: 'ok', ACEPTADA: 'ok',
    PENDIENTE: 'warn', RESERVADO: 'warn',
    CANCELADA: 'bad', RECHAZADA: 'bad',
    FINALIZADO: 'mute', FINALIZADA: 'mute',
  };
  const badge = (estado) => h('span', { class: `badge badge--${ESTADO_TONO[estado] || 'mute'}` }, ESTADO_LABEL[estado] || estado);

  const POSICION_LABEL = { PORTERO: 'Portero', DEFENSA: 'Defensa', MEDIOCAMPISTA: 'Mediocampista', DELANTERO: 'Delantero' };

  function select(attrs, options, value) {
    return h(
      'select',
      attrs,
      options.map((o) => h('option', { value: o.value, selected: String(o.value) === String(value == null ? '' : value) }, o.label))
    );
  }

  const iniciales = (nombre) =>
    nombre.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

  const avatar = (nombre) => h('span', { class: 'avatar', 'aria-hidden': 'true' }, iniciales(nombre));

  const waLink = (telefono, texto) =>
    `https://wa.me/57${telefono}?text=${encodeURIComponent(texto || '')}`;

  /** Diálogo modal genérico. */
  function openDialog(title, content) {
    const dlg = h('dialog', { class: 'dialog', 'aria-labelledby': 'dlg-title' });
    const close = () => dlg.close();
    dlg.append(
      h('div', { class: 'dialog__in' },
        h('div', { class: 'dialog__head' },
          h('h2', { id: 'dlg-title' }, title),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Cerrar', onclick: close }, '✕')),
        content)
    );
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
    dlg.addEventListener('close', () => dlg.remove());
    document.body.append(dlg);
    dlg.showModal();
    return dlg;
  }

  MF.UI = { h, toast, badge, select, avatar, waLink, openDialog, POSICION_LABEL, ESTADO_LABEL };
})((window.MF = window.MF || {}));

/* Utilidades puras de fechas y formato (sin acceso al DOM). */
(function (MF) {
  'use strict';

  const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const DIAS_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  const pad = (n) => String(n).padStart(2, '0');
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hoy = () => toISO(new Date());

  function addDias(iso, n) {
    const d = new Date(`${iso}T00:00:00`);
    d.setDate(d.getDate() + n);
    return toISO(d);
  }

  /** Día de la semana de 1 (lunes) a 7 (domingo). */
  function dow7(iso) {
    const g = new Date(`${iso}T00:00:00`).getDay();
    return g === 0 ? 7 : g;
  }

  const at = (fecha, hora) => new Date(`${fecha}T${hora}:00`);
  const hh = (n) => `${pad(n)}:00`;

  const fmtFecha = (iso) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };
  const fmtCorto = (iso) => {
    const [, m, d] = iso.split('-');
    return `${DIAS_CORTO[dow7(iso) - 1]} ${d}/${m}`;
  };
  const fmtCOP = (n) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

  MF.Dates = { DIAS, DIAS_CORTO, pad, toISO, hoy, addDias, dow7, at, hh, fmtFecha, fmtCorto, fmtCOP };
})((window.MF = window.MF || {}));

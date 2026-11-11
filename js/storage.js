/* Capa de datos: único módulo que toca LocalStorage (RNF-06, RNF-08).
   Para migrar a un backend basta con reemplazar este módulo. */
(function (MF) {
  'use strict';

  const PREFIX = 'mf_';

  const Store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(PREFIX + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },

    set(key, value) {
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
        return { ok: true };
      } catch (e) {
        const quota = !!e && (e.name === 'QuotaExceededError' || e.code === 22);
        if (typeof MF.onStorageError === 'function') MF.onStorageError(quota);
        return { ok: false, quota };
      }
    },

    remove(key) {
      try {
        localStorage.removeItem(PREFIX + key);
      } catch (e) {
        /* sin acceso a LocalStorage */
      }
    },

    clearAll() {
      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith(PREFIX))
          .forEach((k) => localStorage.removeItem(k));
      } catch (e) {
        /* sin acceso a LocalStorage */
      }
    },
  };

  MF.Store = Store;
})((window.MF = window.MF || {}));

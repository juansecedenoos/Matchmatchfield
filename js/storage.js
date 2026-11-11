/* Capa de datos: único módulo que habla con Supabase (RNF-06).
   Expone el cliente (Store.db) y dos ayudantes que traducen los errores a español:
     - run(promesa)  → { ok: true, data } | { ok: false, error }   (para acciones; no lanza)
     - must(promesa) → data, o lanza Error con mensaje en español   (para consultas) */
(function (MF) {
  'use strict';

  const cfg = MF.CONFIG || {};
  const SIN_RED = 'No se pudo conectar con el servidor. Revisa tu conexión a internet.';

  let db = null;
  let errorInicio = null;
  try {
    if (!window.supabase || !window.supabase.createClient) throw new Error('No se pudo cargar la librería de Supabase. Revisa tu conexión a internet.');
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) throw new Error('Falta configurar Supabase en js/config.js.');
    db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  } catch (e) {
    errorInicio = e.message;
  }

  const TRADUCCIONES = [
    [/already registered|already been registered/i, 'Ya existe un perfil con este correo.'],
    [/invalid login credentials/i, 'Correo o contraseña incorrectos.'],
    [/email not confirmed/i, 'Debes confirmar tu correo antes de ingresar.'],
    [/password.*(at least|characters)|weak password/i, 'La contraseña debe tener al menos 6 caracteres.'],
    [/rate limit|too many/i, 'Demasiados intentos. Espera un momento e inténtalo de nuevo.'],
    [/invalid.*email|email.*invalid/i, 'Escribe un correo válido, por ejemplo nombre@correo.com.'],
    [/failed to fetch|networkerror|network request|load failed/i, SIN_RED],
  ];

  function mensaje(e) {
    const m = String((e && e.message) || '');
    if (e && e.code === 'P0001') return m; // errores de negocio lanzados por las funciones SQL (ya en español)
    for (const [re, txt] of TRADUCCIONES) if (re.test(m)) return txt;
    if (e && e.code === '42501') return 'No tienes permiso para hacer esto.';
    if (e && e.code === '23505') return 'Ese dato ya existe.';
    if (typeof console !== 'undefined') console.error(e);
    return 'Ocurrió un error en el servidor. Inténtalo de nuevo.';
  }

  async function run(promesa) {
    try {
      const res = await promesa;
      if (res.error) return { ok: false, error: mensaje(res.error) };
      return { ok: true, data: res.data };
    } catch (e) {
      return { ok: false, error: SIN_RED };
    }
  }

  async function must(promesa) {
    let res;
    try {
      res = await promesa;
    } catch (e) {
      throw new Error(SIN_RED);
    }
    if (res.error) throw new Error(mensaje(res.error));
    return res.data;
  }

  MF.Store = { db, listo: !!db, errorInicio, run, must };
})((window.MF = window.MF || {}));

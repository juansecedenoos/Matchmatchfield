/* Configuración pública de Supabase.
   La clave "anon" es pública por diseño: la seguridad depende de las políticas RLS (supabase/schema.sql).
   NUNCA pongas aquí la clave "service_role" ni la "secret". */
(function (MF) {
  'use strict';

  MF.CONFIG = {
    SUPABASE_URL: 'https://zfovxfarmtvcjrnnollr.supabase.co',
    SUPABASE_ANON_KEY:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmb3Z4ZmFybXR2Y2pybm5vbGxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ0MjU5NTAsImV4cCI6MjExMDAwMTk1MH0.r1dz7cSJNQOqlh1X9zC1L10PnPozGTouL6YeWUV2bHY',
  };
})((window.MF = window.MF || {}));

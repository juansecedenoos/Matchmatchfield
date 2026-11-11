# MatchField

Plataforma web para reservar canchas sintéticas de fútbol y conformar equipos.
Proyecto de Programación Web, Universidad ECCI. HTML + CSS + JavaScript, sin dependencias ni paso de compilación.

## Cómo ejecutarlo

La app usa Supabase como backend, así que **necesita internet** y debe servirse por HTTP (no abrir `index.html` con doble clic). Desde esta carpeta:

```bash
python -m http.server 8080
```

y abre `http://localhost:8080`.

## Estructura (arquitectura en tres capas, RNF-06)

```
index.html          Shell de la aplicación (cabecera, navegación, contenedor)
css/styles.css      Estilos mobile-first y responsive
supabase/schema.sql Esquema de Postgres, políticas RLS, funciones de negocio y catálogo de canchas
js/config.js        URL del proyecto Supabase y clave anon (pública por diseño)
js/utils.js         Fechas y formato (dd/mm/aaaa, COP)
js/storage.js       CAPA DE DATOS: único módulo que crea el cliente de Supabase
js/services.js      CAPA DE LÓGICA (async): consultas y llamadas a las funciones SQL
js/ui.js            Helpers de UI (sin innerHTML, prevención de XSS)
js/views.js         CAPA DE PRESENTACIÓN: Inicio, Canchas, Detalle, Mis partidas, Perfil
js/app.js           Router por hash y arranque
```

## Montar tu propio backend

1. Crea un proyecto en supabase.com y ejecuta `supabase/schema.sql` en *SQL Editor*.
2. En *Authentication → Providers → Email* desactiva *Confirm email* (o confírmalo por correo al registrarte).
3. Copia la Project URL y la clave **anon** en `js/config.js`. Nunca uses la `service_role`.

## Cómo probar el flujo completo

Hacen falta al menos dos cuentas (usa dos navegadores o una ventana privada):

1. En **Perfil → Crea tu perfil**, registra al jugador A y al jugador B en la misma localidad, con disponibilidad que cubra la franja que usarás.
2. Como A, entra a **Canchas**, elige una cancha de esa localidad, una fecha y una franja libre, y reserva.
3. Invita a B desde el panel de la derecha.
4. Como B, acepta la invitación en **Mis partidas → Por responder**.
5. Con un jugador C, pide unirte a una partida abierta y vuelve a A para aceptarlo.

## Seguridad

Las escrituras de reservas y solicitudes solo se hacen mediante funciones SQL con `security definer` que validan RN-02 a RN-07; las tablas tienen RLS y no admiten escritura directa. El teléfono de un jugador es visible para cualquier usuario con sesión (lo usa el botón de WhatsApp).

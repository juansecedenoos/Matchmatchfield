# MatchField · contexto para Claude Code

Proyecto académico (Programación Web, Universidad ECCI). **No es corporativo.** Plataforma web para reservar canchas sintéticas de fútbol y conformar equipos. Responde en español.

Historial detallado de decisiones y pendientes: `BITACORA.md`. Cómo ejecutar y probar: `README.md`.

## Stack y restricciones

- HTML5, CSS3 y JavaScript puro. **Sin frameworks, sin npm, sin paso de compilación.**
- **Scripts clásicos con `defer`, no módulos ES6** (sin paso de compilación). La app ya NO funciona abriendo `index.html` con doble clic como antes: usa Supabase por CDN (`supabase-js` 2.45.4 desde jsDelivr) y necesita internet. Para probarla, servir la carpeta (`python -m http.server`; ver `.claude/launch.json`).
- **Backend: Supabase** (Postgres + RLS + Auth). Proyecto `zfovxfarmtvcjrnnollr`. La URL y la clave **anon** (pública por diseño) están en `js/config.js`. **Nunca** poner `service_role` ni la clave secret.
- Esquema, RLS y funciones en `supabase/schema.sql` (re-ejecutable en el SQL Editor). Cualquier cambio de reglas de negocio se hace ahí.
- Responsive de 360 px a 1920 px, mobile-first. En celular la navegación es una barra inferior.

## Arquitectura en tres capas

| Capa | Archivos | Regla |
|---|---|---|
| Datos | `js/config.js`, `js/storage.js`, `supabase/schema.sql` | `storage.js` es el único que crea el cliente de Supabase y traduce errores (`run` para acciones, `must` para consultas). |
| Lógica | `js/services.js`, `js/utils.js` | Todo `async`. **No toca el DOM.** Las escrituras de reservas y solicitudes pasan por funciones SQL (`rpc`), que aplican RN-02 a RN-07 de forma atómica. |
| Presentación | `js/views.js`, `js/ui.js`, `js/app.js`, `css/styles.css` | Vistas `async` y router por hash (`#/`, `#/canchas`, `#/cancha/:id`, `#/mis-partidas`, `#/perfil`). |

Orden de carga en `index.html`: `supabase-js` (CDN) → `config` → `utils` → `storage` → `services` → `ui` → `views` → `app`. Todo cuelga de `window.MF`.

## Convenciones

- **Nunca usar `innerHTML` con datos del usuario** (RNF-07, prevención de XSS). Construir nodos con `h(tag, attrs, ...children)` de `js/ui.js`.
- Las **acciones** de los servicios devuelven `{ ok: true, ... }` o `{ ok: false, error }`; el perfil devuelve `{ ok: false, errores }` por campo. Las **consultas** devuelven los datos y lanzan `Error` en español (el router lo muestra con "Reintentar").
- Los errores de negocio los lanzan las funciones SQL con `raise exception` (código `P0001`) y ya vienen en español.
- El organizador y el jugador actual son siempre `auth.uid()` en el servidor; el cliente no manda el id del actor.
- Los ids de jugador son `uuid` (los de reservas, franjas y solicitudes, números). Postgres devuelve `time` como `HH:MM:SS`: normalizar con `hm()` en `services.js`.
- Fechas `YYYY-MM-DD` y horas `HH:MM` en los datos; mostrar `dd/mm/aaaa` y precios en COP.
- Una franja pasada se considera FINALIZADO calculando contra la hora actual; no hay tareas programadas. El servidor usa la zona `America/Bogota`.
- Interfaz en español. Contraste WCAG AA, `label` en formularios, foco visible.

## Reglas de negocio que no se deben romper

RN-01 correo único · RN-02 una sola reserva **activa** por franja · RN-03 cupos ocupados ≤ totales (el organizador ocupa el primero) · RN-04 una solicitud o invitación por jugador y reserva · RN-05 el organizador no se solicita a sí mismo · RN-06 no reservar franjas pasadas · RN-07 "disponible" = misma localidad y disponibilidad que cubra la franja.

## Verificación

- En este equipo **no hay Node ni npm**. Sí hay Python 3.11: `python -m http.server 8080` sirve la carpeta; `.claude/launch.json` ya lo define (`matchfield-estatico`). Abrir `index.html` como `file://` en el panel del app solo da una instantánea sin scripts.
- Probado contra Supabase real (solo lectura pública): catálogo, canchas, franjas, pantalla de ingreso y protección de "Mis partidas".
- **Sin probar aún:** registro, ingreso, reservar, invitar, solicitar y responder (requieren cuentas reales; no se crearon cuentas de prueba en el proyecto del usuario), las funciones SQL con usuarios distintos, Firefox, Safari, celular físico y rendimiento (RNF-03).
- La interfaz móvil se ve en Edge headless (`--screenshot`), que no baja de ~500 px: para 390 px cargar la página dentro de un `<iframe style="width:390px">`.

## Git

- Remoto: `https://github.com/juansecedenoos/Matchmatchfield.git` (público; antes terminaba en punto: `Matchmatchfield.`). Sitio publicado: `https://juansecedenoos.github.io/Matchmatchfield/` (GitHub Pages con Actions). Git está en `C:\Program Files\Git\cmd\git.exe` (puede no estar en el PATH de la sesión). El push necesita login interactivo: hacerlo desde el Terminal del app (`run_in_terminal`), no desde la herramienta PowerShell.
- Identidad **solo local** a este repositorio: `juansecedenoos` / correo de la universidad. No usar el correo global ni cuentas laborales.
- Si el push responde `Repository not found`, casi seguro Git Credential Manager está usando otra cuenta guardada.
- No hacer `push`, ni cambiar visibilidad, ni tocar credenciales sin confirmación del usuario.

## Siguiente fase

Backend ya migrado a Supabase. Pendiente: probar los flujos con cuentas reales, decidir el hosting (GitHub Pages exige repo público; Vercel Hobby acepta privados) y, si se publica, añadir la URL del sitio en *Authentication → URL Configuration* de Supabase. Decisiones de la migración: los jugadores de ejemplo ya no existen (necesitarían cuentas Auth); el teléfono de un jugador lo ve cualquier usuario con sesión (lo usa el botón de WhatsApp); el correo vive solo en Auth. Si el proyecto exige confirmar el correo, el perfil viaja en `user_metadata` y se crea al primer ingreso.

## Inconsistencias conocidas en los documentos del proyecto

- El modelo relacional tiene `UNIQUE(id_horario)` en RESERVA, lo que impide re-reservar una franja cancelada. El código sigue RN-02 (una reserva *activa*).
- La portada de la propuesta repite el nombre de Juan Macías tres veces.
- La referencia de Bidelman (2012) trata de application cache, no de Web Storage.

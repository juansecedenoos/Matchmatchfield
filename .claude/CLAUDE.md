# MatchField · contexto para Claude Code

Proyecto académico (Programación Web, Universidad ECCI). **No es corporativo.** Plataforma web para reservar canchas sintéticas de fútbol y conformar equipos. Responde en español.

Historial detallado de decisiones y pendientes: `BITACORA.md`. Cómo ejecutar y probar: `README.md`.

## Stack y restricciones

- HTML5, CSS3 y JavaScript puro. **Sin frameworks, sin npm, sin paso de compilación.**
- **Scripts clásicos con `defer`, no módulos ES6**: los módulos no cargan desde `file://` y el RNF-09 exige que funcione abriendo `index.html`.
- Persistencia en LocalStorage (claves con prefijo `mf_`). Sin backend por ahora.
- Responsive de 360 px a 1920 px, mobile-first. En celular la navegación es una barra inferior.

## Arquitectura en tres capas

| Capa | Archivos | Regla |
|---|---|---|
| Datos | `js/storage.js`, `data/seed.js` | Único lugar que toca LocalStorage. Es lo que se reemplaza al migrar a Supabase. |
| Lógica | `js/services.js`, `js/utils.js` | Reglas de negocio RN-01 a RN-07. **No toca el DOM.** |
| Presentación | `js/views.js`, `js/ui.js`, `js/app.js`, `css/styles.css` | Vistas y router por hash (`#/`, `#/canchas`, `#/cancha/:id`, `#/mis-partidas`, `#/perfil`). |

Orden de carga en `index.html`: `utils` → `storage` → `seed` → `services` → `ui` → `views` → `app`. Todo cuelga de `window.MF`.

## Convenciones

- **Nunca usar `innerHTML` con datos del usuario** (RNF-07, prevención de XSS). Construir nodos con `h(tag, attrs, ...children)` de `js/ui.js`.
- Los servicios devuelven `{ ok: true, ... }` o `{ ok: false, error }`; el perfil devuelve `{ ok: false, errores }` por campo.
- Escrituras de varias colecciones con `commit()` (restaura todo si falla la cuota de LocalStorage).
- Fechas `YYYY-MM-DD` y horas `HH:MM` en los datos; mostrar `dd/mm/aaaa` y precios en COP.
- Una franja pasada se considera FINALIZADO calculando contra la hora actual; no hay tareas programadas.
- Interfaz en español. Contraste WCAG AA, `label` en formularios, foco visible.

## Reglas de negocio que no se deben romper

RN-01 correo único · RN-02 una sola reserva **activa** por franja · RN-03 cupos ocupados ≤ totales (el organizador ocupa el primero) · RN-04 una solicitud o invitación por jugador y reserva · RN-05 el organizador no se solicita a sí mismo · RN-06 no reservar franjas pasadas · RN-07 "disponible" = misma localidad y disponibilidad que cubra la franja.

## Verificación

- Sintaxis: `node --check js/*.js data/seed.js`
- La lógica de `services.js` se puede probar en Node cargando `utils`, `storage`, `seed` y `services` en un contexto `vm` con un `localStorage` simulado (ver la bitácora: 35 comprobaciones).
- Captura visual: Edge headless (`--screenshot`). **Ojo:** Edge headless no baja de ~500 px de ancho; para ver 390 px real, cargar `index.html` dentro de un `<iframe style="width:390px">`.
- Sin probar aún: Firefox, Safari, celular físico, rendimiento (RNF-03).

## Git

- Remoto: `https://github.com/juansecedenoos/Matchmatchfield.git` (privado; verificar que el nombre sea el correcto).
- Identidad **solo local** a este repositorio: `juansecedenoos` / correo de la universidad. No usar el correo global ni cuentas laborales.
- Si el push responde `Repository not found`, casi seguro Git Credential Manager está usando otra cuenta guardada.
- No hacer `push`, ni cambiar visibilidad, ni tocar credenciales sin confirmación del usuario.

## Siguiente fase (backend)

Plan: Supabase (Postgres + RLS + Auth) para los datos; GitHub Pages o Vercel para el hosting. GitHub Actions es solo CI/CD, no un backend. Al migrar: reemplazar `storage.js`, pasar `services.js` a `async/await` y adaptar las vistas. Nunca subir una clave `service_role`; la `anon` es pública por diseño y la seguridad depende de RLS.

## Inconsistencias conocidas en los documentos del proyecto

- El modelo relacional tiene `UNIQUE(id_horario)` en RESERVA, lo que impide re-reservar una franja cancelada. El código sigue RN-02 (una reserva *activa*).
- La portada de la propuesta repite el nombre de Juan Macías tres veces.
- La referencia de Bidelman (2012) trata de application cache, no de Web Storage.

# Bitácora de la sesión · MatchField

Documento de control del trabajo realizado en la sesión de desarrollo.

| Dato | Valor |
|---|---|
| Proyecto | MatchField: plataforma web para reservas de canchas sintéticas y conformación de equipos |
| Materia | Programación Web, Universidad ECCI (docente: Jose Fernando Sotelo Cubillos) |
| Equipo | Juan Sebastián Cedeño Osorio, Yotman Julian Cuellar Bustos, Juan Macías |
| Fecha de la sesión | 11/11/2026 |
| Repositorio destino | `https://github.com/juansecedenoos/Matchmatchfield` (privado) |

---

## 1. Resumen ejecutivo

- Se leyeron y analizaron los dos documentos del proyecto (propuesta y avance).
- Se construyó el **frontend completo** de MatchField (HTML, CSS y JavaScript, sin dependencias) siguiendo el SRS IEEE 830 del avance.
- Se probó la lógica de negocio (35 comprobaciones) y la interfaz en vista de escritorio y de celular.
- Se inició el repositorio Git local y se creó el primer commit.
- **Pendiente:** el `push` a GitHub no se completó por un problema de autenticación (ver sección 6).

---

## 2. Cronología

### 2.1 Lectura de la documentación
- Se listó la carpeta: `Avance Proyecto.docx` y `Propuesta Proyecto.pdf`.
- El `.docx` se leyó extrayendo el XML interno. El `.pdf` falló con la herramienta de lectura (faltaba `pdftoppm`) y se leyó con PyMuPDF.
- No se pudieron ver las 11 figuras del avance (diagramas UML, mockups, Gantt, ER): son imágenes dentro del `.docx`.

**Observaciones sobre los documentos:**
1. En la portada de la propuesta, el nombre de Juan Macías aparece tres veces; dos líneas son sobrantes, una de ellas sin código.
2. La propuesta define 4 objetivos específicos; el avance usa 5 (OE1 a OE5, el quinto es documentación).
3. LocalStorage no sincroniza entre dispositivos; el avance lo reconoce, pero la propuesta habla de ver quién está jugando "en tiempo real".
4. Las fechas entre propuesta y avance necesitan revisión de coherencia.
5. La referencia de Bidelman (2012) trata de *application cache*, no de Web Storage.

### 2.2 Construcción del frontend
- Se decidió: HTML/CSS/JS puro, **scripts clásicos** (no módulos ES6) para que funcione abriendo `index.html` directamente (RNF-09), y arquitectura en tres capas (RNF-06).
- Se crearon los archivos listados en la sección 3.
- Los horarios y las partidas de ejemplo se generan a partir de la fecha actual; no se guardan fechas fijas.

### 2.3 Pruebas
- **Lógica (Node con navegador simulado):** 35 comprobaciones, todas aprobadas tras corregir una aserción mal planteada en el propio test (Camilo ya jugaba en 3 partidas de ejemplo).
- **Interfaz (Edge headless):** capturas en 1280 px y 390 px.
- **Defecto encontrado y corregido:** en el detalle de cancha en celular, la fila de fechas (con scroll horizontal) estiraba la columna de la grilla y empujaba el panel fuera de pantalla. Se corrigió con `minmax(0, 1fr)` y `min-width: 0` en las grillas.
- **No se probó:** el flujo completo con clics reales en el navegador, ni Firefox/Safari, ni un celular físico.

### 2.4 Backend y despliegue (asesoría)
- Se aclaró que **GitHub Actions no es un backend**: es CI/CD.
- Opciones evaluadas: Supabase (datos), Vercel y GitHub Pages (hosting).
- Recomendación: empezar por publicar en GitHub Pages y después migrar a Supabase.
- Restricción: GitHub Pages gratuito exige repositorio público; Vercel Hobby acepta repositorios privados.

### 2.5 Repositorio Git
- Se confirmó que el correo global de git era el de otra cuenta (laboral), por lo que se configuró **solo en este repositorio** el nombre `juansecedenoos` y el correo de la universidad.
- Se añadieron `.gitignore` y el workflow `.github/workflows/pages.yml`.
- Primer commit: `4ae372d`, "Frontend inicial de MatchField", con 12 archivos.

### 2.6 Intento de push (sin éxito)
Ver sección 6.

---

## 3. Entregables creados

```
MatchField/
├── index.html              Shell de la app (cabecera, navegación, contenedor)
├── README.md               Cómo ejecutar y probar
├── BITACORA.md             Este documento
├── .gitignore
├── .github/workflows/pages.yml   Despliegue a GitHub Pages
├── css/styles.css          Estilos mobile-first y responsive
├── data/seed.js            Ciudades, localidades, 11 canchas, 16 jugadores
└── js/
    ├── utils.js            Fechas y formato (dd/mm/aaaa, COP)
    ├── storage.js          CAPA DE DATOS (único acceso a LocalStorage)
    ├── services.js         CAPA DE LÓGICA (reservas, solicitudes, RN-01 a RN-07)
    ├── ui.js               Helpers de UI (sin innerHTML)
    ├── views.js            CAPA DE PRESENTACIÓN (5 vistas)
    └── app.js              Router por hash y arranque
```

---

## 4. Cobertura de requisitos

| Área | Estado |
|---|---|
| RF-01 a RF-04 (perfil, validación, edición, perfil activo) | Implementado |
| RF-05 a RF-09 (búsqueda, filtros, horarios, reservar, cancelar) | Implementado |
| RF-10 a RF-15 (jugadores disponibles, invitar, solicitar, aceptar/rechazar, inicio) | Implementado |
| RF-16 (panel Mis partidas) | Implementado |
| RF-17 (LocalStorage y datos semilla) | Implementado |
| RNF-01, 02, 09 (responsive, compatibilidad, portabilidad) | Implementado; probado solo en Edge |
| RNF-05 (accesibilidad) | Implementado (HTML semántico, labels, foco visible, teclado); sin auditoría formal |
| RNF-07, 08 (seguridad, cuota) | Implementado |
| RN-01 a RN-07 | Implementado y probado |
| RNF-03 (rendimiento) | Sin medir |

---

## 5. Decisiones técnicas

1. **Scripts clásicos en vez de módulos ES6.** Los módulos no cargan desde `file://`; así se cumple RNF-09.
2. **Re-reserva tras cancelar.** El modelo relacional define `UNIQUE(id_horario)` en RESERVA, lo que impide reservar de nuevo una franja cancelada. Se siguió RN-02 (una sola reserva *activa*). **Acción sugerida:** ajustar el documento de avance.
3. **Selector de perfil en la pantalla Perfil.** Como LocalStorage no se comparte entre dispositivos, permite actuar como organizador o como jugador para probar el flujo completo.
4. **Estados derivados.** Una franja pasada se muestra como FINALIZADO calculando contra la hora actual, sin tarea programada.
5. **Servicios síncronos.** Se mantuvo la lógica síncrona; al migrar a Supabase habrá que pasarla a `async/await`.

---

## 6. Incidente: el push a GitHub falló

| Paso | Resultado |
|---|---|
| `git push -u origin main` (primer intento) | `Repository not found` |
| Verificación pública | Usuario `juansecedenoos`: existe (HTTP 200). Repo: HTTP 404 (consistente con repo privado). |
| El usuario confirmó que el repo es privado | — |
| Segundo intento, ejecutado por el usuario | Mismo error, sin abrir ventana de login |
| Diagnóstico | Git Credential Manager tenía guardada **otra cuenta** (laboral) y la usaba en automático; con ella GitHub responde 404 para un repo privado ajeno |
| Mitigación aplicada | `credential.https://github.com.username = juansecedenoos` (solo en este repo). No se cerró la sesión de la otra cuenta. |
| Resultado | El usuario decidió **hacer el push desde otro equipo** |

**Estado final:** commit `4ae372d` creado localmente; nada se subió a GitHub.

---

## 7. Segunda sesión (11/11/2026): push y backend con Supabase

### 7.1 Push a GitHub (resuelto)
- Git no estaba instalado en el equipo: se instaló Git 2.56.0 con winget.
- El push fallaba con `Repository not found` aunque la cuenta era la correcta. **Causa:** el repositorio se llama `Matchmatchfield.` (con un punto al final) y el remoto no lo tenía. Se corrigió con `git remote set-url origin https://github.com/juansecedenoos/Matchmatchfield..git`.
- El login de GitHub necesita una ventana interactiva: se hizo desde el Terminal del app, no desde la herramienta PowerShell (que no admite prompts).
- Resultado: `main` quedó publicado con los commits `4ae372d` y `d05fbec`.

### 7.2 Migración a Supabase
- Proyecto Supabase creado por el usuario (`zfovxfarmtvcjrnnollr`). Primer intento de ejecutar el SQL falló con `password authentication failed for user "postgres"`: el proyecto aún se estaba aprovisionando; se resolvió esperando y repitiendo.
- Nuevo `supabase/schema.sql`: 8 tablas, RLS, índice único parcial para RN-02, restricción para RN-03, y funciones `security definer` (`reservar`, `cancelar_reserva`, `solicitar_unirse`, `invitar`, `responder_solicitud`, `cancelar_solicitud`, `generar_horarios`) que aplican RN-02 a RN-07 de forma atómica. Las reservas, solicitudes y franjas no admiten escritura directa.
- Autenticación con Supabase Auth (correo y contraseña). RN-01 la garantiza Auth. `js/storage.js` pasó de LocalStorage al cliente de Supabase; `services.js`, `views.js` y `app.js` pasaron a `async/await`. Nueva pantalla de ingreso y registro; se eliminó el selector de perfiles y el botón "Restablecer datos de ejemplo". `data/seed.js` se eliminó (el catálogo vive en el SQL).
- **Cambios de comportamiento:** ya no hay jugadores de ejemplo (necesitarían cuentas Auth); la app requiere internet y servirse por HTTP; las partidas abiertas solo las ve quien inicia sesión.
- **Verificado:** el esquema responde con la clave anon (11 canchas, 561 franjas, RLS oculta las reservas a anónimos); la app carga, lista canchas, muestra franjas y pide ingresar en "Mis partidas", sin errores en consola.
- **No verificado:** registro, ingreso, reservar, invitar, solicitar y responder con cuentas reales; las funciones SQL con varios usuarios; Firefox, Safari y celular.

---

## 8. Pendientes

- [ ] Probar el flujo completo con dos o tres cuentas reales (ver README) y corregir lo que falle.
- [ ] Confirmar en Supabase que *Confirm email* está desactivado (si no, el registro pide confirmar el correo).
- [ ] Decidir la publicación: repo público + GitHub Pages (*Settings → Pages → Source: GitHub Actions*), o repo privado + Vercel. Al publicar, añadir la URL en *Authentication → URL Configuration*.
- [ ] Renombrar el repositorio para quitar el punto final (opcional) y actualizar el remoto.
- [ ] Probar la app en un celular real y en Firefox y Safari.
- [ ] Corregir los documentos: portada de la propuesta, referencia de Bidelman, `UNIQUE(id_horario)` en el modelo relacional.
- [ ] Mantener fuera del repositorio cualquier clave `service_role` de Supabase. La clave `anon` es pública por diseño; la seguridad depende de RLS.

---

## 9. Cómo retomar

1. Abrir la carpeta `MatchField/` y revisar `README.md` para ejecutar la app (`python -m http.server 8080`).
2. Revisar `git log` y `git status`.
3. Continuar por el primer pendiente de la sección 8.

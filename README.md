# MatchField

Plataforma web para reservar canchas sintéticas de fútbol y conformar equipos.
Proyecto de Programación Web, Universidad ECCI. HTML + CSS + JavaScript, sin dependencias ni paso de compilación.

## Cómo ejecutarlo

Abre `index.html` en el navegador (doble clic) o sirve la carpeta con cualquier servidor estático:

```bash
npx serve .
```

## Estructura (arquitectura en tres capas, RNF-06)

```
index.html          Shell de la aplicación (cabecera, navegación, contenedor)
css/styles.css      Estilos mobile-first y responsive
data/seed.js        Datos semilla: ciudades, localidades, canchas y jugadores de ejemplo
js/utils.js         Fechas y formato (dd/mm/aaaa, COP)
js/storage.js       CAPA DE DATOS: único módulo que usa LocalStorage
js/services.js      CAPA DE LÓGICA: reservas, solicitudes y reglas de negocio RN-01 a RN-07
js/ui.js            Helpers de UI (sin innerHTML, prevención de XSS)
js/views.js         CAPA DE PRESENTACIÓN: Inicio, Canchas, Detalle, Mis partidas, Perfil
js/app.js           Router por hash y arranque
```

## Cómo probar el flujo completo

1. En **Perfil**, crea tu jugador (o usa uno de ejemplo con el botón "Usar").
2. En **Canchas**, entra a una cancha, elige una fecha y una franja libre y reserva.
3. Invita a un jugador disponible desde el panel de la derecha.
4. En **Perfil**, cambia al jugador invitado y acepta la invitación en **Mis partidas > Por responder**.
5. Cambia a otro jugador, pide unirte a una partida abierta y vuelve al organizador para aceptarlo.

El pie de página tiene "Restablecer datos de ejemplo" para empezar de cero.

## Limitación conocida

LocalStorage es local a cada navegador: los perfiles y reservas no se comparten entre dispositivos.
La sincronización real requiere un backend (ver el plan de despliegue con Supabase).

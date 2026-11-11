/* Datos semilla (RF-17). Todo es ficticio y de ejemplo.
   Los horarios y las partidas de ejemplo se generan en services.js a partir de la fecha actual. */
(function (MF) {
  'use strict';

  const ciudades = [
    { id_ciudad: 1, nombre: 'Bogotá' },
    { id_ciudad: 2, nombre: 'Medellín' },
    { id_ciudad: 3, nombre: 'Cali' },
  ];

  const localidades = [
    { id_localidad: 1, id_ciudad: 1, nombre: 'Bosa' },
    { id_localidad: 2, id_ciudad: 1, nombre: 'Kennedy' },
    { id_localidad: 3, id_ciudad: 1, nombre: 'Suba' },
    { id_localidad: 4, id_ciudad: 1, nombre: 'Engativá' },
    { id_localidad: 5, id_ciudad: 1, nombre: 'Fontibón' },
    { id_localidad: 6, id_ciudad: 1, nombre: 'Usaquén' },
    { id_localidad: 7, id_ciudad: 2, nombre: 'El Poblado' },
    { id_localidad: 8, id_ciudad: 2, nombre: 'Laureles' },
    { id_localidad: 9, id_ciudad: 3, nombre: 'San Fernando' },
  ];

  const canchas = [
    { id_cancha: 1, id_localidad: 1, nombre: 'Canchas El Recreo', direccion: 'Calle 65 Sur # 78-20', tipo_cancha: 'F5', precio_hora: 60000, activa: true },
    { id_cancha: 2, id_localidad: 1, nombre: 'Golazo Bosa', direccion: 'Carrera 80 # 63 Sur-45', tipo_cancha: 'F7', precio_hora: 110000, activa: true },
    { id_cancha: 3, id_localidad: 2, nombre: 'Kennedy Soccer Park', direccion: 'Avenida 1 de Mayo # 72-10', tipo_cancha: 'F7', precio_hora: 120000, activa: true },
    { id_cancha: 4, id_localidad: 2, nombre: 'La Pradera Sintética', direccion: 'Calle 38 Sur # 78-33', tipo_cancha: 'F5', precio_hora: 70000, activa: true },
    { id_cancha: 5, id_localidad: 3, nombre: 'Suba Arena Fútbol', direccion: 'Calle 145 # 91-15', tipo_cancha: 'F7', precio_hora: 130000, activa: true },
    { id_cancha: 6, id_localidad: 3, nombre: 'Club Los Cerros', direccion: 'Carrera 111 # 152-40', tipo_cancha: 'F11', precio_hora: 280000, activa: true },
    { id_cancha: 7, id_localidad: 4, nombre: 'Engativá Fútbol 5', direccion: 'Calle 80 # 100-12', tipo_cancha: 'F5', precio_hora: 65000, activa: true },
    { id_cancha: 8, id_localidad: 5, nombre: 'Fontibón Champions', direccion: 'Carrera 99 # 17-30', tipo_cancha: 'F7', precio_hora: 115000, activa: true },
    { id_cancha: 9, id_localidad: 7, nombre: 'Poblado Fútbol Club', direccion: 'Carrera 35 # 10-25', tipo_cancha: 'F7', precio_hora: 150000, activa: true },
    { id_cancha: 10, id_localidad: 8, nombre: 'Laureles Sintética', direccion: 'Circular 4 # 70-18', tipo_cancha: 'F5', precio_hora: 80000, activa: true },
    { id_cancha: 11, id_localidad: 9, nombre: 'San Fernando Fútbol', direccion: 'Calle 5 # 38-20', tipo_cancha: 'F7', precio_hora: 100000, activa: true },
  ];

  /* [nombre, correo, teléfono, posición, localidad, patrón de disponibilidad] */
  const J = [
    ['Camilo Rojas', 'camilo.rojas@ejemplo.com', '3001112201', 'DELANTERO', 1, 'noche'],
    ['Andrés Peña', 'andres.pena@ejemplo.com', '', 'PORTERO', 1, 'todo'],
    ['Daniel Torres', 'daniel.torres@ejemplo.com', '3001112203', 'DEFENSA', 2, 'noche'],
    ['Sebastián Mora', 'sebastian.mora@ejemplo.com', '3001112204', 'MEDIOCAMPISTA', 2, 'finde'],
    ['Laura Gómez', 'laura.gomez@ejemplo.com', '3001112205', 'MEDIOCAMPISTA', 3, 'todo'],
    ['Julián Vargas', 'julian.vargas@ejemplo.com', '', 'DEFENSA', 3, 'mixto'],
    ['Felipe Castro', 'felipe.castro@ejemplo.com', '3001112207', 'DELANTERO', 4, 'noche'],
    ['Valentina Ruiz', 'valentina.ruiz@ejemplo.com', '3001112208', 'PORTERO', 4, 'todo'],
    ['Mateo Silva', 'mateo.silva@ejemplo.com', '3001112209', 'DEFENSA', 5, 'mixto'],
    ['Nicolás Cárdenas', 'nicolas.cardenas@ejemplo.com', '', 'DELANTERO', 5, 'todo'],
    ['Santiago Ospina', 'santiago.ospina@ejemplo.com', '3001112211', 'MEDIOCAMPISTA', 7, 'noche'],
    ['Isabela Arango', 'isabela.arango@ejemplo.com', '3001112212', 'DELANTERO', 7, 'todo'],
    ['Esteban Zapata', 'esteban.zapata@ejemplo.com', '3001112213', 'DEFENSA', 8, 'finde'],
    ['Manuela Henao', 'manuela.henao@ejemplo.com', '', 'PORTERO', 8, 'todo'],
    ['Cristian Lozano', 'cristian.lozano@ejemplo.com', '3001112215', 'MEDIOCAMPISTA', 9, 'noche'],
    ['Paula Montoya', 'paula.montoya@ejemplo.com', '3001112216', 'DELANTERO', 9, 'todo'],
  ];

  const PATRONES = {
    noche: [[[1, 2, 3, 4, 5], '18:00', '22:00']],
    finde: [[[6, 7], '08:00', '20:00']],
    mixto: [[[2, 4], '18:00', '22:00'], [[6], '08:00', '14:00']],
    todo: [[[1, 2, 3, 4, 5], '17:00', '22:00'], [[6, 7], '08:00', '21:00']],
  };

  const jugadores = [];
  const disponibilidades = [];
  J.forEach((r, i) => {
    const id = i + 1;
    jugadores.push({
      id_jugador: id,
      id_localidad: r[4],
      nombre: r[0],
      correo: r[1],
      telefono: r[2],
      posicion_preferida: r[3],
      fecha_registro: '2026-09-01',
      ejemplo: true,
    });
    PATRONES[r[5]].forEach(([dias, ini, fin]) => {
      dias.forEach((d) => {
        disponibilidades.push({
          id_disponibilidad: disponibilidades.length + 1,
          id_jugador: id,
          dia_semana: d,
          hora_inicio: ini,
          hora_fin: fin,
        });
      });
    });
  });

  MF.SEED = { version: 1, ciudades, localidades, canchas, jugadores, disponibilidades };
})((window.MF = window.MF || {}));

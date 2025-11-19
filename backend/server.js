// --- 1. Importaciones ---
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import crypto from 'crypto';

// --- 2. Configuración del Servidor ---
const app = express();
app.use(cors());

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "https://el-impostor-swart.vercel.app/", // Permitir todas las conexiones (útil para desarrollo/túneles)
    methods: ["GET", "POST"]
  }
});

const PORT = (typeof globalThis !== 'undefined' && globalThis.process && globalThis.process.env && globalThis.process.env.PORT) || 3000;

// --- 3. "Base de Datos" / Estado del Juego ---
let salas = {};

const palabrasJuego = [
  "Casa", "Perro", "Manzana", "Café", "Montaña",
  "Río", "Puente", "Libro", "Cine", "Playa",
  "Escuela", "Micrófono", "Teléfono", "Auto", "Helicóptero", "Hospital"
];

// --- 4. Funciones de Ayuda ---
const generarCodigoSala = () => {
  let codigo;
  do {
    codigo = Math.random().toString(36).substring(2, 6);
  } while (salas[codigo]);
  return codigo;
};

// --- 5. Lógica de Socket.io ---

io.on('connection', (socket) => {
  console.log(`Nuevo cliente conectado: ${socket.id}`);

  /**
   * Helper: Procesar el fin de la votación
   * LÓGICA: Marca al expulsado como alive=false, NO lo saca de la sala.
   */
  /**
   * Procesa el final de la votación en una sala: cuenta votos válidos, determina
   * expulsado según la regla de mayoría (> mitad de jugadores vivos), aplica la
   * "muerte" sin eliminar el jugador del array, actualiza el estado de la sala,
   * y emite los resultados y eventos de finalización via socket.io.
   *
   * Reglas y comportamiento:
   * - Solo se cuentan los votos dirigidos a jugadores vivos. Votos a jugadores
   *   muertos se ignoran.
   * - Votos vacíos o con el valor 'skip' se consideran "skips" y no cuentan
   *   contra ningún jugador, pero se incluyen en el recuento de skips.
   * - Un jugador solo es expulsado si tiene estrictamente más de la mitad de
   *   los jugadores vivos (topCount > aliveCount / 2). Empates o mayorías simples
   *   insuficientes no expulsan a nadie.
   * - Si hay expulsado:
   *   - Se marca jugador.alive = false (no se elimina del array).
   *   - Si el expulsado estaba en sala.impostorIds, se elimina de esa lista y
   *     se marca eraImpostor = true.
   * - Se reinicia sala.votos = {} tras emitir resultados.
   * - Se comprueban condiciones de victoria:
   *   - Si no quedan impostores -> emite 'juegoTerminado' con ganador 'tripulantes'.
   *   - Si impostores >= tripulantes -> emite 'juegoTerminado' con ganador 'impostores'.
   *   - Si no hay victoria, actualiza sala.estadoJuego y emite la lista de jugadores
   *     actualizada para que el frontend refleje muertes.
   *
   * Eventos emitidos (via io.to(codigoSala).emit):
   * - 'resultadoVotacion' : {
   *     expulsado: { playerId: string, nombre: string } | null,
   *     numVotos: number,      // votos recibidos por el expulsado (0 si ninguno)
   *     skips: number,         // cantidad de votos skip / vacíos
   *     totalVotos: number,    // tamaño original de sala.votos antes de reset
   *     aliveCount: number,    // número de jugadores vivos antes de aplicar la expulsión
   *     eraImpostor: boolean   // true si el expulsado era impostor
   *   }
   * - 'juegoTerminado' : { ganador: 'tripulantes'|'impostores', mensaje: string } (si se cumple)
   * - 'actualizarJugadores' : Array<Object> (lista completa sala.jugadores actualizada, si el juego continúa)
   *
   * Parámetros esperados en `sala` (resumen):
   * - sala.jugadores: Array<{ playerId: string, nombre: string, alive: boolean, ... }>
   * - sala.votos: Record<string, string|null>  // mapping de voterId -> targetPlayerId | 'skip' | null
   * - sala.impostorIds: string[]               // lista de playerId activos como impostores
   * - sala.estadoJuego?: string
   *
   * Efectos secundarios:
   * - Mutación de objetos dentro de `sala` (marcar jugador.alive = false, eliminar de impostorIds,
   *   resetear sala.votos, posible cambio de sala.estadoJuego).
   * - Emisión de eventos por socket.io (acción externa dependiente de `io` global).
   *
   * @function procesarFinVotacion
   * @param {Object} sala - Estado de la sala de juego.
   * @param {Array<Object>} sala.jugadores - Lista completa de jugadores en la sala.
   * @param {Object<string, string|null>} sala.votos - Map de votos actuales (voterId -> targetPlayerId|'skip'|null).
   * @param {string[]} sala.impostorIds - IDs de impostores todavía activos.
   * @param {string} codigoSala - Código/identificador de la sala usado para emitir sockets.
   * @returns {void}
   */
  const procesarFinVotacion = (sala, codigoSala) => {
    // 1. Filtrar jugadores vivos
    const jugadoresVivosMap = {};
    sala.jugadores.forEach(j => { if (j.alive) jugadoresVivosMap[j.playerId] = j; });

    const aliveCount = Object.keys(jugadoresVivosMap).length;

    // 2. Contar votos (solo votos válidos hacia gente viva)
    const conteo = {};
    Object.values(sala.votos).forEach(votado => {
      if (!votado || votado === 'skip') return;
      if (!jugadoresVivosMap[votado]) return; // Ignorar votos a muertos
      conteo[votado] = (conteo[votado] || 0) + 1;
    });

    const skips = Object.values(sala.votos).filter(v => !v || v === 'skip').length;

    // 3. Determinar quién es expulsado (Mayoría simple sobre los vivos)
    const entradas = Object.entries(conteo);
    let expulsadoPlayerId = null;
    let numVotos = 0;
    let eraImpostor = false;

    if (entradas.length > 0) {
      // Ordenar de mayor a menor votos
      entradas.sort((a, b) => b[1] - a[1]);
      const [topId, topCount] = entradas[0];

      // Regla: Necesita más de la mitad de los vivos para ser expulsado
      // (O puedes cambiar esto a simple mayoría si prefieres)
      if (topCount > (aliveCount / 2)) {
        expulsadoPlayerId = topId;
        numVotos = topCount;
      }
    }

    let jugadorExpulsadoObj = null;

    // 4. Aplicar la "Muerte" (Sin borrar de la sala)
    if (expulsadoPlayerId) {
      // Buscamos en la lista completa (incluyendo muertos, por si acaso)
      const jugador = sala.jugadores.find(j => j.playerId === expulsadoPlayerId);

      if (jugador) {
        jugadorExpulsadoObj = jugador;
        jugador.alive = false; // <--- AQUÍ ESTÁ EL CAMBIO: Solo cambiamos el estado

        // Si era impostor, lo sacamos de la lista de impostores activos
        const indexImpostor = sala.impostorIds.indexOf(jugador.playerId);
        if (indexImpostor > -1) {
          eraImpostor = true;
          sala.impostorIds.splice(indexImpostor, 1);
        }
      }
    }

    // 5. Emitir resultados
    io.to(codigoSala).emit('resultadoVotacion', {
      expulsado: jugadorExpulsadoObj ? { playerId: jugadorExpulsadoObj.playerId, nombre: jugadorExpulsadoObj.nombre } : null,
      numVotos,
      skips,
      totalVotos: Object.keys(sala.votos).length,
      aliveCount,
      eraImpostor
    });

    // NUEVO: limpiar votantesEsperados al finalizar
    sala.votantesEsperados = [];
    sala.votos = {};

    // 6. Comprobar condiciones de Victoria (Basado en vivos)
    const impostoresVivos = sala.impostorIds.length;
    const totalJugadoresVivos = sala.jugadores.filter(j => j.alive).length;
    const tripulantesVivos = totalJugadoresVivos - impostoresVivos;

    if (impostoresVivos === 0) {
      io.to(codigoSala).emit('juegoTerminado', { ganador: 'tripulantes', mensaje: '¡Todos los impostores han sido eliminados!' });
      // Opcional: resetear sala aquí
    } else if (impostoresVivos >= tripulantesVivos) {
      io.to(codigoSala).emit('juegoTerminado', { ganador: 'impostores', mensaje: '¡Los impostores son mayoría!' });
      // Opcional: resetear sala aquí
    } else {
      // El juego continúa
      sala.estadoJuego = 'resultado'; // O 'jugando' si quieres saltar la pantalla de resultado rápido

      // IMPORTANTE: Enviar la lista actualizada para que el frontend sepa quién murió
      io.to(codigoSala).emit('actualizarJugadores', sala.jugadores);
    }
  };

  /**
   * EVENTO: 'irAVotacion'
   */
  socket.on('irAVotacion', (codigoSala) => {
    const sala = salas[codigoSala];
    if (!sala || socket.id !== sala.hostId) {
      return socket.emit('error', 'Solo el Anfitrión puede iniciar la votación.');
    }

    sala.estadoJuego = 'votando';
    sala.votos = {};

    // NUEVO: registrar quiénes deben votar (los vivos en el inicio de la votación)
    sala.votantesEsperados = sala.jugadores.filter(j => j.alive).map(j => j.playerId);

    io.to(codigoSala).emit('estadoJuegoActualizado', 'votando');

    // Informar cuántos vivos hay para calcular la barra de progreso en el frontend
    const aliveCount = sala.votantesEsperados.length;
    io.to(codigoSala).emit('votacionIniciada', { aliveCount });
  });

  /**
   * EVENTO: 'crearSala'
   */
  socket.on('crearSala', (opciones) => {
    const codigoSala = generarCodigoSala();
    const playerId = crypto.randomUUID();
    const nuevoJugador = {
      id: socket.id,
      nombre: opciones.nombreAnfitrion,
      playerId: playerId,
      disconnectTimer: null,
      alive: true // <--- Estado inicial
    };

    salas[codigoSala] = {
      hostId: socket.id,
      config: {
        maxJugadores: opciones.maxJugadores || 15,
        numeroImpostores: opciones.numeroImpostores || 1,
      },
      estadoJuego: 'lobby',
      palabraSecreta: null,
      impostorIds: [],
      jugadores: [nuevoJugador],
      votos: {}
    };

    socket.join(codigoSala);
    console.log(`Sala ${codigoSala} creada por ${opciones.nombreAnfitrion}`);

    socket.emit('salaCreada', codigoSala);
    socket.emit('actualizarJugadores', salas[codigoSala].jugadores);
    socket.emit('tuPlayerId', playerId);
  });

  /**
   * EVENTO: 'unirseSala'
   */
  socket.on('unirseSala', ({ codigo, nombre }) => {
    const sala = salas[codigo];

    if (!sala) return socket.emit('error', 'La sala no existe.');
    if (sala.estadoJuego !== 'lobby') return socket.emit('error', 'La partida ya ha comenzado.');
    if (sala.jugadores.length >= sala.config.maxJugadores) return socket.emit('error', 'La sala está llena.');

    const playerId = crypto.randomUUID();
    const nuevoJugador = {
      id: socket.id,
      nombre: nombre,
      playerId: playerId,
      disconnectTimer: null,
      alive: true // <--- Estado inicial
    };
    sala.jugadores.push(nuevoJugador);
    socket.join(codigo);

    console.log(`${nombre} se unió a la sala ${codigo}`);

    socket.emit('unidoConExito', { codigo, jugadores: sala.jugadores });
    io.to(codigo).emit('actualizarJugadores', sala.jugadores);
    socket.emit('tuPlayerId', playerId);
  });

  /**
   * EVENTO: 'reconectar'
   */
  socket.on('reconectar', ({ playerId, codigoSala }) => {
    const sala = salas[codigoSala];
    if (!sala) return socket.emit('error', 'La sala ya no existe.');

    const jugador = sala.jugadores.find(j => j.playerId === playerId);
    if (!jugador) return socket.emit('error', 'Tu sesión ha expirado.');

    console.log(`Jugador ${jugador.nombre} reconectado.`);

    if (jugador.disconnectTimer) {
      clearTimeout(jugador.disconnectTimer);
      jugador.disconnectTimer = null;
    }

    const oldSocketId = jugador.id;
    jugador.id = socket.id;

    if (sala.hostId === oldSocketId) {
      sala.hostId = socket.id;
    }

    socket.join(codigoSala);

    const esImpostor = sala.impostorIds.includes(jugador.playerId);

    socket.emit('reconexionExitosa', {
      codigo: codigoSala,
      jugadores: sala.jugadores,
      rol: esImpostor ? 'impostor' : 'tripulante',
      palabra: (esImpostor || !sala.palabraSecreta) ? null : sala.palabraSecreta,
      estadoJuego: sala.estadoJuego,
      miNombre: jugador.nombre
    });

    io.to(codigoSala).emit('actualizarJugadores', sala.jugadores);
  });

  /**
   * EVENTO: 'iniciarPartida'
   */
  socket.on('iniciarPartida', (codigoSala) => {
    const sala = salas[codigoSala];
    if (!sala) return;
    if (socket.id !== sala.hostId) return socket.emit('error', 'Solo el Anfitrión puede iniciar.');

    const numImpostores = sala.config.numeroImpostores;

    // CAMBIO: exigir al menos 4 jugadores además de la lógica de impostores
    const minimoRequerido = Math.max(4, numImpostores * 2 + 1);
    if (sala.jugadores.length < minimoRequerido) {
      return socket.emit('error', `Faltan jugadores. Mínimo ${minimoRequerido}.`);
    }

    sala.estadoJuego = 'jugando';
    sala.palabraSecreta = palabrasJuego[Math.floor(Math.random() * palabrasJuego.length)];
    sala.impostorIds = [];
    sala.votos = {};
    sala.votantesEsperados = []; // asegurar inicialización

    // Resetear estado "alive" de todos para nueva partida
    sala.jugadores.forEach(j => { j.alive = true; });

    const jugadoresCopia = [...sala.jugadores];
    // Barajar (Fisher-Yates shuffle)
    for (let i = jugadoresCopia.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [jugadoresCopia[i], jugadoresCopia[j]] = [jugadoresCopia[j], jugadoresCopia[i]];
    }

    for (let i = 0; i < numImpostores; i++) {
      sala.impostorIds.push(jugadoresCopia[i].playerId);
    }

    console.log(`Partida iniciada en ${codigoSala}. Impostores: ${sala.impostorIds.length}`);

    sala.jugadores.forEach(jugador => {
      if (sala.impostorIds.includes(jugador.playerId)) {
        io.to(jugador.id).emit('partidaIniciada', { rol: 'impostor', palabra: null });
      } else {
        io.to(jugador.id).emit('partidaIniciada', { rol: 'tripulante', palabra: sala.palabraSecreta });
      }
    });

    // Actualizar lista para mostrar estado inicial
    io.to(codigoSala).emit('actualizarJugadores', sala.jugadores);
  });

  /**
   * EVENTO: 'votar'
   */
  socket.on('votar', ({ codigoSala, jugadorVotado }) => {
    const sala = salas[codigoSala];
    if (!sala) return;
    if (sala.estadoJuego !== 'votando') return socket.emit('error', 'No es momento de votar.');

    const votante = sala.jugadores.find(j => j.id === socket.id);
    if (!votante) return;

    // VALIDACIÓN: Jugadores muertos no votan
    if (!votante.alive) {
      return socket.emit('error', 'Estás eliminado, no puedes votar.');
    }

    // NUEVO: Solo quienes estaban en la lista de esperados pueden votar
    if (!Array.isArray(sala.votantesEsperados) || !sala.votantesEsperados.includes(votante.playerId)) {
      return socket.emit('error', 'No estás habilitado para votar en esta ronda.');
    }

    // Validar objetivo
    if (jugadorVotado && jugadorVotado !== 'skip') {
      const objetivo = sala.jugadores.find(j => j.playerId === jugadorVotado);
      if (!objetivo || !objetivo.alive) {
        return socket.emit('error', 'Jugador inválido o ya eliminado.');
      }
    } else {
      jugadorVotado = 'skip';
    }

    // Guardar voto (no se invalida aquí si el objetivo o votante cambia de estado después)
    sala.votos[votante.playerId] = jugadorVotado;

    // Contar votos respecto a los votantes esperados
    const totalVotos = Object.keys(sala.votos).filter(pid => sala.votantesEsperados.includes(pid)).length;
    const aliveCount = sala.votantesEsperados.length;

    io.to(codigoSala).emit('votoRecibido', {
      votantePlayerId: votante.playerId,
      totalVotos,
      aliveCount
    });

    // Auto-finalizar solo cuando hayan votado todos los esperados
    if (totalVotos >= aliveCount) {
      procesarFinVotacion(sala, codigoSala);
    }
  });

  /**
   * EVENTO: 'finalizarVotacion' (Manual por el host)
   */
  socket.on('finalizarVotacion', (codigoSala) => {
    const sala = salas[codigoSala];
    if (!sala || socket.id !== sala.hostId) return;
    procesarFinVotacion(sala, codigoSala);
  });

  /**
   * EVENTO: 'siguienteRonda'
   */
  socket.on('siguienteRonda', (codigoSala) => {
    const sala = salas[codigoSala];
    if (!sala || socket.id !== sala.hostId) return;

    // Volvemos a 'jugando'
    sala.estadoJuego = 'jugando';
    io.to(codigoSala).emit('nuevaRonda');
  });

  /**
   * EVENTO: 'disconnect'
   */
  socket.on('disconnect', () => {
    console.log(`Cliente desconectado: ${socket.id}`);

    Object.keys(salas).forEach(codigoSala => {
      const sala = salas[codigoSala];
      const jugador = sala.jugadores.find(j => j.id === socket.id);

      if (jugador) {
        // Iniciar temporizador para expulsión definitiva
        jugador.disconnectTimer = setTimeout(() => {
          if (jugador.disconnectTimer === null) return; // Se reconectó

          const idx = sala.jugadores.findIndex(j => j.playerId === jugador.playerId);
          if (idx === -1) return;

          // EXPULSIÓN DEFINITIVA (Se fue y no volvió)
          const jugadorEliminado = sala.jugadores.splice(idx, 1)[0];
          console.log(`${jugadorEliminado.nombre} eliminado por desconexión de ${codigoSala}`);

          // Limpiar voto si lo tenía (votos emitidos por él ya se cuentan si la votación termina)
          delete sala.votos[jugadorEliminado.playerId];

          // Si existía lista de votantes esperados en una votación en curso, quitarlo de ella
          if (Array.isArray(sala.votantesEsperados)) {
            const vi = sala.votantesEsperados.indexOf(jugadorEliminado.playerId);
            if (vi > -1) sala.votantesEsperados.splice(vi, 1);
          }

          // Si era impostor, actualizar lista
          const indexImpostor = sala.impostorIds.indexOf(jugadorEliminado.playerId);
          if (indexImpostor > -1) {
            sala.impostorIds.splice(indexImpostor, 1);
          }

          // Chequear victoria tras desconexión
          const impostoresVivos = sala.impostorIds.length;
          const totalVivos = sala.jugadores.filter(j => j.alive).length;
          const tripulantesVivos = totalVivos - impostoresVivos;

          if (sala.estadoJuego !== 'lobby') {
            if (impostoresVivos === 0) {
              io.to(codigoSala).emit('juegoTerminado', { ganador: 'tripulantes', mensaje: 'Impostor desconectado.' });
            } else if (impostoresVivos >= tripulantesVivos) {
              io.to(codigoSala).emit('juegoTerminado', { ganador: 'impostores', mensaje: 'Mayoría de impostores tras desconexión.' });
            }
          }

          // Si estábamos en votación, y la lista de votantes esperados cambió, comprobar si ya se deben contabilizar los votos
          if (sala.estadoJuego === 'votando' && Array.isArray(sala.votantesEsperados)) {
            const votosActuales = Object.keys(sala.votos).filter(pid => sala.votantesEsperados.includes(pid)).length;
            if (votosActuales >= sala.votantesEsperados.length) {
              procesarFinVotacion(sala, codigoSala);
            }
          }

          if (sala.jugadores.length === 0) {
            delete salas[codigoSala];
          } else {
            if (sala.hostId === jugadorEliminado.id) {
              sala.hostId = sala.jugadores[0].id;
            }
            io.to(codigoSala).emit('actualizarJugadores', sala.jugadores);
          }

        }, 30000); // 30 segundos
      }
    });
  });

});

// --- 6. Iniciar Servidor ---
app.get('/', (_req, res) => {
  res.send('Servidor de "El Impostor" está corriendo.');
});

httpServer.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});

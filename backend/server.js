// --- 1. Importaciones ---
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import crypto from 'crypto'; // <-- Ya lo tenías, es necesario

// --- 2. Configuración del Servidor ---
const app = express();
app.use(cors());

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    methods: ["GET", "POST"]
  }
});

const PORT = (typeof globalThis !== 'undefined' && globalThis.process && globalThis.process.env && globalThis.process.env.PORT) || 3000;

// --- 3. "Base de Datos" / Estado del Juego ---
let salas = {};

const palabrasJuego = [
  "Casa", "Perro", "Manzana", "Café", "Montaña",
  "Río", "Puente", "Libro", "Cine", "Playa"
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
    socket.on('irAVotacion', (codigoSala) => {
    const sala = salas[codigoSala];
    // Validación: Solo el Host puede hacerlo
    if (!sala || socket.id !== sala.hostId) {
      return socket.emit('error', 'Solo el Anfitrión puede iniciar la votación.');
    }

    sala.estadoJuego = 'votando'; // Actualiza el estado en el servidor

    // Notifica a TODOS en la sala (incluido el host) del nuevo estado
    io.to(codigoSala).emit('estadoJuegoActualizado', 'votando');
  });

  console.log(`Nuevo cliente conectado: ${socket.id}`);

  /**
   * EVENTO: 'crearSala' (MODIFICADO)
   */
  socket.on('crearSala', (opciones) => {
    const codigoSala = generarCodigoSala();
    const playerId = crypto.randomUUID(); // ID único persistente
    const nuevoJugador = {
      id: socket.id, // El socket.id actual
      nombre: opciones.nombreAnfitrion,
      playerId: playerId, // El ID persistente
      disconnectTimer: null // Para el período de gracia
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
    // Enviar al jugador su ID secreto
    socket.emit('tuPlayerId', playerId);
  });

  /**
   * EVENTO: 'unirseSala' (MODIFICADO)
   */
  socket.on('unirseSala', ({ codigo, nombre }) => {
    const sala = salas[codigo];

    if (!sala) {
      return socket.emit('error', 'La sala no existe.');
    }
    if (sala.estadoJuego !== 'lobby') {
      return socket.emit('error', 'La partida ya ha comenzado.');
    }
    if (sala.jugadores.length >= sala.config.maxJugadores) {
      return socket.emit('error', 'La sala está llena.');
    }

    const playerId = crypto.randomUUID();
    const nuevoJugador = {
      id: socket.id,
      nombre: nombre,
      playerId: playerId,
      disconnectTimer: null
    };
    sala.jugadores.push(nuevoJugador);
    socket.join(codigo);

    console.log(`${nombre} se unió a la sala ${codigo}`);

    socket.emit('unidoConExito', { codigo, jugadores: sala.jugadores });
    io.to(codigo).emit('actualizarJugadores', sala.jugadores);
    // Enviar al jugador su ID secreto
    socket.emit('tuPlayerId', playerId);
  });

  /**
   * EVENTO: 'reconectar' (NUEVO)
   * Se dispara cuando un cliente se vuelve a conectar
   */
  socket.on('reconectar', ({ playerId, codigoSala }) => {
    const sala = salas[codigoSala];
    if (!sala) {
      return socket.emit('error', 'La sala a la que intentas reconectar ya no existe.');
    }

    const jugador = sala.jugadores.find(j => j.playerId === playerId);

    if (!jugador) {
      return socket.emit('error', 'Tu sesión de jugador ha expirado.');
    }

    // ¡Reconexión exitosa!
    console.log(`Jugador ${jugador.nombre} reconectado con nuevo socket ${socket.id}`);

    // Cancelar el temporizador de expulsión
    if (jugador.disconnectTimer) {
      clearTimeout(jugador.disconnectTimer);
      jugador.disconnectTimer = null;
    }

    // Actualizar su socket.id
    const oldSocketId = jugador.id;
    jugador.id = socket.id;

    // Actualizar el hostId si el host era el que se reconectó
    if (sala.hostId === oldSocketId) {
      sala.hostId = socket.id;
    }

    socket.join(codigoSala);

    // Enviar al jugador TODO el estado actual del juego
    const esImpostor = sala.impostorIds.includes(jugador.playerId);

    socket.emit('reconexionExitosa', {
      codigo: codigoSala,
      jugadores: sala.jugadores,
      rol: esImpostor ? 'impostor' : 'tripulante',
      palabra: (esImpostor || !sala.palabraSecreta) ? null : sala.palabraSecreta,
      estadoJuego: sala.estadoJuego,
      miNombre: jugador.nombre // Importante para el store del cliente
    });

    // Notificar a los demás
    io.to(codigoSala).emit('actualizarJugadores', sala.jugadores);
  });


  /**
   * EVENTO: 'iniciarPartida' (MODIFICADO)
   */
  socket.on('iniciarPartida', (codigoSala) => {
    const sala = salas[codigoSala];
    if (!sala) return;

    if (socket.id !== sala.hostId) {
      return socket.emit('error', 'Solo el Anfitrión puede iniciar la partida.');
    }

    const numImpostores = sala.config.numeroImpostores;
    if (sala.jugadores.length < numImpostores * 2 + 1) {
       return socket.emit('error', `Se necesitan al menos ${numImpostores * 2 + 1} jugadores para ${numImpostores} impostor(es).`);
    }

    sala.estadoJuego = 'jugando';
    sala.palabraSecreta = palabrasJuego[Math.floor(Math.random() * palabrasJuego.length)];
    sala.impostorIds = [];
    const jugadoresCopia = [...sala.jugadores];

    for (let i = jugadoresCopia.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [jugadoresCopia[i], jugadoresCopia[j]] = [jugadoresCopia[j], jugadoresCopia[i]];
    }

    for (let i = 0; i < numImpostores; i++) {
      // MODIFICADO: Guardar playerId en lugar de socket.id
      sala.impostorIds.push(jugadoresCopia[i].playerId);
    }

    console.log(`Partida iniciada en ${codigoSala}. Impostores: ${sala.impostorIds.length}`);

    sala.jugadores.forEach(jugador => {
      // MODIFICADO: Comprobar usando playerId
      if (sala.impostorIds.includes(jugador.playerId)) {
        io.to(jugador.id).emit('partidaIniciada', {
          rol: 'impostor',
          palabra: null
        });
      } else {
        io.to(jugador.id).emit('partidaIniciada', {
          rol: 'tripulante',
          palabra: sala.palabraSecreta
        });
      }
    });
  });

  /**
   * EVENTO: 'votar' (Sin cambios)
   */
  socket.on('votar', ({ codigoSala, jugadorVotado }) => {
    const sala = salas[codigoSala];
    if (!sala) return;
    // Esto está bien: la clave es el socket.id (quién votó), el valor es el nombre (por quién votó)
    sala.votos[socket.id] = jugadorVotado;
    const totalVotos = Object.keys(sala.votos).length;

    io.to(codigoSala).emit('votoRecibido', {
      votanteId: socket.id,
      totalVotos: totalVotos,
      totalJugadores: sala.jugadores.length
    });
  });

  /**
   * EVENTO: 'finalizarVotacion' (MODIFICADO)
   */
  socket.on('finalizarVotacion', (codigoSala) => {
    const sala = salas[codigoSala];
    if (!sala || socket.id !== sala.hostId) return;

    // ... (Lógica de conteo sin cambios)
    const conteo = {};
    Object.values(sala.votos).forEach(nombre => {
      conteo[nombre] = (conteo[nombre] || 0) + 1;
    });
    const [expulsado, numVotos] = Object.entries(conteo).reduce((max, curr) =>
      (curr[1] > max[1] ? curr : max), ['', 0]
    );

    let eraImpostor = false;
    let mensajeFinJuego = null;

    const jugadorExpulsadoObj = sala.jugadores.find(j => j.nombre === expulsado);

    if (jugadorExpulsadoObj) {
      sala.jugadores = sala.jugadores.filter(j => j.id !== jugadorExpulsadoObj.id);

      // MODIFICADO: Comprobar usando playerId
      const indexImpostor = sala.impostorIds.indexOf(jugadorExpulsadoObj.playerId);
      if (indexImpostor > -1) {
        eraImpostor = true;
        sala.impostorIds.splice(indexImpostor, 1);
      }
    }

    io.to(codigoSala).emit('actualizarJugadores', sala.jugadores);

    // ... (Lógica de fin de juego sin cambios)
    const impostoresVivos = sala.impostorIds.length;
    const tripulantesVivos = sala.jugadores.length - impostoresVivos;

    if (impostoresVivos === 0) {
      mensajeFinJuego = "¡Todos los impostores han sido eliminados! ¡Ganan los Tripulantes!";
    } else if (impostoresVivos >= tripulantesVivos) {
      mensajeFinJuego = "¡Los impostores son mayoría! ¡Ganan los Impostores!";
    }

    if (mensajeFinJuego) {
      io.to(codigoSala).emit('juegoTerminado', { /* ... */ });
      // ... (reset de sala)
    } else {
      sala.estadoJuego = 'resultado';
      io.to(codigoSala).emit('resultadoVotacion', { /* ... */ });
      sala.votos = {};
    }
  });

  /**
   * EVENTO: 'siguienteRonda' (Sin cambios)
   */
  socket.on('siguienteRonda', (codigoSala) => {
    const sala = salas[codigoSala];
    if (!sala || socket.id !== sala.hostId) return;
    sala.estadoJuego = 'jugando';
    io.to(codigoSala).emit('nuevaRonda');
  });

  /**
   * EVENTO: 'disconnect' (MODIFICADO)
   */
  socket.on('disconnect', () => {
    console.log(`Cliente desconectado: ${socket.id}`);

    Object.keys(salas).forEach(codigoSala => {
      const sala = salas[codigoSala];
      // Buscar al jugador por el socket.id que se desconectó
      const jugador = sala.jugadores.find(j => j.id === socket.id);

      // Si el socket desconectado era un jugador en esta sala
      if (jugador) {
        console.log(`Iniciando temporizador de desconexión para ${jugador.nombre} en ${codigoSala}`);

        // Iniciar temporizador de 30 segundos
        jugador.disconnectTimer = setTimeout(() => {

          // Si el temporizador termina, comprobamos si el jugador se reconectó.
          // Si se reconectó, 'disconnectTimer' será 'null' (cancelado por 'reconectar')
          if (jugador.disconnectTimer === null) {
            console.log(`Expulsión cancelada para ${jugador.nombre}, ya se reconectó.`);
            return;
          }

          // El jugador no volvió. Expulsarlo permanentemente.
          // Volvemos a buscar su índice por si acaso (aunque playerId es más seguro)
          const jugadorIndex = sala.jugadores.findIndex(j => j.playerId === jugador.playerId);
          if (jugadorIndex === -1) return; // Ya fue expulsado por otra lógica

          const jugadorEliminado = sala.jugadores.splice(jugadorIndex, 1)[0];
          console.log(`${jugadorEliminado.nombre} se fue permanentemente de ${codigoSala}`);

          // MODIFICADO: Usar playerId
          const indexImpostor = sala.impostorIds.indexOf(jugadorEliminado.playerId);
          if (indexImpostor > -1) {
            sala.impostorIds.splice(indexImpostor, 1);
            console.log(`Un impostor se desconectó de ${codigoSala}`);

            // ... (Lógica de comprobación de victoria, la tenías bien)
            const impostoresVivos = sala.impostorIds.length;
            const tripulantesVivos = sala.jugadores.length - impostoresVivos;
            if (sala.estadoJuego !== 'lobby') {
              if (impostoresVivos === 0) {
                 io.to(codigoSala).emit('juegoTerminado', { /* ... gana tripulante */ });
                 // ... reset sala
              } else if (impostoresVivos >= tripulantesVivos) {
                 io.to(codigoSala).emit('juegoTerminado', { /* ... gana impostor */ });
                 // ... reset sala
              }
            }
          }

          if (sala.jugadores.length === 0) {
            delete salas[codigoSala];
            console.log(`Sala ${codigoSala} vacía. Eliminada.`);
          } else {
            // MODIFICADO: Usar el socket.id del jugador eliminado
            if (sala.hostId === jugadorEliminado.id) {
              sala.hostId = sala.jugadores[0].id;
              console.log(`Nuevo host en ${codigoSala}: ${sala.jugadores[0].nombre}`);
            }
            io.to(codigoSala).emit('actualizarJugadores', sala.jugadores);
          }
        }, 30000); // 30 segundos de período de gracia
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

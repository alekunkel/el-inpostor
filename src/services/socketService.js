import { io } from "socket.io-client";
import { useGameStore } from "@/stores/gameStore";
import router from "@/router";

let socket;
let isSocketConnected = false;

// (Cachea los audios para no crear un nuevo objeto cada vez)
const audioCache = {};
function playSound(soundName) {
  try {
    let audio = audioCache[soundName];
    if (!audio) {
      // Asume que los archivos están en /public/sounds/
      audio = new Audio(`/sounds/${soundName}`);
      audioCache[soundName] = audio;
    }
    audio.currentTime = 0; // Reinicia el sonido si ya estaba sonando

    audio.play().catch(e => {
      console.warn(`No se pudo reproducir el sonido ${soundName}. Requiere interacción del usuario.`, e);
    });
  } catch (e) {
    console.error(`Error al cargar el sonido ${soundName}:`, e);
  }
}

/**
 * Función de ayuda para comprobar la conexión ANTES de enviar un evento.
 * Muestra una alerta si no está conectado.
 */
function checkConnection() {
  if (!socket || !isSocketConnected) {
    alert("Error: No se puede conectar al servidor. Por favor, revisa tu conexión.");
    return false;
  }
  return true;
}

export function initSocket() {
  const store = useGameStore();

  let disconnectionTimer = null;
  let isConnectedOnce = false; // Flag para saber si ya nos conectamos al menos una vez

  const localPlayerId = localStorage.getItem('impostor_playerId');
  const localCodigoSala = localStorage.getItem('impostor_codigoSala');
  if (localPlayerId) {
    store.playerId = localPlayerId;
  }

  socket = io("https://el-impostor-kk9t.onrender.com", {
    timeout: 60000, // 60 segundos de espera
    transports: ['websocket']
  });
  // --- ESCUCHADORES (con sonidos) ---

  socket.on("connect", () => {
    console.log("Conectado al servidor WebSocket!");
    isSocketConnected = true; // <-- Conectado
    isConnectedOnce = true;

    // Si había un temporizador de desconexión, lo cancelamos
    if (disconnectionTimer) {
      clearTimeout(disconnectionTimer);
      disconnectionTimer = null;
      console.log("Reconexión exitosa, temporizador de 15s cancelado.");
    }

    // Lógica de reconexión de sesión
    if (store.playerId && localCodigoSala) {
      socket.emit('reconectar', {
        playerId: store.playerId,
        codigoSala: localCodigoSala
      });
    }
  });

  socket.on("connect_error", (error) => {
    isSocketConnected = false; // <-- Desconectado
    console.error("Error de conexión:", error.message);

    if (!isConnectedOnce) {
      // Ya no muestra la alerta, solo avisa por consola
      console.error("No se pudo conectar al servidor al iniciar.");
      socket.disconnect();
    }
  });

  socket.on("disconnect", (reason) => {
    isSocketConnected = false; // <-- Desconectado
    console.warn(`Socket desconectado: ${reason}. Iniciando temporizador de 15s.`);

    if (disconnectionTimer) {
      clearTimeout(disconnectionTimer);
    }

    // Lógica de 15 segundos para desconexión total
    disconnectionTimer = setTimeout(() => {
      if (!socket.connected) {
        console.error("No se pudo reconectar en 15 segundos.");
        alert("Se perdió la conexión con el servidor y no se pudo reconectar. Serás redirigido al inicio.");
        store.resetJuego();
        router.push('/');
      }
    }, 15000); // 15 segundos
  });


  // --- RESTO DE LISTENERS DEL JUEGO ---

  socket.on('tuPlayerId', (id) => {
    console.log("Recibido mi PlayerID:", id);
    store.setPlayerId(id);
  });

  socket.on('reconexionExitosa', (datos) => {
    console.log("Reconexión exitosa!");
    store.setSala(datos.codigo, datos.miNombre);
    store.setJugadores(datos.jugadores);
    store.iniciarPartida(datos.rol, datos.palabra);
    store.setEstadoJuego(datos.estadoJuego);
    router.push(`/sala/${datos.codigo}`);
  });

  socket.on("salaCreada", (codigoSala) => {
    store.setSala(codigoSala, store.miNombre);
    router.push(`/sala/${codigoSala}`);
    playSound('join.mp3');
  });

  socket.on("unidoConExito", (datosSala) => {
    store.setSala(datosSala.codigo, store.miNombre);
    store.setJugadores(datosSala.jugadores);
    router.push(`/sala/${datosSala.codigo}`);
    playSound('join.mp3');
  });

  socket.on("actualizarJugadores", (listaJugadores) => {
    store.setJugadores(listaJugadores);
  });

  socket.on("partidaIniciada", (data) => {
    store.iniciarPartida(data.rol, data.palabra);
    playSound('start.mp3');
  });

  // Listener para ERRORES DE JUEGO (Sala llena, etc.)
  socket.on("error", (mensaje) => {
    alert(mensaje);
    playSound('error.mp3');

    const erroresCriticos = [
      "La sala no existe",
      "La sala a la que intentas reconectar ya no existe",
      "Tu sesión de jugador ha expirado"
    ];

    const esErrorCritico = erroresCriticos.some(err => mensaje.includes(err));

    if (esErrorCritico) {
      console.warn("Error crítico de lógica, reseteando y volviendo al inicio.");
      store.resetJuego();
      router.push('/');
    }
  });

  socket.on("resultadoVotacion", (resultado) => {
    store.setResultado(resultado);
    store.setEstadoJuego('resultado');
    playSound('results.mp3');
  });

  socket.on("nuevaRonda", () => {
    store.setHeVotado(false);
    store.setResultado(null);
    store.setEstadoJuego('jugando');
    store.setMostrarTarjeta(false);
  });

  socket.on("estadoJuegoActualizado", (nuevoEstado) => {
    store.setEstadoJuego(nuevoEstado);
  });

  socket.on("juegoTerminado", (resultado) => {
    alert(resultado.mensaje);
    store.setResultado({
      jugadorExpulsado: resultado.jugadorExpulsado,
      eraImpostor: resultado.eraImpostor,
    });
    store.setEstadoJuego('lobby');
    store.setHeVotado(false);
    store.setMostrarTarjeta(false);

    if (resultado.mensaje.includes("Ganan los Tripulantes")) {
      playSound(store.miRol === 'tripulante' ? 'win.mp3' : 'lose.mp3');
    } else {
      playSound(store.miRol === 'impostor' ? 'win.mp3' : 'lose.mp3');
    }
  });
}

// --- EMISORES (MODIFICADOS) ---
// Ahora todos comprueban la conexión antes de emitir

export function crearSala(opciones) {
  if (!checkConnection()) return; // <-- Comprobación

  const store = useGameStore();
  store.miNombre = opciones.nombreAnfitrion;
  socket.emit("crearSala", opciones);
}

export function unirseSala(codigo, nombre) {
  if (!checkConnection()) return; // <-- Comprobación

  const store = useGameStore();
  store.miNombre = nombre;
  socket.emit("unirseSala", { codigo, nombre });
}

export function iniciarPartida() {
  if (!checkConnection()) return; // <-- Comprobación

  const store = useGameStore();
  socket.emit("iniciarPartida", store.codigoSala);
}

export function irAVotacion() {
  if (!checkConnection()) return; // <-- Comprobación

  const store = useGameStore();
  socket.emit("irAVotacion", store.codigoSala);
}

export function enviarVoto(jugadorVotado) {
  if (!checkConnection()) return; // <-- Comprobación

  const store = useGameStore();
  if (store.heVotado) return;
  store.setHeVotado(true);

  playSound('vote.mp3');
  socket.emit("votar", {
    codigoSala: store.codigoSala,
    jugadorVotado: jugadorVotado
  });
}

export function finalizarVotacion() {
  if (!checkConnection()) return; // <-- Comprobación

  const store = useGameStore();
  socket.emit("finalizarVotacion", store.codigoSala);
}

export function siguienteRonda() {
  if (!checkConnection()) return; // <-- Comprobación

  const store = useGameStore();
  socket.emit("siguienteRonda", store.codigoSala);
}

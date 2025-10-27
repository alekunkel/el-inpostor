import { io } from "socket.io-client";
import { useGameStore } from "@/stores/gameStore";
import router from "@/router";

let socket;
let isSocketConnected = false; // <-- 1. RASTREADOR DE CONEXIÓN

// (Función playSound sin cambios)
const audioCache = {};
function playSound(soundName) {
  try {
    let audio = audioCache[soundName];
    if (!audio) {
      audio = new Audio(`/sounds/${soundName}`);
      audioCache[soundName] = audio;
    }
    audio.currentTime = 0;
    audio.play().catch(e => {
      console.warn(`No se pudo reproducir el sonido ${soundName}. Requiere interacción del usuario.`, e);
    });
  } catch (e) {
    console.error(`Error al cargar el sonido ${soundName}:`, e);
  }
}

// Función de ayuda para comprobar la conexión antes de emitir
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
  let isConnectedOnce = false;

  const localPlayerId = localStorage.getItem('impostor_playerId');
  const localCodigoSala = localStorage.getItem('impostor_codigoSala');
  if (localPlayerId) {
    store.playerId = localPlayerId;
  }

  socket = io("http://localhost:3000");

  // --- ESCUCHADORES (con sonidos) ---

  socket.on("connect", () => {
    console.log("Conectado al servidor WebSocket!");
    isSocketConnected = true; // <-- Actualiza el rastreador
    isConnectedOnce = true;

    if (disconnectionTimer) {
      clearTimeout(disconnectionTimer);
      disconnectionTimer = null;
      console.log("Reconexión exitosa, temporizador de 15s cancelado.");
    }

    if (store.playerId && localCodigoSala) {
      socket.emit('reconectar', {
        playerId: store.playerId,
        codigoSala: localCodigoSala
      });
    }
  });

  socket.on("connect_error", (error) => {
    isSocketConnected = false; // <-- Actualiza el rastreador
    console.error("Error de conexión:", error.message);

    if (!isConnectedOnce) {
      // 2. YA NO MUESTRA LA ALERTA AL INICIO
      console.error("No se pudo conectar al servidor al iniciar.");
      socket.disconnect();
    }
  });

  socket.on("disconnect", (reason) => {
    isSocketConnected = false; // <-- Actualiza el rastreador
    console.warn(`Socket desconectado: ${reason}. Iniciando temporizador de 15s.`);

    if (disconnectionTimer) {
      clearTimeout(disconnectionTimer);
    }

    // 3. LA LÓGICA DE 15 SEGUNDOS SE MANTIENE
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
  // (Sin cambios: tuPlayerId, reconexionExitosa, salaCreada, unidoConExito,
  // actualizarJugadores, partidaIniciada, error, resultadoVotacion,
  // nuevaRonda, estadoJuegoActualizado, juegoTerminado)

  socket.on('tuPlayerId', (id) => { store.setPlayerId(id); });
  socket.on('reconexionExitosa', (datos) => { /* ... */ });
  socket.on("salaCreada", (codigoSala) => { /* ... */ });
  socket.on("unidoConExito", (datosSala) => { /* ... */ });
  socket.on("actualizarJugadores", (listaJugadores) => { /* ... */ });
  socket.on("partidaIniciada", (data) => { /* ... */ });
  socket.on("error", (mensaje) => { /* ... */ });
  socket.on("resultadoVotacion", (resultado) => { /* ... */ });
  socket.on("nuevaRonda", () => { /* ... */ });
  socket.on("estadoJuegoActualizado", (nuevoEstado) => { /* ... */ });
  socket.on("juegoTerminado", (resultado) => { /* ... */ });
}

// --- EMISORES (MODIFICADOS) ---

export function crearSala(opciones) {
  if (!checkConnection()) return; // <-- COMPROBACIÓN
  const store = useGameStore();
  store.miNombre = opciones.nombreAnfitrion;
  socket.emit("crearSala", opciones);
}

export function unirseSala(codigo, nombre) {
  if (!checkConnection()) return; // <-- COMPROBACIÓN
  const store = useGameStore();
  store.miNombre = nombre;
  socket.emit("unirseSala", { codigo, nombre });
}

export function iniciarPartida() {
  if (!checkConnection()) return; // <-- COMPROBACIÓN
  const store = useGameStore();
  socket.emit("iniciarPartida", store.codigoSala);
}

export function irAVotacion() {
  if (!checkConnection()) return; // <-- COMPROBACIÓN
  const store = useGameStore();
  socket.emit("irAVotacion", store.codigoSala);
}

export function enviarVoto(jugadorVotado) {
  if (!checkConnection()) return; // <-- COMPROBACIÓN
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
  if (!checkConnection()) return; // <-- COMPROBACIÓN
  const store = useGameStore();
  socket.emit("finalizarVotacion", store.codigoSala);
}

export function siguienteRonda() {
  if (!checkConnection()) return; // <-- COMPROBACIÓN
  const store = useGameStore();
  socket.emit("siguienteRonda", store.codigoSala);
}

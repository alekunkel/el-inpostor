<script setup>
import { useGameStore } from '@/stores/gameStore';
import {
  iniciarPartida,
  enviarVoto,
  finalizarVotacion,
  siguienteRonda,
  irAVotacion
} from '@/services/socketService';

const store = useGameStore();

const handleIniciarPartida = () => {
  iniciarPartida();
};

// CORRECCIÓN: Recibimos ID para la lógica y Nombre para la confirmación visual
const votarPor = (idJugador, nombreJugador) => {
  if (confirm(`¿Estás seguro de que quieres votar por ${nombreJugador}?`)) {
    enviarVoto(idJugador); // Enviamos el ID, que es lo que espera server.js
  }
};

const handleFinalizarVotacion = () => {
  finalizarVotacion();
};

const handleSiguienteRonda = () => {
  siguienteRonda();
};

// Helper para verificar si puedo votar por alguien
const puedoVotarPor = (jugadorObjetivo) => {
  // 1. No puedo votar si ya voté
  if (store.heVotado) return false;
  // 2. No puedo votarme a mí mismo
  if (jugadorObjetivo.playerId === store.miPlayerId) return false;
  // 3. No puedo votar a un muerto
  if (!jugadorObjetivo.alive) return false;

  // 4. IMPORTANTE: No puedo votar si YO estoy muerto (Regla del server.js)
  const yo = store.jugadores.find(j => j.playerId === store.miPlayerId);
  if (yo && !yo.alive) return false;

  return true;
};
</script>

<template>
  <div class="sala-container">

    <div v-if="store.estadoJuego === 'lobby'">
      <h2>Sala: {{ store.codigoSala }}</h2>
      <p>¡Esperando jugadores...</p>

      <div class="lista-jugadores">
        <h3>Jugadores ({{ store.jugadores.length }}):</h3>
        <ul>
          <li v-for="jugador in store.jugadores" :key="jugador.playerId">
            {{ jugador.nombre }}
            <span v-if="jugador.playerId === store.miPlayerId"> (Tú)</span>
            <span v-if="store.jugadores[0] && jugador.id === store.jugadores[0].id"> (👑 Anfitrión)</span>
          </li>
        </ul>
      </div>

      <button
        v-if="store.soyElHost"
        @click="handleIniciarPartida"
        class="btn btn-primary"
        :disabled="store.jugadores.length < 4"
      >
        ¡Iniciar Partida!
      </button>
      <p v-else-if="store.jugadores.length < 4" class="aviso-minimo">
        Se necesitan mínimo 4 jugadores.
      </p>
    </div>

    <div v-else-if="store.estadoJuego === 'jugando'">
      <h2>Ronda de Preguntas</h2>

      <div class="mini-lista">
        <span
          v-for="j in store.jugadores"
          :key="j.playerId"
          class="badge"
          :class="{ 'muerto': !j.alive }"
        >
          {{ j.nombre }} <span v-if="!j.alive">💀</span>
        </span>
      </div>

      <div v-if="store.mostrarTarjeta" class="tarjeta-wrapper">
        <div class="tarjeta flip">
          <div class="tarjeta-inner">
            <div class="tarjeta-front"></div>
            <div class="tarjeta-back">
              <div v-if="store.miRol === 'impostor'">
                <h1 class="texto-impostor">¡Eres el Impostor!</h1>
                <p>No sabes la palabra. ¡Engáñalos a todos!</p>
              </div>
              <div v-else>
                <h1>Eres Tripulante</h1>
                <p>La palabra es:</p>
                <h2 class="palabra-secreta">{{ store.palabraSecreta }}</h2>
              </div>
            </div>
          </div>
        </div>

        <button @click="store.setMostrarTarjeta(false)" class="btn btn-secondary">
          Ocultar Tarjeta
        </button>
      </div>

      <div v-else>
        <button @click="store.setMostrarTarjeta(true)" class="btn btn-primary">
          Ver mi Tarjeta Secreta
        </button>
        <p style="margin-top: 20px;">¡Hagan preguntas en ronda!</p>

        <button
          v-if="store.soyElHost"
          @click="irAVotacion"
          class="btn btn-danger"
        >
          ¡Ir a Votación!
        </button>
      </div>
    </div>

    <div v-else-if="store.estadoJuego === 'votando'">
      <h2>¡A Votar!</h2>

      <div v-if="store.jugadores.find(j => j.playerId === store.miPlayerId && !j.alive)">
        <p class="alerta-muerto">Estás eliminado 💀. No puedes votar, pero puedes observar.</p>
      </div>
      <div v-else>
        <p v-if="!store.heVotado">Elige al jugador que crees que es el impostor.</p>
        <p v-else>¡Voto registrado! Esperando al resto de jugadores...</p>
      </div>

      <div class="grid-votacion">
        <button
          v-for="jugador in store.jugadores"
          :key="jugador.playerId"
          @click="votarPor(jugador.playerId, jugador.nombre)"
          class="btn btn-votar"
          :class="{ 'btn-muerto': !jugador.alive }"
          :disabled="!puedoVotarPor(jugador)"
        >
          <span v-if="!jugador.alive">💀 </span>
          {{ jugador.nombre }}
          <span v-if="!jugador.alive"> (Eliminado)</span>
        </button>
      </div>

      <button
        v-if="store.soyElHost"
        @click="handleFinalizarVotacion"
        class="btn btn-danger"
        style="margin-top: 20px;"
      >
        Forzar Cierre de Votación
      </button>
    </div>

    <div v-else-if="store.estadoJuego === 'resultado'">
      <h2>Resultados de la Votación</h2>

      <div v-if="store.ultimoResultado" class="resultado-info">
        <div v-if="store.ultimoResultado.expulsado">
            <h3>El jugador expulsado es:</h3>
            <h2 class="nombre-expulsado">{{ store.ultimoResultado.expulsado.nombre }}</h2>
            <p>(Con {{ store.ultimoResultado.numVotos }} votos)</p>

            <div v-if="store.ultimoResultado.eraImpostor" class="box-impostor">
            <h2>¡Era un Impostor! 🎉</h2>
            </div>
            <div v-else class="box-inocente">
            <h2>No era un impostor... 😓</h2>
            </div>
        </div>
        <div v-else>
            <h3>Nadie fue expulsado (Empate o Votos en blanco)</h3>
        </div>

        <p class="info-restantes">
            Quedan <strong>{{ store.ultimoResultado.impostoresRestantes }}</strong> impostor(es) en juego.
        </p>
      </div>

      <button
        v-if="store.soyElHost"
        @click="handleSiguienteRonda"
        class="btn btn-primary"
        style="margin-top: 20px;"
      >
        Siguiente Ronda
      </button>
    </div>

  </div>
</template>

<style scoped>
.sala-container { padding: 20px; max-width: 600px; margin: 0 auto; font-family: 'Arial', sans-serif; }

/* Listas y Badges */
.lista-jugadores ul { list-style: none; padding: 0; }
.lista-jugadores li { background: #fff; padding: 10px; margin-bottom: 5px; border-radius: 5px; border-bottom: 1px solid #eee; }
.mini-lista { display: flex; flex-wrap: wrap; gap: 5px; justify-content: center; margin-bottom: 15px; }
.badge { background: #e0e0e0; padding: 5px 10px; border-radius: 15px; font-size: 0.8rem; }
.badge.muerto { background: #555; color: #ccc; text-decoration: line-through; }

/* Botones */
.btn { border: none; border-radius: 5px; cursor: pointer; font-weight: bold; transition: 0.2s; }
.btn-primary { background-color: #3498db; color: white; }
.btn-secondary { background-color: #95a5a6; color: white; }
.btn-danger { background-color: #e74c3c; color: white; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Grid Votación */
.grid-votacion { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px; }
.btn-votar { padding: 15px; background: #f9f9f9; border: 2px solid #ddd; color: #333; }
.btn-votar:hover:not(:disabled) { background: #eef; border-color: #3498db; }
.btn-muerto { background-color: #ddd; color: #888; border-color: #ccc; }

/* Tarjetas */
.tarjeta-wrapper { display: flex; flex-direction: column; align-items: center; gap: 20px; perspective: 1000px; }
.tarjeta { background-color: transparent; width: 300px; height: 200px; }
.tarjeta-inner { position: relative; width: 100%; height: 100%; text-align: center; transition: transform 0.6s; transform-style: preserve-3d; box-shadow: 0 4px 8px 0 rgba(0,0,0,0.2); border-radius: 10px; }
.tarjeta.flip .tarjeta-inner { transform: rotateY(180deg); }
.tarjeta-front, .tarjeta-back { position: absolute; width: 100%; height: 100%; -webkit-backface-visibility: hidden; backface-visibility: hidden; border-radius: 10px; padding: 20px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; align-items: center; }
.tarjeta-front { background-color: #2c3e50; background-image: radial-gradient(#34495e 15%, transparent 16%), radial-gradient(#34495e 15%, transparent 16%); background-size: 20px 20px; }
.tarjeta-back { background-color: #f1f1f1; color: black; transform: rotateY(180deg); border: 2px solid #333; }

/* Textos Especiales */
.palabra-secreta { font-size: 2rem; color: #2980b9; font-weight: bold; margin: 10px 0; }
.texto-impostor { color: #c0392b; }
.alerta-muerto { color: #c0392b; font-weight: bold; background: #fadbd8; padding: 10px; border-radius: 5px; text-align: center; }
.nombre-expulsado { font-size: 1.5rem; text-transform: uppercase; }
.aviso-minimo { color: #7f8c8d; font-style: italic; margin-top: 10px; }

/* Resultados */
.resultado-info { background: #fff; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
.box-impostor h2 { color: #27ae60; }
.box-inocente h2 { color: #c0392b; }
</style>

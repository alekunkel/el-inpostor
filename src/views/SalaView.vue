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

const votarPor = (nombreJugador) => {
  if (confirm(`¿Estás seguro de que quieres votar por ${nombreJugador}?`)) {
    enviarVoto(nombreJugador);
  }
};

const handleFinalizarVotacion = () => {
  finalizarVotacion();
};

const handleSiguienteRonda = () => {
  siguienteRonda();
};

// (El handler para irAVotacion no es necesario, se llama directo)
</script>

<template>
  <div class="sala-container">

    <div v-if="store.estadoJuego === 'lobby'">
      <h2>Sala: {{ store.codigoSala }}</h2>
      <p>¡Esperando jugadores...</p>

      <div class="lista-jugadores">
        <h3>Jugadores ({{ store.jugadores.length }}):</h3>
        <ul>
          <li v-for="jugador in store.jugadores" :key="jugador.id">
            {{ jugador.nombre }}
            <span v-if="jugador.nombre === store.miNombre">(Tú)</span>
            <span v-if="store.jugadores[0] && jugador.id === store.jugadores[0].id"> (👑 Anfitrión)</span>
          </li>
        </ul>
      </div>

      <button
        v-if="store.soyElHost"
        @click="handleIniciarPartida"
        class="btn btn-primary"
      >
        ¡Iniciar Partida!
      </button>
    </div>

    <div v-else-if="store.estadoJuego === 'jugando'">
      <h2>Ronda de Preguntas</h2>

      <div v-if="store.mostrarTarjeta" class="tarjeta-wrapper">
        <div class="tarjeta flip">
          <div class="tarjeta-inner">
            <div class="tarjeta-front"></div>
            <div class="tarjeta-back">
              <div v-if="store.miRol === 'impostor'">
                <h1>¡Eres el Impostor!</h1>
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
      <p v-if="!store.heVotado">Elige al jugador que crees que es el impostor.</p>
      <p v-else>¡Voto registrado! Esperando al resto de jugadores...</p>

      <div class="grid-votacion">
        <button
          v-for="jugador in store.jugadores"
          :key="jugador.id"
          @click="votarPor(jugador.nombre)"
          class="btn btn-votar"
          :disabled="jugador.nombre === store.miNombre || store.heVotado"
        >
          Votar por {{ jugador.nombre }}
        </button>
      </div>

      <button
        v-if="store.soyElHost"
        @click="handleFinalizarVotacion"
        class="btn btn-danger"
        style="margin-top: 20px;"
      >
        Cerrar Votación y Ver Resultados
      </button>
    </div>

    <div v-else-if="store.estadoJuego === 'resultado'">
      <h2>Resultados de la Votación</h2>

      <div v-if="store.ultimoResultado" class="resultado-info">
        <h3>El jugador expulsado es: <strong>{{ store.ultimoResultado.jugadorExpulsado }}</strong></h3>
        <p v-if="store.ultimoResultado.numVotos">(Con {{ store.ultimoResultado.numVotos }} votos)</p>

        <div v-if="store.ultimoResultado.eraImpostor">
          <h2 style="color: green;">¡Era un Impostor!</h2>
        </div>
        <div v-else>
          <h2 style="color: red;">No era un impostor...</h2>
        </div>

        <p>Quedan <strong>{{ store.ultimoResultado.impostoresRestantes }}</strong> impostor(es) en juego.</p>
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
.sala-container { padding: 20px; max-width: 600px; margin: 0 auto; }
.lista-jugadores ul { list-style: none; padding: 0; }
.lista-jugadores li { background: #fff; padding: 10px; margin-bottom: 5px; border-radius: 5px; }
.resultado-info {
  background: #f0f0f0;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
}
.grid-votacion { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.btn-votar { padding: 20px; background: #eee; border: 1px solid #ccc; }

/* Estilos de la tarjeta */
.tarjeta-wrapper { display: flex; flex-direction: column; align-items: center; gap: 20px; }
.tarjeta { background-color: transparent; width: 300px; height: 200px; perspective: 1000px; }
.tarjeta-inner { position: relative; width: 100%; height: 100%; text-align: center; transition: transform 0.6s; transform-style: preserve-3d; box-shadow: 0 4px 8px 0 rgba(0,0,0,0.2); }
.tarjeta.flip .tarjeta-inner { transform: rotateY(180deg); }
.tarjeta-front, .tarjeta-back { position: absolute; width: 100%; height: 100%; -webkit-backface-visibility: hidden; backface-visibility: hidden; border-radius: 10px; padding: 20px; box-sizing: border-box; }
.tarjeta-front { background-color: #ddd; }
.tarjeta-back { background-color: #f1f1f1; color: black; transform: rotateY(180deg); }
.palabra-secreta { font-size: 2rem; color: #4A90E2; }
</style>

import { defineStore } from 'pinia'

export const useGameStore = defineStore('game', {
  state: () => ({
    codigoSala: null,
    miNombre: null,
    playerId: null,
    jugadores: [],
    miRol: null,
    palabraSecreta: null,
    estadoJuego: 'inicio',
    heVotado: false,
    ultimoResultado: null,
    mostrarTarjeta: false,
  }),

  getters: {
    soyElHost: (state) => {
      return state.jugadores.length > 0 && state.jugadores[0].nombre === state.miNombre;
    }
  },

  actions: {
    setPlayerId(id) {
      this.playerId = id;
      localStorage.setItem('impostor_playerId', id);
    },

    setSala(codigo, nombre) {
      this.codigoSala = codigo;
      this.miNombre = nombre;
      this.estadoJuego = 'lobby';
      // Guardar en localStorage
      localStorage.setItem('impostor_codigoSala', codigo);
    },

    setJugadores(listaJugadores) {
      this.jugadores = listaJugadores;
    },

    iniciarPartida(rol, palabra) {
      this.miRol = rol;
      this.palabraSecreta = palabra;
      this.estadoJuego = 'jugando';
      this.heVotado = false;
      this.ultimoResultado = null;
      this.mostrarTarjeta = false;
    },

    setHeVotado(status) {
      this.heVotado = status;
    },

    setEstadoJuego(estado) {
      this.estadoJuego = estado;
    },

    setResultado(resultado) {
      this.ultimoResultado = resultado;
    },

    setMostrarTarjeta(status) {
      this.mostrarTarjeta = status;
    },

    resetJuego() {
      this.codigoSala = null;
      this.miNombre = null;
      this.playerId = null; // <-- AÑADIR
      this.jugadores = [];
      this.miRol = null;
      this.palabraSecreta = null;
      this.estadoJuego = 'inicio';
      this.heVotado = false;
      this.ultimoResultado = null;
      this.mostrarTarjeta = false;

      // Limpiar localStorage
      localStorage.removeItem('impostor_playerId');
      localStorage.removeItem('impostor_codigoSala');
    }
  }
})

<script setup>
import { ref } from 'vue';
import { crearSala } from '@/services/socketService';

const apodo = ref('');
const jugadoresMax = ref(5);
const numeroImpostores = ref(1); // <-- AÑADIR ESTE REF

const handleCrearSala = () => {
  if (!apodo.value) {
    alert('Por favor, ingresa un apodo.');
    return;
  }

  // Validar impostores
  if (numeroImpostores.value >= Math.floor(jugadoresMax.value / 2)) {
    alert('El número de impostores debe ser menor que la mitad de los jugadores.');
    return;
  }

  const opciones = {
    nombreAnfitrion: apodo.value,
    maxJugadores: jugadoresMax.value,
    numeroImpostores: numeroImpostores.value, // <-- AÑADIR ESTA OPCIÓN
  };

  crearSala(opciones);
};
</script>

<template>
  <div class="form-container">
    <h2>Crear Sala Nueva</h2>
    <form @submit.prevent="handleCrearSala">

      <div class="form-group">
        <label for="apodo">Tu Apodo de Anfitrión</label>
        <input id="apodo" type="text" v-model="apodo" />
      </div>

      <div class="form-group">
        <label for="jugadores">Jugadores (4-15)</label>
        <input id="jugadores" type="number" min="4" max="15" v-model="jugadoresMax" />
      </div>

      <div class="form-group">
        <label for="impostores">Número de Impostores</label>
        <input id="impostores" type="number" min="1" :max="Math.floor(jugadoresMax / 2) - 1" v-model="numeroImpostores" />
      </div>

      <button type="submit" class="btn btn-primary">Crear</button>
    </form>
  </div>
</template>

<style scoped>
/* (Tus estilos) */
.form-container { max-width: 400px; margin: 50px auto; padding: 20px; }
.form-group { display: flex; flex-direction: column; margin-bottom: 15px; }
.form-group.checkbox { flex-direction: row; align-items: center; gap: 10px; }
.btn-primary { width: 100%; padding: 15px; /* ... */ }
</style>

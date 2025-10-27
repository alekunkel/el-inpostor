<script setup>
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import ComoJugarModal from '@/components/ComoJugarModal.vue';

const mostrarModal = ref(false);
</script>

<template>
  <div class="home-container">
    <h1>El Impostor</h1>

    <div class="botones-accion">
      <RouterLink to="/crear" class="btn btn-primary">Crear Sala</RouterLink>
      <RouterLink to="/unirse" class="btn btn-secondary">Unirse a Sala</RouterLink>
    </div>

    <button @click="mostrarModal = true" class="btn btn-link">
      ¿Cómo Jugar?
    </button>

    <ComoJugarModal
      :visible="mostrarModal"
      @close="mostrarModal = false"
    />
  </div>
</template>

<style scoped>
/* (Estilos de Home.vue, como los que te pasé antes) */
.home-container { text-align: center; padding-top: 100px; }
.botones-accion { display: flex; flex-direction: column; gap: 15px; max-width: 300px; margin: 40px auto; }
.btn { padding: 15px; text-decoration: none; border-radius: 8px; font-weight: bold; }
.btn-primary { background-color: #4A90E2; color: white; }
.btn-secondary { background-color: #50E3C2; color: #333; }
.btn-link { background: none; border: none; color: #888; text-decoration: underline; cursor: pointer; }
</style>

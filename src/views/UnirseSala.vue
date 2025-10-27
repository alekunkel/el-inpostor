<script setup>
import { ref } from 'vue';
import { unirseSala } from '@/services/socketService';
import router from '@/router';

const codigoSala = ref('');
const apodo = ref('');

const handleUnirse = () => {
  if (codigoSala.value && apodo.value) {
    unirseSala(codigoSala.value.toLowerCase(), apodo.value);
  } else {
    alert('Debes ingresar un código de sala y un apodo.');
  }
};
</script>

<template>
  <div class="unirse-container">
    <h2>Unirse a Sala</h2>
    <form @submit.prevent="handleUnirse" class="unirse-form">
      <div class="form-group">
        <label for="codigo">Código de Sala</label>

        <input
          id="codigo"
          type="text"
          v-model="codigoSala"
          @input="codigoSala = codigoSala.toLowerCase()" placeholder="abcd"
          maxlength="4"
          style="text-transform: lowercase;" />
      </div>
      <div class="form-group">
        <label for="apodo">Tu Apodo</label>
        <input id="apodo" type="text" v-model="apodo" placeholder="Tu nombre" />
      </div>
      <button type="submit" class="btn btn-primary">Entrar</button>
    </form>
    <button @click="router.push('/')" class="btn-link">Volver</button>
  </div>
</template>

<style scoped>
/* (Tus estilos) */
</style>

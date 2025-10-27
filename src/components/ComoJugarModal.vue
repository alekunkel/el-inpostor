<script setup>
defineProps({
  visible: Boolean
});
const emit = defineEmits(['close']);
</script>

<template>
  <div v-if="visible" class="modal-overlay" @click.self="emit('close')">
    <div class="modal-content">
      <button @click="emit('close')" class="close-button">&times;</button>
      <h2>Cómo Jugar</h2> [cite: 6]

      <div class="reglas-seccion">
        <h3>1. Creación y Unión</h3>
        <ul>
          <li>Un <strong>Anfitrión</strong> crea una sala y elige las opciones. </li>
          <li>Los demás jugadores se unen con el código de la sala. </li>
          <li>Cada jugador pone su nombre o apodo. </li>
        </ul>
      </div>

      <div class="reglas-seccion">
        <h3>2. Revelación de Roles</h3>
        <ul>
          <li>El Anfitrión inicia la partida. </li>
          <li>Si eres <strong>Tripulante</strong>, ves la palabra (ej: Casa). </li>
          <li>Si eres <strong>El Impostor</strong>, NO ves la palabra.</li>
        </ul>
      </div>

      <div class="reglas-seccion">
        <h3>3. Dinámica y Votación</h3>
        <ul>
          <li>Se hacen preguntas en ronda. </li>
          <li>Cuando se decide votar, todos usan su dispositivo para elegir a quién expulsar. </li>
        </ul>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* (Estilos del modal que te pasé antes) */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; }
.modal-content { background: white; padding: 30px; border-radius: 10px; max-width: 500px; position: relative; }
.close-button { position: absolute; top: 10px; right: 15px; background: none; border: none; font-size: 2rem; }
</style>

import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue'),
    },
    {
      path: '/crear',
      name: 'Crear',
      component: () => import('../views/CrearSalaView.vue'),
    },
    {
      path: '/unirse', // <-- Corregido a minúscula
      name: 'Unirse',
      component: () => import('../views/UnirseSala.vue'),
    },
    {
      path: '/sala/:codigo', // La ruta del juego
      name: 'Sala',
      // Asegúrate de que el nombre del archivo sea correcto (SalaView.vue o Sala.vue)
      component: () => import('../views/SalaView.vue'),
      props: true // Esto pasa el :codigo como 'prop' al componente
    }
  ],
})

export default router

import './assets/main.css'
import './assets/mobile.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { initSocket } from './services/socketService'

const app = createApp(App)

app.use(createPinia())
app.use(router)

initSocket()
app.mount('#app')

import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'
import '@agri/shared/tokens/tokens.css'
import './styles/finance-ui.css'

const app = createApp(App)
app.use(ElementPlus)
app.use(router)
app.mount('#app')

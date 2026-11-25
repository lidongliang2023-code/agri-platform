import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@agri/shared/tokens/tokens.css'
import './app.css'
import App from './App.vue'
import './shared-wiring'
import '../../../shared/pc-ui-v1.mjs'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('未找到 #root 挂载节点，请检查 index.html')
}

const app = createApp(App)
app.use(createPinia())
app.mount(rootElement)

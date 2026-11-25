import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import App from './App.vue'
import './index.css'
import './iot-app.css'
import '../../../shared/pc-ui-v1.mjs'

const app = createApp(App)
app.use(createPinia())
app.use(Antd)
app.mount('#root')

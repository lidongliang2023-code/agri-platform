import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import '@agri/shared/tokens/tokens.css'
import '../../frontend-shared/styles/s2b2c-admin.css'
import {
  bootstrapUnifiedSso,
  showUnifiedAuthFailure,
} from '../../frontend-shared/unified-auth'

bootstrapUnifiedSso({
  clientId: 'mall-supplier',
  permission: 's2b2c:supplier',
  landingPath: '/',
})
  .then((login) => {
    if (!login) return
    const app = createApp(App)
    app.use(createPinia())
    app.use(router)
    app.use(ElementPlus)
    app.mount('#app')
  })
  .catch(showUnifiedAuthFailure)

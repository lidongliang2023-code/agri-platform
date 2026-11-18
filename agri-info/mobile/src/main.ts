import { createSSRApp } from 'vue'
import App from './App.vue'
import { isLoggedIn, handleInfoUnauthorized } from './auth'

export function createApp() {
  const app = createSSRApp(App)
  app.mixin({
    onShow() {
      const pages = getCurrentPages()
      const route = pages[pages.length - 1]?.route
      if (route && route !== 'pages/login/index' && !isLoggedIn()) handleInfoUnauthorized()
    },
  })
  return { app }
}

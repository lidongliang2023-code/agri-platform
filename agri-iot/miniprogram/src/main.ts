import { createSSRApp } from 'vue'
import App from './App.vue'
import { ensureIotSession, guardWorkspace } from './api/iot'

export function createApp() {
  const app = createSSRApp(App)
  app.mixin({onShow(){const pages=getCurrentPages();const route=pages[pages.length-1]?.route;if(route&&route!=='pages/login/index'&&ensureIotSession())void guardWorkspace(route).catch(error=>uni.showToast({title:error.message||'权限校验失败',icon:'none'}))}})
  return { app }
}
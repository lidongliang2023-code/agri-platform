import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import './theme.css'
import './portal.css'
import App from './App'
import '../../../shared/pc-ui-v1.mjs'

const router = createRouter({ history: createWebHashHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] })
createApp(App).use(createPinia()).use(router).mount('#root')

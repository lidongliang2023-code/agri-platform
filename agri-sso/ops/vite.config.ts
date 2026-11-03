import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// 用户中心运营端：网关下挂在 /user-center-ops/，与 SSO 登录页（/）分属不同应用。
export default defineConfig({
  plugins: [react()],
  base: '/user-center-ops/',
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    host: '0.0.0.0',
    port: 5200,
    proxy: {
      '/api': { target: 'http://localhost:8093', changeOrigin: true },
    },
  },
})

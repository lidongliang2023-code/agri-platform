import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// 产物按 /info/ 前缀引用资源：网关把 bucket/info/versions/<v>/ 挂在该前缀下，
// 与综合服务 /service/、政府监管 /gov/ 的口径一致。
export default defineConfig({
  plugins: [react()],
  base: '/info/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5197,
    proxy: {
      '/api/v1/sso': { target: 'http://localhost:8093', changeOrigin: true },
      '/api/v1/auth': { target: 'http://localhost:8093', changeOrigin: true },
      '/api/v1/platform': { target: 'http://localhost:8093', changeOrigin: true },
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:8096',
        changeOrigin: true,
      },
    },
  },
})

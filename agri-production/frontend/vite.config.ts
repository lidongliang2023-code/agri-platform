import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // 默认指向 core-platform 的默认端口 8099。
        // 8080 在本机被一个无关的微服务注册中心长期占用（discoveryComposite），
        // core-platform 无法抢占，因此默认端口已改为 8099，前端同步对齐。
        // 需要临时指向别处时用环境变量覆盖：
        //   VITE_PROXY_TARGET=http://localhost:8111 npm run dev
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:8099',
        changeOrigin: true,
      },
    },
  },
})
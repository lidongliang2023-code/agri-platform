import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// 官网门户（独立工程）。
//
// 本地开发期把平台接口与交易接口代理到网关/后端；生产由 8098 网关按路径转发。
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5190,
    proxy: {
      '/api/v1': { target: 'http://localhost:8093', changeOrigin: true },
      '/api/trade': { target: 'http://localhost:8089', changeOrigin: true },
    },
  },
})

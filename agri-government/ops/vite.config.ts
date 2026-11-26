import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      'ant-design-vue': path.resolve(__dirname, 'node_modules/ant-design-vue'),
      '@ant-design/icons-vue': path.resolve(__dirname, 'node_modules/@ant-design/icons-vue'),
      'vue': path.resolve(__dirname, 'node_modules/vue'),
      'axios': path.resolve(__dirname, 'node_modules/axios'),
      '@agri/shared': path.resolve(__dirname, '../../packages/agri-shared/src'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5183,
    proxy: {
      '/api/v1/sso': { target: 'http://localhost:8093', changeOrigin: true },
      '/api/v1/auth': { target: 'http://localhost:8093', changeOrigin: true },
      '/api/v1/platform': { target: 'http://localhost:8093', changeOrigin: true },
      '/api': { target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:8095', changeOrigin: true },
    },
  },
})

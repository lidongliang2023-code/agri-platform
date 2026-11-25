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
    port: 5177,
    proxy: {
      '/api': { target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:8091', changeOrigin: true },
    },
  },
})

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@agri/shared': path.resolve(__dirname, '../../packages/agri-shared/src'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5179,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:8093',
        changeOrigin: true,
      },
    },
  },
})

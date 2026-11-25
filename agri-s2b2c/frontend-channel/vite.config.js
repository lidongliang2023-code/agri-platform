import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@agri/shared': resolve(__dirname, '../../packages/agri-shared/src'),
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    port: 3002,
    proxy: {
      '/api/v1/sso': {
        target: 'http://localhost:8093',
        changeOrigin: true
      },
      '/api/v1/auth': {
        target: 'http://localhost:8093',
        changeOrigin: true
      },
      '/api/v1/platform': {
        target: 'http://localhost:8093',
        changeOrigin: true
      },
      '/api': {
        target: 'http://localhost:8088',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist'
  }
})

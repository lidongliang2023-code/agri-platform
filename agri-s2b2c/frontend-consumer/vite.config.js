import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 3000,
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

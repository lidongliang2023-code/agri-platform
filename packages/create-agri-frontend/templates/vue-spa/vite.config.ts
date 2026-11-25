import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  base: '/{{APP_SLUG}}/versions/{{BUILD_VERSION}}/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@agri/shared': path.resolve(__dirname, '{{SHARED_SRC_REL}}'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: {{DEV_PORT}},
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? '{{PROXY_TARGET}}',
        changeOrigin: true,
      },
    },
  },
})

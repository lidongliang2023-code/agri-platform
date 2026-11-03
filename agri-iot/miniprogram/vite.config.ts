import { defineConfig } from 'vite'
import uniPlugin from '@dcloudio/vite-plugin-uni'
const uni=(uniPlugin as unknown as {default?:typeof uniPlugin}).default??uniPlugin

export default defineConfig({
  plugins: [uni()],
  base: process.env.UNI_H5_BASE || './',
  server: {
    port: 5178,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:8091',
        changeOrigin: true
      }
    }
  }
})

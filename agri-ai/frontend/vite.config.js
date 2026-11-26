import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

export default defineConfig({
 plugins: [vue()],
 base: '/ai-ops/',
 build: {
  outDir: fileURLToPath(new URL('../src/main/resources/static/ai-ops', import.meta.url)),
  emptyOutDir: true,
 },
 server: { proxy: { '/api': 'http://localhost:8201' } },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const frontendSource = path.resolve(__dirname, '../frontend/src')

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@/pages/mobile-trade', replacement: path.resolve(__dirname, 'src/pages/mobile-trade/index.tsx') },
      { find: '@/utils/sso', replacement: path.resolve(__dirname, 'src/utils/sso.ts') },
      { find: '@/utils/session', replacement: path.resolve(__dirname, 'src/utils/session.ts') },
      { find: '@', replacement: frontendSource },
    ],
  },
  server: {
    port: 8181,
    proxy: {
      '/api': {
        target: 'http://localhost',
        changeOrigin: true,
      },
    },
  },
})

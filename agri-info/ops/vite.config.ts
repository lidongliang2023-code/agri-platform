import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import path from 'path'

// 运营端与用户端同源同栈，仅以 base 与 dev 端口区分：
// 网关下 /info/ 归用户端，/info-ops/ 归运营端，避免两个应用互相覆盖产物。
export default defineConfig({
  plugins: [vue(), vueJsx()],
  base: '/info-ops/',
  resolve: {
    alias: {
      'vue': path.resolve(__dirname, 'node_modules/vue'),
      'ant-design-vue': path.resolve(__dirname, 'node_modules/ant-design-vue'),
      '@ant-design/icons-vue': path.resolve(__dirname, 'node_modules/@ant-design/icons-vue'),
      '@agri/shared': path.resolve(__dirname, '../../packages/agri-shared/src'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5198,
    proxy: {
      '/api/v1/sso': { target: 'http://localhost:8093', changeOrigin: true },
      '/api/v1/auth': { target: 'http://localhost:8093', changeOrigin: true },
      '/api/v1/platform': { target: 'http://localhost:8093', changeOrigin: true },
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:8096',
        changeOrigin: true,
      },
    },
  },
})

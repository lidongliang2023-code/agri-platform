import { defineConfig } from 'vite'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue(), vueJsx()],
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
    port: 3002,
    proxy: {
      '/api': {
        // 交易后端实际跑在 8089：8084 是 nginx 的 mall-supplier 虚拟主机端口，
        // 代理指过去只会把接口请求打到网关的静态站点上（拿到 HTML 而不是 JSON）。
        target: 'http://localhost:8089',
        changeOrigin: true,
      },
    },
  },
})

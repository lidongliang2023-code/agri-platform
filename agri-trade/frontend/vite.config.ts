import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
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

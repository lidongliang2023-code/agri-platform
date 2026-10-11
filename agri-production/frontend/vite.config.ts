import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // 必须排在 '@' 之前：Vite 的 alias 按插入顺序做前缀匹配，
      // 否则 '@' 会先把 '@agri/shared/...' 吞成 './src/agri/shared/...'。
      // 用 alias 而不是依赖 package.json 的 exports 子路径 —— 后者在 tsc 侧不可靠（B2a 已踩过）。
      '@agri/shared': path.resolve(__dirname, '../../packages/agri-shared/src'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // 默认指向 core-platform 的默认端口 8099。
        // 8080 在本机被一个无关的微服务注册中心长期占用（discoveryComposite），
        // core-platform 无法抢占，因此默认端口已改为 8099，前端同步对齐。
        // 需要临时指向别处时用环境变量覆盖：
        //   VITE_PROXY_TARGET=http://localhost:8111 npm run dev
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:8099',
        changeOrigin: true,
      },
    },
  },
})

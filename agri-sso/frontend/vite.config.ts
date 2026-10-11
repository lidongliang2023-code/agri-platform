import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// 统一认证中心登录页（sso 子域）。
//
// 开发期直连 core-platform（生产由网关按子域把 /api 与 /authorize 转过去）：
//   VITE_PROXY_TARGET=http://localhost:8093 pnpm dev
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // 共享包必须排在 '@' 之前：Vite 的 alias 按插入顺序做前缀匹配，
      // 否则 '@' 会先把 '@agri/shared/...' 吞成 './src/agri/shared/...'。
      '@agri/shared': path.resolve(__dirname, '../../packages/agri-shared/src'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5179,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:8093',
        changeOrigin: true,
      },
    },
  },
})

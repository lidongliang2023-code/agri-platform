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
        // 默认指向**网关**（nginx :80），而不是某个后端的直连端口。
        //
        // 原因：`/api/v1/production/**` 现在由网关**按路径段**分发 —— iot/plots/growth 等
        // 走 agri-production，未切换的段回退到 core-platform。开发时如果直连某个后端，
        // 就绕过了这张路由表，会出现"本地好好的、发布后页面 500"（2026-10-28 实测踩过：
        // 服务在 8094 上跑得好好的，网关却把 /monitor/** 兜底给了 core-platform）。
        // 走网关能让开发与生产的路由行为完全一致。
        //
        // 只想直连某个后端时用环境变量覆盖：
        //   VITE_PROXY_TARGET=http://localhost:8092 npm run dev   # 只打 agri-production
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost',
        changeOrigin: true,
      },
    },
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * {{APP_NAME}}前端构建配置。
 *
 * 三条硬约定，改动前请先读完再动手：
 *
 * 1. `@agri/shared` 用 alias 解析，且必须排在 `'@'` 之前。Vite 的 alias 是前缀匹配，
 *    `'@'` 在前会把 `@agri/shared/...` 吞成 `./src/agri/shared/...`。不使用 agri-shared
 *    的 package.json `exports` 子路径 —— 该方式在 tsc 侧不可靠（主应用 B2 迁移已实测）。
 *
 * 2. `base` 带版本号。产物按 `/<app>/versions/<version>/` 发布，与网关的版本指针
 *    （`current` → 具体版本目录）配套：回滚时只切换指针，不动已发布的版本目录。
 *
 * 3. 开发代理默认指向 core-platform 的 8099。8080 在本机被无关服务长期占用，
 *    core-platform 抢不到该端口，因此默认端口是 8099。
 */
export default defineConfig({
  base: '/{{APP_SLUG}}/versions/{{BUILD_VERSION}}/',
  plugins: [react()],
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
        // 需要临时指向别处时用环境变量覆盖：
        //   VITE_PROXY_TARGET=http://localhost:8111 pnpm dev
        target: process.env.VITE_PROXY_TARGET ?? '{{PROXY_TARGET}}',
        changeOrigin: true,
      },
    },
  },
})

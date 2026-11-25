import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // 共享包必须排在 '@' 之前：Vite 的 alias 按插入顺序做前缀匹配，

      // 否则 '@' 会先把 '@agri/shared/...' 吞成 './src/agri/shared/...'。

      '@agri/shared': path.resolve(__dirname, '../../packages/agri-shared/src'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5177,
    proxy: {
      // 平台侧接口（SSO 换票 / 运营账号 / 用户中心）在 core-platform，先于 /api 匹配。
      '/api/v1': {
        target: 'http://localhost:8093',
        changeOrigin: true,
      },
      '/api/trade': {
        target: 'http://localhost:8089',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:8083',
        changeOrigin: true,
      },
    },
  },
})

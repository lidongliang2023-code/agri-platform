import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // 共享包必须排在 '@' 之前：Vite 的 alias 按插入顺序做前缀匹配，
      // 否则 '@' 会先把 '@agri/shared/...' 吞成 './src/agri/shared/...'。
      '@agri/shared': resolve(__dirname, '../../packages/agri-shared/src'),
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    port: 5175,
    proxy: {
      '/api': {
        target: 'http://localhost:8087',
        changeOrigin: true
      }
    }
  }
})
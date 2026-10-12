import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// 回归 PRD §15.1 的 Vue 选型：index.html 的入口是 /src/main.ts，.vue 单文件组件必须由本插件转译。
// 少了它，构建会在 [vite:build-import-analysis] 处报 "Failed to parse source ... App.vue" —— 与页面代码无关。
// react() 暂时保留：React 版页面文件还在仓库里（待挪入 legacy-react/），保留它不影响 Vue 构建。
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue(), react()],
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
      '/api': {
        target: 'http://localhost:8083',
        changeOrigin: true,
      },
    },
  },
})

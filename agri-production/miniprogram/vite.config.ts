import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

export default defineConfig({
  plugins: [uni()],
  // 静态部署到网关版本目录时注入带版本号的绝对前缀；本地构建仍保持相对路径。
  base: process.env.UNI_H5_BASE || './',
  server: {
    port: 5300,
    // H5 预览时把 /api 反代到 nginx 网关，避免小程序端/H5 端各写一套 baseUrl
    proxy: {
      '/api': {
        target: 'http://localhost',
        changeOrigin: true,
      },
    },
  },
})

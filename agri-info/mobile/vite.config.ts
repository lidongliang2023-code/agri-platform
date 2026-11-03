import { defineConfig } from 'vite'
import uniPlugin from '@dcloudio/vite-plugin-uni'

const uni = (uniPlugin as unknown as { default?: typeof uniPlugin }).default ?? uniPlugin

export default defineConfig({
  plugins: [uni()],
  // 发布到 /info-mobile/ 时由 publish.mjs 注入 UNI_H5_BASE；本地开发用相对路径即可。
  base: process.env.UNI_H5_BASE || './',
  server: {
    host: '0.0.0.0',
    port: 5199,
    proxy: {
      // 统一登录与权限中心（core-platform）
      '/api/v1/sso': { target: 'http://localhost:8093', changeOrigin: true },
      '/api/v1/auth': { target: 'http://localhost:8093', changeOrigin: true },
      '/api/v1/platform': { target: 'http://localhost:8093', changeOrigin: true },
      // 信息资讯业务接口
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:8096',
        changeOrigin: true,
      },
      // 课程视频：由网关的 /vod/ 静态服务提供（带 secure_link 签名校验），
      // 不代理的话本地 dev 里 <video> 拿到 /vod/xxx 会 404，看起来像"播放器坏了"。
      '/vod': {
        target: process.env.VITE_MEDIA_TARGET ?? 'http://localhost:8114',
        changeOrigin: true,
      },
    },
  },
})

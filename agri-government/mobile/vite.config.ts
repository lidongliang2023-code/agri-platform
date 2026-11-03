import { defineConfig } from 'vite'
import uniPlugin from '@dcloudio/vite-plugin-uni'
const uni=(uniPlugin as unknown as {default?:typeof uniPlugin}).default??uniPlugin
export default defineConfig({
  plugins:[uni()],base:process.env.UNI_H5_BASE||'./',
  server:{host:'0.0.0.0',port:5182,proxy:{
    '/api/v1/sso':{target:'http://localhost:8093',changeOrigin:true},
    '/api/v1/auth':{target:'http://localhost:8093',changeOrigin:true},
    '/api/v1/platform':{target:'http://localhost:8093',changeOrigin:true},
    '/api':{target:process.env.VITE_PROXY_TARGET??'http://localhost:8095',changeOrigin:true},
  }},
})

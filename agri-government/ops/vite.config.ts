import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins:[react()],
  resolve:{alias:{'@':path.resolve(__dirname,'./src')}},
  server:{host:'0.0.0.0',port:5183,proxy:{
    '/api/v1/sso':{target:'http://localhost:8093',changeOrigin:true},
    '/api/v1/auth':{target:'http://localhost:8093',changeOrigin:true},
    '/api/v1/platform':{target:'http://localhost:8093',changeOrigin:true},
    '/api':{target:process.env.VITE_PROXY_TARGET??'http://localhost:8095',changeOrigin:true},
  }},
})

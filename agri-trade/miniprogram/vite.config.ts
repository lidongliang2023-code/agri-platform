import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import uniPlugin from '@dcloudio/vite-plugin-uni'

const uni = (uniPlugin as unknown as { default?: typeof uniPlugin }).default ?? uniPlugin

/** 首页对应的页面 chunk（uni-app 按页面路径给 chunk 命名）。 */
const HOME_CHUNK = 'pages-home-index'

/**
 * H5 首屏优化，只在 H5 构建里生效（小程序、App 不经过 index.html，也不需要这些）。
 *
 * 1. 标签栏图标：uni-app 在 hash 路由 + router.base="./" 时，把 `/static/**` 按页面地址拼成根路径，
 *    而发布后静态资源都在 `/trade-mobile/versions/<版本>/static/` 下 —— 线上图标请求拿到的是
 *    网关回退的 index.html。构建时把图标路径补上版本前缀。
 * 2. 首页代码预加载：把首页 chunk、它静态依赖的 chunk 和样式写进 index.html，由内联脚本在
 *    首页路由时立即发起，不再等主脚本下载执行完才开始请求（省一轮往返）。
 * 3. 预压缩：给 js / css / svg / json 生成 .gz，网关 gzip_static 直接发送，不在请求时压缩。
 */
function tradeH5FirstScreen(apiBase: string): Plugin {
  let base = './'
  let outDir = ''
  return {
    name: 'trade-h5-first-screen',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      base = config.base
      outDir = path.resolve(config.root, config.build.outDir)
    },
    generateBundle(_options, bundle) {
      if (!base.startsWith('/') || base === '/') return
      const pattern = /((?:selected)?[iI]conPath["']?\s*:\s*)(["'])\/static\//g
      for (const item of Object.values(bundle)) {
        if (item.type === 'chunk' && pattern.test(item.code)) {
          pattern.lastIndex = 0
          item.code = item.code.replace(pattern, `$1$2${base}static/`)
        }
        pattern.lastIndex = 0
      }
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const preload: string[] = []
        const styles: string[] = []
        const bundle = ctx.bundle ?? {}
        const home = Object.values(bundle).find((item) => item.type === 'chunk' && item.fileName.includes(`${HOME_CHUNK}.`))
        if (home && home.type === 'chunk') {
          const seen = new Set<string>()
          const visit = (fileName: string) => {
            const chunk = bundle[fileName]
            if (!chunk || chunk.type !== 'chunk' || seen.has(fileName) || chunk.isEntry) return
            seen.add(fileName)
            preload.push(base + fileName)
            const css = (chunk as unknown as { viteMetadata?: { importedCss?: Set<string> } }).viteMetadata?.importedCss
            css?.forEach((file) => { if (!styles.includes(base + file)) styles.push(base + file) })
            chunk.imports.forEach(visit)
          }
          visit(home.fileName)
        }
        return html
          .replace('__TRADE_API_BASE__', apiBase)
          .replace('"__TRADE_HOME_PRELOAD__"', JSON.stringify({ js: preload, css: styles }))
      },
    },
    closeBundle() {
      if (!outDir) return
      // uni-app 把 uni.css 插在 <head> 最前面；排在样式表后面的内联脚本要等样式表下载完才执行，
      // 预加载和数据预取会因此晚一轮往返。把启动脚本挪到 charset 之后。
      // 样式表挪到 <body> 里启动骨架之后、#app 之前：骨架不必等样式表就能先画出来；
      // 样式表仍排在主脚本之前，主脚本照样要等它们加载完才执行，页面不会无样式闪一下。
      const indexFile = path.join(outDir, 'index.html')
      try {
        let html = readFileSync(indexFile, 'utf8')
        const boot = /<script id="trade-boot">[\s\S]*?<\/script>/.exec(html)?.[0]
        const charset = /<meta charset="UTF-8"\s*\/?>/i.exec(html)?.[0]
        if (boot && charset) {
          html = html.replace(boot, '')
          const headPart = html.slice(0, html.indexOf('</head>'))
          const sheets = headPart.match(/<link rel="stylesheet"[^>]*>/g) ?? []
          sheets.forEach((tag) => { html = html.replace(tag, '') })
          html = html.replace(charset, `${charset}\n    ${boot}`)
          html = html.replace('<div id="app">', `${sheets.join('\n    ')}\n    <div id="app">`)
          writeFileSync(indexFile, html)
        }
      } catch { /* 非 H5 产物没有 index.html */ }
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const file = path.join(dir, name)
          if (statSync(file).isDirectory()) { walk(file); continue }
          if (!/\.(js|css|svg|json)$/.test(name)) continue
          const source = readFileSync(file)
          if (source.length < 1024) continue
          writeFileSync(`${file}.gz`, gzipSync(source, { level: 9 }))
        }
      }
      walk(outDir)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const apiBase = String(env.VITE_TRADE_API_BASE || '').replace(/\/$/, '')
  const h5 = (process.env.UNI_PLATFORM || 'h5') === 'h5'
  return {
    plugins: [uni(), ...(h5 ? [tradeH5FirstScreen(apiBase)] : [])],
    base: process.env.UNI_H5_BASE || './',
    server: {
      host: '0.0.0.0',
      port: 5330,
      proxy: {
        '/api/v1/sso': { target: 'http://127.0.0.1:8093', changeOrigin: true },
        '/api/v1/auth': { target: 'http://127.0.0.1:8093', changeOrigin: true },
        '/api/v1/platform': { target: 'http://127.0.0.1:8093', changeOrigin: true },
        '/api': { target: 'http://127.0.0.1:8089', changeOrigin: true },
      },
    },
  }
})

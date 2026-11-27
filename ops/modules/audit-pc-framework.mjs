import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const errors = []
const forbidden = /^(?:react(?:-dom|-router(?:-dom)?|-refresh)?|preact|antd|echarts-for-react|@types\/react(?:-dom)?|@vitejs\/plugin-react(?:-swc)?|eslint-plugin-react(?:-hooks|-refresh)?|@ant-design\/(?:icons|pro-[^/]+)|@tanstack\/react-[^/]+)(?:\/|$)/
const apps = []
const read = p => fs.readFileSync(path.join(root,p),'utf8')
const exists = p => fs.existsSync(path.join(root,p))
const fail = (file,message) => errors.push(`${file}: ${message}`)
function files(dir) {
 if(!exists(dir))return []
 return fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(entry=>{
  if(['node_modules','dist','build','target','legacy-prototype'].includes(entry.name))return []
  const p=path.posix.join(dir,entry.name)
  return entry.isDirectory()?files(p):[p]
 })
}
for(const module of fs.readdirSync(root,{withFileTypes:true}).filter(e=>e.isDirectory()&&e.name.startsWith('agri-'))){
 for(const dir of fs.readdirSync(path.join(root,module.name),{withFileTypes:true}).filter(e=>e.isDirectory())){
  const base=`${module.name}/${dir.name}`,manifest=`${base}/package.json`
  if(!exists(manifest))continue
  const pkg=JSON.parse(read(manifest))
  if(!pkg.scripts?.build || pkg.dependencies?.['@dcloudio/uni-app'])continue
  apps.push(base)
  if(!/^[~^]?3\./.test(pkg.dependencies?.vue??''))fail(manifest,'PC 应用必须直接依赖 Vue 3')
  for(const group of ['dependencies','devDependencies','peerDependencies','optionalDependencies']){
   for(const dep of Object.keys(pkg[group]??{}))if(forbidden.test(dep))fail(manifest,`禁止依赖 ${dep}`)
  }
  const vite=['vite.config.ts','vite.config.js'].find(name=>exists(`${base}/${name}`))
  if(!vite||!read(`${base}/${vite}`).includes('@vitejs/plugin-vue'))fail(base,'缺少 Vue Vite 插件')
  const html=exists(`${base}/index.html`)?read(`${base}/index.html`):''
  const entry=html.match(/<script\b[^>]*\bsrc=["']\/?(src\/[^"']+)["']/)?.[1]
  if(!entry||!exists(`${base}/${entry}`))fail(base,'缺少有效前端入口')
  else if(!/import\s*\{[^}]*\bcreateApp\b[^}]*\}\s*from\s*['"]vue['"]/.test(read(`${base}/${entry}`)))fail(base,'入口未从 Vue 导入 createApp')
  for(const local of ['package-lock.json','pnpm-lock.yaml'])if(exists(`${base}/${local}`))fail(`${base}/${local}`,'PC 工程统一使用仓库根 pnpm 锁文件')
  for(const file of files(`${base}/src`).concat(vite?[`${base}/${vite}`]:[]))scanImports(file)
}
}
function scanImports(file){
 if(!/\.(?:[cm]?[jt]sx?|vue|json)$/.test(file))return
 const source=read(file)
 for(const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)['"]([^'"\r\n]+)['"]/g)){
  if(forbidden.test(match[1]))fail(file,`禁止导入 ${match[1]}`)
 }
 if(/jsxImportSource["']?\s*:\s*["']react["']/.test(source))fail(file,'JSX 必须使用 Vue')
}
for(const file of files('packages/agri-shared/src'))scanImports(file)
const lock=read('pnpm-lock.yaml')
for(const match of lock.matchAll(/^  ['"]?([^\s:]+)@[^\n]*:/gm))if(forbidden.test(match[1]))fail('pnpm-lock.yaml',`存在禁止包 ${match[1]}`)
// react-is 是移动端 uni-automator → Jest → pretty-format 的类型判断工具，不是 React 运行时。
console.log(`PC Vue 3 framework audit: ${apps.length} applications`)
for(const app of apps)console.log(`  ${errors.some(e=>e.startsWith(app+':')||e.startsWith(app+'/'))?'FAIL':'PASS'} ${app}`)
if(!apps.length)fail('workspace','没有发现 PC 应用')
if(errors.length){console.error(errors.join('\n'));process.exitCode=1}
else console.log('PASS: Vue 3 entries, build plugins, dependencies, source imports and root lockfile')

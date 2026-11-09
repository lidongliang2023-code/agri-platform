/**
 * Vue <script setup> 模板标识符自查（一次性工具，也可挂进 CI）
 *
 * 为什么要有它：`<script setup>` 的模板里写了一个没声明的标识符，vite 构建**零警告**，
 * 运行时才在点击那一刻抛 ReferenceError（本项目已因此交付过死按钮两次）。
 * tsc / eslint 都不覆盖这条链路（模板不是 TS 代码），所以只能自己比。
 *
 * 判据：模板表达式（{{ }}、:prop、@event、v-if/v-for/v-model）里的**首层标识符**
 * 必须能在 <script> 里找到声明（const/let/function/import/defineProps 解构）
 * 或属于浏览器/JS 内建。找不到就报出来，由人判断是真漏还是模板字符串误伤。
 *
 * 用法：node scripts/check-vue-template-ids.mjs <文件或目录> [...更多]
 * 退出码：0 全部有声明；1 存在可疑标识符（逐项列出）。
 *
 * 定位是**改动自查**，不是全仓硬门禁。已知会误报三类（都不修，靠人判）：
 *   1. `defineProps<{ size?: string }>()` 这种类型式声明（只认对象式与解构）；
 *   2. Options API 的 `data() { return { keyword: '' } }`；
 *   3. 非 `<script setup>` 的老写法（组件选项里声明的 methods/computed）。
 * 实测口径：agri-s2b2c 全模块 166 个 .vue 零误报；跨模块跑会出十几条上述三类，
 * 所以 CI 里只对"本轮改过的文件"要求它归零。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const GLOBALS = new Set([
  'true', 'false', 'null', 'undefined', 'NaN', 'Infinity',
  'Math', 'JSON', 'String', 'Number', 'Boolean', 'Array', 'Object', 'Date', 'Set', 'Map',
  'Promise', 'RegExp', 'Intl', 'console', 'window', 'document', 'localStorage', 'sessionStorage',
  'navigator', 'location', 'history', 'fetch', 'URLSearchParams', 'FormData', 'Blob', 'setTimeout',
  'clearTimeout', 'encodeURIComponent', 'decodeURIComponent', 'isNaN', 'isFinite', 'parseInt', 'parseFloat',
  'in', 'of', 'typeof', 'instanceof', 'new', 'return', 'if', 'else', 'and', 'or', 'not', 'key', 'index',
  'item', 'row', 'scope', 'event', '$event', 'this', '$refs', '$slots', '$attrs', '$emit',
])

const collect = (dir) => {
  const out = []
  for (const name of readdirSync(dir)) {
    // 第三方产物与构建输出里没有"我们的模板"，扫它们只会产出别人的噪音
    if (name === 'node_modules' || name === 'dist' || name === 'unpackage') continue
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) out.push(...collect(full))
    else if (name.endsWith('.vue')) out.push(full)
  }
  return out
}

const targets = process.argv.slice(2)
if (targets.length === 0) {
  console.error('用法：node scripts/check-vue-template-ids.mjs <文件或目录> [...更多]')
  process.exit(2)
}
const files = targets.flatMap((t) => (statSync(t).isDirectory() ? collect(t) : [t]))

const problems = []
for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const tplStart = src.indexOf('<template>')
  const tplEnd = src.lastIndexOf('</template>')
  const scriptStart = src.indexOf('<script')
  if (tplStart < 0 || tplEnd < 0 || scriptStart < 0) continue
  const tpl = src.slice(tplStart, tplEnd)
  const script = src.slice(scriptStart)

  const exprs = [
    ...[...tpl.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1]),
    ...[...tpl.matchAll(/(?:@[\w.:-]+|v-on:[\w.:-]+|:[\w.:-]+|v-if|v-else-if|v-for|v-model(?:\.\w+)?|v-show|#[\w-]+)="([^"]+)"/g)]
      .map((m) => m[1]),
  ]

  // v-for 的迭代别名是模板局部变量，不是 setup 里的声明（(item, index) in list / n in nodes）
  const locals = new Set()
  for (const m of tpl.matchAll(/v-for="\s*\(?([^)" ]+(?:\s*,\s*[^) ]+)*)\s*\)?\s+(?:in|of)\s+/g)) {
    for (const alias of m[1].split(',')) locals.add(alias.trim())
  }
  // 具名插槽的解构别名同理：v-slot="{ Component, props }" / #item="{ row }"
  for (const m of tpl.matchAll(/(?:v-slot(?::[\w-]+)?|#[\w-]+)\s*=\s*"\s*\{([^}]*)\}/g)) {
    for (const alias of m[1].split(',')) {
      const name = alias.split(':').pop().trim()
      if (/^[A-Za-z_$][\w$]*$/.test(name)) locals.add(name)
    }
  }

  const used = new Set()
  for (const expr of exprs) {
    // 内联箭头函数的形参同样是局部变量：@change="(value) => save(row, value)"
    for (const m of expr.matchAll(/\(\s*([\w$, ]+)\)\s*=>|([A-Za-z_$][\w$]*)\s*=>/g)) {
      for (const p of (m[1] ?? m[2]).split(',')) locals.add(p.trim())
    }
    // 只扫 ${...} 里的插值，其余模板字符串按纯文本处理；字符串字面量整段丢弃
    const scannable = /`/.test(expr)
      ? [...expr.matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1]).join(' ')
      : expr.replace(/'[^']*'|"[^"]*"/g, "''")
    for (const m of scannable.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)/g)) {
      const id = m[2]
      // 后跟冒号的是对象字面量的键（{ onchain: n.onChain }），不是标识符
      if (/^\s*:/.test(scannable.slice(m.index + m[0].length))) continue
      used.add(id)
    }
  }

  for (const id of used) {
    if (GLOBALS.has(id) || locals.has(id) || id.startsWith('$')) continue
    const declared = new RegExp(`(?:const|let|var|function|class)\\s+${id}\\b|import\\s+\\{[^}]*\\b${id}\\b|import\\s+${id}\\b|\\b${id}\\s*[,:}]\\s*[A-Za-z]|\\b${id}\\s*=>`)
      .test(script)
      || new RegExp(`const\\s*\\{[^}]*\\b${id}\\b[^}]*\\}\\s*=`).test(script)
      || new RegExp(`defineProps\\([\\s\\S]*?\\b${id}:`).test(script)
    if (!declared) problems.push(`${path.relative(process.cwd(), file)} → ${id}`)
  }
}

for (const line of [...new Set(problems)]) console.log(`? ${line}`)
console.log(`\n扫描 ${files.length} 个 .vue，可疑未声明标识符 ${new Set(problems).size} 个`)
process.exit(new Set(problems).size > 0 ? 1 : 0)

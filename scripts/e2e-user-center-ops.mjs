// 用户中心运营端 E2E：走真实 SSO 登录，逐页截图并收集控制台异常。
// 依赖：Edge headless + CDP（Node 22 内置 WebSocket），不引入 puppeteer/playwright。
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const PORT = 9344
const PROFILE = 'C:/Users/71502/AppData/Local/Temp/edge-uc-ops'
const OUT = 'C:/Users/71502/AppData/Local/Temp'
const BASE = 'http://127.0.0.1:8115/user-center-ops/'

mkdirSync(OUT, { recursive: true })

const edge = spawn(EDGE, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`,
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--window-size=1600,1000',
  'about:blank',
], { stdio: 'ignore', detached: false })

let ws
let nextId = 1
const pending = new Map()
const consoleErrors = []
const pageErrors = []

function send(method, params = {}, sessionId) {
  const id = nextId++
  const payload = { id, method, params }
  if (sessionId) payload.sessionId = sessionId
  ws.send(JSON.stringify(payload))
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        reject(new Error(`CDP 超时：${method}`))
      }
    }, 30000)
  })
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (result.exceptionDetails) {
    throw new Error(`页面执行异常：${result.exceptionDetails.text} ${JSON.stringify(result.exceptionDetails.exception?.description ?? '')}`)
  }
  return result.result?.value
}

async function waitFor(expression, timeoutMs = 20000, label = expression) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      if (await evaluate(expression)) return true
    } catch {
      // 页面跳转期间执行上下文会失效，忽略后重试
    }
    await sleep(400)
  }
  throw new Error(`等待超时：${label}`)
}

async function shot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, 'base64'))
  return `${name}.png`
}

async function goto(hash) {
  await evaluate(`window.location.hash = ${JSON.stringify(hash)}; true`)
  await sleep(1200)
}

async function main() {
  // 等调试端口就绪
  let targets = null
  for (let i = 0; i < 40; i++) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      targets = await response.json()
      if (targets.some((t) => t.type === 'page')) break
    } catch {
      // 端口还没起来
    }
    await sleep(300)
  }
  if (!targets) throw new Error('Edge 调试端口未就绪')
  const page = targets.find((t) => t.type === 'page')
  ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = () => reject(new Error('CDP WebSocket 连接失败'))
  })
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`))
      else resolve(msg.result)
      return
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300))
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      pageErrors.push(String(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text).slice(0, 300))
    }
  }

  await send('Page.enable')
  await send('Runtime.enable')

  console.log('=== 1. 打开运营端（应跳转统一认证）===')
  await send('Page.navigate', { url: BASE })
  await waitFor(`document.body.innerText.includes('统一认证中心') || document.body.innerText.includes('用户中心')`,
    30000, '认证页或运营端渲染')
  console.log('  当前地址:', await evaluate('location.href'))
  console.log('  页面标题:', await evaluate('document.title'))

  // SSO 登录页：默认「手机号+验证码」，需切到「账号+密码」
  const onLogin = await evaluate(`Array.from(document.querySelectorAll('button')).some((b) => (b.textContent || '').includes('账号 + 密码'))`)
  if (onLogin) {
    console.log('=== 2. 切换「账号 + 密码」并登录 ===')
    await evaluate(`(() => {
      const tabs = Array.from(document.querySelectorAll('button'));
      const tab = tabs.find((b) => (b.textContent || '').includes('账号 + 密码'));
      if (tab) tab.click();
      return Boolean(tab);
    })()`)
    await waitFor(`Array.from(document.querySelectorAll('input')).some((i) => (i.placeholder || '').includes('登录密码'))`,
      10000, '账号密码表单出现')
    const filled = await evaluate(`(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const user = inputs.find((i) => (i.placeholder || '').includes('手机号 / 用户名'));
      const pwd = inputs.find((i) => (i.placeholder || '').includes('登录密码'));
      if (!user || !pwd) return false;
      const setValue = (el, value) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      setValue(user, 'admin');
      setValue(pwd, 'Admin@123');
      return true;
    })()`)
    console.log('  表单填充:', filled ? 'OK' : '未找到输入框')
    await evaluate(`(() => {
      const btn = document.querySelector('button.auth-submit');
      if (btn) btn.click();
      return Boolean(btn);
    })()`)
    await waitFor(`location.href.includes('/user-center-ops/') || document.body.innerText.includes('用户中心')`,
      30000, '登录回跳运营端')
    await sleep(1500)
    console.log('  登录后地址:', await evaluate('location.href'))
  } else {
    console.log('=== 2. 已存在会话，跳过登录 ===')
  }

  console.log('=== 3. 等待运营端渲染 ===')
  await waitFor(`document.body.innerText.includes('用户中心')`, 30000, '运营端标题出现')
  console.log('  当前标题:', await evaluate('document.title'))
  console.log('  侧栏菜单数:', await evaluate(`document.querySelectorAll('.sidebar-group button').length`))

  const shots = []
  const pages = [
    ['dashboard', '#/dashboard', '运营总览'],
    ['user-list', '#/user-list', '用户列表'],
    ['user-identity', '#/user-identity', '身份管理'],
    ['identity-audit', '#/identity-audit', '身份申请审核'],
    ['realname-audit', '#/realname-audit', '实名认证审核'],
    ['qualification-audit', '#/qualification-audit', '资质审核'],
    ['org-list', '#/org-list', '组织列表'],
    ['org-audit', '#/org-audit', '组织认证审核'],
    ['role-list', '#/role-list', '角色管理'],
    ['perm-matrix', '#/perm-matrix', '权限矩阵'],
    ['auth-app', '#/auth-app', '第三方应用'],
    ['auth-record', '#/auth-record', '授权记录'],
    ['message-push', '#/message-push', '消息推送'],
    ['message-template', '#/message-template', '消息模板'],
    ['security-risk', '#/security-risk', '安全风险监控'],
    ['device-log', '#/device-log', '设备与登录日志'],
    ['account-freeze', '#/account-freeze', '账号冻结与解封'],
    ['privacy-request', '#/privacy-request', '隐私请求处理'],
    ['feedback-manage', '#/feedback-manage', '反馈处理'],
    ['stats', '#/stats', '用户统计分析'],
    ['config', '#/config', '参数配置'],
    ['audit-log', '#/audit-log', '操作审计'],
  ]

  for (const [name, hash, label] of pages) {
    await goto(hash)
    await sleep(900)
    const info = await evaluate(`(() => {
      const h1 = document.querySelector('.page-title-row h1');
      const body = document.body.innerText;
      return {
        title: h1 ? h1.textContent.trim() : '(无标题)',
        rows: document.querySelectorAll('.ant-table-tbody > tr.ant-table-row').length,
        empty: body.includes('数据暂时未加载'),
        blank: body.includes('正在加载'),
        chars: body.length,
      };
    })()`)
    shots.push(await shot(`uc-${name}`))
    console.log(
      `  ${label.padEnd(12, ' ')} h1=${(info.title || '').padEnd(12, ' ')} 行数=${String(info.rows).padEnd(3, ' ')}`
      + ` ${info.empty ? '❌加载失败' : ''}${info.blank ? '(仍在加载)' : ''}`,
    )
  }

  // 详情页：从用户列表点第一条进详情
  console.log('=== 4. 详情页 ===')
  await goto('#/user-list')
  await sleep(1200)
  const detailOpened = await evaluate(`(() => {
    const link = Array.from(document.querySelectorAll('.ant-table-tbody a, .ant-table-tbody button'))
      .find((el) => el.textContent.trim() === '详情');
    if (link) { link.click(); return true; }
    return false;
  })()`)
  await sleep(1500)
  if (detailOpened) {
    const hash = await evaluate('location.hash')
    const info = await evaluate(`(() => ({
      title: document.querySelector('.uc-detail-title')?.textContent?.trim() ?? '(无)',
      sub: document.querySelector('.uc-detail-sub')?.textContent?.trim()?.slice(0, 60) ?? '',
    }))()`)
    console.log('  用户详情 hash:', hash, '| 标题:', info.title)
    shots.push(await shot('uc-user-detail'))
  } else {
    console.log('  ❌ 未找到详情入口')
  }

  console.log('=== 5. 控制台异常 ===')
  console.log('  console.error:', consoleErrors.length)
  consoleErrors.slice(0, 5).forEach((item) => console.log('   ·', item))
  console.log('  未捕获异常:', pageErrors.length)
  pageErrors.slice(0, 5).forEach((item) => console.log('   ·', item))
  console.log('=== 截图 ===')
  console.log('  ' + shots.join(', '))
}

main()
  .catch((error) => {
    console.error('E2E 失败:', error.message)
    process.exitCode = 1
  })
  .finally(() => {
    try { ws?.close() } catch { /* 忽略 */ }
    edge.kill()
  })

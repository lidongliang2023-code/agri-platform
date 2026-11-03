#!/usr/bin/env node
/**
 * 主数据运营端 · 页面回归（2026-10-29 重构）。
 *
 * 真实 SSO 登录 admin，逐页打开新信息架构与新增页面，断言：
 *   1. 页面标题渲染（路由 / 菜单 / 视图三者对得上）；
 *   2. 关键区域有真实内容或明确空态（不是白屏）；
 *   3. 无新增控制台错误 / 未捕获异常。
 *
 * 依赖：Edge headless + CDP（Node 内置 WebSocket），不引入 puppeteer。
 * 运行：node scripts/e2e-mdm-ops-pages.mjs
 */
import { execFileSync, spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const PORT = 9346
const PROFILE = 'C:/Users/71502/AppData/Local/Temp/edge-mdm-ops'
const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'outputs', 'mdm-ops-20261029')
const BASE = 'http://localhost:8080'

mkdirSync(OUT, { recursive: true })

/**
 * 只用于清掉本脚本自造的测试角色。
 *
 * 删除接口是逻辑删（del_flag=1），页面看不见但行一直在 —— 每跑一次回归就多一条。
 * 脚本自造的东西要清到零残留，所以这里按 role_code 物理删，不碰任何业务角色。
 */
const MYSQL = 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe'
const sql = (query) => {
  try {
    return execFileSync(MYSQL, ['-uroot', '-proot', '--default-character-set=utf8mb4', '-N', '-B', '-e', query],
      { encoding: 'utf8' }).trim()
  } catch {
    return 'ERR'
  }
}

const edge = spawn(
  EDGE,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1440,960',
    'about:blank',
  ],
  { stdio: 'ignore', detached: false },
)

let ws
let nextId = 1
const pending = new Map()
const consoleErrors = []
const pageErrors = []
const failures = []

const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

function send(method, params = {}) {
  const id = nextId++
  ws.send(JSON.stringify({ id, method, params }))
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
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) {
    throw new Error(`页面执行异常：${result.exceptionDetails.text}`)
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
    await sleep(300)
  }
  throw new Error(`等待超时：${label}`)
}

async function goto(url) {
  await send('Page.navigate', { url })
  await sleep(900)
}

async function shot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(data, 'base64'))
}

const PAGES = [
  { path: '/dashboard', title: '运营大盘', shot: '01-dashboard' },
  { path: '/subject/audit', title: '入驻与生命周期', shot: '02-subject-audit' },
  { path: '/subject/create', title: '开通配置', shot: '03-subject-create' },
  { path: '/permission/matrix', title: '角色权限矩阵', shot: '04-role-matrix' },
  { path: '/permission/anomaly', title: '异常权限检测', shot: '05-permission-anomaly' },
  { path: '/product/template', title: '属性模板与 SKU', shot: '06-product-template' },
  { path: '/product/spu-audit', title: '商品（SPU）准入审核', shot: '06b-spu-audit' },
  { path: '/customer/blacklist', title: '黑名单管理', shot: '07-customer-blacklist' },
  { path: '/datastandard/metadata', title: '标准与元数据', shot: '08-data-metadata' },
  { path: '/datastandard/dict', title: '数据字典', shot: '08b-data-dict' },
  { path: '/datastandard/code-rule', title: '编码规则管理', shot: '08c-code-rule' },
  { path: '/permission/log', title: '操作审计', shot: '08d-operation-audit' },
  { path: '/quality/dashboard', title: '质量稽核', shot: '08e-quality-dashboard' },
  { path: '/quality/list', title: '质量监控', shot: '08e2-quality-list' },
  { path: '/quality/issue', title: '问题治理与合并', shot: '08f-quality-issue' },
  { path: '/quality/rule', title: '质量规则', shot: '08g-quality-rule' },
  { path: '/quality/task', title: '检测任务', shot: '08h-quality-task' },
  { path: '/system/params', title: '参数配置', shot: '10a-system-params' },
  { path: '/system/template', title: '通知模板', shot: '10b-notification-template' },
  { path: '/system/announcement', title: '公告管理', shot: '10c-announcement' },
  { path: '/system/region', title: '行政区划', shot: '10d-region' },
  { path: '/system/ops-accounts', title: '运营账号与角色', shot: '09-ops-accounts' },
  { path: '/masterdata/boundary', title: '模块边界与协同说明', shot: '10-module-boundary' },
  { path: '/subject/list', title: '租户列表', shot: '11-legacy-subject-list' },
  { path: '/org/list', title: '全平台组织', shot: '12-org-list' },
  { path: '/product/list', title: '官网上架商品', shot: '13-legacy-product-list' },
  { path: '/customer/list', title: '客户主数据', shot: '14-customer-list' },
  { path: '/supplier/list', title: '供应商主数据', shot: '15-supplier-list' },
  { path: '/user/list', title: '全平台用户', shot: '16-user-list' },
  { path: '/user/audit', title: '认证审核', shot: '17-user-audit' },
  { path: '/uc/overview', title: '用户中心总览', shot: '18-uc-overview' },
  { path: '/uc/identity', title: '身份管理', shot: '19-uc-identity' },
  { path: '/uc/identity-audit', title: '身份申请审核', shot: '20-uc-identity-audit' },
  { path: '/uc/certification', title: '资质审核', shot: '21-uc-certification' },
  { path: '/uc/feedback', title: '意见反馈处理', shot: '22-uc-feedback' },
  { path: '/uc/privacy', title: '隐私与数据申请', shot: '23-uc-privacy' },
  { path: '/user/workbench', title: '企业工作台', shot: '24-user-workbench' },
  { path: '/user/identity', title: '我的身份', shot: '25-user-identity' },
  { path: '/user/realname', title: '实名认证', shot: '26-user-realname' },
  { path: '/user/qualification', title: '资质证照', shot: '27-user-qualification' },
  { path: '/user/profile', title: '资料与安全', shot: '28-user-profile' },
  { path: '/user/messages', title: '消息通知', shot: '29-user-messages' },
  { path: '/user/boundary', title: '模块边界', shot: '30-user-boundary' },
  { path: '/user/org-tree', title: '组织架构', shot: '31-user-org-tree' },
  { path: '/user/members', title: '成员账号', shot: '32-user-members' },
  { path: '/user/products', title: '商品 SPU 与 SKU', shot: '33-user-products' },
  { path: '/user/customers', title: '客户档案', shot: '34-user-customers' },
  { path: '/user/suppliers', title: '供应商档案', shot: '35-user-suppliers' },
  { path: '/user/dept', title: '部门与岗位', shot: '36-user-dept' },
  { path: '/user/invite', title: '成员邀请与审批', shot: '37-user-invite' },
  { path: '/user/roles', title: '角色与权限', shot: '38-user-roles' },
  { path: '/user/categories', title: '我的品类', shot: '39-user-categories' },
  { path: '/user/attr-templates', title: '属性模板', shot: '40-user-attr' },
  { path: '/user/partner-graph', title: '伙伴关系图', shot: '41-user-partner' },
  { path: '/user/tenant', title: '租户与套餐', shot: '42-user-tenant' },
  { path: '/user/operation-log', title: '操作记录', shot: '43-user-log' },

]

async function login() {
  await goto(`${BASE}/dashboard`)
  await waitFor(`location.href.includes('8080') || location.href.includes('8090')`, 30000, '首次跳转')
  if ((await evaluate('location.href')).includes('8090')) {
    await waitFor(`document.body.innerText.includes('统一认证中心')`, 30000, '统一认证登录页')
    await evaluate(`(() => {
      const tab = [...document.querySelectorAll('button[role="tab"]')].find((el) => (el.textContent || '').includes('账号 + 密码'));
      tab?.click();
      return true;
    })()`)
    await sleep(400)
    await waitFor(`document.querySelector('input[autocomplete="username"]') !== null`, 15000, '账号密码表单')
    await evaluate(`(() => {
      const set = (el, value) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      set(document.querySelector('input[autocomplete="username"]'), 'admin');
      set(document.querySelector('input[type="password"]'), 'Admin@123');
      const submit = document.querySelector('.auth-submit') || [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('登'));
      submit?.click();
      return true;
    })()`)
    await waitFor(`location.href.includes('8080')`, 40000, '登录后回跳')
  }
  await waitFor(`document.querySelector('.content-wrapper, .user-content') !== null`, 30000, '运营端渲染').catch(async () => {
    // Edge 复用 profile 时偶发首次导航没落到回跳地址：再导航一次即可（实测第二次必成功）
    await goto(`${BASE}/dashboard`)
    await waitFor(`document.querySelector('.content-wrapper, .user-content') !== null`, 30000, '运营端渲染（重试）')
  })
}

async function verifySpuAuditLoop() {
  // 接口层闭环：改 → 回读 → 还原。页面只能证明"看得见"，不能证明"写得进"。
  const loginResponse = await fetch('http://127.0.0.1:8093/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Admin@123' }),
  })
  const loginBody = await loginResponse.json()
  const token = loginBody?.data?.accessToken
  if (!token) {
    check(false, 'SPU 审核：拿到平台令牌', JSON.stringify(loginBody).slice(0, 120))
    return
  }
  const headers = { Authorization: `Bearer ${token}` }
  const base = `${BASE}/admin/masterdata/product`

  const listResponse = await fetch(`${base}/list?pageNum=1&pageSize=1&auditStatus=PENDING`, { headers })
  const listBody = await listResponse.json()
  const target = listBody?.data?.list?.[0]
  if (!target) {
    console.log('  跳过：没有待审 SPU 可作为写接口样本')
    return
  }
  const originalStatus = target.auditStatus || 'PENDING'

  const readStatus = async () => {
    const response = await fetch(`${base}/detail/${target.id}`, { headers })
    const body = await response.json()
    return body?.data?.auditStatus
  }

  const putStatus = async (status) => {
    const response = await fetch(`${base}/${target.id}/audit?auditStatus=${status}`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
    return response.json()
  }

  const rejected = await putStatus('REJECTED')
  check(rejected.code === 200 && (await readStatus()) === 'REJECTED', 'SPU 审核：驳回后回读一致', `SPU ${target.productCode}`)
  const approved = await putStatus('APPROVED')
  check(approved.code === 200 && (await readStatus()) === 'APPROVED', 'SPU 审核：通过后回读一致')
  const restored = await putStatus(originalStatus)
  check(restored.code === 200 && (await readStatus()) === originalStatus, 'SPU 审核：还原为原始状态', originalStatus)
}

async function verifyCustomerWriteLoop() {
  const token = await loginToken()
  if (!token) return
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const code = `E2E${Date.now()}`
  const base = `${BASE}/admin/masterdata/customer`

  const created = await (
    await fetch(base, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        customerCode: code,
        customerName: '回归测试客户',
        customerType: 'enterprise',
        level: 'C',
        contactName: '回归联系人',
        contactPhone: '13800009999',
        status: 1,
      }),
    })
  ).json()
  const list = await (await fetch(`${base}/list?pageNum=1&pageSize=5&keyword=${code}`, { headers })).json()
  const row = list?.data?.list?.find((item) => item.customerCode === code)
  check(created.code === 200 && Boolean(row), '客户：新增后列表可见', code)
  if (!row) return
  check(row.contactName === '回归联系人', '客户：联系人落库（contact_name）', String(row.contactName))

  await fetch(`${base}/${row.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ contactName: '回归联系人改' }),
  })
  const detail = await (await fetch(`${base}/detail/${row.id}`, { headers })).json()
  check(detail?.data?.contactName === '回归联系人改', '客户：编辑后回读一致')

  await fetch(`${base}/${row.id}`, { method: 'PUT', headers, body: JSON.stringify({ status: 0 }) })
  const disabled = await (await fetch(`${base}/detail/${row.id}`, { headers })).json()
  check(Number(disabled?.data?.status) === 0, '客户：禁用后回读一致（status 真的落库）', String(disabled?.data?.status))

  await fetch(`${base}/${row.id}`, { method: 'DELETE', headers })
  const after = await (await fetch(`${base}/list?pageNum=1&pageSize=5&keyword=${code}`, { headers })).json()
  check(!(after?.data?.list ?? []).some((item) => item.customerCode === code), '客户：删除后列表不再出现')
}

async function verifySupplierWriteLoop() {
  const token = await loginToken()
  if (!token) return
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const code = `E2ES${Date.now()}`
  const base = `${BASE}/admin/masterdata/customer/supplier`

  const created = await (
    await fetch(base, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        supplierCode: code,
        supplierName: '回归测试供应商',
        supplierType: 'manufacturer',
        level: 'C',
        contactPerson: '回归供应商联系人',
        contactPhone: '13800008888',
        status: 1,
      }),
    })
  ).json()
  const list = await (await fetch(`${base}/list?pageNum=1&pageSize=5&keyword=${code}`, { headers })).json()
  const row = list?.data?.list?.find((item) => item.supplierCode === code)
  check(created.code === 200 && Boolean(row), '供应商：新增后列表可见', code)
  if (!row) return
  check(row.contactPerson === '回归供应商联系人', '供应商：联系人落库（contact_person）', String(row.contactPerson))

  await fetch(`${base}/${row.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ contactPerson: '回归供应商联系人改' }),
  })
  const detail = await (await fetch(`${base}/detail/${row.id}`, { headers })).json()
  check(detail?.data?.contactPerson === '回归供应商联系人改', '供应商：编辑后回读一致')

  await fetch(`${base}/${row.id}`, { method: 'PUT', headers, body: JSON.stringify({ status: 0 }) })
  const disabled = await (await fetch(`${base}/detail/${row.id}`, { headers })).json()
  check(Number(disabled?.data?.status) === 0, '供应商：禁用后回读一致（status 真的落库）', String(disabled?.data?.status))

  await fetch(`${base}/${row.id}`, { method: 'DELETE', headers })
  const after = await (await fetch(`${base}/list?pageNum=1&pageSize=5&keyword=${code}`, { headers })).json()
  check(!(after?.data?.list ?? []).some((item) => item.supplierCode === code), '供应商：删除后列表不再出现')
}

async function verifyDictWriteLoop() {
  const token = await loginToken()
  if (!token) return
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const code = `E2ED${Date.now()}`
  const base = `${BASE}/admin/masterdata/standard/dict`

  const created = await (
    await fetch(base, {
      method: 'POST',
      headers,
      body: JSON.stringify({ dictCode: code, dictName: '回归测试字典', dictType: 'platform', status: 1 }),
    })
  ).json()
  const list = await (await fetch(`${base}/list?pageNum=1&pageSize=5&keyword=${code}`, { headers })).json()
  const row = list?.data?.list?.find((item) => item.dictCode === code)
  check(created.code === 200 && Boolean(row), '字典：新增后列表可见', code)
  if (!row) return
  check(Number(row.status) === 1, '字典：新建默认启用（status=1）', String(row.status))

  await fetch(`${base}/${row.id}/item`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ itemName: '回归项', itemValue: 'E2E_VALUE', itemSort: 1, status: 1 }),
  })
  const detail = await (await fetch(`${base}/${row.id}`, { headers })).json()
  const item = (detail?.data?.items ?? []).find((entry) => entry.itemValue === 'E2E_VALUE')
  check(Boolean(item), '字典项：新增后回读可见')
  if (item) {
    await fetch(`${base}/item/${item.id}`, { method: 'DELETE', headers })
  }
  await fetch(`${base}/${row.id}`, { method: 'DELETE', headers })
  const after = await (await fetch(`${base}/list?pageNum=1&pageSize=5&keyword=${code}`, { headers })).json()
  check(!(after?.data?.list ?? []).some((entry) => entry.dictCode === code), '字典：删除后列表不再出现')

  // 删除接口是逻辑删：页面看不见，但每跑一次回归就多一行。字典与字典项都按前缀物理清掉。
  sql(`DELETE FROM agri_masterdata.agri_md_dict_item WHERE dict_code LIKE 'E2ED%'`)
  sql(`DELETE FROM agri_masterdata.agri_md_dict WHERE dict_code LIKE 'E2ED%'`)
  const residueDict = sql(`SELECT COUNT(*) FROM agri_masterdata.agri_md_dict WHERE dict_code LIKE 'E2ED%'`)
  check(residueDict === '0', '清理：E2ED* 回归字典（含历史逻辑删的行）已物理清空', `rows=${residueDict}`)
}

async function verifyCodeRuleTest() {
  const token = await loginToken()
  if (!token) return
  const headers = { Authorization: `Bearer ${token}` }
  const base = `${BASE}/admin/masterdata/standard/code-rule`
  const list = await (await fetch(`${base}/list?pageNum=1&pageSize=50`, { headers })).json()
  const rules = list?.data?.list ?? []
  const autoRule = rules.find((rule) => rule.ruleType === 'auto')
  const manualRule = rules.find((rule) => rule.ruleType === 'manual')

  if (autoRule) {
    const tested = await (
      await fetch(`${base}/${autoRule.id}/test`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' } })
    ).json()
    const sample = String(tested?.data ?? '')
    check(tested.code === 200 && sample.length > 0, '编码规则：自动规则试算返回样例', `${autoRule.ruleCode} → ${sample}`)
  } else {
    console.log('  跳过：没有自动生成规则可试算')
  }

  if (manualRule) {
    const tested = await (
      await fetch(`${base}/${manualRule.id}/test`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' } })
    ).json()
    check(tested.code !== 200 && tested.code !== 500, '编码规则：手工规则试算被明确拒绝（不 500）', `${manualRule.ruleCode} → code ${tested.code}`)
  }
}

async function verifyDataStandardLoop() {
  const token = await loginToken()
  if (!token) return
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const base = `${BASE}/admin/masterdata/standard`
  const code = `FMT_E2E_${Date.now()}`

  const created = await (
    await fetch(`${base}/format`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ formatCode: code, formatName: 'E2E 手机号格式', dataType: 'string', maxLength: 11 }),
    })
  ).json()
  const listFormats = async () => (await fetch(`${base}/format/list`, { headers })).json()
  const findFormat = async () => ((await listFormats())?.data ?? []).find((item) => item.formatCode === code)
  const draft = await findFormat()
  check(created.code === 200 && draft?.status === 'DRAFT', '格式标准：新建为草稿', String(draft?.status))
  if (!draft) return

  await fetch(`${base}/format/${draft.id}/status?status=PUBLISHED`, { method: 'PUT', headers })
  const published = await findFormat()
  check(published?.status === 'PUBLISHED', '格式标准：发布后回读一致', String(published?.status))

  const change = await (
    await fetch(`${base}/change-approve`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        targetType: 'format',
        targetId: String(draft.id),
        targetName: 'E2E 手机号格式',
        changeType: 'UPDATE',
        beforeValue: 'maxLength=11',
        afterValue: 'maxLength=20',
      }),
    })
  ).json()
  const listChanges = async (status) =>
    (await fetch(`${base}/change-approve?pageNum=1&pageSize=10&status=${status}`, { headers })).json()
  const pending = ((await listChanges('PENDING'))?.data?.list ?? []).find((item) => item.id === change.data)
  check(change.code === 200 && Boolean(pending), '标准变更：提交后进入待审列表')

  await fetch(`${base}/change-approve/${change.data}?status=APPROVED&remark=${encodeURIComponent('E2E 同意')}`, {
    method: 'PUT',
    headers,
  })
  const approved = ((await listChanges('APPROVED'))?.data?.list ?? []).find((item) => item.id === change.data)
  check(approved?.status === 'APPROVED', '标准变更：通过后回读一致', String(approved?.status))

  const metaName = `E2E元数据${Date.now()}`
  const meta = await (
    await fetch(`${base}/metadata`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        metadataType: 'TECHNICAL',
        name: metaName,
        nameEn: 'e2e_field',
        domainName: '用户主数据',
        dataType: 'varchar(32)',
        required: '是',
      }),
    })
  ).json()
  const metaList = await (await fetch(`${base}/metadata?keyword=${encodeURIComponent(metaName)}`, { headers })).json()
  const metaRow = (metaList?.data ?? []).find((item) => item.name === metaName)
  check(meta.code === 200 && Boolean(metaRow), '元数据目录：新增后可按关键字查到')
}

async function verifyBlacklistLoop() {
  const token = await loginToken()
  if (!token) return
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const base = `${BASE}/admin/masterdata/blacklist`
  const name = `E2E回归客户${Date.now()}`

  const created = await (
    await fetch(base, {
      method: 'POST',
      headers,
      body: JSON.stringify({ targetType: 'customer', targetName: name, reason: '资料造假', evidence: '自动化回归' }),
    })
  ).json()
  const listActive = await (await fetch(`${base}?pageNum=1&pageSize=5&status=active&keyword=${encodeURIComponent(name)}`, { headers })).json()
  const row = (listActive?.data?.list ?? []).find((item) => item.targetName === name)
  check(created.code === 200 && Boolean(row), '黑名单：新增后出现在生效列表', name)

  if (!row) return
  await fetch(`${base}/${row.id}/release?reason=${encodeURIComponent('E2E 回归解除')}`, { method: 'PUT', headers })
  const listReleased = await (await fetch(`${base}?pageNum=1&pageSize=5&status=released&keyword=${encodeURIComponent(name)}`, { headers })).json()
  const released = (listReleased?.data?.list ?? []).find((item) => item.id === row.id)
  check(released?.status === 'released', '黑名单：解除后状态回读一致', String(released?.status))
}

async function verifyAnnouncementLoop() {
  const token = await loginToken()
  if (!token) return
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const base = `${BASE}/admin/masterdata/announcement`
  const title = `E2E回归公告${Date.now()}`

  const created = await (
    await fetch(base, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title, type: 'info', content: '自动化回归公告正文', publishNow: false }),
    })
  ).json()
  const find = async () => {
    const list = await (await fetch(`${base}?pageNum=1&pageSize=5&keyword=${encodeURIComponent(title)}`, { headers })).json()
    return (list?.data?.list ?? []).find((item) => item.title === title)
  }
  const draft = await find()
  check(created.code === 200 && draft?.status === 'draft', '公告：新建默认为草稿', String(draft?.status))
  if (!draft) return

  await fetch(`${base}/${draft.id}/publish`, { method: 'PUT', headers })
  const published = await find()
  check(published?.status === 'published' && Boolean(published?.publishTime), '公告：发布后记录发布时间', String(published?.status))

  const userView = await (
    await fetch(`${BASE}/api/user/announcements?limit=10`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Agri-Merchant': '2001' },
    })
  ).json()
  const visible = Array.isArray(userView?.data) && userView.data.some((item) => item.title === title)
  check(visible, '公告：企业端能读到已发布公告')

  await fetch(`${base}/${draft.id}/offline`, { method: 'PUT', headers })
  const offline = await find()
  check(offline?.status === 'offline', '公告：下线后状态回读一致', String(offline?.status))
}

async function verifyMerchantContext() {
  const token = await loginToken()
  if (!token) return
  const base = BASE
  const call = async (path, merchant) => {
    const headers = { Authorization: `Bearer ${token}` }
    if (merchant) headers['X-Agri-Merchant'] = merchant
    const response = await fetch(`${base}${path}`, { headers })
    return response.json()
  }

  const ok = await call('/api/user/context', '2001')
  check(ok.code === 200 && String(ok.data?.merchantId) === '2001', '主体上下文：合法主体被接受', String(ok.data?.merchantId))

  const missing = await call('/api/user/context')
  check(missing.code === 3002, '主体上下文：缺少请求头被拒绝', `code ${missing.code}`)

  const foreign = await call('/api/user/context', '9999')
  check(foreign.code === 3002, '主体上下文：不属于该主体被拒绝', `code ${foreign.code}`)

  const customerNoHeader = await call('/api/customer/list')
  check(customerNoHeader.code === 3002, '客户列表：无主体上下文不返回全量', `code ${customerNoHeader.code}`)

  const foreignOrg = await call('/api/user/depts?orgId=1701', '2001')
  check(foreignOrg.code === 3002, '部门列表：别家组织 id 被拒绝', `code ${foreignOrg.code}`)

  const customerScoped = await call('/api/customer/list', '2001')
  const scopedList = Array.isArray(customerScoped.data) ? customerScoped.data : []
  const onlyOwn = scopedList.length > 0 && scopedList.every((row) => String(row.customerCode || '').startsWith('CUS2001-'))
  check(customerScoped.code === 200 && onlyOwn, '客户列表：只返回本主体客户', `${scopedList.length} 条`)
}

async function verifyQualityRuleLoop() {
  const token = await loginToken()
  if (!token) return
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const code = `E2EQ${Date.now()}`
  const base = `${BASE}/admin/masterdata/quality/rules`

  const created = await (
    await fetch(base, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ruleCode: code,
        ruleName: '回归测试规则',
        ruleType: 'completeness',
        targetTable: 'user_master',
        targetField: 'phone',
        expression: '^1[3-9]\\d{9}$',
        threshold: 95,
        status: 1,
      }),
    })
  ).json()
  const list = async () => (await fetch(base, { headers })).json()
  const find = async () => ((await list())?.data ?? []).find((item) => item.ruleCode === code)

  const row = await find()
  check(created.code === 200 && Boolean(row), '质量规则：新增后列表可见', code)
  if (!row) return
  check(Number(row.status) === 1, '质量规则：新建默认启用', String(row.status))

  await fetch(`${base}/${row.id}`, { method: 'PUT', headers, body: JSON.stringify({ status: 0 }) })
  const disabled = await find()
  check(Number(disabled?.status) === 0, '质量规则：停用后回读一致', String(disabled?.status))

  await fetch(`${base}/${row.id}`, { method: 'DELETE', headers })
  check(!(await find()), '质量规则：删除后列表不再出现')
}

async function verifyRolePermissionLoop() {
  const token = await loginToken()
  if (!token) return
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const base = `${BASE}/admin/masterdata/permission`

  const tree = await (await fetch(`${BASE}/api/system/menu/tree`, { headers })).json()
  const groups = tree?.data ?? []
  const childCount = groups.reduce((sum, group) => sum + (group.children?.length ?? 0), 0)
  check(tree.code === 200 && groups.length >= 9, '权限点目录：至少 9 个分组', `${groups.length} 组`)
  check(childCount >= 40, '权限点目录：页面级权限点 ≥ 40', `${childCount} 个`)
  if (!childCount) return

  // id 必须按字符串用：18 位雪花值转 Number 会丢精度，提交后会变成"不存在的权限点"。
  const ids = groups.flatMap((group) => (group.children ?? []).map((child) => String(child.id))).slice(0, 2)
  const code = `E2EP${Date.now()}`
  const created = await (
    await fetch(`${base}/role`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        roleName: '权限点回归临时角色',
        roleCode: code,
        roleKey: code.toLowerCase(),
        roleSort: 99,
        status: 1,
        dataScope: 'ALL',
      }),
    })
  ).json()
  const roleId = created?.data
  check(created.code === 200 && Boolean(roleId), '角色授权：创建临时角色', code)
  if (!roleId) return

  const assign = await (
    await fetch(`${base}/role/${roleId}/menus`, { method: 'PUT', headers, body: JSON.stringify(ids) })
  ).json()
  const detail = await (await fetch(`${base}/role/${roleId}`, { headers })).json()
  const readIds = (detail?.data?.menuIds ?? []).map(String)
  check(assign.code === 200 && assign.data === 2, '角色授权：提交 2 个权限点', String(assign.data))
  check(readIds.length === 2 && ids.every((id) => readIds.includes(id)), '角色授权：回读与提交一致', `${readIds.length} 个`)
  check(Number(detail?.data?.menuCount) === 2, '角色授权：menuCount 同步', String(detail?.data?.menuCount))

  const bad = await (
    await fetch(`${base}/role/${roleId}/menus`, { method: 'PUT', headers, body: JSON.stringify(['1', '2']) })
  ).json()
  check(bad.code !== 200, '角色授权：不存在的权限点被拒绝', bad.message)

  const cleared = await (
    await fetch(`${base}/role/${roleId}/menus`, { method: 'PUT', headers, body: JSON.stringify([]) })
  ).json()
  const afterDetail = await (await fetch(`${base}/role/${roleId}`, { headers })).json()
  check(cleared.code === 200 && (afterDetail?.data?.menuIds ?? []).length === 0, '角色授权：清空后回读为 0')

  await fetch(`${base}/role/${roleId}`, { method: 'DELETE', headers })
  const gone = await (await fetch(`${base}/role/${roleId}`, { headers })).json()
  check(gone.code !== 200, '角色授权：临时角色已删除')

  // 逻辑删不等于没留东西：按本次的 role_code 物理清掉，并断言库里真的没有 E2E 测试角色
  sql(`DELETE FROM agri_masterdata.agri_md_role_menu WHERE role_id = ${roleId}`)
  sql(`DELETE FROM agri_masterdata.agri_md_role_permission WHERE role_id = ${roleId}`)
  sql(`DELETE FROM agri_masterdata.agri_md_role WHERE role_code = '${code}'`)
  const residue = sql(`SELECT COUNT(*) FROM agri_masterdata.agri_md_role WHERE role_code LIKE 'E2E%'`)
  check(residue === '0', '清理：库内没有 E2E* 测试角色残留（逻辑删的行也一并物理清掉）', `rows=${residue}`)
}

async function loginToken() {
  const response = await fetch('http://127.0.0.1:8093/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Admin@123' }),
  })
  const body = await response.json()
  const token = body?.data?.accessToken
  if (!token) {
    check(false, '拿到平台令牌', JSON.stringify(body).slice(0, 120))
    return ''
  }
  return token
}

async function main() {
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
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) reject(new Error(`${message.error.message} (${message.error.code})`))
      else resolve(message.result)
      return
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      consoleErrors.push(message.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300))
    }
    if (message.method === 'Runtime.exceptionThrown') {
      pageErrors.push(
        String(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text).slice(0, 300),
      )
    }
  }

  await send('Page.enable')
  await send('Runtime.enable')

  console.log('=== 1. 统一认证登录 ===')
  await login()
  check((await evaluate('location.href')).includes('8080'), '登录后回到主数据运营端', await evaluate('location.href'))
  const navGroups = await evaluate(`document.querySelectorAll('.nav-group').length`)
  check(navGroups === 9, '侧栏分组数 = 9', `${navGroups} 组`)
  const navErrorCount = consoleErrors.length
  check(navErrorCount === 0, '登录与首屏无控制台错误', `${navErrorCount} 条`)

  console.log('\n=== 2. 逐页回归 ===')
  for (const item of PAGES) {
    const beforeConsole = consoleErrors.length
    const beforePage = pageErrors.length
    await goto(`${BASE}${item.path}`)
    let title = ''
    try {
      await waitFor(`document.querySelector('.content-wrapper, .user-content') !== null`, 25000, `${item.path} 渲染`)
      await waitFor(
        `document.querySelectorAll('.mds-card, .mds-stat-grid, .mds-table tbody tr, .data-table tbody tr, .mds-empty, .mds-notice, .empty-cell').length > 0`,
        15000,
        `${item.path} 数据区`,
      )
      title = await evaluate(
        `document.querySelector('.mds-page-title, .page-header h1')?.textContent?.trim() ?? ''`,
      )
    } catch (error) {
      title = `加载失败：${error.message}`
    }
    await sleep(600)
    const bodyText = await evaluate(`document.querySelector('.content-wrapper, .user-content')?.innerText ?? ''`)
    check(title === item.title, `${item.path} 标题`, title)
    check(bodyText.length > 120, `${item.path} 有实际内容`, `${bodyText.length} 字符`)
    const newConsole = consoleErrors.length - beforeConsole
    check(newConsole === 0, `${item.path} 无控制台错误`, `+${newConsole}`)
    check(pageErrors.length === beforePage, `${item.path} 无未捕获异常`, `+${pageErrors.length - beforePage}`)
    await shot(item.shot)
  }

  console.log('\n=== 3. 关键数据断言 ===')
  await goto(`${BASE}/product/template`)
  await waitFor(`document.querySelector('.mds-tree__node') !== null`, 20000, '品类树')
  const categoryCount = await evaluate(`document.querySelectorAll('.mds-tree__node').length`)
  check(categoryCount > 0, '属性模板页读到真实品类', `${categoryCount} 个`)

  await goto(`${BASE}/system/ops-accounts`)
  await waitFor(`document.querySelector('.mds-table tbody tr') !== null`, 20000, '账号列表')
  const opsRows = await evaluate(`document.querySelectorAll('.mds-table tbody tr').length`)
  check(opsRows > 0, '运营账号页读到真实账号', `${opsRows} 行`)

  await goto(`${BASE}/subject/audit`)
  await waitFor(`document.querySelector('.mds-table tbody tr') !== null`, 20000, '主体列表')
  const auditRows = await evaluate(`document.querySelectorAll('.mds-table tbody tr').length`)
  check(auditRows > 0, '入驻与生命周期页有真实主体行', `${auditRows} 行`)

  console.log('\n=== 4. SPU 审核写接口（改后回读，最后还原）===')
  await verifySpuAuditLoop()

  console.log('\n=== 5. 客商写接口（新增 → 回读 → 编辑 → 删除）===')
  await verifyCustomerWriteLoop()
  await verifySupplierWriteLoop()

  console.log('\n=== 6. 字典与编码规则 ===')
  await verifyDictWriteLoop()
  await verifyCodeRuleTest()

  console.log('\n=== 7. 质量规则写接口（新增 → 停用回读 → 删除）===')
  await verifyQualityRuleLoop()

  console.log('\n=== 10. 数据标准（格式 / 变更 / 元数据）===')
  await verifyDataStandardLoop()

  console.log('\n=== 9. 黑名单与公告（新增 → 状态流转）===')
  await verifyBlacklistLoop()
  await verifyAnnouncementLoop()

  console.log('\n=== 8. 企业端主体上下文（隔离校验）===')
  await verifyMerchantContext()

  console.log('\n=== 11. 角色权限点（目录 → 授权 → 回读 → 撤销 → 删除）===')
  await verifyRolePermissionLoop()

  console.log('\n=== 汇总 ===')
  console.log('  截图目录:', OUT)
  console.log('  控制台错误总数:', consoleErrors.length)
  consoleErrors.slice(0, 6).forEach((text) => console.log('   ·', text))
  console.log('  未捕获异常总数:', pageErrors.length)
  pageErrors.slice(0, 6).forEach((text) => console.log('   ·', text))
}

try {
  await main()
} catch (error) {
  console.error('E2E 失败:', error.message)
  process.exitCode = 1
} finally {
  try {
    ws?.close()
  } catch {
    // 忽略
  }
  edge.kill()
}

if (failures.length) {
  console.log(`\n失败 ${failures.length} 项：`)
  failures.forEach((item) => console.log(' -', item))
  process.exitCode = 1
} else if (!process.exitCode) {
  console.log('\n全部通过')
}

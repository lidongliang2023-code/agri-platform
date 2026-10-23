#!/usr/bin/env node
/** 卖家保证金账户开立、审核、补缴、流水和权限闭环回归。 */
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require2 = createRequire(path.join(ROOT, 'agri-production/frontend/package.json'))
const puppeteer = require2('puppeteer')
const BASE = 'http://localhost:8086'
const CORE = 'http://localhost:8093'
const OUT = 'C:/Users/71502/.codex/visualizations/2026/10/16/01a14244-ead8-7ab0-8c7c-df7abac44648'
const MYSQL = 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe'
const marker = `GUARANTEE-E2E-${Date.now()}`
const failures = []
let guaranteeId = null
let guaranteeNo = ''
let expiredGuaranteeId = null
let expiredGuaranteeNo = ''
const isDefaultBlue = (value) => {
  const match = String(value).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!match) return false
  const [, red, green, blue] = match.map(Number)
  return blue > 170 && blue > red + 80 && blue > green + 40
}
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `  ${extra}` : ''}`)
  if (!ok) failures.push(label)
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const sql = (statement) => {
  const output = execFileSync(MYSQL, [
    '--default-character-set=utf8mb4', '-uroot', '-proot', '-N', '-B', '-e', statement,
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  return output.trim().split(/\r?\n/).filter(Boolean).map((line) => line.split('\t'))
}
const scalar = (statement) => sql(statement)[0]?.[0] ?? ''
const fill = async (page, selector, value) => page.evaluate(({ target, next }) => {
  const input = document.querySelector(target)
  if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLTextAreaElement)) {
    throw new Error(`未找到输入框 ${target}`)
  }
  const prototype = input instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value').set
  setter.call(input, next)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}, { target: selector, next: value })

const loginApi = async (username, password) => {
  const response = await fetch(`${CORE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, marketId: 1 }),
  })
  const body = await response.json()
  if (body.code !== 0) throw new Error(body.message ?? `${username} 登录失败`)
  return body.data.accessToken
}
const call = async (method, requestPath, token, payload) => {
  const response = await fetch(`${BASE}${requestPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  })
  return { status: response.status, body: await response.json() }
}

const [adminToken, buyerToken] = await Promise.all([
  loginApi('admin', 'Admin@123'),
  loginApi('19900002005', 'Test12345'),
])

try {
  const created = await call('POST', '/api/trade/guarantee', adminToken, {
    merchantId: 2001,
    merchantName: '绿源农业合作社',
    guaranteeType: 'cash',
    totalAmount: 1,
    expireTime: '2027-12-31 23:59:59',
    remark: marker,
  })
  check(created.body.code === 200, '运营可创建保证金开立申请', created.body.message ?? '')
  guaranteeId = Number(scalar(`
    SELECT id FROM agri_trade.agri_trade_merchant_guarantee
    WHERE merchant_id=2001 AND remark='${marker}' AND del_flag=0 ORDER BY id DESC LIMIT 1
  `))
  guaranteeNo = scalar(`SELECT guarantee_no FROM agri_trade.agri_trade_merchant_guarantee WHERE id=${guaranteeId}`)
  const pending = sql(`
    SELECT guarantee_status,total_amount,available_amount,frozen_amount,used_amount
    FROM agri_trade.agri_trade_merchant_guarantee WHERE id=${guaranteeId}
  `)[0] ?? []
  check(Boolean(guaranteeId), '待审核保证金账户已落库', guaranteeNo)
  check(pending[0] === 'pending' && Number(pending[1]) === 1 && Number(pending[2]) === 0,
    '待审核账户不会提前形成可用余额', pending.join('/'))
  check(scalar(`
    SELECT COUNT(*) FROM agri_trade.agri_trade_guarantee_log
    WHERE guarantee_id=${guaranteeId} AND action='create' AND del_flag=0
  `) === '1', '开立申请已写入不可缺失的审计流水')

  const pendingReplenish = await call('POST', `/api/trade/guarantee/${guaranteeId}/replenish`, await loginApi('farmer', 'Admin@123'), {
    amount: '0.01',
    reason: '待审核账户不应允许补缴',
  })
  check(pendingReplenish.body.code !== 200 && /生效中/.test(pendingReplenish.body.message ?? ''),
    '待审核账户不能补缴', pendingReplenish.body.message ?? '')

  const approved = await call('POST', `/api/trade/admin/guarantee/${guaranteeId}/verify`, adminToken, {
    status: 'active',
    remark: '保证金账户联调审核通过',
  })
  const active = sql(`
    SELECT guarantee_status,total_amount,available_amount,frozen_amount,used_amount
    FROM agri_trade.agri_trade_merchant_guarantee WHERE id=${guaranteeId}
  `)[0] ?? []
  check(approved.body.code === 200 && active[0] === 'active'
    && Number(active[1]) === 1 && Number(active[2]) === 1,
  '审核通过后总额与可用余额正确同步', active.join('/'))
  check(scalar(`
    SELECT COUNT(*) FROM agri_trade.agri_trade_guarantee_log
    WHERE guarantee_id=${guaranteeId} AND action='verify' AND del_flag=0
  `) === '1', '审核动作已写入资金流水')

  expiredGuaranteeNo = `GT-EXPIRED-${Date.now()}`
  sql(`
    INSERT INTO agri_trade.agri_trade_merchant_guarantee
      (merchant_id,merchant_name,guarantee_no,guarantee_type,total_amount,available_amount,
       frozen_amount,used_amount,guarantee_status,apply_time,verify_time,verified_by,expire_time,
       remark,del_flag,create_time,update_time)
    VALUES
      (2001,'绿源农业合作社','${expiredGuaranteeNo}','cash',999999,888888,
       0,0,'active',DATE_SUB(NOW(), INTERVAL 370 DAY),DATE_SUB(NOW(), INTERVAL 370 DAY),
       'admin',DATE_SUB(NOW(), INTERVAL 1 DAY),'${marker}-expired',0,NOW(),NOW())
  `)
  expiredGuaranteeId = Number(scalar(`
    SELECT id FROM agri_trade.agri_trade_merchant_guarantee
    WHERE guarantee_no='${expiredGuaranteeNo}' ORDER BY id DESC LIMIT 1
  `))
  const validAvailable = Number(scalar(`
    SELECT COALESCE(SUM(available_amount),0) FROM agri_trade.agri_trade_merchant_guarantee
    WHERE merchant_id=2001 AND del_flag=0 AND guarantee_status='active'
      AND (expire_time IS NULL OR expire_time > NOW())
  `))
  const balanceResponse = await call('GET', '/api/trade/compensation/guarantee/2001/balance', adminToken)
  check(expiredGuaranteeId > 0 && balanceResponse.body.code === 200
    && Math.abs(Number(balanceResponse.body.data) - validAvailable) < 0.0001,
  '保证金余额接口排除已到期账户', `${balanceResponse.body.data}/${validAvailable}`)

  const sellerToken = await loginApi('farmer', 'Admin@123')
  const forbidden = await call('POST', `/api/trade/guarantee/${guaranteeId}/replenish`, buyerToken, {
    amount: '0.01',
    reason: '越权补缴测试',
  })
  check(forbidden.body.code !== 200, '其他经营主体不能为卖家保证金账户补缴', forbidden.body.message ?? '')

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: 'new',
    args: ['--no-sandbox'],
  })
  try {
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(String(error)))
    await page.setViewport({ width: 1440, height: 1000 })
    await page.goto(`${BASE}/member/seller?tab=fund`, { waitUntil: 'networkidle2', timeout: 60000 })
    await page.waitForFunction(() => window.location.port === '8090', { timeout: 20000 })
    await page.waitForSelector('button[role="tab"]', { timeout: 20000 })
    await page.evaluate(() => {
      const tab = [...document.querySelectorAll('button[role="tab"]')]
        .find((item) => item.textContent?.includes('账号 + 密码'))
      tab?.click()
    })
    await fill(page, 'input[autocomplete="username"]', 'farmer')
    await fill(page, 'input[autocomplete="current-password"]', 'Admin@123')
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('button[type="submit"]')]
        .find((item) => item.textContent?.includes('登 录'))
      button?.click()
    })
    for (let i = 0; i < 60; i += 1) {
      await sleep(400)
      if (page.url().includes('/member/seller')) break
    }
    await page.waitForSelector('.guarantee-workbench', { timeout: 30000 })
    await page.waitForNetworkIdle({ idleTime: 700, timeout: 15000 }).catch(() => {})
    const listText = await page.evaluate(() => document.body.innerText)
    check(listText.includes('保证金账户') && listText.includes(guaranteeNo)
      && listText.includes('补缴保证金') && listText.includes('查看流水'),
    '资金结算页展示保证金账户完整信息', guaranteeNo)
    check(listText.includes('绿源农业合作社'), '保证金账户展示当前经营主体名称')
    check(listText.includes(expiredGuaranteeNo) && listText.includes('已到期'),
      '过期账户展示正确状态且不伪装为生效中')
    const metricText = await page.$eval('.guarantee-metrics', (node) => node.textContent ?? '')
    check(!metricText.includes('999,999.00') && !metricText.includes('888,888.00'),
      '页面资金汇总不包含过期账户余额')
    const accountCardWidth = await page.$eval(
      '.guarantee-account-card',
      (node) => node.getBoundingClientRect().width,
    )
    check(accountCardWidth > 480, '保证金账户卡在桌面端使用全宽双列布局',
      `${Math.round(accountCardWidth)}px`)
    check(!(await page.$('.guarantee-workbench .ant-table'))
      && !(await page.$('.guarantee-workbench .ant-modal')),
      '保证金工作区不再使用默认表格和弹窗')
    const fundButtons = await page.$$('.seller-fund-workspace button:not([disabled])')
    let blueFundButton = ''
    for (const button of fundButtons.slice(0, 24)) {
      const visible = await button.evaluate((element) => {
        const rect = element.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      })
      if (!visible) continue
      await button.hover()
      await sleep(220)
      const style = await button.evaluate((element) => {
        const computed = getComputedStyle(element)
        return {
          text: (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 24),
          color: computed.color,
          background: computed.backgroundColor,
          border: computed.borderColor,
        }
      })
      if ([style.color, style.background, style.border].some(isDefaultBlue)) {
        blueFundButton = `${style.text}: ${JSON.stringify(style)}`
        break
      }
    }
    check(!blueFundButton, '资金结算页所有可见按钮悬浮态无默认蓝色', blueFundButton)
    const primaryButton = await page.$('.guarantee-account-card.active .guarantee-account-actions .mc-btn:not(.ghost)')
    await primaryButton?.hover()
    await sleep(260)
    const primaryHover = await primaryButton?.evaluate((element) => {
      const style = getComputedStyle(element)
      return { background: style.backgroundColor, color: style.color, border: style.borderColor }
    })
    check(primaryHover?.background === 'rgb(14, 82, 51)'
      && primaryHover?.color === 'rgb(255, 255, 255)',
    '主按钮悬浮态使用深绿色而非默认蓝色',
    primaryHover ? JSON.stringify(primaryHover) : '未找到主按钮')
    const ghostButton = await page.$('.guarantee-account-card.active .guarantee-account-actions .mc-btn.ghost')
    await ghostButton?.hover()
    await sleep(260)
    const ghostHover = await ghostButton?.evaluate((element) => {
      const style = getComputedStyle(element)
      return { background: style.backgroundColor, color: style.color, border: style.borderColor }
    })
    check(ghostHover?.background === 'rgb(237, 249, 242)'
      && ghostHover?.color === 'rgb(14, 82, 51)',
    '次按钮悬浮态使用浅绿色背景和深绿色文字',
    ghostHover ? JSON.stringify(ghostHover) : '未找到次按钮')
    await page.screenshot({ path: path.join(OUT, 'seller-guarantee-hover.png'), fullPage: true })
    await page.screenshot({ path: path.join(OUT, 'seller-guarantee-account.png'), fullPage: true })

    const openedLogs = await page.evaluate((accountNo) => {
      const card = [...document.querySelectorAll('.guarantee-account-card')]
        .find((item) => item.textContent?.includes(accountNo))
      const button = card ? [...card.querySelectorAll('button')]
        .find((item) => item.textContent?.includes('查看流水')) : null
      if (!button) return false
      button.click()
      return true
    }, guaranteeNo)
    check(openedLogs, '保证金账户提供页面级流水入口')
    await page.waitForFunction(() => document.body.innerText.includes('资金流水'), { timeout: 10000 })
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 10000 }).catch(() => {})
    const openedLogText = await page.evaluate(() => document.body.innerText)
    check(openedLogText.includes('账户开立') && openedLogText.includes('账户审核'),
      '流水页展示账户开立与审核记录')

    await page.evaluate(() => {
      const button = [...document.querySelectorAll('button')]
        .find((item) => item.textContent?.includes('补缴'))
      button?.click()
    })
    await page.waitForFunction(() => document.body.innerText.includes('GUARANTEE REPLENISHMENT'), { timeout: 10000 })
    const actionColumns = await page.$eval(
      '.guarantee-action-layout',
      (node) => getComputedStyle(node).gridTemplateColumns.split(' ').length,
    )
    check(actionColumns >= 2, '补缴页面采用表单与说明双栏布局')
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('.guarantee-quick-amounts button')]
        .find((item) => item.textContent?.includes('500'))
      button?.click()
    })
    const quickAmount = await page.$eval('.guarantee-form input', (input) => input.value)
    const previewText = await page.$eval('.guarantee-replenish-preview', (node) => node.textContent ?? '')
    check(Number(quickAmount) === 500 && previewText.includes('501.00'),
      '快捷金额会同步更新补缴金额与补缴后可用余额', `${quickAmount}/${previewText}`)
    await page.screenshot({ path: path.join(OUT, 'seller-guarantee-replenish.png'), fullPage: true })
    const replenishReason = `${marker}-补缴`
    await fill(page, '.guarantee-form input', '0.01')
    await fill(page, '.guarantee-form textarea', replenishReason)
    await page.click('.guarantee-form button[type="submit"]')
    for (let i = 0; i < 40; i += 1) {
      await sleep(300)
      const text = await page.evaluate(() => document.body.innerText)
      if (text.includes('保证金补缴') && text.includes(replenishReason)) break
    }
    const logText = await page.evaluate(() => document.body.innerText)
    check(logText.includes('保证金补缴') && logText.includes(replenishReason) && logText.includes('0.01'),
      '页面补缴成功后展示金额与原因流水')
    const after = sql(`
      SELECT total_amount,available_amount,
        (SELECT COUNT(*) FROM agri_trade.agri_trade_guarantee_log
         WHERE guarantee_id=${guaranteeId} AND action='replenish' AND reason='${replenishReason}' AND del_flag=0)
      FROM agri_trade.agri_trade_merchant_guarantee WHERE id=${guaranteeId}
    `)[0] ?? []
    check(Number(after[0]) === 1.01 && Number(after[1]) === 1.01 && after[2] === '1',
      '补缴后总额、可用额和流水同步落库', after.join('/'))
    await page.screenshot({ path: path.join(OUT, 'seller-guarantee-log.png'), fullPage: true })

    await page.click('.guarantee-back')
    await page.waitForSelector('.guarantee-workbench', { timeout: 10000 })
    await page.setViewport({ width: 390, height: 844 })
    await page.reload({ waitUntil: 'networkidle2', timeout: 60000 })
    await page.waitForSelector('.guarantee-workbench', { timeout: 30000 })
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      '390px 保证金账户页无横向溢出')
    await page.screenshot({ path: path.join(OUT, 'seller-guarantee-mobile.png'), fullPage: true })
    check(errors.length === 0, '保证金账户页面无未捕获脚本异常', errors.slice(0, 2).join(' | '))
  } finally {
    await browser.close()
  }
} catch (error) {
  check(false, '保证金账户回归未抛异常', String(error).slice(0, 320))
} finally {
  if (expiredGuaranteeId) {
    try {
      sql(`
        DELETE FROM agri_trade.agri_trade_guarantee_log WHERE guarantee_id=${expiredGuaranteeId};
        DELETE FROM agri_trade.agri_trade_merchant_guarantee WHERE id=${expiredGuaranteeId};
      `)
      console.log(`已清理过期保证金测试账户 ${expiredGuaranteeNo}`)
    } catch (error) {
      console.error(`过期保证金测试账户清理失败：${String(error)}`)
      failures.push('清理过期保证金测试账户')
    }
  }
  if (guaranteeId) {
    try {
      sql(`
        DELETE FROM agri_trade.agri_trade_guarantee_log WHERE guarantee_id=${guaranteeId};
        DELETE FROM agri_trade.agri_trade_merchant_guarantee WHERE id=${guaranteeId};
      `)
      console.log(`已清理临时保证金账户 ${guaranteeNo}`)
    } catch (error) {
      console.error(`临时保证金账户清理失败：${String(error)}`)
      failures.push('清理临时保证金账户')
    }
  }
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log(`失败项：${failures.join('、')}`)
process.exit(failures.length ? 1 : 0)

/**
 * 供应商端全页面点检：造供应商/商品/渠道/订单 → 浏览器校验总览/待办/货源/分销池/渠道/订单/售后/收入/分析/边界。
 * 用法：node scripts/check-supplier-ops-ui.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const require2 = createRequire('C:/Users/71502/.workbuddy-ai/binaries/node/workspace/noop.js')
const { chromium } = require2('playwright-core')
const BROWSER = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))
const MYSQL = 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe'
const sql = (q) => {
  try {
    return execFileSync(MYSQL, ['-uroot', '-proot', '--default-character-set=utf8mb4', '-N', '-B', '-e', q],
      { encoding: 'utf8' }).trim()
  } catch (e) {
    return `ERR:${String(e?.message ?? e).slice(0, 80)}`
  }
}
const CORE = 'http://localhost:8093'
const S2B2C = 'http://localhost:8088'
const APP = 'http://localhost:8084'
const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'outputs', 'supplier-ops-20261030')
mkdirSync(OUT, { recursive: true })

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const login = await (await fetch(`${CORE}/api/v1/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'Admin@123', marketId: 1 }),
})).json()
const token = login?.data?.accessToken ?? ''
const auth = { Authorization: `Bearer ${token}` }
const adminId = sql(`SELECT id FROM agri_core.platform_user WHERE username = 'admin'`)
const sessionRes = await fetch(`${CORE}/api/v1/sso/login-standalone`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'Admin@123' }),
})
const cookie = (sessionRes.headers.getSetCookie?.() ?? []).map((x) => x.split(';')[0]).join('; ')

let identityId = ''
let supplierId = ''
let channelId = ''
let productId = ''
let rejectedProductId = ''
let relationId = ''
let consumerId = ''
let addressId = ''
let orderId = ''
let cartId = ''
let reviewId = ''
const created = { supplier: false, channel: false }
const productName = `供应商点检商品${Date.now() % 10000}`
const rejectedName = `供应商驳回商品${Date.now() % 10000}`

try {
  const identityCount = sql(`SELECT COUNT(*) FROM agri_core.platform_identity_application WHERE user_id = '${adminId}' AND identity_type = 'wholesaler' AND status = 'approved'`)
  if (identityCount === '0' || identityCount === '') {
    const applied = await (await fetch(`${CORE}/api/v1/sso/account/identity-applications`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ identityType: 'wholesaler', subjectName: '供应商点检主体' }),
    })).json()
    identityId = applied?.data?.id ?? ''
    await fetch(`${CORE}/api/v1/admin/identity-applications/${identityId}/review`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved: true, remark: 'supplier ops check' }),
    })
  }

  const supplierProfile = await (await fetch(`${S2B2C}/api/supplier/profile`, { headers: auth })).json()
  if (supplierProfile?.applied) {
    supplierId = String(supplierProfile.id)
  } else {
    await fetch(`${S2B2C}/api/supplier/apply`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName: '供应商点检企业', creditCode: '91320100SUP001X', contactPhone: '13800000000' }),
    })
    supplierId = sql(`SELECT id FROM agri_s2b2c.s2b2c_supplier WHERE user_id = '${adminId}' ORDER BY id DESC LIMIT 1`)
    created.supplier = true
  }
  const supplierState = await (await fetch(`${S2B2C}/api/supplier/profile`, { headers: auth })).json()
  if (supplierState?.auditStatus !== 'APPROVED') {
    await fetch(`${S2B2C}/api/platform/supplier/audit?id=${supplierId}&auditStatus=APPROVED&auditOpinion=ui`,
      { method: 'PUT', headers: auth })
  }
  await fetch(`${S2B2C}/api/supplier/product/create`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ categoryId: 1, name: productName, price: 12.8, stock: 50, commissionRate: 8 }),
  })
  productId = sql(`SELECT id FROM agri_s2b2c.s2b2c_product WHERE supplier_id = '${supplierId}' AND name = '${productName}' ORDER BY id DESC LIMIT 1`)
  await fetch(`${S2B2C}/api/platform/product/audit?id=${productId}&status=APPROVED&opinion=ui`, { method: 'PUT', headers: auth })

  await fetch(`${S2B2C}/api/supplier/product/create`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ categoryId: 1, name: rejectedName, price: 9.9, stock: 10, commissionRate: 5 }),
  })
  rejectedProductId = sql(`SELECT id FROM agri_s2b2c.s2b2c_product WHERE supplier_id = '${supplierId}' AND name = '${rejectedName}' ORDER BY id DESC LIMIT 1`)
  await fetch(`${S2B2C}/api/platform/product/audit?id=${rejectedProductId}&status=REJECTED&opinion=资料不全`, { method: 'PUT', headers: auth })

  const channelProfile = await (await fetch(`${S2B2C}/api/channel/profile`, { headers: auth })).json()
  if (channelProfile?.applied) {
    channelId = String(channelProfile.id)
    if (channelProfile.auditStatus !== 'APPROVED') {
      await fetch(`${S2B2C}/api/platform/channel-partner/audit?id=${channelId}&auditStatus=APPROVED&auditOpinion=ui`, { method: 'PUT', headers: auth })
    }
  } else {
    await fetch(`${S2B2C}/api/channel/apply`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ registerType: 'PERSONAL', contactName: '供应商点检渠道', contactPhone: '13800000000', shopName: '供应商点检渠道店' }),
    })
    channelId = sql(`SELECT id FROM agri_s2b2c.s2b2c_channel_partner WHERE shop_name = '供应商点检渠道店' ORDER BY id DESC LIMIT 1`)
    created.channel = true
    await fetch(`${S2B2C}/api/platform/channel-partner/audit?id=${channelId}&auditStatus=APPROVED&auditOpinion=ui`, { method: 'PUT', headers: auth })
  }
  const shopName = sql(`SELECT shop_name FROM agri_s2b2c.s2b2c_channel_partner WHERE id = '${channelId}'`)
  await fetch(`${S2B2C}/api/channel/select-product?channelId=${channelId}&productId=${productId}`, { method: 'POST', headers: auth })
  relationId = sql(`SELECT id FROM agri_s2b2c.s2b2c_channel_product WHERE channel_id = '${channelId}' AND product_id = '${productId}' LIMIT 1`)

  const consumer = await (await fetch(`${S2B2C}/api/consumer/profile`, { headers: auth })).json()
  consumerId = String(consumer?.id ?? '')
  await fetch(`${S2B2C}/api/consumer/address/add`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ consumerId, name: '供应商点检买家', phone: '13900003333', province: '广东省', city: '广州市', district: '天河区', address: '点检路 3 号', isDefault: true, status: 'ACTIVE' }),
  })
  addressId = sql(`SELECT id FROM agri_s2b2c.s2b2c_address WHERE consumer_id = '${consumerId}' ORDER BY id DESC LIMIT 1`)
  await fetch(`${S2B2C}/api/consumer/cart/add?consumerId=${consumerId}&productId=${productId}&quantity=2&channelId=${channelId}`, { method: 'POST', headers: auth })
  cartId = sql(`SELECT id FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${consumerId}' AND product_id = '${productId}' ORDER BY id DESC LIMIT 1`)
  const orderRes = await (await fetch(`${S2B2C}/api/consumer/order/create`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ consumerId, addressId }),
  })).json()
  orderId = String(orderRes?.orderIds?.[0] ?? '')
  check(Boolean(orderId), '造好供应商渠道订单', `order=${orderId}`)
  await fetch(`${S2B2C}/api/consumer/order/pay/${orderId}`, { method: 'PUT', headers: auth })
  const orderNo = sql(`SELECT order_no FROM agri_s2b2c.s2b2c_order WHERE id = '${orderId}'`)
  sql(`DELETE FROM agri_s2b2c.s2b2c_review WHERE order_id = '${orderId}' AND product_id = '${productId}'`)
  reviewId = String(Date.now())
  sql(`INSERT INTO agri_s2b2c.s2b2c_review
       (id,order_id,product_id,consumer_id,rating,content,anonymous,create_time)
       VALUES ('${reviewId}','${orderId}','${productId}','${consumerId}',5,'UI点检评价：果径均匀，物流及时',FALSE,NOW())`)
  await fetch(`${S2B2C}/api/consumer/after-sales`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ consumerId, orderId, type: 'REFUND', reason: '供应商点检售后', amount: 3 }),
  })

  const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 940 } })
  const cookiePairs = cookie.split('; ').map((x) => x.split('='))
  await context.addCookies(cookiePairs.map(([name, ...rest]) => ({ name, value: rest.join('='), domain: 'localhost', path: '/' })))
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e?.message ?? e).slice(0, 120)))

  try {
    await page.goto(`${APP}/`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(1300)
    let text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('分销总览') && text.includes('供货收入'), '分销总览渲染')
    check(['货源与投放', '分销网络', '分销订单', '分销资金', '模块边界与协同'].every((label) => text.includes(label)), '侧栏按原型 IA 分组')
    const supplierNotices = await (await fetch(`${S2B2C}/api/supplier/notices?page=1&size=50`, { headers: auth })).json()
    check((supplierNotices?.records ?? []).some((row) => row.type === 'ORDER_CREATED' && String(row.refId) === String(orderId)),
      '供应商收到新订单通知')
    await page.locator('.notice-badge button').click()
    await page.waitForTimeout(900)
    text = (await page.evaluate(() => document.body.innerText)).replace(/s+/g, ' ')
    check(text.includes('新分销订单'), '铃铛展示新订单通知')
    await page.locator('.notice-panel button', { hasText: '全部已读' }).click()
    await page.waitForTimeout(800)
    const unreadAfter = await (await fetch(`${S2B2C}/api/supplier/notices/unread-count`, { headers: auth })).json()
    check(Number(unreadAfter?.unread ?? -1) === 0, '通知全部已读', `unread=${unreadAfter?.unread}`)
    await page.goto(`${APP}/notice-settings`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(800)
    text = (await page.evaluate(() => document.body.innerText)).replace(/s+/g, ' ')
    check(text.includes('协同与通知设置') && text.includes('新订单'), '通知设置页展示事件开关')
    const orderNoticeRow = page.locator('tr', { hasText: '新订单 / 新渠道订单' }).first()
    await orderNoticeRow.locator('.el-switch').click()
    await page.waitForTimeout(900)
    const prefOff = sql(`SELECT enabled FROM agri_s2b2c.s2b2c_notice_preference WHERE recipient_type='SUPPLIER' AND recipient_id='${supplierId}' AND notice_type='ORDER_CREATED'`)
    check(prefOff === '0', '关闭新订单通知落库', `enabled=${prefOff}`)
    await orderNoticeRow.locator('.el-switch').click()
    await page.waitForTimeout(900)
    const prefOn = sql(`SELECT enabled FROM agri_s2b2c.s2b2c_notice_preference WHERE recipient_type='SUPPLIER' AND recipient_id='${supplierId}' AND notice_type='ORDER_CREATED'`)
    check(prefOn === '1', '重新开启新订单通知', `enabled=${prefOn}`)
    await page.screenshot({ path: path.join(OUT, '01-dashboard.png'), fullPage: false })

    await page.goto(`${APP}/todo`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(800)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('待办与预警') && text.includes('待发货'), '待办页展示待发货')

    await page.goto(`${APP}/supply-pool`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(800)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('可投放货源') && text.includes(productName), '可投放货源含商品')

    await page.goto(`${APP}/listing-config`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(900)
    const ruleRow = page.locator('tr', { hasText: productName }).first()
    await ruleRow.locator('.el-switch').click()
    await ruleRow.locator('button', { hasText: '保存' }).click()
    await page.waitForTimeout(1000)
    const disabled = sql(`SELECT distribution_enabled FROM agri_s2b2c.s2b2c_product WHERE id='${productId}'`)
    check(disabled === '0', '关闭渠道投放落库', `enabled=${disabled}`)
    const blockedSelect = await (await fetch(`${S2B2C}/api/channel/select-product?channelId=${channelId}&productId=${productId}`, {
      method: 'POST', headers: auth,
    })).json()
    check(blockedSelect?.success === false && String(blockedSelect?.message ?? '').includes('关闭'),
      '关闭投放后渠道选品被拒', String(blockedSelect?.message ?? '').slice(0, 20))
    await ruleRow.locator('.el-switch').click()
    await ruleRow.locator('button', { hasText: '保存' }).click()
    await page.waitForTimeout(1000)
    const enabled = sql(`SELECT distribution_enabled FROM agri_s2b2c.s2b2c_product WHERE id='${productId}'`)
    check(enabled === '1', '重新开启渠道投放', `enabled=${enabled}`)
    const allowedSelect = await (await fetch(`${S2B2C}/api/channel/select-product?channelId=${channelId}&productId=${productId}`, {
      method: 'POST', headers: auth,
    })).json()
    check(allowedSelect?.success === true, '恢复投放后渠道可再次选品')

    const whitelistOther = await (await fetch(`${S2B2C}/api/supplier/product/${productId}/distribution-rule`, {
      method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true, maxChannels: 0, channelIds: ['999999999'] }),
    })).json()
    check(whitelistOther?.success === true && Number(whitelistOther?.revoked || 0) >= 1,
      '白名单收紧自动撤销授权', `revoked=${whitelistOther?.revoked}`)
    const revokedRelation = sql(`SELECT status FROM agri_s2b2c.s2b2c_channel_product WHERE channel_id='${channelId}' AND product_id='${productId}'`)
    check(revokedRelation === 'REVOKED', '白名单外渠道授权已撤销', `status=${revokedRelation}`)
    const whitelistBlocked = await (await fetch(`${S2B2C}/api/channel/select-product?channelId=${channelId}&productId=${productId}`, {
      method: 'POST', headers: auth,
    })).json()
    check(whitelistBlocked?.success === false && String(whitelistBlocked?.message ?? '').includes('白名单'),
      '白名单外渠道选品被拒', String(whitelistBlocked?.message ?? '').slice(0, 20))

    await (await fetch(`${S2B2C}/api/supplier/product/${productId}/distribution-rule`, {
      method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true, maxChannels: 0, channelIds: [String(channelId)] }),
    })).json()
    const whitelistedSelect = await (await fetch(`${S2B2C}/api/channel/select-product?channelId=${channelId}&productId=${productId}`, {
      method: 'POST', headers: auth,
    })).json()
    check(whitelistedSelect?.success === true, '加入白名单后可重新选品')

    await page.goto(`${APP}/listing-config`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(900)
    await page.locator('tr', { hasText: productName }).first().locator('button', { hasText: '白名单' }).click()
    await page.waitForSelector('.el-dialog .el-select', { timeout: 10000 })
    text = (await page.evaluate(() => document.body.innerText)).replace(/s+/g, ' ')
    check(text.includes('渠道白名单') && text.includes(shopName), '白名单弹窗展示已选渠道', shopName)
    await page.locator('.el-dialog button', { hasText: '取消' }).click().catch(() => {})
    await page.screenshot({ path: path.join(OUT, '05-listing-config.png'), fullPage: false })

    await page.locator('tr', { hasText: productName }).first().locator('button', { hasText: '限售区域' }).click()
    const regionDialog = page.locator('.el-dialog').filter({ hasText: '限售区域' }).last()
    await regionDialog.locator('.el-select').click()
    await page.locator('.el-select-dropdown__item', { hasText: '浙江省' }).first().click()
    await page.keyboard.press('Escape')
    await regionDialog.locator('button', { hasText: '保存限售区域' }).click()
    await page.waitForTimeout(1200)
    const regionDb = sql(`SELECT region_name FROM agri_s2b2c.s2b2c_distribution_region WHERE product_id='${productId}'`)
    check(regionDb.includes('浙江省'), '限售区域保存落库', regionDb)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('浙江省'), '投放规则页展示限售区域')
    await (await fetch(`${S2B2C}/api/supplier/product/${productId}/distribution-rule`, {
      method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true, maxChannels: 0, channelIds: [String(channelId)], regionNames: [] }),
    })).json()

    const badMinRule = await (await fetch(`${S2B2C}/api/supplier/product/${productId}/distribution-rule`, {
      method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true, maxChannels: 0, channelIds: [String(channelId)],
        minRetailPrice: 10 }),
    })).json()
    check(badMinRule?.success === false && String(badMinRule?.message ?? '').includes('供货价'),
      '最低零售价不能低于供货价', String(badMinRule?.message ?? '').slice(0, 24))
    const belowSupply = await (await fetch(`${S2B2C}/api/channel/product/${productId}/listing?retailPrice=10&shelfStatus=ON`, {
      method: 'PUT', headers: auth,
    })).json()
    check(belowSupply?.success === false && String(belowSupply?.message ?? '').includes('供货价'),
      '渠道改价低于供货价被拒', String(belowSupply?.message ?? '').slice(0, 24))

    const priceRule = await (await fetch(`${S2B2C}/api/supplier/product/${productId}/distribution-rule`, {
      method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true, maxChannels: 0, channelIds: [String(channelId)],
        minRetailPrice: 20, maxRetailPrice: 25 }),
    })).json()
    check(priceRule?.success === true, '设置零售价区间', `outOfRange=${priceRule?.outOfRange}`)
    const priceRange = sql(`SELECT CONCAT(min_retail_price,'|',max_retail_price) FROM agri_s2b2c.s2b2c_product WHERE id='${productId}'`)
    check(priceRange === '20.00|25.00', '零售价区间落库', priceRange)
    const belowMin = await (await fetch(`${S2B2C}/api/channel/product/${productId}/listing?retailPrice=15&shelfStatus=ON`, {
      method: 'PUT', headers: auth,
    })).json()
    check(belowMin?.success === false && String(belowMin?.message ?? '').includes('最低限价'),
      '渠道改价低于最低限价被拒', String(belowMin?.message ?? '').slice(0, 24))
    const inRange = await (await fetch(`${S2B2C}/api/channel/product/${productId}/listing?retailPrice=22&shelfStatus=ON`, {
      method: 'PUT', headers: auth,
    })).json()
    check(inRange?.success === true, '区间内改价成功')
    const retailPrice = sql(`SELECT retail_price FROM agri_s2b2c.s2b2c_channel_product WHERE channel_id='${channelId}' AND product_id='${productId}'`)
    check(Number(retailPrice) === 22, '渠道零售价落库', `retail=${retailPrice}`)
    await page.goto(`${APP}/listing-config`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(900)
    const ruleRowAgain = page.locator('tr', { hasText: productName }).first()
    const minValue = await ruleRowAgain.locator('input').nth(2).inputValue().catch(() => '')
    const maxValue = await ruleRowAgain.locator('input').nth(3).inputValue().catch(() => '')
    check(Number(minValue) === 20 && Number(maxValue) === 25, '投放规则页回显零售价区间',
      `min=${minValue} max=${maxValue}`)

    sql(`UPDATE agri_s2b2c.s2b2c_channel_product SET retail_price = 5, shelf_status = 'ON' WHERE channel_id='${channelId}' AND product_id='${productId}'`)
    await page.locator('button', { hasText: '扫描超低价并下架' }).click()
    await page.waitForTimeout(1400)
    const autoOffShelf = sql(`SELECT shelf_status FROM agri_s2b2c.s2b2c_channel_product WHERE channel_id='${channelId}' AND product_id='${productId}'`)
    const autoNotice = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_notice WHERE type='PRODUCT_AUTO_OFF_SHELF' AND ref_type='PRODUCT' AND ref_id='${productId}'`)
    check(autoOffShelf === 'OFF' && autoNotice !== '0', '历史超低价商品自动下架并通知',
      `shelf=${autoOffShelf} notice=${autoNotice}`)
    const reshelfBlocked = await (await fetch(`${S2B2C}/api/channel/product/${productId}/listing?shelfStatus=ON`, {
      method: 'PUT', headers: auth,
    })).json()
    check(reshelfBlocked?.success === false && String(reshelfBlocked?.message ?? '').includes('底价'),
      '低于底价不能直接重新上架', String(reshelfBlocked?.message ?? '').slice(0, 24))
    const reshelfOk = await (await fetch(`${S2B2C}/api/channel/product/${productId}/listing?retailPrice=22&shelfStatus=ON`, {
      method: 'PUT', headers: auth,
    })).json()
    check(reshelfOk?.success === true, '调价后可重新上架')
    await page.screenshot({ path: path.join(OUT, '06-price-guard.png'), fullPage: false })

    await page.goto(`${APP}/products`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(800)
    await page.locator('tr', { hasText: rejectedName }).first().locator('button', { hasText: '重新提交' }).click()
    await page.waitForTimeout(1200)
    const resubmitted = sql(`SELECT status FROM agri_s2b2c.s2b2c_product WHERE id = '${rejectedProductId}'`)
    check(resubmitted === 'PENDING', '驳回商品重新提交审核', `status=${resubmitted}`)

    await page.goto(`${APP}/distributors`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(800)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('分销商列表') && text.includes(shopName), '分销商列表含授权渠道')
    await page.locator('tr', { hasText: shopName }).first().locator('button', { hasText: '详情与授权' }).click()
    await page.waitForTimeout(1000)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('分销商详情与授权') && text.includes(productName), '分销商详情含商品授权')
    await page.locator('tr', { hasText: productName }).first().locator('button', { hasText: '撤销授权' }).click()
    await page.waitForSelector('.el-message-box__btns button', { timeout: 10000 })
    await page.locator('.el-message-box__btns button').last().click()
    await page.waitForTimeout(1200)
    const relationStatus = sql(`SELECT status FROM agri_s2b2c.s2b2c_channel_product WHERE id = '${relationId}'`)
    check(relationStatus === 'REVOKED', '供应商撤销渠道授权', `status=${relationStatus}`)
    sql(`UPDATE agri_s2b2c.s2b2c_channel_product SET status = 'ACTIVE' WHERE id = '${relationId}'`)

    await page.goto(`${APP}/orders`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(900)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes(orderNo), '分销订单列表含订单', orderNo)
    await page.locator('tr', { hasText: orderNo }).first().locator('button', { hasText: '发货' }).click()
    await page.waitForSelector('.el-dialog input[placeholder*="电子面单号"]', { timeout: 10000 })
    await page.locator('.el-dialog input[placeholder*="电子面单号"]').fill(`SF-SUP-${Date.now()}`)
    await page.locator('.el-dialog button', { hasText: '确认发货' }).click()
    await page.waitForTimeout(1400)
    const pendingShipStatus = sql(`SELECT status FROM agri_s2b2c.s2b2c_order WHERE id = '${orderId}'`)
    const proposal = sql(`SELECT CONCAT(status,'|',proposer_type) FROM agri_s2b2c.s2b2c_order_shipment WHERE order_id='${orderId}' ORDER BY create_time DESC, id DESC LIMIT 1`)
    check(pendingShipStatus === 'PENDING_SHIP' && proposal === 'PROPOSED|SUPPLIER', '供应商提交发货待渠道确认',
      `order=${pendingShipStatus} proposal=${proposal}`)
    const confirmed = await (await fetch(`${S2B2C}/api/channel/order/${orderId}/shipment/confirm`, { method: 'PUT', headers: auth })).json()
    check(confirmed?.success === true, '渠道确认发货', String(confirmed?.message ?? '').slice(0, 20))
    const shipped = sql(`SELECT status FROM agri_s2b2c.s2b2c_order WHERE id = '${orderId}'`)
    check(shipped === 'SHIPPED', '双方确认后订单为已发货', `status=${shipped}`)
    const confirmNotices = await (await fetch(`${S2B2C}/api/supplier/notices?page=1&size=50`, { headers: auth })).json()
    check((confirmNotices?.records ?? []).some((row) => row.type === 'SHIP_CONFIRMED' && String(row.refId) === String(orderId)),
      '供应商收到发货确认通知')
    await page.screenshot({ path: path.join(OUT, '02-orders.png'), fullPage: false })

    await page.goto(`${APP}/reviews`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(900)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('评价管理') && text.includes('UI点检评价：果径均匀'), '评价管理页展示本供应商商品评价')
    await page.locator('tr', { hasText: 'UI点检评价：果径均匀' }).first().locator('button', { hasText: '回复' }).click()
    await page.waitForSelector('.el-dialog textarea', { timeout: 10000 })
    await page.locator('.el-dialog textarea').fill('感谢认可，欢迎再次采购')
    await page.locator('.el-dialog button', { hasText: '提交回复' }).click()
    await page.waitForTimeout(1200)
    const reviewReplyDb = sql(`SELECT CONCAT(IFNULL(reply,''),'|',IFNULL(reply_by,'')) FROM agri_s2b2c.s2b2c_review WHERE id = '${reviewId}'`)
    check(reviewReplyDb === '感谢认可，欢迎再次采购|SUPPLIER', '供应商页面回复评价落库', reviewReplyDb)
    await page.screenshot({ path: path.join(OUT, '07-reviews.png'), fullPage: false })

    await page.goto(`${APP}/after-sales`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(800)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes(orderNo) && text.includes('供应商点检售后'), '售后协同含工单')

    await page.goto(`${APP}/revenue`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(900)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('供货收入与对账') && text.includes(productName) && text.includes('供货对账单'),
      '供货收入含商品明细与对账单')
    await page.screenshot({ path: path.join(OUT, '03-revenue.png'), fullPage: false })

    await page.goto(`${APP}/analytics`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(1000)
    const charts = await page.locator('canvas').count()
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('分销动销分析') && charts > 0, '动销分析渲染走势图', `canvas=${charts}`)

    await page.goto(`${APP}/boundary`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(600)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('模块边界与协同说明') && text.includes('渠道商端') && text.includes('交易撮合'), '模块边界页展示协同关系')

    await page.goto(`${APP}/gap/listing-config`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(600)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('投放规则配置') && text.includes('能力未接入'), '未接入页明确缺口')

    check(pageErrors.length === 0, '页面无运行时异常', pageErrors.slice(0, 2).join(' | '))
    await page.screenshot({ path: path.join(OUT, '04-boundary.png'), fullPage: false })
  } finally {
    await browser.close()
  }
} finally {
  if (supplierId) sql(`DELETE FROM agri_s2b2c.s2b2c_notice_preference WHERE recipient_type='SUPPLIER' AND recipient_id='${supplierId}'`)
  if (reviewId) sql(`DELETE FROM agri_s2b2c.s2b2c_review WHERE id = '${reviewId}'`)
  if (orderId) {
    sql(`DELETE FROM agri_s2b2c.s2b2c_review WHERE order_id = '${orderId}' AND content LIKE 'UI点检评价%'`)
  }
  if (orderId) {
    sql(`DELETE FROM agri_s2b2c.s2b2c_notice WHERE ref_type = 'ORDER' AND ref_id = '${orderId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_after_sale WHERE order_id = '${orderId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_commission WHERE order_id = '${orderId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_order_item WHERE order_id = '${orderId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_order_shipment WHERE order_id = '${orderId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_order WHERE id = '${orderId}'`)
  }
  if (cartId) sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE id = '${cartId}'`)
  if (addressId) sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '${addressId}'`)
  if (relationId) sql(`DELETE FROM agri_s2b2c.s2b2c_channel_product WHERE id = '${relationId}'`)
  if (productId) sql(`DELETE FROM agri_s2b2c.s2b2c_distribution_whitelist WHERE product_id = '${productId}'`)
  if (productId) sql(`DELETE FROM agri_s2b2c.s2b2c_notice WHERE ref_type = 'PRODUCT' AND ref_id = '${productId}'`)
  if (productId) {
    sql(`DELETE FROM agri_s2b2c.s2b2c_price_guard_log WHERE product_id = '${productId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_distribution_region WHERE product_id = '${productId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_product WHERE id = '${productId}'`)
  }
  if (rejectedProductId) sql(`DELETE FROM agri_s2b2c.s2b2c_product WHERE id = '${rejectedProductId}'`)
  if (created.channel && channelId) sql(`DELETE FROM agri_s2b2c.s2b2c_channel_partner WHERE id = '${channelId}'`)
  if (created.supplier && supplierId) sql(`DELETE FROM agri_s2b2c.s2b2c_supplier WHERE id = '${supplierId}'`)
  if (identityId) sql(`DELETE FROM agri_core.platform_identity_application WHERE id = '${identityId}'`)
  console.log(`\n清理：order=${orderId ? 1 : 0} products=2 supplier=${created.supplier ? 1 : 0} channel=${created.channel ? 1 : 0}`)
}

console.log('')
if (!failures.length) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((item) => console.log('  -', item))
process.exit(1)

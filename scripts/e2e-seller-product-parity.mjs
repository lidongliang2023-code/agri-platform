#!/usr/bin/env node
/** 卖家中心商品与主数据商品同源、范围隔离回归（2026-10-21）。 */
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require2 = createRequire(path.join(REPO_ROOT, 'agri-production/frontend/package.json'))
const puppeteer = require2('puppeteer')
const TRADE = 'http://localhost:8086'
const PORTAL = 'http://localhost:8098/portal/'
const CORE = 'http://localhost:8093'
const MDM = 'http://localhost:8080'
const OUT = 'C:/Users/71502/.codex/visualizations/2026/10/16/01a14244-ead8-7ab0-8c7c-df7abac44648'
const HEADFUL = process.argv.includes('--headful')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const jsonHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
})

const loginAdmin = async () => {
  const response = await fetch(`${CORE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Admin@123', marketId: 1 }),
  })
  const body = await response.json()
  if (body.code !== 0 || !body.data?.accessToken) throw new Error(body.message || '管理员登录失败')
  return body.data.accessToken
}

const browser = await puppeteer.launch({ headless: HEADFUL ? false : 'new', args: ['--no-sandbox'] })
let token = ''
try {
  const page = await browser.newPage()
  const errors = []
  let authorization = ''
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('request', (request) => {
    const value = request.headers().authorization
    if (typeof value === 'string' && value.startsWith('Bearer ')) authorization = value
  })
  await page.setViewport({ width: 1440, height: 1000 })
  await page.goto(PORTAL, { waitUntil: 'networkidle2', timeout: 60000 })
  const login = await page.evaluate(async () => {
    const response = await fetch('/api/v1/sso/login-standalone', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: '19900002005',
        password: 'Test12345',
        marketId: 1,
        remember: false,
      }),
    })
    return await response.json()
  })
  check(login.code === 0 && login.data?.stage === 'done', '真实企业卖家账号登录成功', login.data?.stage ?? login.message)

  await page.goto(`${TRADE}/member/seller?tab=goods`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.mc-shell', { timeout: 30000 })
  for (let i = 0; i < 30 && !authorization; i += 1) await sleep(200)
  token = authorization.replace(/^Bearer\s+/i, '')
  check(Boolean(token), '卖家中心已取得当前账号访问令牌')

  const merchantResponse = await fetch(`${CORE}/api/v1/platform/merchants/mine`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const merchantBody = await merchantResponse.json()
  const merchantId = String(merchantBody.data?.[0]?.merchantId ?? '')
  check(merchantResponse.status === 200 && Boolean(merchantId), '当前卖家主体已解析', merchantId)

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlKkAAAAASUVORK5CYII=',
    'base64',
  )
  const form = new FormData()
  form.append('file', new Blob([png], { type: 'image/png' }), 'seller-product.png')
  const uploadResponse = await fetch(`${TRADE}/api/trade/seller/product/image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  const uploadBody = await uploadResponse.json()
  const imageUrl = uploadBody.data?.url
  check(uploadBody.code === 200 && imageUrl?.startsWith('/uploads/trade/'), '卖家商品图片上传成功', imageUrl ?? uploadBody.message)

  const categoryResponse = await fetch(`${TRADE}/api/trade/product/category/list`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const categoryBody = await categoryResponse.json()
  const category = (categoryBody.data ?? []).find((item) => item.categoryName === '水果') ?? categoryBody.data?.[0]
  check(categoryBody.code === 200 && category?.id, '卖家可选择主数据商品分类', category?.categoryName ?? '')

  const timestamp = Date.now()
  const productName = `卖家中心同源商品${timestamp}`
  const payload = {
    sellerId: merchantId,
    productCode: `SELLER${timestamp}`,
    productName,
    categoryId: category.id,
    categoryName: category.categoryName,
    barcode: `88${timestamp}`,
    variety: '纽荷尔脐橙',
    originProvince: '江西省',
    originCity: '赣州市',
    originDistrict: '信丰县',
    originAddress: '信丰县卖家中心联调基地',
    specLevel: '一级',
    qualityLevel: '优质',
    specSize: '10kg/箱',
    unit: '箱',
    stockQuantity: 88,
    price: 66.8,
    priceMin: 62.8,
    priceMax: 69.8,
    priceType: 'fixed',
    minOrderQuantity: 2,
    harvestBatchNo: `SELLER-BATCH-${timestamp}`,
    certifications: ['绿色食品'],
    qualityReportUrl: null,
    description: '卖家中心新增，主数据运营端可查看同一条商品。',
    videoUrl: null,
    images: [imageUrl],
    status: 1,
  }
  const createResponse = await fetch(`${TRADE}/api/trade/seller/product/mine`, {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(payload),
  })
  const createBody = await createResponse.json()
  const created = createBody.data
  check(createBody.code === 200 && created?.id && created.sellerId === merchantId,
    '卖家新增商品真实落库并归属当前主体', `${created?.id ?? createBody.message} / seller=${created?.sellerId ?? ''}`)

  const mineResponse = await fetch(
    `${TRADE}/api/trade/seller/product/mine/page?pageNum=1&pageSize=100&sellerId=${merchantId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  const mineBody = await mineResponse.json()
  const mineRows = mineBody.data?.records ?? []
  check(mineBody.code === 200 && mineRows.some((item) => item.id === created.id),
    '卖家中心商品接口可见自己新增的商品')
  check(mineRows.every((item) => String(item.sellerId) === merchantId),
    '卖家商品列表只返回当前卖家主体的商品', `${mineRows.length} 条`)
  check(!mineRows.some((item) => item.id === 7011),
    '卖家列表不包含其他供应商的商品')

  const foreignResponse = await fetch(`${TRADE}/api/trade/seller/product/mine/7011`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const foreignBody = await foreignResponse.json()
  check(foreignBody.code !== 200, '卖家不能读取其他供应商的商品详情', foreignBody.message ?? '')

  const adminToken = await loginAdmin()
  const adminResponse = await fetch(
    `${MDM}/api/trade/admin/product/manage/page?pageNum=1&pageSize=100&keyword=${encodeURIComponent(productName)}`,
    { headers: { Authorization: `Bearer ${adminToken}` } },
  )
  const adminBody = await adminResponse.json()
  const adminRows = adminBody.data?.records ?? []
  const adminProduct = adminRows.find((item) => item.id === created.id)
  check(adminBody.code === 200 && Boolean(adminProduct), '主数据运营端可查看卖家新增的同一条商品')
  check(String(adminProduct?.sellerId) === merchantId
    && adminProduct?.productName === productName
    && Number(adminProduct?.price) === 66.8
    && Number(adminProduct?.stockQuantity) === 88
    && adminProduct?.images?.[0] === imageUrl,
  '卖家端与主数据端字段和图片完全一致')

  const allResponse = await fetch(
    `${MDM}/api/trade/admin/product/manage/page?pageNum=1&pageSize=100`,
    { headers: { Authorization: `Bearer ${adminToken}` } },
  )
  const allBody = await allResponse.json()
  check(allBody.code === 200 && (allBody.data?.records ?? []).some((item) => item.id === 7011),
    '主数据全量列表仍能看到其他卖家的商品')

  await page.reload({ waitUntil: 'networkidle2' })
  await page.waitForFunction((name) => document.body.innerText.includes(name), { timeout: 20000 }, productName)
  check(true, '卖家中心页面显示当前卖家的新增商品')
  await page.screenshot({ path: path.join(OUT, 'seller-product-center.png'), fullPage: true })

  const editHref = await page.evaluate((id) =>
    [...document.querySelectorAll('a.mc-link')]
      .find((item) => (item.getAttribute('href') ?? '').includes(`/product/edit/${id}`))
      ?.getAttribute('href'), created.id)
  check(Boolean(editHref), '卖家中心提供与主数据同字段的编辑入口', editHref ?? '')
  if (editHref) {
    await page.goto(`${TRADE}${editHref}`, { waitUntil: 'networkidle2', timeout: 60000 })
    await page.waitForSelector('.ant-form', { timeout: 20000 })
    const editText = await page.evaluate(() => document.body.innerText)
    check(['商品名称', '商品分类', '产地省份', '销售单价', '库存数量', '起订量', '认证信息', '商品图片']
      .every((label) => editText.includes(label)), '卖家编辑页包含主数据商品完整字段')
    const imageCount = await page.$$eval('.ant-image img', (items) => items.length)
    check(imageCount >= 1, '卖家编辑页回显已上传商品图片', `${imageCount} 张`)
    await page.screenshot({ path: path.join(OUT, 'seller-product-edit.png'), fullPage: true })
  }
  check(errors.length === 0, '卖家中心无未捕获脚本异常', errors.slice(0, 2).join(' | '))

  console.log(`\n卖家商品：id=${created.id} seller=${merchantId} ${TRADE}/product/edit/${created.id}?sellerId=${merchantId}`)
} catch (error) {
  check(false, '卖家商品同源回归未抛异常', String(error).slice(0, 260))
} finally {
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)

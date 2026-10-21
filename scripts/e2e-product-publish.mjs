#!/usr/bin/env node
/** 主数据运营端新增商品 → 交易库落库 → 官网详情展示（2026-10-21）。 */
import { createRequire } from 'node:module'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require2 = createRequire(path.join(REPO_ROOT, 'agri-production/frontend/package.json'))
const puppeteer = require2('puppeteer')
const MDM = 'http://localhost:8080'
const TRADE = 'http://localhost:8086'
const OUT = 'C:/Users/71502/.codex/visualizations/2026/10/16/01a14244-ead8-7ab0-8c7c-df7abac44648'
const HEADFUL = process.argv.includes('--headful')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const setField = async (page, label, value) => {
  await page.evaluate(({ text, val }) => {
    const span = [...document.querySelectorAll('.form-group > span')]
      .find((item) => (item.textContent ?? '').includes(text))
    const field = span?.parentElement?.querySelector('input, textarea')
    if (!field) throw new Error(`未找到字段 ${text}`)
    const proto = field.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(field, val)
    field.dispatchEvent(new Event('input', { bubbles: true }))
    field.dispatchEvent(new Event('change', { bubbles: true }))
  }, { text: label, val: String(value) })
}

const selectOption = async (page, label, preferred) => {
  return await page.evaluate(({ text, hint }) => {
    const span = [...document.querySelectorAll('.form-group > span')]
      .find((item) => (item.textContent ?? '').includes(text))
    const select = span?.parentElement?.querySelector('select')
    const options = [...(select?.options ?? [])].filter((item) => item.value)
    const option = options.find((item) => (item.textContent ?? '').includes(hint)) ?? options[0]
    if (!select || !option) throw new Error(`没有可选的 ${text}`)
    select.value = option.value
    select.dispatchEvent(new Event('change', { bubbles: true }))
    return { value: option.value, text: option.textContent?.trim() }
  }, { text: label, hint: preferred })
}

async function loginAndOpen(page) {
  await page.goto(`${MDM}/product/list`, { waitUntil: 'networkidle2', timeout: 60000 })
  for (let i = 0; i < 30; i++) {
    if (await page.$('.product-list')) return
    if (page.url().includes(':8090') || page.url().includes('/login')) break
    await sleep(400)
  }
  await page.waitForSelector('.auth-card', { timeout: 20000 })
  await page.evaluate(() => {
    const tab = [...document.querySelectorAll('button[role="tab"]')]
      .find((item) => (item.textContent ?? '').includes('账号 + 密码'))
    tab?.click()
  })
  await sleep(200)
  const username = await page.$('input[autocomplete="username"]')
  await username.click({ clickCount: 3 })
  await username.type('admin')
  const password = await page.$('input[type="password"]')
  await password.click({ clickCount: 3 })
  await password.type('Admin@123')
  await page.click('.auth-submit')
  for (let i = 0; i < 45; i++) {
    await sleep(600)
    if (page.url().includes('8080') && !page.url().includes('/login')) break
  }
  await page.goto(`${MDM}/product/list`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.product-list', { timeout: 30000 })
}

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'agri-product-publish-'))
const imageFile = path.join(tempDir, 'e2e-product.png')
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlKkAAAAASUVORK5CYII=',
  'base64',
)
await writeFile(imageFile, png)

const browser = await puppeteer.launch({ headless: HEADFUL ? false : 'new', args: ['--no-sandbox'] })
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.setViewport({ width: 1440, height: 1000 })
  await loginAndOpen(page)

  await page.click('.add-btn')
  await page.waitForSelector('.modal-content', { timeout: 10000 })
  await page.waitForFunction(() => {
    const selects = [...document.querySelectorAll('.modal-content select')]
    return selects.some((select) => select.options.length > 1)
      && selects.some((select) => [...select.options].some((item) => /水产|水果|大米|蔬菜/.test(item.textContent ?? '')))
  }, { timeout: 20000 })

  const timestamp = Date.now()
  const productName = `联调官网上架脐橙${timestamp}`
  const category = await selectOption(page, '商品分类', '水果')
  const seller = await selectOption(page, '供应商', '陕西洛川果业')
  await setField(page, '商品名称', productName)
  await setField(page, '商品编码', `E2E${timestamp}`)
  await setField(page, '条码', `690${timestamp}`)
  await setField(page, '品种', '纽荷尔脐橙')
  await setField(page, '产地省份', '江西省')
  await setField(page, '产地城市', '赣州市')
  await setField(page, '区县', '信丰县')
  await setField(page, '详细产地', '信丰县安西镇联调基地 8 号')
  await setField(page, '规格等级', '一级')
  await setField(page, '质量等级', '优质')
  await setField(page, '规格尺寸', '果径 75-85mm / 10kg 箱')
  await setField(page, '采收批次', `HARVEST-${timestamp}`)
  await setField(page, '销售单价', '36.8')
  await setField(page, '参考最低价', '34.8')
  await setField(page, '参考最高价', '39.8')
  await setField(page, '库存数量', '320')
  await setField(page, '计量单位', 'kg')
  await setField(page, '起订量', '5')
  await setField(page, '认证信息', '绿色食品,地理标志')
  await setField(page, '商品描述', '联调新增商品：赣南脐橙，产地直供，支持冷链发货。')

  const fileInput = await page.$('.modal-content input[type="file"]')
  await fileInput.uploadFile(imageFile)
  await page.waitForFunction(() => document.querySelectorAll('.image-item').length === 1, { timeout: 20000 })
  check(true, '新增商品表单可上传图片并显示主图预览')

  const responsePromise = page.waitForResponse((response) =>
    response.url().endsWith('/api/trade/admin/product')
      && response.request().method() === 'POST',
  { timeout: 20000 })
  await page.evaluate(() => document.querySelector('.modal-footer .btn-primary')?.click())
  const response = await responsePromise
  const body = await response.json()
  check(response.status() === 200 && body.code === 200 && body.data?.id,
    '新增商品接口返回落库商品 ID', String(body.data?.id ?? body.message))
  const created = body.data
  if (!created?.id) throw new Error(body.message || '商品创建失败')

  await page.goto(`${MDM}/product/list`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.product-list', { timeout: 20000 })
  await page.waitForFunction((name) => document.body.innerText.includes(name), { timeout: 10000 }, productName)
  check(true, '新增商品后运营列表立即出现该商品')

  const detailResponse = await fetch(`${TRADE}/api/trade/public/products/${created.id}`)
  const detailBody = await detailResponse.json()
  const detail = detailBody.data
  check(detailResponse.status === 200 && detailBody.code === 200, '官网公开详情接口可读取新增商品')
  check(detail.productName === productName && detail.productCode === `E2E${timestamp}`,
    '官网详情商品名称与编码来自新增表单')
  check(detail.barcode === `690${timestamp}`, '官网详情条码来自新增表单', detail.barcode ?? '')
  check(Number(detail.price) === 36.8 && Number(detail.stockQuantity) === 320
    && Number(detail.minOrderQuantity) === 5, '官网详情价格、库存与起订量完整落库')
  check(detail.originProvince === '江西省' && detail.originCity === '赣州市'
    && detail.originDistrict === '信丰县', '官网详情产地字段完整落库')
  check(detail.specLevel === '一级' && detail.qualityLevel === '优质'
    && detail.specSize.includes('75-85mm'), '官网详情规格与质量字段完整落库')
  check(detail.description.includes('产地直供')
    && detail.certificationJson.includes('绿色食品')
    && detail.certificationJson.includes('地理标志'),
  '官网详情商品描述与认证信息完整落库', detail.description ?? '')

  const imageResponse = await fetch(`${TRADE}/api/trade/public/products/${created.id}/images`)
  const imageBody = await imageResponse.json()
  const imageUrl = imageBody.data?.[0]?.imageUrl
  check(imageResponse.status === 200 && imageBody.code === 200 && imageUrl?.startsWith('/uploads/trade/'),
    '官网详情图库读取新增上传图片', imageUrl ?? '')
  if (imageUrl) {
    const asset = await fetch(`${TRADE}${imageUrl}`)
    check(asset.status === 200 && (asset.headers.get('content-type') ?? '').startsWith('image/'),
      '商品图片文件可通过网关公开访问', String(asset.status))
  }

  const listResponse = await fetch(
    `${TRADE}/api/trade/public/hall/products?pageNum=1&pageSize=10&keyword=${encodeURIComponent(productName)}`,
  )
  const listBody = await listResponse.json()
  check(listBody.code === 200 && listBody.data?.records?.some((item) => item.id === created.id),
    '新增商品已进入官网商品列表与产业链数据源')

  const detailPage = await browser.newPage()
  const detailErrors = []
  detailPage.on('pageerror', (error) => detailErrors.push(String(error)))
  await detailPage.setViewport({ width: 1440, height: 1000 })
  await detailPage.goto(`${TRADE}/product/detail/${created.id}`, { waitUntil: 'networkidle2', timeout: 60000 })
  await detailPage.waitForSelector('.pd-hero', { timeout: 20000 })
  const detailText = await detailPage.evaluate(() => document.body.innerText)
  check(detailText.includes(productName) && detailText.includes('江西省 赣州市 信丰县')
    && detailText.includes('36.8') && detailText.includes('320')
    && detailText.includes('产地直供'), '官网商品详情页面展示新增表单全部核心字段')
  await detailPage.evaluate(() => {
    const button = [...document.querySelectorAll('.pd-tabs button')]
      .find((item) => item.textContent?.includes('规格参数'))
    button?.click()
  })
  await sleep(200)
  const specText = await detailPage.evaluate(() => document.querySelector('.pd-tab-panel')?.innerText ?? '')
  check(specText.includes(`690${timestamp}`), '官网规格页签展示新增商品条码')
  const renderedImage = await detailPage.evaluate(() => {
    const image = document.querySelector('.pd-main-image img')
    return image ? { src: image.getAttribute('src'), width: image.naturalWidth } : null
  })
  check(renderedImage?.src?.startsWith('/uploads/trade/') && renderedImage.width > 0,
    '官网商品详情实际渲染上传图片', renderedImage?.src ?? '')
  check(detailErrors.length === 0, '新增商品详情页无未捕获脚本异常', detailErrors.slice(0, 2).join(' | '))
  await detailPage.screenshot({ path: path.join(OUT, 'product-publish-detail.png'), fullPage: true })

  console.log(`\n新增商品：id=${created.id} code=${created.productCode} category=${category.text} seller=${seller.text}`)
  console.log(`官网详情：${TRADE}/product/detail/${created.id}`)
} catch (error) {
  check(false, '新增商品联调脚本未抛异常', String(error).slice(0, 260))
} finally {
  await browser.close()
  await rm(tempDir, { recursive: true, force: true })
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)

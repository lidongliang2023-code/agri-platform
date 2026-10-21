#!/usr/bin/env node
/**
 * 主数据管理 · 认证审核联调（2026-10-20）。
 *
 * 覆盖：用户管理 → 认证审核入口、企业/个人合并列表、KPI、搜索、详情、
 * 企业通过、个人驳回、数据库状态落库。
 *
 * 测试数据使用 ASCII 名称，结束后删除；不会改动真实申请。
 */
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require2 = createRequire(path.join(REPO_ROOT, 'agri-production/frontend/package.json'))
const puppeteer = require2('puppeteer')
const MYSQL = 'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe'
const MDM = 'http://localhost:8080'
const HEADFUL = process.argv.includes('--headful')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const sql = (statement) => execFileSync(MYSQL, [
  '--default-character-set=utf8mb4', '-uroot', '-proot', '-N', '-e',
  `USE agri_core; ${statement}`,
], { encoding: 'utf8' }).trim()

const fill = async (page, selector, value) => {
  await page.evaluate(({ sel, val }) => {
    const input = document.querySelector(sel)
    if (!input) throw new Error(`未找到输入框 ${sel}`)
    const proto = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
    setter.call(input, val)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, { sel: selector, val: value })
}

const clickText = async (page, text, selector = 'button') => {
  await page.evaluate(({ label, sel }) => {
    const target = [...document.querySelectorAll(sel)]
      .find((el) => (el.textContent ?? '').replace(/\s/g, '').includes(label.replace(/\s/g, '')))
    if (!target) throw new Error(`未找到 ${label}`)
    target.click()
  }, { label: text, sel: selector })
  await sleep(400)
}

const clickRowButton = async (page, rowText, buttonText) => {
  await page.evaluate(({ row, btn }) => {
    const tr = [...document.querySelectorAll('.data-table tbody tr')]
      .find((el) => (el.textContent ?? '').includes(row))
    if (!tr) throw new Error(`未找到申请行 ${row}`)
    const button = [...tr.querySelectorAll('button')]
      .find((el) => (el.textContent ?? '').replace(/\s/g, '').includes(btn))
    if (!button) throw new Error(`未找到行内按钮 ${btn}`)
    button.click()
  }, { row: rowText, btn: buttonText })
  await sleep(500)
}

const setup = () => {
  const documentDirectory = path.join(
    REPO_ROOT, 'core-platform/uploads/platform/certification/9701')
  fs.mkdirSync(documentDirectory, { recursive: true })
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  )
  const fileIds = {
    businessLicense: '11111111111111111111111111111111.png',
    legalPersonFront: '22222222222222222222222222222222.png',
    legalPersonBack: '33333333333333333333333333333333.png',
  }
  Object.values(fileIds).forEach((fileId) => fs.writeFileSync(path.join(documentDirectory, fileId), png))
  const documentUrl = (kind, fileId) =>
    `/api/v1/sso/account/businesses/9701/certification-files/${kind}/${fileId}`
  sql(`
    DELETE FROM platform_merchant_certification WHERE id=9801;
    DELETE FROM platform_merchant WHERE id=9701;
    DELETE FROM platform_user_identity WHERE id=9802;
    INSERT INTO platform_merchant
      (id, market_id, tenant_id, code, name, type, member_type, status, verify_status, created_at, updated_at, deleted)
      VALUES (9701, 1, 0, 'CERTTEST9701', 'CERT-TEST-ENTERPRISE', 'BOTH', 'enterprise', 1, 'pending', NOW(), NOW(), 0);
    INSERT INTO platform_merchant_certification
      (id, market_id, tenant_id, merchant_id, merchant_name, cert_no, company_name, credit_code,
       legal_person, contact_name, contact_phone, attach_note, business_license_url,
       legal_person_id_front_url, legal_person_id_back_url, cert_status, submit_time, deleted, created_at, updated_at)
      VALUES (9801, 1, 0, 9701, 'CERT-TEST-ENTERPRISE', 'CTTEST9801', 'CERT-TEST-ENTERPRISE',
       '91370700CERTTEST01', 'Test Legal', 'Test Contact', '13900009999', 'E2E materials',
       '${documentUrl('business_license', fileIds.businessLicense)}',
       '${documentUrl('legal_person_id_front', fileIds.legalPersonFront)}',
       '${documentUrl('legal_person_id_back', fileIds.legalPersonBack)}',
       'pending', NOW(), 0, NOW(), NOW());
    INSERT INTO platform_user_identity
      (id, user_id, market_id, identity_no, real_name, id_no_masked, id_no_hash, id_no_salt,
       status, submit_time, created_at, updated_at)
      VALUES (9802, 2112366253521158145, 1, 'IDTEST9802', 'CERT-TEST-PERSON',
       '110***********0010', 'testhash', 'testsalt', 'pending', NOW(), NOW(), NOW());
  `)
}

const cleanup = () => {
  try {
    sql(`
      DELETE FROM platform_merchant_certification WHERE id=9801;
      DELETE FROM platform_merchant WHERE id=9701;
      DELETE FROM platform_user_identity WHERE id=9802;
    `)
  } catch { /* 清理失败不覆盖主结论 */ }
  try {
    fs.rmSync(path.join(
      REPO_ROOT, 'core-platform/uploads/platform/certification/9701'),
    { recursive: true, force: true })
  } catch { /* 清理失败不覆盖主结论 */ }
}

async function loginAndOpen(page) {
  await page.goto(`${MDM}/user/audit`, { waitUntil: 'networkidle2', timeout: 60000 })
  for (let i = 0; i < 30; i++) {
    await sleep(500)
    if (page.url().includes(':8090') || page.url().includes('/login')) break
    if (await page.$('.user-audit')) break
  }
  if (page.url().includes(':8090') || page.url().includes('/login')) {
    await page.waitForSelector('.auth-card', { timeout: 25000 })
    await page.evaluate(() => {
      const tab = [...document.querySelectorAll('button[role="tab"]')].find((el) => (el.textContent ?? '').includes('账号 + 密码'))
      tab?.click()
    })
    await sleep(250)
    await fill(page, 'input[autocomplete="username"]', 'admin')
    await fill(page, 'input[type="password"]', 'Admin@123')
    await page.click('.auth-submit')
    for (let i = 0; i < 40; i++) {
      await sleep(700)
      if (page.url().includes('8080') && !page.url().includes('/login')) break
    }
    if (!page.url().includes('/user/audit')) {
      await page.goto(`${MDM}/user/audit`, { waitUntil: 'networkidle2' })
    }
  }
  await page.waitForSelector('.user-audit', { timeout: 30000 })
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 15000 }).catch(() => {})
  await sleep(500)
}

const browser = await puppeteer.launch({ headless: HEADFUL ? false : 'new', args: ['--no-sandbox'] })
try {
  setup()
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.setViewport({ width: 1440, height: 1000 })
  await loginAndOpen(page)

  const text = await page.evaluate(() => document.body.innerText)
  check(text.includes('认证审核') && text.includes('企业与个人实名认证统一审核'), '主数据端认证审核页已渲染')
  check(text.includes('用户管理') && text.includes('认证审核'), '认证审核入口位于主数据「用户管理」菜单')
  check(text.includes('待审核') && text.includes('企业待审') && text.includes('个人待审'), '审核 KPI 已展示')

  await fill(page, '.search-input', 'CERT-TEST')
  await sleep(500)
  const rowsText = await page.evaluate(() => document.querySelector('.data-table tbody')?.innerText ?? '')
  check(rowsText.includes('CERT-TEST-ENTERPRISE') && rowsText.includes('CERT-TEST-PERSON'),
    '企业与个人申请合并显示')

  // 企业通过
  await clickRowButton(page, 'CERT-TEST-ENTERPRISE', '审核')
  await page.waitForSelector('.audit-detail', { timeout: 10000 })
  const detailText = await page.evaluate(() => document.querySelector('.audit-detail')?.innerText ?? '')
  check(detailText.includes('CERT-TEST-ENTERPRISE') && detailText.includes('E2E materials'), '企业详情展示主体与材料说明')
  await page.waitForFunction(
    () => [...document.querySelectorAll('.material-gallery img')].length === 3
      && [...document.querySelectorAll('.material-gallery img')].every((img) => img.naturalWidth > 0),
    { timeout: 10000 },
  ).catch(() => {})
  const materials = await page.evaluate(() =>
    [...document.querySelectorAll('.material-gallery img')]
      .map((img) => ({ width: img.naturalWidth, alt: img.alt })))
  check(materials.length === 3 && materials.every((item) => item.width > 0),
    '审核详情可鉴权加载营业执照与法人身份证正反面', JSON.stringify(materials))
  await page.screenshot({
    path: path.join('C:/Users/71502/.codex/visualizations/2026/10/16/01a14244-ead8-7ab0-8c7c-df7abac44648',
      'mdm-certification-files.png'),
    fullPage: false,
  })
  await clickText(page, '审核通过', '.audit-detail .modal-footer button')
  await sleep(1500)
  const certStatus = sql("SELECT cert_status FROM platform_merchant_certification WHERE id=9801;")
  const merchantStatus = sql("SELECT verify_status FROM platform_merchant WHERE id=9701;")
  check(certStatus === 'approved' && merchantStatus === 'approved', '企业审核通过并同步主体认证状态', `${certStatus}/${merchantStatus}`)

  // 个人驳回
  await clickRowButton(page, 'CERT-TEST-PERSON', '审核')
  await page.waitForSelector('.audit-detail', { timeout: 10000 })
  await clickText(page, '驳回申请', '.audit-detail .modal-footer button')
  await page.waitForSelector('.modal-content .form-textarea', { timeout: 10000 })
  await fill(page, '.modal-content .form-textarea', 'E2E reject reason')
  await clickText(page, '确认驳回', '.modal-content .modal-footer button')
  await sleep(1800)
  const identityStatus = sql("SELECT status FROM platform_user_identity WHERE id=9802;")
  const identityRemark = sql("SELECT review_remark FROM platform_user_identity WHERE id=9802;")
  check(identityStatus === 'rejected' && identityRemark.includes('E2E reject reason'),
    '个人实名驳回并落库审核意见', `${identityStatus}/${identityRemark}`)

  // 类型筛选
  await clickText(page, '企业认证', '.type-btn')
  await sleep(300)
  const enterpriseOnly = await page.evaluate(() => document.querySelector('.data-table tbody')?.innerText ?? '')
  check(enterpriseOnly.includes('CERT-TEST-ENTERPRISE') && !enterpriseOnly.includes('CERT-TEST-PERSON'),
    '类型筛选只显示企业认证')

  await page.screenshot({
    path: path.join('C:/Users/71502/.codex/visualizations/2026/10/16/01a14244-ead8-7ab0-8c7c-df7abac44648', 'mdm-certification-review.png'),
    fullPage: true
  })
  check(errors.length === 0, '认证审核页面无未捕获脚本异常', errors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '认证审核联调脚本未抛异常', String(error).slice(0, 220))
} finally {
  cleanup()
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)

#!/usr/bin/env node
/** 官网门户个人中心全链路回归（2026-10-21）。 */
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require2 = createRequire(path.join(REPO_ROOT, 'agri-production/frontend/package.json'))
const puppeteer = require2('puppeteer')
const PORTAL = 'http://localhost:8098/portal/'
const OUT = 'C:/Users/71502/.codex/visualizations/2026/10/16/01a14244-ead8-7ab0-8c7c-df7abac44648'
const HEADFUL = process.argv.includes('--headful')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const account = { phone: '19900002005', password: 'Test12345', nickname: '页面注册企业测试有限公司' }

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const redisCode = (phone) => execFileSync(
  'C:\\Redis\\redis-cli.exe',
  ['--raw', 'GET', `agri:sms:code:change_phone:${phone}`],
  { encoding: 'utf8' },
).trim()

const validId = () => {
  const base = `11010519900101${String(Date.now()).slice(-3).padStart(3, '0')}`
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
  const codes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']
  const sum = base.split('').reduce((total, char, index) => total + Number(char) * weights[index], 0)
  return base + codes[sum % 11]
}

const browser = await puppeteer.launch({ headless: HEADFUL ? false : 'new', args: ['--no-sandbox'] })
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.setViewport({ width: 1440, height: 1000 })
  await page.goto(PORTAL, { waitUntil: 'networkidle2', timeout: 60000 })
  const login = await page.evaluate(async ({ phone, password }) => {
    const response = await fetch('/api/v1/sso/login-standalone', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: phone, password, marketId: 1, remember: false }),
    })
    return await response.json()
  }, account)
  check(login.code === 0 && login.data?.stage === 'done', '账号中心测试账号登录成功')

  await page.goto(`${PORTAL}#/account`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.account-page', { timeout: 20000 })
  await page.waitForSelector('.account-tabs button', { timeout: 20000 })
  check((await page.$$eval('.account-tabs button', (items) => items.length)) === 4,
    '个人中心四个功能分区齐全')

  const request = async (path, init = {}) => page.evaluate(async ({ url, options }) => {
    const response = await fetch(url, {
      credentials: 'include',
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    })
    return await response.json()
  }, { url: path, options: init })

  const uploadCertificationDocument = async (merchantId, kind, invalid = false) => page.evaluate(
    async ({ targetMerchantId, documentKind, invalidImage }) => {
      let blob
      if (invalidImage) {
        blob = new Blob(['not-an-image'], { type: 'image/png' })
      } else {
        const canvas = document.createElement('canvas')
        canvas.width = 480
        canvas.height = 300
        const context = canvas.getContext('2d')
        context.fillStyle = documentKind === 'business_license' ? '#e6f4ec' : '#fff5d6'
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.fillStyle = '#174e34'
        context.font = 'bold 32px sans-serif'
        context.fillText(documentKind, 28, 150)
        blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
      }
      const body = new FormData()
      body.append('file', new File([blob], `${documentKind}.png`, { type: blob.type }))
      const response = await fetch(
        `/api/v1/sso/account/businesses/${targetMerchantId}/certification-files?kind=${encodeURIComponent(documentKind)}`,
        { method: 'POST', credentials: 'include', body },
      )
      return { status: response.status, ...(await response.json()) }
    },
    { targetMerchantId: merchantId, documentKind: kind, invalidImage: invalid },
  )

  const original = await request('/api/v1/sso/account/summary')
  check(original.code === 0 && original.data?.username === account.phone, '账号摘要读取真实平台用户')
  const initialActiveMerchantId = original.data?.activeMerchantId
  check(Boolean(initialActiveMerchantId)
    && original.data?.merchants?.filter((item) => item.merchantId === initialActiveMerchantId).length === 1,
  '登录会话只解析出一个当前主体', initialActiveMerchantId ?? '')

  const refreshedSession = await page.evaluate(async () => {
    const response = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    return await response.json()
  })
  const accessToken = refreshedSession.data?.accessToken
  check(refreshedSession.code === 0 && Boolean(accessToken), '可获取平台访问令牌用于主体范围验证')

  const testNickname = `账号中心测试${Date.now().toString().slice(-6)}`
  const profileSave = await request('/api/v1/sso/account/profile', {
    method: 'PUT',
    body: JSON.stringify({ nickname: testNickname, email: 'account-center@example.com' }),
  })
  const afterProfile = await request('/api/v1/sso/account/summary')
  check(profileSave.code === 0 && afterProfile.data?.nickname === testNickname
    && afterProfile.data?.email === 'account-center@example.com', '个人资料修改真实落库')
  const profileRestore = await request('/api/v1/sso/account/profile', {
    method: 'PUT',
    body: JSON.stringify({ nickname: original.data.nickname, email: original.data.email }),
  })
  check(profileRestore.code === 0, '个人资料测试后恢复原值')

  const tempPassword = 'Test12346'
  const passwordChange = await request('/api/v1/sso/account/password', {
    method: 'POST',
    body: JSON.stringify({
      currentPassword: account.password,
      newPassword: tempPassword,
      confirmPassword: tempPassword,
    }),
  })
  const passwordRestore = await request('/api/v1/sso/account/password', {
    method: 'POST',
    body: JSON.stringify({
      currentPassword: tempPassword,
      newPassword: account.password,
      confirmPassword: account.password,
    }),
  })
  check(passwordChange.code === 0 && passwordRestore.code === 0, '密码修改与恢复链路真实可用')

  const newPhone = `199${String(Date.now()).slice(-8)}`
  let sms = await request('/api/v1/sso/sms/code', {
    method: 'POST',
    body: JSON.stringify({ phone: newPhone, scene: 'change_phone' }),
  })
  let code = redisCode(newPhone)
  const phoneChange = await request('/api/v1/sso/account/phone', {
    method: 'POST',
    body: JSON.stringify({ phone: newPhone, code }),
  })
  let afterPhone = await request('/api/v1/sso/account/summary')
  check(sms.code === 0 && phoneChange.code === 0 && afterPhone.data?.phone === newPhone,
    '短信验证后手机号变更真实落库', newPhone)

  sms = await request('/api/v1/sso/sms/code', {
    method: 'POST',
    body: JSON.stringify({ phone: account.phone, scene: 'change_phone' }),
  })
  code = redisCode(account.phone)
  const phoneRestore = await request('/api/v1/sso/account/phone', {
    method: 'POST',
    body: JSON.stringify({ phone: account.phone, code }),
  })
  afterPhone = await request('/api/v1/sso/account/summary')
  check(sms.code === 0 && phoneRestore.code === 0 && afterPhone.data?.phone === account.phone,
    '手机号测试后恢复登录账号')

  const addressCreate = await request('/api/v1/sso/account/addresses', {
    method: 'POST',
    body: JSON.stringify({
      receiverName: '账号中心收货人',
      contactPhone: account.phone,
      province: '山东省',
      city: '潍坊市',
      district: '寿光市',
      detailAddress: '账号中心测试路 66 号',
      postalCode: '262700',
      isDefault: true,
    }),
  })
  const addressId = addressCreate.data?.id
  check(addressCreate.code === 0 && addressId, '新增收货地址真实落库')
  const addressUpdate = await request(`/api/v1/sso/account/addresses/${addressId}`, {
    method: 'PUT',
    body: JSON.stringify({
      receiverName: '账号中心收货人',
      contactPhone: account.phone,
      province: '山东省',
      city: '潍坊市',
      district: '寿光市',
      detailAddress: '账号中心测试路 88 号',
      postalCode: '262700',
      isDefault: true,
    }),
  })
  const afterAddress = await request('/api/v1/sso/account/addresses')
  check(addressUpdate.code === 0
    && afterAddress.data?.some((item) => item.id === addressId && item.detailAddress.includes('88 号')),
  '收货地址修改、默认地址和查询可用')

  const realName = await request('/api/v1/sso/account/real-name', {
    method: 'POST',
    body: JSON.stringify({
      realName: '账号中心实名测试',
      idCard: validId(),
      contactPhone: account.phone,
      address: '山东省潍坊市寿光市账号中心路 1 号',
      validStart: '2020-01-01',
      validEnd: '2040-01-01',
      businessType: '家庭农场',
      email: 'account-center@example.com',
    }),
  })
  const afterRealName = await request('/api/v1/sso/account/summary')
  check(realName.code === 0 && afterRealName.data?.realName?.status === 'pending',
    '企业账号也可提交账号级个人实名认证')

  const beforeCreate = await request('/api/v1/sso/account/summary')
  const createSubject = await request('/api/v1/sso/account/businesses', {
    method: 'POST',
    body: JSON.stringify({
      identity: 'personal',
      realName: '账号中心新增主体',
      idCard: validId(),
      businessType: '家庭农场',
      address: '山东省潍坊市寿光市主体创建路 2 号',
      contactName: '账号中心新增主体',
      contactPhone: account.phone,
      email: 'account-center@example.com',
      validStart: '2020-01-01',
      validEnd: '2040-01-01',
    }),
  })
  const afterCreate = await request('/api/v1/sso/account/summary')
  const addedMerchant = (afterCreate.data?.merchants ?? []).find((item) =>
    !(beforeCreate.data?.merchants ?? []).some((old) => old.merchantId === item.merchantId))
  check(createSubject.code === 0 && addedMerchant?.memberType === 'personal',
    '已有主体账号仍可创建新的个人主体', addedMerchant?.merchantName ?? '')

  const enterpriseName = `账号中心创建企业主体${Date.now().toString().slice(-6)}`
  const beforeEnterprise = await request('/api/v1/sso/account/summary')
  const createEnterprise = await request('/api/v1/sso/account/businesses', {
    method: 'POST',
    body: JSON.stringify({
      identity: 'enterprise',
      companyName: enterpriseName,
      creditCode: `913707${String(Date.now()).padStart(12, '0').slice(-12)}`,
      industry: '果蔬产业',
      companySize: '10-50人',
      address: '山东省潍坊市寿光市企业总部路 3 号',
      contactName: '企业主体联系人',
      contactPhone: account.phone,
      legalPerson: '企业主体法人',
      email: 'account-center@example.com',
    }),
  })
  const afterEnterprise = await request('/api/v1/sso/account/summary')
  const addedEnterprise = (afterEnterprise.data?.merchants ?? []).find((item) =>
    !(beforeEnterprise.data?.merchants ?? []).some((old) => old.merchantId === item.merchantId))
  check(createEnterprise.code === 0 && addedEnterprise?.memberType === 'enterprise'
    && addedEnterprise?.verifyStatus !== 'approved',
  '已有主体账号可创建待认证企业主体', addedEnterprise?.merchantName ?? '')
  let uploadedDocuments = null
  if (addedEnterprise?.merchantName) {
    // 主体是 API 新建的，当前 SPA 的内存摘要不会自动感知；强制刷新才能按真实后端状态渲染。
    await page.goto(`${PORTAL}#/account?tab=business`, { waitUntil: 'networkidle2', timeout: 60000 })
    await page.reload({ waitUntil: 'networkidle2', timeout: 60000 })
    await page.waitForSelector('.account-tabs button', { timeout: 20000 })
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('.account-tabs button')]
        .find((item) => item.textContent?.includes('主体资料与认证'))
      button?.click()
    })
    await page.waitForSelector('.merchant-row', { timeout: 15000 })
    const openedCertification = await page.evaluate((name) => {
      const rows = [...document.querySelectorAll('.merchant-row')]
      const namedRow = rows.find((item) => (item.textContent ?? '').includes(name))
      const fallbackRow = rows.find((item) => [...item.querySelectorAll('button')]
        .some((button) => (button.textContent ?? '').trim() === '去认证'))
      const row = namedRow ?? fallbackRow
      const button = [...(row?.querySelectorAll('button') ?? [])]
        .find((item) => (item.textContent ?? '').trim() === '去认证')
      button?.click()
      return Boolean(button)
    }, addedEnterprise.merchantName)
    check(openedCertification, '待认证企业主体显示去认证操作')
    await page.waitForSelector('.account-modal', { timeout: 10000 })
    const certificationText = await page.evaluate(() => document.querySelector('.account-modal')?.innerText ?? '')
    check(['企业名称', '统一社会信用代码', '法定代表人', '营业执照号', '营业执照照片', '法人身份证人像面', '法人身份证国徽面', '联系人姓名', '联系电话', '认证材料说明']
      .every((label) => certificationText.includes(label)),
    '个人中心企业认证弹窗包含完整认证字段')
    await page.screenshot({
      path: path.join(OUT, 'account-certification-upload-form.png'),
      fullPage: false,
    })

    const documentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agri-certification-docs-'))
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    )
    const filePaths = [
      'business-license.png',
      'legal-person-front.png',
      'legal-person-back.png',
    ].map((filename) => {
      const filePath = path.join(documentDir, filename)
      fs.writeFileSync(filePath, png)
      return filePath
    })
    try {
      for (let index = 0; index < filePaths.length; index += 1) {
        const inputs = await page.$$('.certification-upload input[type="file"]')
        if (!inputs.length) throw new Error('认证材料文件选择框不存在')
        await inputs[0].uploadFile(filePaths[index])
        await page.waitForFunction(
          (expected) => document.querySelectorAll('.certification-document-preview img').length >= expected,
          { timeout: 10000 },
          index + 1,
        )
      }
      const previewUrls = await page.$$eval('.certification-document-preview img',
        (images) => images.map((image) => image.getAttribute('src')))
      uploadedDocuments = {
        businessLicenseUrl: previewUrls[0],
        legalPersonIdFrontUrl: previewUrls[1],
        legalPersonIdBackUrl: previewUrls[2],
      }
      check(previewUrls.length === 3 && previewUrls.every((url) => url?.includes('/certification-files/')),
        '浏览器选择三张图片后均显示缩略图')
      await page.screenshot({
        path: path.join(OUT, 'account-certification-files.png'),
        fullPage: false,
      })
    } finally {
      fs.rmSync(documentDir, { recursive: true, force: true })
    }
    await page.click('.account-modal-close')

    const clickedSwitch = await page.evaluate((name) => {
      const row = [...document.querySelectorAll('.merchant-row')]
        .find((item) => (item.textContent ?? '').includes(name))
      const button = [...(row?.querySelectorAll('button') ?? [])]
        .find((item) => (item.textContent ?? '').includes('切换为此主体'))
      button?.click()
      return Boolean(button)
    }, addedEnterprise.merchantName)
    check(clickedSwitch, '个人中心为目标主体显示切换入口')
    await page.waitForFunction((merchantId) => {
      const active = document.querySelector('.merchant-row.active')
      return active?.textContent?.includes(merchantId)
    }, { timeout: 10000 }, addedEnterprise.merchantId)
    await page.screenshot({
      path: path.join(OUT, 'account-active-merchant.png'),
      fullPage: true,
    })
    const afterSwitch = await request('/api/v1/sso/account/summary')
    check(afterSwitch.data?.activeMerchantId === addedEnterprise.merchantId,
      '页面切换后当前登录主体已更新')
    const scopedMerchants = await page.evaluate(async (token) => {
      const response = await fetch('/api/v1/platform/merchants/mine', {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      })
      return await response.json()
    }, accessToken)
    check(scopedMerchants.code === 0 && scopedMerchants.data?.length === 1
      && scopedMerchants.data[0]?.merchantId === addedEnterprise.merchantId,
    '业务侧主体范围只返回当前这一家')
    const productionScoped = await fetch(
      'http://localhost:8092/api/v1/production/members?pageNum=1&pageSize=10',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    ).then((response) => response.json())
    check([0, 200].includes(productionScoped.code) && productionScoped.data?.total === 0,
      '生产管理模块切换到新主体后查询新主体的空数据范围')
    const productionCreate = await fetch(
      'http://localhost:8092/api/v1/production/members',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memberName: '主体切换测试成员',
          phone: '13700008888',
          memberType: 'OPERATOR',
          postName: '测试操作员',
          joinDate: '2026-10-21',
          status: 1,
        }),
      },
    ).then((response) => response.json())
    const productionMemberId = productionCreate.data
    const productionAfterCreate = await fetch(
      'http://localhost:8092/api/v1/production/members?pageNum=1&pageSize=10',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    ).then((response) => response.json())
    check([0, 200].includes(productionCreate.code) && Boolean(productionMemberId)
      && productionAfterCreate.data?.records?.some((item) => item.memberId === productionMemberId),
    '生产管理模块的数据新增与查询均落在切换后的主体')
    if (productionMemberId) {
      const productionDelete = await fetch(
        `http://localhost:8092/api/v1/production/members/${encodeURIComponent(productionMemberId)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      ).then((response) => response.json())
      check([0, 200].includes(productionDelete.code), '主体切换测试成员已删除')
      execFileSync(
        'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe',
        ['-uroot', '--batch', '-e',
          `DELETE FROM agri_production.agri_prod_member WHERE member_id='${productionMemberId}';`],
        { env: { ...process.env, MYSQL_PWD: 'root' } },
      )
    }
    const forbiddenSwitch = await request('/api/v1/sso/account/businesses/2001/activate',
      { method: 'POST' })
    check(forbiddenSwitch.code === 403, '不能切换到自己未绑定的经营主体')
  }
  if (addedEnterprise?.merchantId) {
    const incomplete = await request(
      `/api/v1/sso/account/businesses/${addedEnterprise.merchantId}/submit-certification`,
      {
        method: 'POST',
        body: JSON.stringify({
          companyName: addedEnterprise.merchantName,
          creditCode: '91370783MA3C8ACC01',
          legalPerson: '企业认证法人',
          contactName: '企业主体联系人',
          contactPhone: account.phone,
        }),
      },
    )
    check(incomplete.code === 400 && String(incomplete.message).includes('营业执照'),
      '缺少认证材料时提交被后端拦截')

    const invalid = await uploadCertificationDocument(
      addedEnterprise.merchantId, 'business_license', true)
    check(invalid.code === 400, '伪装成图片的非法文件被拒绝')

    const preview = await page.evaluate(async (url) => {
      const response = await fetch(url, { credentials: 'include' })
      return { status: response.status, type: response.headers.get('content-type'), size: (await response.arrayBuffer()).byteLength }
    }, uploadedDocuments.businessLicenseUrl)
    check(preview.status === 200 && preview.type?.startsWith('image/') && preview.size > 0,
      '申请人可读取已上传材料且返回真实图片流')
  }
  let enterpriseCertified = { code: -1 }
  if (addedEnterprise?.merchantId && uploadedDocuments) {
    enterpriseCertified = await request(
      `/api/v1/sso/account/businesses/${addedEnterprise.merchantId}/submit-certification`,
      {
        method: 'POST',
        body: JSON.stringify({
          companyName: addedEnterprise.merchantName,
          creditCode: '91370783MA3C8ACC01',
          legalPerson: '企业认证法人',
          licenseNo: 'BL-ACCOUNT-CENTER-001',
          contactName: '企业主体联系人',
          contactPhone: account.phone,
          attachNote: '个人中心企业认证联调材料说明',
          ...uploadedDocuments,
        }),
      },
    )
    const certifiedSummary = await request('/api/v1/sso/account/summary')
    const certifiedMerchant = certifiedSummary.data?.merchants
      ?.find((item) => item.merchantId === addedEnterprise.merchantId)
    check(enterpriseCertified.code === 0 && certifiedMerchant?.verifyStatus === 'pending',
      '未认证企业主体可从入口提交认证审核')
    check(certifiedMerchant?.certification?.legalPerson === '企业认证法人'
      && certifiedMerchant?.certification?.status === 'pending',
    '企业认证资料完整落库并显示认证单号')
    const persistedUrls = execFileSync(
      'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe',
      ['-uroot', '-N', '--batch', '-e',
        `SELECT CONCAT_WS('|', business_license_url, legal_person_id_front_url, legal_person_id_back_url) FROM agri_core.platform_merchant_certification WHERE merchant_id=${addedEnterprise.merchantId} ORDER BY id DESC LIMIT 1;`],
      { encoding: 'utf8', env: { ...process.env, MYSQL_PWD: 'root' } },
    ).trim()
    check(persistedUrls.split('|').length === 3 && persistedUrls.includes('business_license'),
      '三张企业认证材料地址已真实落库')
  }

  const search = await request('/api/v1/sso/account/businesses/search?keyword=%E7%BB%BF%E6%BA%90')
  const business = (search.data ?? []).find((item) => !item.alreadyJoined)
  check(search.code === 0 && Boolean(business), '可搜索待加入的经营主体', business?.name ?? '')
  let joinId = ''
  if (business) {
    const join = await request('/api/v1/sso/account/businesses/join-requests', {
      method: 'POST',
      body: JSON.stringify({
        merchantId: business.merchantId,
        roleInMerchant: 'buyer',
        message: '账号中心联调申请',
      }),
    })
    joinId = join.data?.id
    const afterJoin = await request('/api/v1/sso/account/summary')
    check(join.code === 0 && afterJoin.data?.sentJoinRequests
      ?.some((item) => item.id === joinId && item.status === 'pending'),
    '加入经营主体申请真实落库并进入待审批')
  }

  await page.reload({ waitUntil: 'networkidle2' })
  await page.waitForSelector('.account-tabs button', { timeout: 20000 })
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.account-tabs button')]
      .find((item) => item.textContent?.includes('主体资料与认证'))
    button?.click()
  })
  await page.waitForFunction(() => {
    const text = document.body.innerText
    return text.includes('创建企业主体') && text.includes('创建个人主体')
  }, { timeout: 10000 })
  check(true, '登录后始终显示创建企业/个人主体入口')
  const merchantDetails = await page.evaluate(() =>
    document.querySelector('.merchant-detail-grid')?.innerText ?? '')
  check(['主体编码', '经营主体 ID', '联系人', '联系电话', '主体状态']
    .every((label) => merchantDetails.includes(label)),
  '个人中心展示经营主体完整资料')
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')]
      .find((item) => item.textContent?.trim() === '创建企业主体')
    button?.click()
  })
  await page.waitForSelector('.account-modal', { timeout: 10000 })
  const enterpriseFields = await page.evaluate(() => (
    [...document.querySelectorAll('.account-modal .account-form-grid > label')]
      .map((label) => label.childNodes[0]?.textContent?.trim())
  ))
  check(JSON.stringify(enterpriseFields) === JSON.stringify(
    ['企业名称', '统一社会信用代码', '所属行业', '企业规模', '注册地址', '联系人姓名']),
  '企业主体创建字段与注册向导一致')
  const enterpriseSizes = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('.account-modal label')]
    const sizeLabel = labels.find((item) => item.textContent?.includes('企业规模'))
    return [...(sizeLabel?.querySelectorAll('option') ?? [])].map((item) => item.textContent?.trim())
  })
  check(JSON.stringify(enterpriseSizes) === JSON.stringify(
    ['微型（20人以下）', '小型（20-100人）', '中型（100-500人）', '大型（500人以上）']),
  '企业规模选项与注册向导一致')
  await page.click('.account-modal-close')
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')]
      .find((item) => item.textContent?.trim() === '创建个人主体')
    button?.click()
  })
  await page.waitForSelector('.account-modal', { timeout: 10000 })
  const personalFields = await page.evaluate(() => (
    [...document.querySelectorAll('.account-modal .account-form-grid > label')]
      .map((label) => label.childNodes[0]?.textContent?.trim())
  ))
  check(JSON.stringify(personalFields) === JSON.stringify(
    ['真实姓名', '身份证号', '经营类型', '联系人姓名']),
  '个人主体创建字段与注册向导一致')
  const businessTypes = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('.account-modal label')]
    const typeLabel = labels.find((item) => item.textContent?.includes('经营类型'))
    return [...(typeLabel?.querySelectorAll('option') ?? [])].map((item) => item.textContent?.trim())
  })
  check(JSON.stringify(businessTypes) === JSON.stringify(
    ['家庭农场', '农民专业合作社', '个体采购户', '经纪人', '其他']),
  '个人经营类型选项与注册向导一致')
  await page.click('.account-modal-close')
  check((await page.evaluate(() => document.body.innerText)).includes('去实名认证'),
    '未认证个人主体显示认证入口')
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.account-tabs button')]
      .find((item) => item.textContent?.includes('地址管理'))
    button?.click()
  })
  await page.waitForFunction(() => document.body.innerText.includes('账号中心测试路 88 号'), { timeout: 10000 })
  check(true, '个人中心地址页显示真实地址')
  await page.screenshot({ path: path.join(OUT, 'account-center.png'), fullPage: true })
  await page.setViewport({ width: 390, height: 844 })
  await page.goto(`${PORTAL}#/account`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.account-tabs button', { timeout: 20000 })
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check(mobileOverflow <= 1, '个人中心 390px 无横向溢出', String(mobileOverflow))
  await page.screenshot({ path: path.join(OUT, 'account-center-mobile.png'), fullPage: true })

  const addressDelete = await request(`/api/v1/sso/account/addresses/${addressId}`, { method: 'DELETE' })
  check(addressDelete.code === 0, '收货地址删除可用')
  if (initialActiveMerchantId) {
    const restored = await request(
      `/api/v1/sso/account/businesses/${initialActiveMerchantId}/activate`,
      { method: 'POST' },
    )
    check(restored.code === 0, '切换测试后恢复原当前主体')
    await sleep(2300)
    const restoredProduction = await fetch(
      'http://localhost:8092/api/v1/production/members?pageNum=1&pageSize=10',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    ).then((response) => response.json())
    check([0, 200].includes(restoredProduction.code),
      '恢复主体后生产管理模块继续可用')
  }
  if (joinId) {
    const cancel = await request(`/api/v1/sso/account/businesses/join-requests/${joinId}`, { method: 'DELETE' })
    check(cancel.code === 0, '加入主体申请可撤回')
  }
  if (addedMerchant?.merchantId) {
    execFileSync(
      'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe',
      ['-uroot', '--batch', '-e',
        `DELETE FROM agri_core.platform_user_merchant WHERE user_id=(SELECT id FROM agri_core.platform_user WHERE phone='${account.phone}') AND merchant_id=${addedMerchant.merchantId}; DELETE FROM agri_core.platform_merchant WHERE id=${addedMerchant.merchantId};`],
      { env: { ...process.env, MYSQL_PWD: 'root' } },
    )
    check(true, '主体创建测试数据已清理')
  }
  if (addedEnterprise?.merchantId) {
    execFileSync(
      'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe',
      ['-uroot', '--batch', '-e',
        `DELETE FROM agri_core.platform_merchant_certification WHERE merchant_id=${addedEnterprise.merchantId}; DELETE FROM agri_core.platform_user_merchant WHERE user_id=(SELECT id FROM agri_core.platform_user WHERE phone='${account.phone}') AND merchant_id=${addedEnterprise.merchantId}; DELETE FROM agri_core.platform_merchant WHERE id=${addedEnterprise.merchantId};`],
      { env: { ...process.env, MYSQL_PWD: 'root' } },
    )
    if (/^\d+$/.test(String(addedEnterprise.merchantId))) {
      fs.rmSync(path.join(
        REPO_ROOT,
        'core-platform/uploads/platform/certification',
        String(addedEnterprise.merchantId),
      ), { recursive: true, force: true })
    }
    check(true, '企业认证测试数据已清理')
  }
  const activeKey = `agri:active-merchant:${original.data.userId}:1`
  const activeBeforeLogout = execFileSync(
    'C:\\Redis\\redis-cli.exe',
    ['--raw', 'GET', activeKey],
    { encoding: 'utf8' },
  ).trim()
  await page.evaluate(async () => {
    await fetch('/api/v1/sso/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
  })
  const activeAfterLogout = execFileSync(
    'C:\\Redis\\redis-cli.exe',
    ['--raw', 'EXISTS', activeKey],
    { encoding: 'utf8' },
  ).trim()
  check(activeBeforeLogout === initialActiveMerchantId && activeAfterLogout === '0',
    '退出登录后清除当前主体状态')
  check(errors.length === 0, '个人中心无未捕获脚本异常', errors.slice(0, 2).join(' | '))

  console.log('\n个人中心地址：http://localhost:8098/portal/#/account')
} catch (error) {
  check(false, '个人中心回归未抛异常', String(error).slice(0, 260))
} finally {
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)

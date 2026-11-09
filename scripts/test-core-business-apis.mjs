#!/usr/bin/env node
/**
 * 现代农业产业互联网平台 - 各子系统核心业务接口自动化测试套件
 * 
 * 全面覆盖 11 大业务子系统与技术中枢：
 *  1. Core / SSO (统一认证中心与主控 - 8093)
 *  2. Production (生产管理系统 - 8092)
 *  3. Master Data (主数据治理中心 - 8083)
 *  4. Trade (交易撮合平台 - 8089)
 *  5. Finance (供应链金融系统 - 8087)
 *  6. S2B2C (供应链商城四端 - 8088)
 *  7. IoT (物联网智能监控 - 8091)
 *  8. Service (综合服务子系统 - 8094)
 *  9. Info (信息资讯子系统 - 8096)
 * 10. Government (政府监管子系统 - 8095)
 * 11. AI Hub (AI智算中枢中台 - 8201)
 */

import process from 'node:process'

const CORE_URL = process.env.CORE_URL || 'http://localhost:8093'
const PROD_URL = process.env.PROD_URL || 'http://localhost:8092'
const MDM_URL = process.env.MDM_URL || 'http://localhost:8083'
const TRADE_URL = process.env.TRADE_URL || 'http://localhost:8089'
const FINANCE_URL = process.env.FINANCE_URL || 'http://localhost:8087'
const S2B2C_URL = process.env.S2B2C_URL || 'http://localhost:8088'
const IOT_URL = process.env.IOT_URL || 'http://localhost:8091'
const SERVICE_URL = process.env.SERVICE_URL || 'http://localhost:8094'
const INFO_URL = process.env.INFO_URL || 'http://localhost:8096'
const GOV_URL = process.env.GOV_URL || 'http://localhost:8095'
const AI_URL = process.env.AI_URL || 'http://localhost:8201'

const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  failures: []
}

function printHeader(title) {
  console.log(`\n======================================================`)
  console.log(`  ${title}`)
  console.log(`======================================================`)
}

async function request(url, options = {}) {
  const start = Date.now()
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Accept': 'application/json',
        ...(options.headers || {})
      }
    })
    const latency = Date.now() - start
    let data = null
    const text = await res.text()
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
    return { status: res.status, ok: res.ok, data, latency }
  } catch (err) {
    return { status: 0, ok: false, error: err.message, latency: Date.now() - start }
  }
}

async function assertApi({ domain, name, url, options = {}, assertFn }) {
  stats.total++
  const res = await request(url, options)
  let passed = false
  let reason = ''

  if (!res.ok && res.status !== 200) {
    reason = `HTTP ${res.status}: ${res.error || (typeof res.data === 'string' ? res.data.slice(0, 100) : JSON.stringify(res.data))}`
  } else {
    try {
      const result = assertFn ? assertFn(res.data, res) : (res.status === 200)
      if (result === true || result === undefined) {
        passed = true
      } else {
        reason = typeof result === 'string' ? result : '断言未通过'
      }
    } catch (e) {
      reason = `断言异常: ${e.message}`
    }
  }

  const mark = passed ? ' [PASS] ' : ' [FAIL] '
  const latencyStr = `${res.latency}ms`.padStart(6, ' ')
  console.log(`${mark} [${domain}] ${name.padEnd(24, ' ')} (${latencyStr}) -> ${url}`)
  if (!passed) {
    console.log(`         原因: ${reason}`)
    stats.failed++
    stats.failures.push({ domain, name, reason, url })
  } else {
    stats.passed++
  }
  return res
}

function isSuccessCode(code) {
  return code === 200 || code === 0 || code === '0' || code === '200'
}

async function run() {
  console.log('>>> 正在启动各子系统核心业务接口全流程测试...\n')

  // 1. 统一认证中心与核心平台 (Core SSO)
  printHeader('1. 统一认证中心与核心平台 (Core SSO / 8093)')
  let token = ''
  await assertApi({
    domain: 'SSO',
    name: '统一登录与令牌签发',
    url: `${CORE_URL}/api/v1/auth/login`,
    options: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Admin@123', marketId: 1 })
    },
    assertFn: (body) => {
      if (isSuccessCode(body?.code) && body?.data?.accessToken) {
        token = body.data.accessToken
        return true
      }
      return `未能获取有效 accessToken: ${JSON.stringify(body)}`
    }
  })

  const authHeader = token ? { 'Authorization': `Bearer ${token}` } : {}

  await assertApi({
    domain: 'SSO',
    name: '授权子系统模块列表',
    url: `${CORE_URL}/api/v1/sso/account/modules`,
    options: { headers: authHeader },
    assertFn: (body) => {
      const modules = body?.data?.modules || (Array.isArray(body?.data) ? body.data : [])
      return (modules.length > 0) || '授权模块列表为空'
    }
  })

  await assertApi({
    domain: 'SSO',
    name: '平台角色权限码治理',
    url: `${CORE_URL}/api/v1/admin/roles/MARKET_OPS/permissions`,
    options: { headers: authHeader },
    assertFn: (body) => isSuccessCode(body?.code) && Array.isArray(body?.data)
  })

  // 2. 生产管理子系统 (agri-production)
  printHeader('2. 生产管理子系统 (agri-production / 8092)')
  await assertApi({
    domain: 'Production',
    name: '示范农场分页列表',
    url: `${PROD_URL}/api/v1/production/farms?pageNum=1&pageSize=10`,
    options: { headers: authHeader },
    assertFn: (body) => isSuccessCode(body?.code) && body?.data?.records !== undefined
  })

  await assertApi({
    domain: 'Production',
    name: '种植地块台账清单',
    url: `${PROD_URL}/api/v1/production/plots?pageNum=1&pageSize=10`,
    options: { headers: authHeader },
    assertFn: (body) => isSuccessCode(body?.code) && body?.data?.records !== undefined
  })

  await assertApi({
    domain: 'Production',
    name: '农事种植计划清单',
    url: `${PROD_URL}/api/v1/production/plans?pageNum=1&pageSize=10`,
    options: { headers: authHeader },
    assertFn: (body) => isSuccessCode(body?.code)
  })

  await assertApi({
    domain: 'Production',
    name: '生产农事作业任务',
    url: `${PROD_URL}/api/v1/production/tasks?pageNum=1&pageSize=10`,
    options: { headers: authHeader },
    assertFn: (body) => isSuccessCode(body?.code)
  })

  await assertApi({
    domain: 'Production',
    name: '农产品采收管理台账',
    url: `${PROD_URL}/api/v1/production/harvests?pageNum=1&pageSize=10`,
    options: { headers: authHeader },
    assertFn: (body) => isSuccessCode(body?.code)
  })

  await assertApi({
    domain: 'Production',
    name: '生产驾驶舱全景态势',
    url: `${PROD_URL}/api/v1/production/admin/dashboard`,
    options: { headers: authHeader },
    assertFn: (body) => isSuccessCode(body?.code) && body?.data?.farmCount !== undefined
  })

  // 3. 主数据管理平台 (agri-master-data)
  printHeader('3. 主数据管理平台 (agri-master-data / 8083)')
  await assertApi({
    domain: 'MasterData',
    name: '平台用户全量治理列表',
    url: `${MDM_URL}/admin/masterdata/user/list?pageNum=1&pageSize=10`,
    options: { headers: authHeader },
    assertFn: (body) => isSuccessCode(body?.code) && (Array.isArray(body?.data?.list) || Array.isArray(body?.data?.records))
  })

  await assertApi({
    domain: 'MasterData',
    name: '主数据运营态势看板',
    url: `${MDM_URL}/admin/masterdata/dashboard`,
    options: { headers: authHeader },
    assertFn: (body) => isSuccessCode(body?.code) && body?.data !== undefined
  })

  await assertApi({
    domain: 'MasterData',
    name: '主数据健康度仪表盘',
    url: `${MDM_URL}/admin/masterdata/dashboard/health`,
    options: { headers: authHeader },
    assertFn: (body) => isSuccessCode(body?.code) && body?.data !== undefined
  })

  // 4. 交易撮合平台 (agri-trade)
  printHeader('4. 交易撮合平台 (agri-trade / 8089)')
  await assertApi({
    domain: 'Trade',
    name: '公开交易品类与分类树',
    url: `${TRADE_URL}/api/trade/public/categories`,
    assertFn: (body) => isSuccessCode(body?.code) && Array.isArray(body?.data)
  })

  await assertApi({
    domain: 'Trade',
    name: '大宗农产品公开展示流',
    url: `${TRADE_URL}/api/trade/public/products?limit=8`,
    assertFn: (body) => isSuccessCode(body?.code) && Array.isArray(body?.data)
  })

  await assertApi({
    domain: 'Trade',
    name: '采购需求交易大厅列表',
    url: `${TRADE_URL}/api/trade/public/demands?limit=8`,
    assertFn: (body) => isSuccessCode(body?.code) && Array.isArray(body?.data)
  })

  // 5. 供应链金融系统 (agri-finance)
  printHeader('5. 供应链金融系统 (agri-finance / 8087)')
  await assertApi({
    domain: 'Finance',
    name: '公开金融信贷产品线',
    url: `${FINANCE_URL}/open/finance/products`,
    assertFn: (body) => isSuccessCode(body?.code) && Array.isArray(body?.data)
  })

  await assertApi({
    domain: 'Finance',
    name: '授信评分与风控模型报告',
    url: `${FINANCE_URL}/api/v1/credit/score`,
    options: { headers: authHeader },
    assertFn: (body) => isSuccessCode(body?.code) && (body?.data?.compositeScore !== undefined || body?.data?.score !== undefined)
  })

  // 获取资金方专属 Token 测试资金工作台
  let fundToken = token
  try {
    const fundLogin = await request(`${CORE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'fund', password: 'Admin@123', marketId: 1 })
    })
    if (fundLogin.data?.data?.accessToken) {
      fundToken = fundLogin.data.data.accessToken
    }
  } catch {}

  await assertApi({
    domain: 'Finance',
    name: '资金方机构工作台概览',
    url: `${FINANCE_URL}/api/v1/fund-workbench/mine`,
    options: { headers: { 'Authorization': `Bearer ${fundToken}` } },
    assertFn: (body) => isSuccessCode(body?.code) && body?.data !== undefined
  })

  // 6. S2B2C 供应链商城 (agri-s2b2c)
  printHeader('6. S2B2C 供应链商城 (agri-s2b2c / 8088)')
  await assertApi({
    domain: 'S2B2C',
    name: '消费者商城商品列表',
    url: `${S2B2C_URL}/api/consumer/products?page=1&size=10`,
    options: { headers: authHeader },
    assertFn: (body) => Array.isArray(body?.records) || body?.total !== undefined
  })

  await assertApi({
    domain: 'S2B2C',
    name: '精选渠道商专属店铺池',
    url: `${S2B2C_URL}/api/consumer/channels?limit=10`,
    options: { headers: authHeader },
    assertFn: (body) => Array.isArray(body)
  })

  await assertApi({
    domain: 'S2B2C',
    name: '平台端供应商审核工作流',
    url: `${S2B2C_URL}/api/platform/suppliers?page=1&size=10`,
    options: { headers: authHeader },
    assertFn: (body) => Array.isArray(body?.records) || body?.total !== undefined
  })

  // 7. 物联网平台 (agri-iot)
  printHeader('7. 物联网平台 (agri-iot / 8091)')
  await assertApi({
    domain: 'IoT',
    name: '示范农场物联网监测总览',
    url: `${IOT_URL}/api/v1/iot/app/overview`,
    options: { headers: authHeader },
    assertFn: (body) => isSuccessCode(body?.code) && body?.data?.farm !== undefined
  })

  await assertApi({
    domain: 'IoT',
    name: '物联网在线传感设备清单',
    url: `${IOT_URL}/api/v1/iot/app/devices`,
    options: { headers: authHeader },
    assertFn: (body) => isSuccessCode(body?.code) && Array.isArray(body?.data)
  })

  await assertApi({
    domain: 'IoT',
    name: '物联网遥测设备指标统计',
    url: `${IOT_URL}/api/v1/iot/app/device-stats`,
    options: { headers: authHeader },
    assertFn: (body) => isSuccessCode(body?.code) && body?.data !== undefined
  })

  // 8. 综合服务子系统 (agri-service)
  printHeader('8. 综合服务子系统 (agri-service / 8094)')
  await assertApi({
    domain: 'Service',
    name: '综合服务大屏业务概览',
    url: `${SERVICE_URL}/api/v1/service/overview`,
    options: { headers: authHeader },
    assertFn: (body) => isSuccessCode(body?.code) && body?.data?.stats !== undefined
  })

  await assertApi({
    domain: 'Service',
    name: '三农技术专家智库列表',
    url: `${SERVICE_URL}/api/v1/service/experts`,
    options: { headers: authHeader },
    assertFn: (body) => isSuccessCode(body?.code) && Array.isArray(body?.data)
  })

  await assertApi({
    domain: 'Service',
    name: '统一业务分类与字典词表',
    url: `${SERVICE_URL}/api/v1/service/dictionaries`,
    options: { headers: authHeader },
    assertFn: (body) => isSuccessCode(body?.code) && body?.data !== undefined
  })

  // 9. 信息资讯子系统 (agri-info)
  printHeader('9. 信息资讯子系统 (agri-info / 8096)')
  await assertApi({
    domain: 'Info',
    name: '资讯行情公开全景总览',
    url: `${INFO_URL}/api/v1/info/public/overview`,
    assertFn: (body) => isSuccessCode(body?.code) && body?.data?.stats !== undefined
  })

  await assertApi({
    domain: 'Info',
    name: '行业资讯与三农政策文章',
    url: `${INFO_URL}/api/v1/info/public/articles?page=1&size=10`,
    assertFn: (body) => isSuccessCode(body?.code) && Array.isArray(body?.data?.items || body?.data?.records || body?.data?.list || body?.data)
  })

  await assertApi({
    domain: 'Info',
    name: '农产品大宗市场价格行情',
    url: `${INFO_URL}/api/v1/info/public/markets`,
    assertFn: (body) => isSuccessCode(body?.code) && body?.data !== undefined
  })

  // 10. 政府监管子系统 (agri-government)
  printHeader('10. 政府监管子系统 (agri-government / 8095)')
  await assertApi({
    domain: 'Government',
    name: '监管机构身份与管辖区域',
    url: `${GOV_URL}/api/v1/government/identity`,
    options: { headers: authHeader },
    assertFn: (body) => isSuccessCode(body?.code) && (body?.data?.department !== undefined || body?.data?.region !== undefined || body?.data !== undefined)
  })

  await assertApi({
    domain: 'Government',
    name: '政府监管指挥大屏工作台',
    url: `${GOV_URL}/api/v1/government/home`,
    options: { headers: authHeader },
    assertFn: (body) => isSuccessCode(body?.code) && (body?.data?.subject !== undefined || body?.data?.summary !== undefined)
  })

  await assertApi({
    domain: 'Government',
    name: '农产品质量安全快检报告',
    url: `${GOV_URL}/api/v1/government/reports`,
    options: { headers: authHeader },
    assertFn: (body) => isSuccessCode(body?.code) && Array.isArray(body?.data)
  })

  // 11. AI 智算中枢中台 (agri-ai)
  printHeader('11. AI 智算中枢中台 (agri-ai / 8201)')
  await assertApi({
    domain: 'AI-Hub',
    name: 'AI 中枢健康状态感知',
    url: `${AI_URL}/api/ai/status`,
    options: { headers: authHeader },
    assertFn: (body) => isSuccessCode(body?.code) && body?.data?.status === 'UP'
  })

  await assertApi({
    domain: 'AI-Hub',
    name: '跨子系统统一 AI 推导调度',
    url: `${AI_URL}/api/ai/invoke`,
    options: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader
      },
      body: JSON.stringify({
        bizSystem: 'production',
        sceneCode: 'DIAGNOSIS_PEST',
        bizId: 'biz-test-001',
        params: { cropName: '大豆', symptom: '叶片发黄枯萎' }
      })
    },
    assertFn: (body) => body?.ok === true && body?.status === 'SUCCESS' && body?.result !== undefined
  })

  // 测试汇总输出
  printHeader('全栈业务接口测试执行汇总')
  console.log(`总计测试接口: ${stats.total}`)
  console.log(`成功通过 (PASS): ${stats.passed}`)
  console.log(`未通过   (FAIL): ${stats.failed}`)

  if (stats.failed > 0) {
    console.log('\n未通过的接口详情:')
    stats.failures.forEach((item, idx) => {
      console.log(` ${idx + 1}. [${item.domain}] ${item.name}`)
      console.log(`    URL: ${item.url}`)
      console.log(`    原因: ${item.reason}`)
    })
    process.exit(1)
  } else {
    console.log('\n✨ 恭喜！全系统 11 大业务子系统核心接口全部测试通过！✨\n')
    process.exit(0)
  }
}

run()

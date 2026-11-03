#!/usr/bin/env node
/**
 * 主数据企业端 · 成员任职档案：端到端验证
 *
 * <p>要证的不是"页面能打开"，而是：</p>
 * <ol>
 *   <li>成员列表以<b>用户中心</b>为准（2 人），不是本地种子表（5 人）；</li>
 *   <li>页面上分配组织/部门/岗位 → <b>直连 MySQL 核对真的落库</b>；</li>
 *   <li>改部门、清除都能落库；</li>
 *   <li>孤儿任职记录（账号已不在成员列表）<b>不显示</b>；</li>
 *   <li>跨主体组织/部门被拒；岗位与部门不匹配被拒。</li>
 * </ol>
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'

const require2 = createRequire(
  path.join('C:/Users/71502/.workbuddy-ai/binaries/node/workspace', 'noop.js'),
)
const { chromium } = require2('playwright-core')

const BROWSER = [
  'C:/Users/71502/AppData/Local/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((p) => existsSync(p))
const MYSQL = 'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe'
const OPS = 'http://localhost:8080'
const TENANT = '2001'

/** 测试口令从既有脚本读取，避免同一份明文散落多处各自过期 */
const PASSWORD = (() => {
  const src = readFileSync('scripts/e2e-mdm-sso-loop.mjs', 'utf8')
  return src.match(/登录密码"\]'\)\.first\(\)\.fill\('([^']+)'\)/)[1]
})()

const sql = (q) => {
  try {
    return execFileSync(
      MYSQL,
      ['-uroot', '-proot', '--default-character-set=utf8mb4', '-N', '-B', '-e', q],
      { encoding: 'utf8' },
    ).trim()
  } catch (e) {
    return `ERR:${String(e.message).slice(0, 120)}`
  }
}

let pass = 0
let fail = 0
const check = (ok, label, detail = '') => {
  if (ok) {
    pass += 1
    console.log(`✓ ${label}${detail ? `　${detail}` : ''}`)
  } else {
    fail += 1
    console.log(`✗ ${label}${detail ? `　${detail}` : ''}`)
  }
}

/* ---------- 测试用部门与岗位（从库里取真实数据，不硬编码） ---------- */
const DEPT_A = sql(
  `SELECT id FROM agri_masterdata.agri_md_department WHERE tenant_id='${TENANT}' AND status='1' ORDER BY id LIMIT 1`,
)
const DEPT_B = sql(
  `SELECT id FROM agri_masterdata.agri_md_department WHERE tenant_id='${TENANT}' AND status='1' ORDER BY id LIMIT 1 OFFSET 1`,
)
const POS_A = sql(
  `SELECT position_id FROM agri_masterdata.agri_md_position WHERE dept_id='${DEPT_A}' AND status='1' LIMIT 1`,
)
const POS_B = sql(
  `SELECT position_id FROM agri_masterdata.agri_md_position WHERE dept_id='${DEPT_B}' AND status='1' LIMIT 1`,
)
const DEPT_A_NAME = sql(`SELECT dept_name FROM agri_masterdata.agri_md_department WHERE id='${DEPT_A}'`)
const POS_A_NAME = sql(`SELECT position_name FROM agri_masterdata.agri_md_position WHERE position_id='${POS_A}'`)
const ORG_OF_DEPT_A = sql(`SELECT org_id FROM agri_masterdata.agri_md_department WHERE id='${DEPT_A}'`)
const OTHER_ORG = sql(
  `SELECT id FROM agri_masterdata.agri_md_organization WHERE tenant_id<>'${TENANT}' AND del_flag=0 LIMIT 1`,
)

const browser = await chromium.launch({
  headless: true,
  executablePath: BROWSER,
  args: ['--no-sandbox'],
})
const ctx = await browser.newContext({ viewport: { width: 1560, height: 1100 } })
const page = await ctx.newPage()

const jsErrors = []
page.on('pageerror', (e) => jsErrors.push(String(e.message).slice(0, 160)))

/** 直连接口调一次（用页面上下文里的会话，免去手搓 token） */
const api = (method, url, body) =>
  page.evaluate(
    async ({ method, url, body, tenant }) => {
      const tok =
        (
          await (
            await fetch('/api/v1/auth/refresh', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: '{}',
            })
          ).json()
        )?.data?.accessToken ?? ''
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${tok}`,
          'X-Agri-Merchant': tenant,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      const j = await res.json().catch(() => null)
      return { code: j?.code, msg: j?.message, data: j?.data }
    },
    { method, url, body, tenant: TENANT },
  )

try {
  /* ---------- 0) 清理上次残留 ---------- */
  sql(`DELETE FROM agri_masterdata.agri_md_member_profile WHERE tenant_id='${TENANT}'`)

  /* ---------- 1) 登录 ---------- */
  await page.goto(`${OPS}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2500)
  await page.locator('button').filter({ hasText: '账号 + 密码' }).first().click({ timeout: 15000 })
  await page.waitForSelector('input[placeholder*="用户名"]', { timeout: 15000 })
  await page.locator('input[placeholder*="用户名"]').first().fill('admin')
  await page.locator('input[placeholder*="登录密码"]').first().fill(PASSWORD)
  await page.locator('button').filter({ hasText: '登' }).first().click()
  await page.waitForTimeout(6000)
  check(!page.url().includes(':8090/login'), '统一认证登录成功', page.url().replace(OPS, ''))

  /* ---------- 2) 成员列表以用户中心为准 ---------- */
  await page.goto(`${OPS}/user/members`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(2500)
  const listText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')

  const coreCount = Number(
    sql(
      `SELECT COUNT(*) FROM agri_core.platform_user_merchant WHERE merchant_id=${TENANT} AND status=1`,
    ),
  )
  const localCount = Number(
    sql(`SELECT COUNT(*) FROM agri_masterdata.agri_md_user WHERE tenant_id='${TENANT}' AND del_flag=0`),
  )
  check(listText.includes(`共 ${coreCount} 人`), '成员数与用户中心一致', `应为 ${coreCount}`)
  check(coreCount !== localCount, '本地种子表人数确实不同（证明没拿它冒充）', `本地 ${localCount}`)
  check(!listText.includes(`共 ${localCount} 人`), '没有按本地表人数展示')
  check(listText.includes('未分配'), '初始状态显示「未分配」')
  check(
    listText.includes('agri_md_member_profile') === false && listText.includes('任职档案'),
    '页面写明了组织/部门/岗位的存储来源',
  )

  /* ---------- 3) 页面分配部门 + 岗位 → 查库 ---------- */
  const firstRow = page.locator('tbody tr').first()
  await firstRow.locator('button', { hasText: '分配' }).first().click()
  await page.waitForSelector('.mds-dialog', { timeout: 10000 })
  await page.waitForTimeout(600)

  await page.locator('.mds-dialog select').nth(1).selectOption(String(DEPT_A))
  await page.waitForTimeout(1200) // 等部门变化后拉岗位
  await page.locator('.mds-dialog select').nth(2).selectOption(String(POS_A))
  const orgAuto = await page.locator('.mds-dialog select').nth(0).inputValue()
  check(
    orgAuto === String(ORG_OF_DEPT_A),
    '选部门后组织自动补齐',
    `org=${orgAuto}（部门所属组织 ${ORG_OF_DEPT_A}）`,
  )

  await page.locator('.mds-dialog__foot button', { hasText: '保存' }).click()
  await page.waitForTimeout(2500)

  const savedRow = sql(
    `SELECT tenant_id, platform_user_id, org_id, dept_id, position_id, job_status
     FROM agri_masterdata.agri_md_member_profile WHERE tenant_id='${TENANT}'`,
  )
  check(savedRow.length > 0, '页面分配的任职档案已落库', savedRow)
  const cols = savedRow.split('\t')
  check(cols[0] === TENANT, 'tenant_id = 当前主体', `tenant=${cols[0]}`)
  check(cols[2] === String(ORG_OF_DEPT_A), 'org_id 落库正确', `org=${cols[2]}`)
  check(cols[3] === String(DEPT_A), 'dept_id 落库正确', `dept=${cols[3]}`)
  check(cols[4] === String(POS_A), 'position_id 落库正确', `pos=${cols[4]}`)
  check(cols[5] === 'active', 'job_status 默认 active', `=${cols[5]}`)

  /* ---------- 4) 页面回显 ---------- */
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  const afterText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(afterText.includes(DEPT_A_NAME), '页面回显部门名', DEPT_A_NAME)
  check(afterText.includes(POS_A_NAME), '页面回显岗位名', POS_A_NAME)
  check(afterText.includes('已分配职务 1 人'), '统计卡显示已分配 1 人')
  // 按行判断：本主体有 2 个成员，只给第一个分配了，第二个当然还是「未分配」——
  // 之前这里断言整页不含「未分配」，是个假失败（页面整体文本必然含另一个人的状态）
  const firstRowText = (await page.locator('tbody tr').first().innerText()).replace(/\s+/g, ' ')
  check(!firstRowText.includes('未分配'), '已分配的那一行不再显示「未分配」', firstRowText.slice(0, 60))
  check(afterText.includes('未分配'), '未分配的其他成员仍显示「未分配」（只影响本人）')

  /* ---------- 5) 改到另一个部门 → 查库 ---------- */
  await page.locator('tbody tr').first().locator('button', { hasText: '调整' }).first().click()
  await page.waitForSelector('.mds-dialog', { timeout: 10000 })
  await page.waitForTimeout(500)
  await page.locator('.mds-dialog select').nth(1).selectOption(String(DEPT_B))
  await page.waitForTimeout(1200)
  await page.locator('.mds-dialog select').nth(2).selectOption(String(POS_B))
  await page.locator('.mds-dialog__foot button', { hasText: '保存' }).click()
  await page.waitForTimeout(2500)

  const movedDept = sql(
    `SELECT dept_id, position_id FROM agri_masterdata.agri_md_member_profile WHERE tenant_id='${TENANT}'`,
  )
  check(
    movedDept === `${DEPT_B}\t${POS_B}`,
    '换部门后落库已更新（不是新增一条）',
    `dept=${movedDept.split('\t')[0]} pos=${movedDept.split('\t')[1]}`,
  )
  const profileCount = sql(
    `SELECT COUNT(*) FROM agri_masterdata.agri_md_member_profile WHERE tenant_id='${TENANT}'`,
  )
  check(profileCount === '1', '同一成员只有一条档案（upsert 生效）', `count=${profileCount}`)

  /* ---------- 6) 孤儿记录不显示 ---------- */
  sql(
    `INSERT INTO agri_masterdata.agri_md_member_profile
       (tenant_id, platform_user_id, org_id, dept_id, position_id, job_status, create_time, update_time)
     VALUES ('${TENANT}', 999999999999999999, '${ORG_OF_DEPT_A}', '${DEPT_A}', NULL, 'active', NOW(), NOW())`,
  )
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  const orphanText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(
    orphanText.includes(`共 ${coreCount} 人`),
    '孤儿任职记录不会撑大成员数',
    `仍为 ${coreCount} 人`,
  )
  const orphanApi = await api('GET', '/api/user/member-profiles')
  check(
    Array.isArray(orphanApi.data) && orphanApi.data.length === 2,
    '接口仍返回孤儿记录（留给排查），但页面按成员列表左连接不显示',
    `接口 ${orphanApi.data?.length} 条 / 页面 ${coreCount} 行`,
  )
  sql(
    `DELETE FROM agri_masterdata.agri_md_member_profile WHERE platform_user_id=999999999999999999`,
  )

  /* ---------- 7) 越权与一致性校验 ---------- */
  const farmerId = sql(
    `SELECT user_id FROM agri_core.platform_user_merchant WHERE merchant_id=${TENANT} AND status=1 ORDER BY user_id DESC LIMIT 1`,
  )
  if (OTHER_ORG) {
    const crossOrg = await api('PUT', `/api/user/member-profiles/${farmerId}`, { orgId: OTHER_ORG })
    check(crossOrg.code !== 200, '跨主体组织被拒', `code=${crossOrg.code} ${crossOrg.msg ?? ''}`)
  } else {
    check(true, '跨主体组织校验跳过（库里没有别家组织）')
  }

  const emptyBody = await api('PUT', `/api/user/member-profiles/${farmerId}`, {})
  check(
    emptyBody.code !== 200,
    '三项全空被拒（防止前端漏传静默抹掉任职信息）',
    `code=${emptyBody.code} ${emptyBody.msg ?? ''}`,
  )

  const mismatch = await api('PUT', `/api/user/member-profiles/${farmerId}`, {
    deptId: DEPT_A,
    positionId: POS_B,
  })
  check(
    mismatch.code !== 200,
    '岗位不属于所选部门时被拒',
    `code=${mismatch.code} ${mismatch.msg ?? ''}`,
  )

  /* ---------- 8) 页面清除 → 查库 ---------- */
  page.once('dialog', (d) => void d.accept())
  await page.locator('tbody tr').first().locator('button', { hasText: '清除' }).first().click()
  await page.waitForTimeout(2500)
  const afterClear = sql(
    `SELECT COUNT(*) FROM agri_masterdata.agri_md_member_profile WHERE tenant_id='${TENANT}'`,
  )
  check(afterClear === '0', '页面清除后档案已删除', `剩余 ${afterClear} 条`)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  const clearedText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(clearedText.includes('未分配'), '清除后页面回到「未分配」')

  check(jsErrors.length === 0, '页面无自身 JS 错误', jsErrors.slice(0, 2).join(' | '))
} catch (e) {
  fail += 1
  console.log(`✗ 流程异常：${String(e.message).slice(0, 300)}`)
} finally {
  sql(`DELETE FROM agri_masterdata.agri_md_member_profile WHERE tenant_id='${TENANT}'`)
  const left = sql(
    `SELECT COUNT(*) FROM agri_masterdata.agri_md_member_profile WHERE tenant_id='${TENANT}'`,
  )
  console.log(`\n清理：残留 ${left} 条（应为 0）`)
  await browser.close()
  console.log(`\n${fail === 0 ? '全部断言通过 ✅' : `失败 ${fail} 项 ❌`}　（通过 ${pass} / 共 ${pass + fail}）`)
  process.exit(fail === 0 ? 0 : 1)
}

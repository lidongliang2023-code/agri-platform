/**
 * 一次性迁移脚本：把 src/api/** 中「与后端 Controller 签名不符」的返回类型改准。
 *
 * 依据：scripts/check-api-contract.mjs 的比对结果 + 后端 Controller 源码逐条确认
 *  - create*  -> 后端 ApiResponse<String>（新主键）  => Promise<string>
 *  - delete*  -> 后端 ApiResponse<Void>              => Promise<void>
 *  - verify*  -> 后端 ApiResponse<Boolean>           => Promise<boolean>
 *
 * 只改函数签名中的 Promise 泛型，不碰函数体、不碰页面。
 */
import fs from 'node:fs'
import path from 'node:path'

const API_DIR = 'src/api'

/** 待修正清单：[文件, 函数名, 目标返回类型] */
const TARGETS = [
  // A 类：create -> 新主键字符串
  ['alerts.ts', 'createAlertRule', 'string'],
  ['harvests.ts', 'createHarvest', 'string'],
  ['inputs.ts', 'createInput', 'string'],
  ['inputs.ts', 'createInputUsage', 'string'],
  ['iot.ts', 'createDevice', 'string'],
  ['members.ts', 'createMember', 'string'],
  ['plans.ts', 'createPlan', 'string'],
  ['production-view.ts', 'inviteMember', 'string'],
  ['production-view.ts', 'createPlanInfo', 'string'],
  ['quality.ts', 'createInspection', 'string'],
  ['settings.ts', 'createSetting', 'string'],
  ['tasks.ts', 'createTask', 'string'],
  ['tasks.ts', 'createTaskTemplate', 'string'],
  ['tasks.ts', 'createTaskRecord', 'string'],
  ['growth.ts', 'createGrowthRecord', 'string'],
  ['admin/tenants.ts', 'createTenant', 'string'],
  ['admin/sop.ts', 'createSopTemplate', 'string'],
  ['admin/sop.ts', 'createKnowledgeArticle', 'string'],
  // C 类：trace 生成 -> 后端返回单个码（String），不是数组
  ['trace.ts', 'generateTraceCodes', 'string'],
  // C 类：区块链验真 -> 后端返回 Boolean
  ['blockchain.ts', 'verifyChain', 'boolean'],
  ['blockchain.ts', 'verifyCertificate', 'boolean'],
  // B 类：delete -> Void
  ['admin/reports.ts', 'deleteAdminReport', 'void'],
  ['admin/tenants.ts', 'deleteTenant', 'void'],
  ['alerts.ts', 'deleteAlertRule', 'void'],
  ['harvests.ts', 'deleteHarvest', 'void'],
  ['inputs.ts', 'deleteInput', 'void'],
  ['inputs.ts', 'removeInput', 'void'],
  ['inputs.ts', 'deleteInputUsage', 'void'],
  ['inputs.ts', 'removeUsage', 'void'],
  ['inputs.ts', 'removeStockFlow', 'void'],
  ['iot.ts', 'deleteDevice', 'void'],
  ['iot.ts', 'deleteMaintenance', 'void'],
  ['members.ts', 'deleteMember', 'void'],
  ['messages.ts', 'deleteMessage', 'void'],
  ['plans.ts', 'deletePlan', 'void'],
  ['quality.ts', 'deleteInspection', 'void'],
  ['settings.ts', 'deleteSetting', 'void'],
  ['tasks.ts', 'deleteTask', 'void'],
  ['tasks.ts', 'deleteTaskTemplate', 'void'],
]

/**
 * 从 start 处解析一个平衡的泛型片段，返回 [起, 止) 区间。
 *
 * @param {string} src 源码
 * @param {number} ltIndex '<' 的下标
 * @returns {number} 匹配 '>' 的下标
 */
function matchAngle(src, ltIndex) {
  let depth = 0
  for (let i = ltIndex; i < src.length; i += 1) {
    const c = src[i]
    if (c === '<') depth += 1
    else if (c === '>') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

let changed = 0
const skipped = []

for (const [rel, fn, target] of TARGETS) {
  const file = path.join(API_DIR, rel)
  if (!fs.existsSync(file)) {
    skipped.push(`${rel}#${fn}（文件不存在）`)
    continue
  }
  const src = fs.readFileSync(file, 'utf8')
  const head = src.indexOf(`export function ${fn}(`)
  if (head < 0) {
    skipped.push(`${rel}#${fn}（未找到函数）`)
    continue
  }
  const pIdx = src.indexOf('Promise<', head)
  const lt = pIdx + 'Promise'.length
  const gt = matchAngle(src, lt)
  if (pIdx < 0 || gt < 0) {
    skipped.push(`${rel}#${fn}（未解析到 Promise 泛型）`)
    continue
  }
  // 函数体内第一个 http.xxx<...> 调用的泛型要同步改，否则返回类型与实现不一致
  const callIdx = src.slice(head).search(/http\.(?:get|post|put|delete|patch)\s*</)
  let next = src
  let callNote = ''
  if (callIdx >= 0) {
    const abs = head + callIdx
    const cLt = src.indexOf('<', abs)
    const cGt = matchAngle(src, cLt)
    if (cGt > 0) {
      const oldCall = src.slice(cLt + 1, cGt)
      if (oldCall !== target) {
        next = `${next.slice(0, cLt + 1)}${target}${next.slice(cGt)}`
        callNote = `；http 泛型 ${oldCall} -> ${target}`
      }
    }
  }

  const oldType = src.slice(lt + 1, gt)
  if (oldType === target) {
    if (next === src) {
      skipped.push(`${rel}#${fn}（已是 ${target}，无需改）`)
      continue
    }
    fs.writeFileSync(file, next, 'utf8')
    changed += 1
    console.log(`${rel}#${fn}: 仅同步 http 泛型${callNote}`)
    continue
  }
  // http 调用一定出现在签名的 Promise< 之后，故 lt/gt 下标不受上面的替换影响
  const final = `${next.slice(0, lt + 1)}${target}${next.slice(gt)}`
  fs.writeFileSync(file, final, 'utf8')
  changed += 1
  console.log(`${rel}#${fn}: Promise<${oldType}> -> Promise<${target}>${callNote}`)
}

console.log(`\n已修改 ${changed} 处，跳过 ${skipped.length} 处`)
skipped.forEach((s) => console.log(`  - ${s}`))

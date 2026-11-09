/**
 * 生产主链路端到端联调（用户端 + 运营端 + 数据库落库）
 *
 * 链路：
 *   地块 → 种养计划 → 提交审批 → 主体内部审批通过 → 计划进入进行中
 *   → 计划阶段 → 农事任务（开始/提交/验收）→ 阶段完成
 *   → 投入品入库 → 使用记录自动扣库并写流水
 *   → 采收批次 → 溯源码 → 入库库存与流水
 *   → 质检不合格 → 批次冻结、库存冻结、告警与站内信
 *   → IoT 阈值规则 → 传感器读数越限 → 告警与站内信
 *
 * 用法：node scripts/e2e-production-flow.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const originalFetch = globalThis.fetch
globalThis.fetch = (url, options = {}) => originalFetch(url, { ...options, signal: options.signal ?? AbortSignal.timeout(20000) })

const CORE = 'http://localhost:8093'
const GW = 'http://localhost'
const MYSQL = 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe'
const sql = (query) => {
  if (!existsSync(MYSQL)) return ''
  try {
    return execFileSync(MYSQL, ['-uroot', '-proot', '--default-character-set=utf8mb4', '-N', '-B', '-e', query],
      { encoding: 'utf8' }).trim()
  } catch (error) {
    return `ERR:${String(error?.message ?? error).slice(0, 120)}`
  }
}

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const login = async (username) => {
  const response = await fetch(`${CORE}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'Admin@123', marketId: 1 }),
  })
  const body = await response.json()
  return body?.data?.accessToken ?? ''
}

const unwrap = async (response) => {
  const text = await response.text()
  try {
    const body = JSON.parse(text)
    if (body?.code !== 0) throw new Error(`${response.status} ${body?.message ?? text.slice(0, 120)}`)
    return body.data
  } catch (error) {
    throw new Error(`${response.status} ${error.message}`)
  }
}

const api = async (token, method, path, body) => {
  const response = await fetch(`${GW}/api/v1/production${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return unwrap(response)
}

/**
 * 负向断言专用：**不抛错**的调用。
 *
 * api() 遇到业务码非 0 会 throw，用来验"被拒绝"时反而会把整个脚本打断。
 * 本服务的失败是 HTTP 200 + code=4xx（业务异常统一包装），所以判据要看 code 不能只看 HTTP。
 */
const probe = async (token, method = 'GET', path, body) => {
  const response = await fetch(`${GW}/api/v1/production${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  let parsed = null
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = { code: -1, message: text.slice(0, 120) }
  }
  return { status: response.status, code: parsed?.code ?? -1, message: parsed?.message ?? '', data: parsed?.data }
}

const raw = (token, path) => probe(token, 'GET', path)

const stamp = Date.now()
const suffix = String(stamp).slice(-8)
const ids = {
  plot: '', plan: '', stage: '', task: '', input: '', usage: '', batch: '',
  inspection: '', rule: '', approval: '', traceCode: '', batchNo: '', chainRecords: [], qcInspections: [],
}

const adminToken = await login('admin')
const farmerToken = await login('farmer')
// 另一个经营主体：用来验"跨主体不能给别人家的记录出存证"（洛川果园与丰链云不是同一个 tenant）
const luochuanToken = await login('luochuan')
check(Boolean(adminToken) && Boolean(farmerToken) && Boolean(luochuanToken),
  '取得运营端、用户端与另一主体的令牌')

try {
  // 任务必须派发给本农场的在岗成员才能开始执行，所以先找在岗成员，再用他所在的农场做整条链路
  const allMembers = await api(farmerToken, 'GET', '/members?page=1&size=100')
  const activeMember = (allMembers?.records ?? allMembers?.list ?? []).find((row) => Number(row.status) === 1 && row.farmId)
  const farmId = activeMember ? Number(activeMember.farmId) : undefined
  check(Boolean(farmId), '读取有在岗成员的当前主体农场', `farm=${farmId} member=${activeMember?.memberId ?? ''}`)

  const plot = await api(farmerToken, 'POST', '/plots', {
    plotName: `联调地块-${suffix}`, farmId, area: 12.5, soilType: '壤土', status: 1,
  })
  ids.plot = String(plot)
  check(Boolean(ids.plot), '用户端创建地块并落库', `plot=${ids.plot}`)

  const crops = await api(farmerToken, 'GET', '/crops/options')
  const crop = crops?.[0]
  check(Boolean(crop?.cropId), '读取作物主数据下拉', `crop=${crop?.cropName}`)

  ids.plan = String(await api(farmerToken, 'POST', '/plans', {
    planName: `联调种养计划-${suffix}`, farmId: String(farmId), plotId: ids.plot,
    cropId: String(crop.cropId), cropVariety: '联调品种',
    planStartDate: '2026-12-01', planEndDate: '2027-01-31',
    expectedYield: 8888, planArea: 12.5,
  }))
  const planDraft = await api(farmerToken, 'GET', `/plans/${ids.plan}`)
  check(Boolean(ids.plan) && planDraft?.status === 1, '用户端创建种养计划为编制中', `plan=${ids.plan}`)

  ids.stage = String(await api(farmerToken, 'POST', `/plans/${ids.plan}/stages`, {
    stageName: '联调苗期', taskType: '施肥', planStartDate: '2026-12-01', planEndDate: '2026-12-10', status: 1,
  }))
  check(Boolean(ids.stage), '计划阶段创建并落库', `stage=${ids.stage}`)

  await api(farmerToken, 'POST', `/plans/${ids.plan}/submit`)
  const pendingPlan = await api(farmerToken, 'GET', `/plans/${ids.plan}`)
  check(pendingPlan?.status === 5, '用户端提交计划后进入待审批', `status=${pendingPlan?.status}`)

  await api(farmerToken, 'POST', `/plans/${ids.plan}/approve`, { comment: `联调主体内审批-${suffix}` })
  const approvedPlan = await api(farmerToken, 'GET', `/plans/${ids.plan}`)
  const approvalAfter = sql(`SELECT plan_status FROM agri_production.agri_prod_planting_plan WHERE id = '${ids.plan}'`)
  check(approvedPlan?.status === 2 && approvalAfter === 'active',
    '主体内部审批通过后计划进入进行中且状态落库', `plan=${approvedPlan?.status} db=${approvalAfter}`)

  const members = await api(farmerToken, 'GET', `/members?page=1&size=10&farmId=${farmId}`)
  const member = (members?.records ?? members?.list ?? []).find((row) => Number(row.status) === 1) ?? activeMember
  ids.task = String(await api(farmerToken, 'POST', '/tasks', {
    taskName: `联调农事任务-${suffix}`, taskType: 'fertilizing', priority: 3,
    farmId, plotId: ids.plot, planId: ids.plan, stageId: ids.stage,
    assigneeId: member?.memberId, planStartDate: '2026-12-01 08:00:00',
    planEndDate: '2026-12-02 18:00:00', description: '端到端联调任务',
  }))
  const taskCreated = await api(farmerToken, 'GET', `/tasks/${ids.task}`)
  check(String(taskCreated?.planId) === ids.plan && String(taskCreated?.stageId) === ids.stage,
    '农事任务回挂计划与阶段并落库', `task=${ids.task}`)

  const planTasks = await api(farmerToken, 'GET', `/tasks?page=1&size=20&planId=${ids.plan}`)
  check((planTasks?.records ?? planTasks?.list ?? []).some((row) => String(row.taskId) === ids.task),
    '计划详情可按 planId 服务端筛选关联任务')

  await api(farmerToken, 'POST', `/tasks/${ids.task}/start`)
  await api(farmerToken, 'POST', `/tasks/${ids.task}/submit?resultDesc=${encodeURIComponent('联调作业完成')}`)
  await api(farmerToken, 'POST', `/tasks/${ids.task}/acceptance?pass=true&opinion=${encodeURIComponent('验收通过')}`)
  const taskDone = await api(farmerToken, 'GET', `/tasks/${ids.task}`)
  const stageDone = sql(`SELECT CONCAT(status,'|',IFNULL(DATE(actual_end_date),'')) FROM agri_production.agri_prod_plan_stage WHERE id = '${ids.stage}'`)
  check(taskDone?.status === 'completed' && taskDone?.acceptStatus === 1 && stageDone.startsWith('3|'),
    '任务验收通过后任务完成并回写计划阶段', `task=${taskDone?.status} stage=${stageDone}`)

  ids.input = String(await api(farmerToken, 'POST', '/inputs', {
    inputName: `联调肥料-${suffix}`, inputType: 'FERTILIZER', unit: 'kg',
    stockQty: 20, warnQty: 3, safetyInterval: 7, status: 1,
  }))
  const usage = await api(farmerToken, 'POST', '/inputs/usages', {
    inputId: ids.input, plotId: ids.plot, farmId: String(farmId), taskId: ids.task,
    dosage: 5, unit: 'kg', method: '撒施', safetyIntervalDays: 7, status: 1,
  })
  ids.usage = String(usage)
  const inputAfterUsage = await api(farmerToken, 'GET', `/inputs/${ids.input}`)
  const usageFlow = sql(`SELECT COUNT(*) FROM agri_production.agri_prod_input_stock_flow WHERE input_id = '${ids.input}' AND deleted = 0`)
  check(Number(inputAfterUsage?.stockQty) === 15 && usageFlow === '1',
    '投入品使用记录自动扣库并写库存流水', `stock=${inputAfterUsage?.stockQty} flow=${usageFlow}`)

  ids.batch = String(await api(farmerToken, 'POST', '/harvests', {
    plotId: ids.plot, planId: ids.plan, cropId: crop.cropId, cropName: crop.cropName,
    harvestDate: '2027-01-20', quantity: 100, unit: 'kg', grade: '待检',
    warehouseName: '联调主仓', remark: `端到端联调批次-${suffix}`,
  }))
  const generated = await api(farmerToken, 'POST', `/harvests/${ids.batch}/generate`, {
    warehouseName: '联调主仓',
  })
  const traceRows = sql(`SELECT COUNT(*) FROM agri_production.agri_prod_trace_code WHERE harvest_id = '${ids.batch}' AND deleted = 0`)
  check(Boolean(generated?.traceCode) && traceRows === '1' && Number(generated?.traceGenerated) === 1,
    '采收批次生成溯源码并写入溯源码台账', `code=${generated?.traceCode} rows=${traceRows}`)

  // 先验证正常生成码可以扫码；后续质检不合格会冻结批次，冻结后扫码应被拒绝。
  const scannedCode = generated.traceCode
  await api(farmerToken, 'POST', `/trace/scan?code=${scannedCode}`)
  const scannedProfile = await api(farmerToken, 'GET', `/trace/codes/${scannedCode}`)
  check(Boolean(scannedProfile?.firstQueryTime) && scannedProfile?.queryCount === 1
    && Boolean(scannedProfile?.plotName),
    '扫码后回显首次扫码时间与地块编号（firstQueryTime/plotName 真的有值）',
    `first=${scannedProfile?.firstQueryTime ?? ''} plot=${scannedProfile?.plotName ?? ''}`)

  await api(farmerToken, 'POST', '/harvests/inventory/in', {
    batchId: ids.batch, warehouseName: '联调主仓', quantity: 100, operatorName: '联调操作员',
  })
  const batchAfterInbound = await api(farmerToken, 'GET', `/harvests/${ids.batch}`)
  const inventoryRow = sql(`SELECT CONCAT(current_qty,'|',IFNULL(frozen,0),'|',IFNULL(frozen_qty,0)) FROM agri_production.agri_prod_inventory WHERE batch_id = '${ids.batch}' AND deleted = 0 LIMIT 1`)
  const inventoryFlow = sql(`SELECT COUNT(*) FROM agri_production.agri_prod_inventory_flow WHERE batch_id = '${ids.batch}' AND deleted = 0`)
  const [inventoryQty, inventoryFrozen] = inventoryRow.split('|')
  check(Number(batchAfterInbound?.inboundStatus) === 1 && Number(inventoryQty) === 100
    && inventoryFlow === '1',
    '采收入库生成库存与流水并回写批次', `inbound=${batchAfterInbound?.inboundStatus} inventory=${inventoryRow} flow=${inventoryFlow}`)

  ids.inspection = String(await api(farmerToken, 'POST', '/quality/inspections', {
    batchId: ids.batch, batchNo: batchAfterInbound?.batchNo, farmId: String(farmId), plotId: ids.plot,
    cropId: String(crop.cropId), cropName: crop.cropName, inspectionType: 'SELF',
    inspectorName: '联检测员', sampleQty: 3, remark: `联调不合格-${suffix}`,
  }))
  await api(farmerToken, 'POST', `/quality/inspections/${ids.inspection}/result?result=FAIL&reportUrl=https://example.invalid/report`)
  const batchAfterQuality = await api(farmerToken, 'GET', `/harvests/${ids.batch}`)
  const inventoryAfterFail = sql(`SELECT CONCAT(current_qty,'|',frozen,'|',IFNULL(frozen_qty,0)) FROM agri_production.agri_prod_inventory WHERE batch_id = '${ids.batch}' AND deleted = 0 LIMIT 1`)
  const qualityAlert = sql(`SELECT COUNT(*) FROM agri_production.agri_prod_alert_record WHERE source_type = 'quality' AND source_id = '${ids.inspection}' AND deleted = 0`)
  const qualityMessage = sql(`SELECT COUNT(*) FROM agri_production.agri_prod_message_notify WHERE msg_type = 'QUALITY' AND biz_id = '${ids.batch}' AND deleted = 0`)
  const [failQty, failFrozen, failFrozenQty] = inventoryAfterFail.split('|')
  check(Number(batchAfterQuality?.status) === 4 && String(batchAfterQuality?.inspectionId) === ids.inspection
    && Number(failQty) === 100 && failFrozen === '1' && Number(failFrozenQty) === 100
    && Number(qualityAlert) >= 1 && Number(qualityMessage) >= 1,
    '质检不合格冻结批次与库存并生成告警、站内信',
    `batch=${batchAfterQuality?.status} inventory=${inventoryAfterFail} alert=${qualityAlert} msg=${qualityMessage}`)

  const alertList = await api(farmerToken, 'GET', '/alerts?page=1&size=50')
  const qualityAlertRow = (alertList?.list ?? alertList?.records ?? []).find((row) => row.alertTitle?.includes('质量检测不合格'))
  check(Boolean(qualityAlertRow), '用户端告警中心可看到质检告警', qualityAlertRow?.alertId)
  if (qualityAlertRow) {
    await api(farmerToken, 'PATCH', `/alerts/${qualityAlertRow.alertId}/handle`, {
      status: 3, handleRemark: `联调已处置-${suffix}`,
    })
    const handled = sql(`SELECT status FROM agri_production.agri_prod_alert_record WHERE alert_code = '${qualityAlertRow.alertId}'`)
    const handledMessage = sql(`SELECT COUNT(*) FROM agri_production.agri_prod_message_notify WHERE msg_type = 'ALERT' AND biz_id = '${qualityAlertRow.alertId}' AND deleted = 0`)
    check(handled === 'handled' && Number(handledMessage) >= 1, '告警处置回写状态并发送站内信', `status=${handled} msg=${handledMessage}`)
  }

  /* ---------- 溯源链上口径：属主视图与核验视图必须同源 ---------- */
  ids.batchNo = String(batchAfterQuality?.batchNo ?? '')
  ids.traceCode = String(generated?.traceCode ?? '')
  const inspectionNo = sql(`SELECT inspection_no FROM agri_production.agri_prod_inspection WHERE id = '${ids.inspection}'`)
  check(Boolean(ids.batchNo) && Boolean(ids.traceCode) && Boolean(inspectionNo) && !inspectionNo.startsWith('ERR'),
    '取到批次号 / 溯源码 / 质检单号（存证按业务键关联，三个键都要真值）',
    `batchNo=${ids.batchNo} code=${ids.traceCode} qc=${inspectionNo}`)

  // 1) 真写一条采收存证（本部署是模拟链：anchor 会给出 SUCCESS + SIMU 交易哈希）
  const harvestAnchor = await api(farmerToken, 'POST', '/blockchain/anchor', {
    bizType: 'HARVEST', bizNo: ids.batchNo, bizSummary: `联调采收存证-${suffix}`,
  })
  ids.chainRecords.push(String(harvestAnchor?.recordNo ?? ''))
  const ownerNodes = await api(farmerToken, 'GET', `/trace/full-chain/${ids.batch}/nodes`)
  const harvestNode = (ownerNodes ?? []).find((node) => node.nodeType === 'harvest')
  const chainRow = sql(`SELECT CONCAT(chain_status,'#',IFNULL(tx_hash,'')) FROM agri_production.agri_prod_chain_record
                        WHERE record_no = '${harvestAnchor?.recordNo}' AND del_flag = 0`)
  check(harvestAnchor?.status === 'SUCCESS' && harvestNode?.attested === true && harvestNode?.onChain === true
    && String(harvestNode?.txHash) === String(harvestAnchor?.txHash) && chainRow === `SUCCESS#${harvestAnchor?.txHash}`,
    '属主全链路：采收节点按存证表判定已上链，交易哈希与库内一致（不再用"批次有没有码"代理）',
    `onChain=${harvestNode?.onChain} tx=${harvestNode?.txHash ?? ''}`)

  // 2) 两个负向分支：PENDING（有记录未出块）与 FAILED（有记录且失败，要给原因）
  const pendingNo = `CHAIN-E2E-${suffix}-P`
  const failedNo = `CHAIN-E2E-${suffix}-F`
  ids.chainRecords.push(pendingNo, failedNo)
  sql(`INSERT INTO agri_production.agri_prod_chain_record
       (record_no, chain_type, target_type, target_id, target_code, data_hash, chain_status,
        failed_reason, retry_count, del_flag, tenant_id, create_by, create_time, update_time)
       VALUES ('${pendingNo}', 'SIMULATED', 'QUALITY', ${ids.inspection}, '${inspectionNo}', 'e2e', 'PENDING',
        NULL, 0, 0, '2001', 'e2e', NOW(), NOW()),
        ('${failedNo}', 'SIMULATED', 'TRACE', NULL, '${ids.traceCode}', 'e2e', 'FAILED',
        '联调：模拟链出块超时', 2, 0, '2001', 'e2e', NOW(), NOW())`)
  const seededNodes = await api(farmerToken, 'GET', `/trace/full-chain/${ids.batch}/nodes`)
  const inspectNode = (seededNodes ?? []).find((node) => node.nodeType === 'inspect'
    && String(node.refNo) === String(inspectionNo))
  const traceNode = (seededNodes ?? []).find((node) => node.nodeType === 'trace'
    && String(node.refNo) === ids.traceCode)
  const inputNode = (seededNodes ?? []).find((node) => node.nodeType === 'input')
  check(inspectNode?.attested === true && inspectNode?.onChain === false
    && inspectNode?.chainStatus === 'PENDING' && !inspectNode?.txHash,
    '属主全链路：PENDING 如实显示"有存证但未出块"，不冒充已上链', `status=${inspectNode?.chainStatus}`)
  check(traceNode?.attested === true && traceNode?.onChain === false
    && traceNode?.chainStatus === 'FAILED' && String(traceNode?.failedReason ?? '').includes('超时'),
    '属主全链路：FAILED 给出状态与失败原因（不笼统写成待上链）', `reason=${traceNode?.failedReason ?? ''}`)
  check(inputNode?.attested === false && inputNode?.onChain === false && !inputNode?.chainStatus,
    '属主全链路：投入品节点此刻确实没有存证记录，如实为"无存证记录"（不是"能力未接入"）')

  // 3) 同源校验：核验视图每个节点的 onChain/chainStatus/txHash 必须与属主视图逐条一致
  const verifyResponse = await fetch(`${GW}/api/v1/production/trace/public/verify/${ids.traceCode}`)
  const verifyBody = await verifyResponse.json()
  const verifyNodes = verifyBody?.data?.nodes ?? []
  const ownerByKey = new Map((seededNodes ?? []).map((node) => [`${node.stage}#${node.refNo}`, node]))
  let divergence = ''
  for (const node of verifyNodes) {
    const refNo = String(node.title ?? '').slice(String(node.stageName ?? '').length + 1)
    const owner = ownerByKey.get(`${node.stage}#${refNo}`)
    if (!owner) {
      divergence = `核验视图有节点而属主视图没有：${node.title}`
      break
    }
    if (Boolean(owner.attested) !== Boolean(node.attested) || Boolean(owner.onChain) !== Boolean(node.onChain)
      || String(owner.chainStatus ?? '') !== String(node.chainStatus ?? '')
      || String(owner.txHash ?? '') !== String(node.txHash ?? '')) {
      divergence = `${node.title}：属主 ${owner.chainStatus}/${owner.onChain} vs 核验 ${node.chainStatus}/${node.onChain}`
      break
    }
  }
  check(verifyNodes.length > 0 && divergence === '',
    '属主视图与核验视图逐节点同源（attested/onChain/chainStatus/txHash 全一致）',
    divergence || `${verifyNodes.length} 个节点`)
  const selfAttest = verifyBody?.data?.selfAttestation
  check(Number(verifyBody?.data?.onChainCount) === 1 && Number(verifyBody?.data?.attestedCount) === 3
    && String(selfAttest?.recordNo) === failedNo && String(verifyBody?.data?.chainConclusion ?? '').includes('存证未成功'),
    '核验汇总：1 条已上链、3 条有存证，码自身取到 FAILED 记录且结论提示谨慎采信',
    `onChain=${verifyBody?.data?.onChainCount} attested=${verifyBody?.data?.attestedCount} self=${selfAttest?.recordNo ?? ''}`)

  // 4) 按溯源码取全链路（属主侧另一个入口）也要给出同一份链上凭证
  const byCodeNodes = await api(farmerToken, 'GET', `/trace/full-chain/trace/${ids.traceCode}`)
  const codeMirror = (byCodeNodes ?? []).find((node) => node.stage === 'trace')
  check(codeMirror?.attested === true && codeMirror?.onChain === false
    && codeMirror?.chainStatus === 'FAILED' && String(codeMirror?.recordNo) === failedNo
    && String(codeMirror?.txHash ?? '') === '',
    '按码取全链路：透传链上凭证（含未出块时交易哈希为空）', `status=${codeMirror?.chainStatus}`)

  /* ---------- 存证写入口收口：词表 + 业务存在性 + 主体归属 ---------- */
  const inputAnchor = await api(farmerToken, 'POST', '/blockchain/anchor', {
    bizType: 'INPUT', bizNo: ids.usage, bizSummary: `联调投入品存证-${suffix}`,
  })
  ids.chainRecords.push(String(inputAnchor?.recordNo ?? ''))
  const nodesAfterInputAnchor = await api(farmerToken, 'GET', `/trace/full-chain/${ids.batch}/nodes`)
  const inputNodeNow = (nodesAfterInputAnchor ?? []).find((node) => node.nodeType === 'input')
  check(inputAnchor?.status === 'SUCCESS' && inputNodeNow?.attested === true && inputNodeNow?.onChain === true
    && String(inputNodeNow?.txHash) === String(inputAnchor?.txHash)
    && String(inputNodeNow?.chainType) === 'SIMULATED',
    '投入品存证写入后，属主全链路的投入品节点立刻按存证表显示已上链（INPUT 对号打通）',
    `tx=${inputNodeNow?.txHash ?? ''} chainType=${inputNodeNow?.chainType ?? ''}`)
  const inputRow = sql(`SELECT CONCAT(target_type,'|',IFNULL(target_id,'-'),'|',target_code,'|',chain_status)
                        FROM agri_production.agri_prod_chain_record WHERE record_no = '${inputAnchor?.recordNo}'`)
  check(inputRow === `INPUT|${ids.usage}|${ids.usage}|SUCCESS`,
    '存证落库带规范业务键与主键（target_id/target_code 都对得上，页面才可能对号）', inputRow)

  const badKey = await probe(farmerToken, 'POST', '/blockchain/anchor', { bizType: 'INPUT', bizNo: '999999999' })
  check(badKey.code === 404 && badKey.message.includes('找不到要存证的业务'),
    '给不存在的业务键出存证被拒（不能凭自由填写的单号造"已上链"）', `code=${badKey.code} ${badKey.message.slice(0, 40)}`)
  const numericType = await probe(farmerToken, 'POST', '/blockchain/records', { bizId: ids.usage, bizType: 2 })
  check(numericType.code === 400 && numericType.message.includes('不再接受数字枚举'),
    '数字业务类型被明确拒绝（它就是 target_type=\'2\' 脏值的来源，静默失效比报错隐蔽）',
    `code=${numericType.code}`)
  const unverifiable = await probe(farmerToken, 'POST', '/blockchain/anchor', { bizType: 'FARMING', bizNo: 'X-1' })
  check(unverifiable.code === 400 && unverifiable.message.includes('没有可校验的业务主数据'),
    '本部署无法校验的业务类型（FARMING/CIRCULATION/IOT）直接拒绝，不提供入口',
    `code=${unverifiable.code}`)
  const foreignUsage = await probe(luochuanToken, 'POST', '/blockchain/anchor', { bizType: 'INPUT', bizNo: ids.usage })
  check(foreignUsage.code !== 0 && foreignUsage.code === 404,
    '跨主体不能给别人家经营主体的记录出存证（按"找不到"回，不泄露它是否存在）',
    `code=${foreignUsage.code} ${foreignUsage.message.slice(0, 30)}`)

  const readNumeric = await probe(farmerToken, 'GET', '/blockchain/records?page=1&size=5&bizType=2')
  check(readNumeric.code === 400, '读侧筛数字类型也报错，不再静默返回空列表（筛了不生效最难被发现）',
    `code=${readNumeric.code}`)
  const readInput = await probe(farmerToken, 'GET', '/blockchain/records?page=1&size=20&bizType=INPUT')
  check(readInput.code === 0 && (readInput.data?.records ?? []).some((row) => String(row.bizNo) === String(ids.usage)),
    '按 INPUT 能筛到刚写入的存证（页面"上链"列的判据来自这里）',
    `rows=${(readInput.data?.records ?? []).length}`)
  const byBizInput = await probe(farmerToken, 'GET', `/blockchain/by-biz?bizType=INPUT&bizNo=${ids.usage}`)
  check(byBizInput.code === 0 && (byBizInput.data ?? []).length >= 1
    && String((byBizInput.data ?? [])[0]?.txHash) === String(inputAnchor?.txHash),
    'by-biz 与 records 两个读入口对同一业务给出同一条存证')
  const vocabularyAudit = sql(`SELECT COUNT(*) FROM agri_production.agri_prod_chain_record
                               WHERE del_flag = 0 AND target_type NOT IN ('HARVEST','QUALITY','TRACE','INPUT')`)
  check(vocabularyAudit === '0', '存证表业务类型全在词表内（历史脏值已迁移，新写入被拦住）', `越界值=${vocabularyAudit}`)

  /* ---------- 溯源码有效期：落库、扫描、核验三处都要说真话 ---------- */
  const pastCode = await api(farmerToken, 'POST', `/trace/codes/generate?batchId=${ids.batch}&expireDate=2020-01-01`)
  const futureCode = await api(farmerToken, 'POST', `/trace/codes/generate?batchId=${ids.batch}&expireDate=2099-12-31`)
  const pastProfile = await api(farmerToken, 'GET', `/trace/codes/${pastCode}`)
  const futureProfile = await api(farmerToken, 'GET', `/trace/codes/${futureCode}`)
  check(String(pastProfile?.expireDate) === '2020-01-01' && String(futureProfile?.expireDate) === '2099-12-31',
    '生成时填的有效期真的落库并回显（此前入参一直被丢掉，页面"有效期至"永远是 -）',
    `past=${pastProfile?.expireDate ?? ''} future=${futureProfile?.expireDate ?? ''}`)
  const badDate = await probe(farmerToken, 'POST',
    `/trace/codes/generate?batchId=${ids.batch}&expireDate=2026-13-99`)
  check(badDate.code === 400 && badDate.message.includes('yyyy-MM-dd'),
    '非法日期被拒并给出正确格式（不静默存成 null 让用户以为设置成功）', `code=${badDate.code}`)
  const noDateCode = await api(farmerToken, 'GET', `/trace/codes/${ids.traceCode}`)
  check(noDateCode?.expireDate === null || noDateCode?.expireDate === undefined,
    '没设有效期的码保持为空（不拿采收日或今天编一个出来）', `expireDate=${String(noDateCode?.expireDate)}`)

  const scanCount = await api(farmerToken, 'PATCH', '/trace/codes/expire-overdue')
  const pastAfterScan = await api(farmerToken, 'GET', `/trace/codes/${pastCode}`)
  const futureAfterScan = await api(farmerToken, 'GET', `/trace/codes/${futureCode}`)
  const mainAfterScan = await api(farmerToken, 'GET', `/trace/codes/${ids.traceCode}`)
  check(Number(scanCount) >= 1 && pastAfterScan?.status === 'expired'
    && futureAfterScan?.status !== 'expired' && mainAfterScan?.status !== 'expired',
    '到期扫描只把过了有效期的码置为 expired，未来日期与未设置的都不动',
    `扫描=${scanCount} past=${pastAfterScan?.status} future=${futureAfterScan?.status} 无日期=${mainAfterScan?.status}`)
  const expiredVerify = await raw(null, `/trace/public/verify/${pastCode}`)
  // 生产域成功码是 0（监管端才是 200），别拿另一套词表判这一边的成败
  check(expiredVerify.code === 0 && expiredVerify.data?.verifiable === false
    && expiredVerify.data?.expired === true && String(expiredVerify.data?.expiryDate) === '2020-01-01'
    && String(expiredVerify.data?.chainConclusion ?? '').includes('有效期'),
    '过期码在公开核验里被明确判为不可核验并说明有效期（不是继续显示"可核验"）',
    `verifiable=${expiredVerify.data?.verifiable} expired=${expiredVerify.data?.expired}`)
  const expiredDb = sql(`SELECT CONCAT(IFNULL(expiry_date,'-'),'|',status) FROM agri_production.agri_prod_trace_code
                         WHERE trace_code = '${pastCode}' AND deleted = 0`)
  check(expiredDb === '2020-01-01|expired', '到期结论与库内列一致（页面与数据库不会各说一套）', expiredDb)

  /* ---------- 存证记录要能跳回业务：出参得带上业务主键 ---------- */
  const harvestAnchorRow = await probe(farmerToken, 'GET', `/blockchain/by-biz?bizType=HARVEST&bizNo=${ids.batchNo}`)
  const harvestForJump = (harvestAnchorRow.data ?? [])[0]
  check(String(harvestForJump?.targetId) === String(ids.batch)
    && String(harvestForJump?.bizNo) === String(ids.batchNo),
    '采收存证带出 target_id（列表页跳采收详情靠它，编号进不去详情页）',
    `targetId=${harvestForJump?.targetId ?? ''}`)
  const inputAnchorRow = await probe(farmerToken, 'GET', `/blockchain/by-biz?bizType=INPUT&bizNo=${ids.usage}`)
  check(String((inputAnchorRow.data ?? [])[0]?.targetId) === String(ids.usage),
    '投入品存证带出使用记录主键（跳使用台账时用得上）')

  /* ---------- 列表的链上状态必须与存证表、与全链路节点同一个口径 ---------- */
  const codeAnchor = await api(farmerToken, 'POST', '/blockchain/anchor', {
    bizType: 'TRACE', bizNo: ids.traceCode, bizSummary: `联调溯源码存证-${suffix}`,
  })
  ids.chainRecords.push(String(codeAnchor?.recordNo ?? ''))
  const codedProfile = await api(farmerToken, 'GET', `/trace/codes/${ids.traceCode}`)
  check(codedProfile?.attested === true && codedProfile?.onChain === true
    && String(codedProfile?.txHash) === String(codeAnchor?.txHash)
    && String(codedProfile?.recordNo) === String(codeAnchor?.recordNo)
    && codedProfile?.chainStatus === 'SUCCESS',
    '用户端单码详情按存证表给出已上链与交易哈希（不再读 blockchain_tx_hash 死列）',
    `onChain=${codedProfile?.onChain} record=${codedProfile?.recordNo ?? ''}`)

  // 同一码再补一条 FAILED（id 更大）：已出过块的事实不能被后来的一次失败抹掉
  const laterFailed = `CHAIN-E2E-${suffix}-T2`
  ids.chainRecords.push(laterFailed)
  sql(`INSERT INTO agri_production.agri_prod_chain_record
       (record_no, chain_type, target_type, target_id, target_code, data_hash, chain_status,
        failed_reason, retry_count, del_flag, tenant_id, create_by, create_time, update_time)
       VALUES ('${laterFailed}', 'SIMULATED', 'TRACE', NULL, '${ids.traceCode}', 'e2e', 'FAILED',
        '联调：重复提交后失败', 1, 0, '2001', 'e2e', NOW(), NOW())`)
  const afterSecond = await api(farmerToken, 'GET', `/trace/codes/${ids.traceCode}`)
  check(afterSecond?.onChain === true && String(afterSecond?.recordNo) === String(codeAnchor?.recordNo),
    '同一码有 SUCCESS 又有 FAILED 时判"已上链"并取那条 SUCCESS（规则只有一处：ChainEvidenceRule）',
    `onChain=${afterSecond?.onChain} record=${afterSecond?.recordNo ?? ''}`)

  const userList = await api(farmerToken, 'GET', '/trace/codes?page=1&size=50')
  const userRow = (userList?.records ?? []).find((row) => String(row.code) === String(ids.traceCode))
  const seedFailedRow = (userList?.records ?? []).find((row) => String(row.code) === 'AG010102202605280001')
  const noRecordRow = (userList?.records ?? []).find((row) => String(row.code) === 'AG010101202606010001')
  check(userRow?.onChain === true && seedFailedRow?.attested === true && seedFailedRow?.onChain === false
    && seedFailedRow?.chainStatus === 'FAILED' && noRecordRow?.attested === false
    && noRecordRow?.onChain === false,
    '列表三态各归各位：已上链 / 有记录但未成功 / 查过没有记录',
    `${userRow?.onChain} / ${seedFailedRow?.chainStatus} / attested=${noRecordRow?.attested}`)

  const opsList = await api(adminToken, 'GET', '/admin/trace/codes?page=1&size=50')
  const opsRow = (opsList?.records ?? []).find((row) => String(row.code) === String(ids.traceCode))
  check(opsRow?.onChain === userRow?.onChain && String(opsRow?.recordNo) === String(userRow?.recordNo)
    && opsRow?.attested === userRow?.attested,
    '运营端列表与用户端列表对同一个码给出同样的链上结论',
    `ops=${opsRow?.onChain}/${opsRow?.recordNo ?? ''} user=${userRow?.onChain}/${userRow?.recordNo ?? ''}`)
  const opsStats = await api(adminToken, 'GET', '/admin/trace/code-stats')
  check(Object.prototype.hasOwnProperty.call(opsStats ?? {}, 'expired'),
    '运营端码段统计含 expired 档（加了到期扫描后不再漏计过期码）',
    `keys=${Object.keys(opsStats ?? {}).join(',')}`)
  const nodeForCode = (await api(farmerToken, 'GET', `/trace/full-chain/trace/${ids.traceCode}`))
    ?.find((node) => node.stage === 'trace')
  check(nodeForCode && Boolean(nodeForCode.onChain) === Boolean(userRow?.onChain)
    && String(nodeForCode.recordNo ?? '') === String(userRow?.recordNo ?? ''),
    '列表结论与全链路节点结论一致（同一处规则，两处不会各说一套）',
    `node=${nodeForCode?.onChain}/${nodeForCode?.recordNo ?? ''} list=${userRow?.onChain}`)

  /* ---------- 列表筛选：条件必须在服务端真的生效 ---------- */
  const codesWith = async (params) => {
    const rows = (await api(farmerToken, 'GET', `/trace/codes?page=1&size=200&${params}`))?.records ?? []
    return new Set(rows.map((row) => String(row.code)))
  }
  const onChainSet = await codesWith('chain=onChain')
  const noneSet = await codesWith('chain=none')
  const unconfirmedSet = await codesWith('chain=unconfirmed')
  check(onChainSet.has(String(ids.traceCode)) && !noneSet.has(String(ids.traceCode))
    && !unconfirmedSet.has(String(ids.traceCode)),
    '链上状态筛选：已上链的码只出现在 chain=onChain 结果里',
    `onChain=${onChainSet.size} unconfirmed=${unconfirmedSet.size} none=${noneSet.size}`)
  check(noneSet.has('AG010101202606010001') && unconfirmedSet.has('AG010102202605280001')
    && !noneSet.has('AG010102202605280001'),
    '种子数据也按存证表分档：没记录=none，只有 FAILED=unconfirmed')
  const expiredSet = await codesWith('expiry=expired')
  const validSet = await codesWith('expiry=valid')
  const unsetSet = await codesWith('expiry=unset')
  check(expiredSet.has(String(pastCode)) && validSet.has(String(futureCode))
    && unsetSet.has(String(ids.traceCode)) && !expiredSet.has(String(futureCode)),
    '有效期筛选三档互斥且与库内 expiry_date 一致（未设置的不算已过期）',
    `expired=${expiredSet.size} valid=${validSet.size} unset=${unsetSet.size}`)
  const keywordSet = await codesWith(`keyword=${ids.batchNo}`)
  check(keywordSet.size >= 3 && keywordSet.has(String(pastCode))
    && keywordSet.has(String(futureCode)) && keywordSet.has(String(ids.traceCode))
    && !keywordSet.has('AG010101202606010001'),
    '关键字在服务端跨全表匹配（不再只筛已经取回的那一页）', `命中=${keywordSet.size}`)
  const farmSet = await codesWith(`farmId=${farmId}`)
  const otherFarm = await codesWith('farmId=999999')
  check(farmSet.size > 0 && otherFarm.size === 0,
    '农场筛选真的生效（此前比的是出参里不存在的 farmId，这个下拉从来没起过作用）',
    `本农场=${farmSet.size} 别的农场=${otherFarm.size}`)
  const badChain = await raw(farmerToken, '/trace/codes?page=1&size=10&chain=bogus')
  check(badChain.code === 400 && badChain.message.includes('链上状态筛选只认'),
    '非法链上状态取值报 400 并列出可选项（不静默当"不筛"）', `code=${badChain.code}`)
  const badFarm = await raw(farmerToken, '/trace/codes?page=1&size=10&farmId=abc')
  check(badFarm.code === 400 && badFarm.message.includes('农场主键'),
    '非数字农场 id 报错，不静默忽略筛选条件')
  const opsFiltered = await api(adminToken, 'GET', `/admin/trace/codes?page=1&size=50&code=${ids.traceCode}`)
  check((opsFiltered?.records ?? []).some((row) => String(row.code) === String(ids.traceCode))
    && (opsFiltered?.total ?? 0) >= 1,
    '运营端按溯源码筛选走服务端，total 与筛后结果一致（不再是"筛出空列表但总数照旧"）',
    `total=${opsFiltered?.total} rows=${(opsFiltered?.records ?? []).length}`)
  const opsChainFilter = await api(adminToken, 'GET', '/admin/trace/codes?page=1&size=50&chain=none')
  check((opsChainFilter?.records ?? []).every((row) => row.attested === false)
    && !(opsChainFilter?.records ?? []).some((row) => String(row.code) === String(ids.traceCode)),
    '运营端链上状态筛选同样生效（跨主体也按各自存证判）',
    `rows=${(opsChainFilter?.records ?? []).length}`)
  const foreignList = await api(luochuanToken, 'GET', '/trace/codes?page=1&size=50&chain=onChain')
  check(!(foreignList?.records ?? []).some((row) => String(row.code) === String(ids.traceCode)),
    '别的主体筛 chain=onChain 拿不到本主体的码（租户条件先于链上条件）',
    `rows=${(foreignList?.records ?? []).length}`)

  /* ---------- 分页：翻页必须由服务端做，且两页不重不漏 ---------- */
  // 演示库里只有 2 条可见码，不够验证分页 —— 给本批次补到 12 条（清理按 harvest_id 一起软删）
  const batchCodes = (await api(farmerToken, 'GET', `/trace/batches/${ids.batch}`)).map((row) => row.code)
  for (let i = batchCodes.length; i < 12; i += 1) {
    await api(farmerToken, 'POST', `/trace/codes/generate?batchId=${ids.batch}`)
  }
  const pageQuery = (page, size) => api(farmerToken, 'GET', `/trace/codes?page=${page}&size=${size}&keyword=${ids.batchNo}`)
  const page1 = await pageQuery(1, 10)
  const page2 = await pageQuery(2, 10)
  const page3 = await pageQuery(3, 10)
  const page1Codes = (page1?.records ?? []).map((row) => String(row.code))
  const page2Codes = (page2?.records ?? []).map((row) => String(row.code))
  const overlap = page1Codes.filter((code) => page2Codes.includes(code))
  check(page1?.total === 12 && page1Codes.length === 10 && page2Codes.length === 2 && overlap.length === 0
    && (page3?.records ?? []).length === 0 && page3?.total === 12,
    '服务端分页：第 1 页 10 条、第 2 页 2 条、第 3 页空，两页不重叠且 total 稳定',
    `total=${page1?.total} p1=${page1Codes.length} p2=${page2Codes.length} 重复=${overlap.length}`)
  const pageSizeChanged = await pageQuery(1, 5)
  check((pageSizeChanged?.records ?? []).length === 5 && pageSizeChanged?.total === 12,
    '改每页条数由服务端返回对应条数（不是本地切同一批数据）',
    `rows=${(pageSizeChanged?.records ?? []).length}`)

  // 人为作废与到期失效是两件事：库里 revoked / expired 两个取值要各自筛得出来，页面才谈得上两种文案。
  // 这里另起一条没有到期日的码来作废 —— 别拿 pastCode 那批，它们的组合会把两个维度搅在一起看不清。
  const revokedCode = String(await api(farmerToken, 'POST', `/trace/codes/generate?batchId=${ids.batch}`))
  const revokedProfile = await api(farmerToken, 'POST', `/trace/${revokedCode}/revoke`)
  const revokedSet = await codesWith('status=revoked')
  const expiredStatusSet = await codesWith('status=expired')
  check(revokedProfile?.status === 'revoked' && revokedSet.has(revokedCode)
    && !revokedSet.has(String(pastCode)) && expiredStatusSet.has(String(pastCode))
    && !expiredStatusSet.has(revokedCode),
    '状态筛选把「人为作废」和「到期失效」分成两档（revoked / expired 不互相冒充）',
    `revoked=${revokedSet.size} expired=${expiredStatusSet.size}`)
  const revokedUnset = await codesWith('status=revoked&expiry=unset')
  const revokedExpired = await codesWith('status=revoked&expiry=expired')
  check(revokedUnset.has(revokedCode) && revokedExpired.size === 0,
    '状态与有效期是两个独立维度：作废的码没设到期日就只在 expiry=unset 里，不随状态一起变',
    `unset=${revokedUnset.size} expired=${revokedExpired.size}`)

  // 出参的批次键要和页面读的名字对上：以前用户端 VO 给 batchNumber，页面按 batchNo/batchId 取，
  // 于是「批次号」列永远是 "-"、行内「全链路→」永远显示"未关联批次"（跳转入口等于不存在）
  const contractRow = (await api(farmerToken, 'GET', `/trace/codes?page=1&size=1&keyword=${revokedCode}`))?.records?.[0]
  check(String(contractRow?.batchId) === String(ids.batch) && String(contractRow?.batchNo) === String(ids.batchNo)
    && /^\d{4}-\d{2}-\d{2}/.test(String(contractRow?.createdAt ?? '')),
    '用户端列表出参带 batchId/batchNo/createdAt（批次主键、批次号、生成时间），页面那几个键真的取得到',
    `batchId=${contractRow?.batchId ?? ''} batchNo=${contractRow?.batchNo ?? ''} created=${contractRow?.createdAt ?? ''}`)

  /* ---------- 质检列表：筛选与分页都要在服务端真的生效 ---------- */
  // 建 12 张带统一前缀的检测单：机构 6/6 分两家，抽样日期铺在 10-01~10-12，先都不出结论
  const qcNos = []
  const qcIds = []
  for (let i = 0; i < 12; i += 1) {
    const no = `QC-E2E-${suffix}-${String(i + 1).padStart(2, '0')}`
    qcNos.push(no)
    qcIds.push(String(await api(farmerToken, 'POST', '/quality/inspections', {
      inspectionNo: no, batchId: ids.batch, batchNo: ids.batchNo, farmId: String(farmId), plotId: ids.plot,
      cropName: crop.cropName, inspectionType: i % 2 === 0 ? 'SELF' : 'SEND',
      labName: i < 6 ? '联调甲机构' : '联调乙机构', sampleQty: 1,
      sampleAt: `2026-10-${String(i + 1).padStart(2, '0')} 09:00:00`,
      inspectorName: '联检测员', remark: `联调质检分页-${suffix}`,
    })))
  }
  ids.qcInspections = qcNos
  for (const id of qcIds.slice(0, 3)) {
    await api(farmerToken, 'POST', `/quality/inspections/${id}/result?result=PASS`)
  }
  const qcMarker = `QC-E2E-${suffix}`
  const qcQuery = async (params) => {
    const json = await api(farmerToken, 'GET', `/quality/inspections?keyword=${qcMarker}&${params}`)
    return { total: Number(json?.total ?? -1), nos: (json?.records ?? []).map((row) => String(row.inspectionNo)) }
  }
  const qcPage1 = await qcQuery('page=1&size=10')
  const qcPage2 = await qcQuery('page=2&size=10')
  const qcOverlap = qcPage1.nos.filter((no) => qcPage2.nos.includes(no))
  check(qcPage1.total === 12 && qcPage1.nos.length === 10 && qcPage2.nos.length === 2
    && qcOverlap.length === 0,
    '质检列表服务端分页：第 1 页 10 条、第 2 页 2 条、不重叠，total 是筛选后的总数',
    `total=${qcPage1.total} p1=${qcPage1.nos.length} p2=${qcPage2.nos.length} 重复=${qcOverlap.length}`)
  const qcPending = await qcQuery('page=1&size=50&result=PENDING')
  const qcPass = await qcQuery('page=1&size=50&result=PASS')
  check(qcPass.total === 3 && qcPending.total === 9
    && qcPass.nos.every((no) => !qcPending.nos.includes(no)),
    '「待检」在服务端解释成"还没出结论"（库里 result 是 NULL，按等值筛 PENDING 会一条都命中不到）',
    `PASS=${qcPass.total} 待检=${qcPending.total}`)
  const qcLabA = await qcQuery('page=1&size=50&labName=' + encodeURIComponent('联调甲机构'))
  const qcLabNone = await qcQuery('page=1&size=50&labName=' + encodeURIComponent('不存在的机构'))
  check(qcLabA.total === 6 && qcLabNone.total === 0,
    '机构筛选真的生效（此前只在浏览器里筛那 200 条，机构下拉换了没反应）',
    `甲机构=${qcLabA.total} 不存在的机构=${qcLabNone.total}`)
  const qcDated = await qcQuery('page=1&size=50&startDate=2026-10-01&endDate=2026-10-05')
  const qcOutOfRange = await qcQuery('page=1&size=50&startDate=2027-01-01&endDate=2027-12-31')
  check(qcDated.total === 5 && qcOutOfRange.total === 0,
    '抽样日期区间按 sample_at 在服务端生效，且两端含当天（区间外如实为空，不返回全量）',
    `10-01~10-05=${qcDated.total} 2027 全年=${qcOutOfRange.total}`)
  const qcCombined = await qcQuery(`page=1&size=50&result=PASS&labName=${encodeURIComponent('联调甲机构')}`)
  check(qcCombined.total === 3 && qcCombined.nos.every((no) => qcLabA.nos.includes(no)),
    '多个条件叠加是 AND（结论 + 机构），不是各筛一遍再取并集', `命中=${qcCombined.total}`)

  /* ---------- 溯源码生成日期区间（用户端本轮补的控件） ---------- */
  const todayText = new Date().toISOString().slice(0, 10)
  const datedCodes = await codesWith(`from=2000-01-01&to=${todayText}`)
  const futureCodes = await codesWith('from=2099-01-01&to=2099-12-31')
  check(datedCodes.has(revokedCode) && futureCodes.size === 0,
    '溯源码 from/to 在服务端按 create_time 生效（区间外返回空，而不是把全量再交给前端）',
    `今年前至今=${datedCodes.size} 2099 年=${futureCodes.size}`)
  const badRange = await raw(farmerToken, '/trace/codes?page=1&size=10&from=2026/13/01')
  check(badRange.code === 400 && badRange.message.includes('yyyy-MM-dd'),
    '生成日期格式不对报 400 并给出正确格式（不静默当"没筛"）', `code=${badRange.code}`)

  ids.rule = `RULE-E2E-${suffix}`
  sql(`INSERT INTO agri_production.agri_prod_alert_rule
       (rule_code, rule_name, alert_type, level, source_type, threshold_max, unit,
        is_enabled, notify_users, tenant_id, create_time, update_time, deleted)
       VALUES ('${ids.rule}', '联调温度上限-${suffix}', 'temperature', 'warning', 'SENSOR', 35, '℃',
        1, '${member?.memberId ?? ''}', '2001', NOW(), NOW(), 0)`)
  const devices = await api(farmerToken, 'GET', '/iot/devices?page=1&size=1')
  const device = devices?.records?.[0] ?? devices?.list?.[0]
  check(Boolean(device?.deviceId ?? device?.id), '读取 IoT 设备', `device=${device?.deviceId ?? device?.id}`)
  await api(farmerToken, 'POST', '/iot/sensor-data', {
    deviceId: device?.deviceId ?? device?.id, deviceCode: device?.deviceCode,
    sensorType: 'temperature', sensorName: '空气温度', value: 41.2, unit: '℃',
    qualityFlag: 'GOOD', farmId, plotId: ids.plot,
  })
  const sensorAlert = sql(`SELECT COUNT(*) FROM agri_production.agri_prod_alert_record WHERE rule_code = '${ids.rule}' AND deleted = 0`)
  const sensorMessage = sql(`SELECT COUNT(*) FROM agri_production.agri_prod_message_notify WHERE msg_type = 'ALERT' AND title LIKE '%联调温度上限-${suffix}%' AND deleted = 0`)
  check(Number(sensorAlert) >= 1 && Number(sensorMessage) >= 1,
    'IoT 读数越限自动生成告警并通知', `alert=${sensorAlert} msg=${sensorMessage}`)

} finally {
  // 逻辑删除一律写 1（与 @TableLogic 的 logic-delete-value 同值）。
  // 此前这里写的是 `deleted = id`：查询效果碰巧一样（都不是 0），但库里会出现应用永远
  // 产生不了的值，下一轮用 SQL 审计残留时就会被这些行误导 —— 口径要跟着应用走。
  const softDelete = (table, where) =>
    sql(`UPDATE agri_production.${table} SET deleted = 1 WHERE ${where}`)
  if (ids.plot) softDelete('agri_prod_plot_info', `id = '${ids.plot}'`)
  if (ids.plan) softDelete('agri_prod_planting_plan', `id = '${ids.plan}'`)
  if (ids.stage) softDelete('agri_prod_plan_stage', `id = '${ids.stage}'`)
  if (ids.task) softDelete('agri_prod_task_info', `id = '${ids.task}'`)
  if (ids.input) {
    softDelete('agri_prod_input_usage', `id = '${ids.usage}'`)
    softDelete('agri_prod_input_stock_flow', `input_id = '${ids.input}'`)
    softDelete('agri_prod_input_material', `id = '${ids.input}'`)
  }
  if (ids.batch) {
    softDelete('agri_prod_inventory', `batch_id = '${ids.batch}'`)
    softDelete('agri_prod_inventory_flow', `batch_id = '${ids.batch}'`)
    softDelete('agri_prod_trace_code', `harvest_id = '${ids.batch}'`)
    softDelete('agri_prod_harvest_batch', `id = '${ids.batch}'`)
  }
  if (ids.inspection) softDelete('agri_prod_inspection', `id = '${ids.inspection}'`)
  // 质检分页那 12 张按单号前缀清掉（它们只为验证服务端筛选与分页而存在）
  if (ids.qcInspections.length) {
    softDelete('agri_prod_inspection',
      `inspection_no IN (${ids.qcInspections.map((no) => `'${no}'`).join(',')})`)
  }
  softDelete('agri_prod_alert_record', `content LIKE '%${suffix}%' OR title LIKE '%${suffix}%'`)
  softDelete('agri_prod_message_notify', `content LIKE '%${suffix}%' OR title LIKE '%${suffix}%'`)
  if (ids.rule) softDelete('agri_prod_alert_rule', `rule_code = '${ids.rule}'`)
  if (ids.approval) softDelete('agri_prod_approval', `approval_code = '${ids.approval}'`)
  softDelete('agri_prod_sensor_data', `sensor_name = '空气温度' AND value = 41.2 AND plot_id = '${ids.plot}'`)
  // 存证记录用真删：它不属于业务台账，留着会一直在存证列表里污染条数统计
  if (ids.chainRecords.length) {
    sql(`DELETE FROM agri_production.agri_prod_chain_record
         WHERE record_no IN (${ids.chainRecords.map((no) => `'${no}'`).join(',')})`)
  }
  console.log('\n清理：联调数据已按主键逻辑删除（deleted=1），存证记录已物理删除')
}

/* 清理后复核：软删的行对应用必须彻底不可见（这是本轮"软删过滤"的判据，不看 SQL 看接口） */
{
  const goneChecks = [
    [`/trace/codes/${ids.traceCode}`, '已作废溯源码在属主侧不可见'],
    [`/trace/full-chain/${ids.batch}/nodes`, '已作废批次的全链路在属主侧不可见'],
    [`/harvests/${ids.batch}`, '已作废批次详情不可见'],
  ]
  for (const [path, label] of goneChecks) {
    const gone = await raw(farmerToken, path)
    check(gone.code === 404, label, `code=${gone.code} message=${gone.message}`)
  }
  const publicGone = await fetch(`${GW}/api/v1/production/trace/public/verify/${ids.traceCode}`)
  const publicBody = await publicGone.json().catch(() => ({}))
  check(publicBody?.code === 404, '已作废溯源码在公开核验入口同样 404（作废码不会被显示成可核验）',
    `code=${publicBody?.code}`)
  const residue = sql(`SELECT COUNT(*) FROM agri_production.agri_prod_trace_code WHERE deleted NOT IN (0, 1)`)
  const chainResidue = sql(`SELECT COUNT(*) FROM agri_production.agri_prod_chain_record WHERE record_no LIKE 'CHAIN-E2E-%'`)
  const qcResidue = sql(`SELECT COUNT(*) FROM agri_production.agri_prod_inspection WHERE inspection_no LIKE 'QC-E2E-%' AND deleted = 0`)
  check(residue === '0' && chainResidue === '0' && qcResidue === '0',
    '库内没有非规范 deleted 值、没有联调存证残留、没有联调检测单残留',
    `deleted 异常=${residue} 存证残留=${chainResidue} 检测单残留=${qcResidue}`)
}

console.log('')
if (!failures.length) {
  console.log('生产主链路端到端联调全部通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((label) => console.log('  -', label))
process.exit(1)

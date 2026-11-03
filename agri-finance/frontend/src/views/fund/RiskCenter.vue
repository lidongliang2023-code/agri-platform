<template>
  <section class="finance-page risk-center-page">
    <header class="finance-page-heading">
      <div>
        <small>TRIANGLE CHAIN RISK CENTER</small>
        <h1>三角链风控中台</h1>
        <p>订单、物流、仓单与生产 IoT 多源交叉验证，形成资金方可追溯的信用评估依据。</p>
      </div>
      <div class="finance-page-heading-actions risk-actions">
        <el-select v-model="subjectId" filterable style="width: 210px" @change="load">
          <el-option
            v-for="subject in subjects"
            :key="subject.subjectId"
            :label="subject.subjectName"
            :value="subject.subjectId"
          />
        </el-select>
        <el-button class="finance-ghost-button" :loading="loading" @click="load">刷新</el-button>
        <el-button class="finance-action-button" :loading="assessing" @click="assess">
          运行交叉风控评估
        </el-button>
      </div>
    </header>

    <div v-if="error" class="risk-error">{{ error }}</div>
    <el-skeleton v-if="loading && !report" :rows="8" animated />

    <template v-if="report">
      <div class="risk-hero">
        <div class="risk-score-orb" :class="levelTone(report.riskLevel)">
          <small>综合风险分</small>
          <strong>{{ report.compositeScore }}</strong>
          <span>{{ report.riskLevel }}</span>
        </div>
        <div class="risk-hero-main">
          <span class="risk-subject">{{ report.subjectName }} · {{ report.subjectId }}</span>
          <h2>{{ report.decision }}</h2>
          <p>四维数据完整度 {{ report.dataCompleteness }}% · 交叉验证状态 {{ crossText(report.crossValidationStatus) }}</p>
          <div class="risk-hero-bar">
            <i :style="{ width: `${report.dataCompleteness}%` }" />
          </div>
          <div class="risk-hero-tags">
            <span>评估时间 {{ report.generatedAt }}</span>
            <span v-if="report.assessmentNo">快照编号 {{ report.assessmentNo }}</span>
          </div>
        </div>
        <div class="risk-portfolio">
          <div><small>在贷余额</small><strong>{{ compactMoney(report.portfolio?.outstandingAmount) }}</strong></div>
          <div><small>在贷笔数</small><strong>{{ report.portfolio?.activeLoans ?? 0 }}</strong></div>
          <div><small>有效仓单</small><strong>{{ report.portfolio?.activePledges ?? 0 }}</strong></div>
          <div><small>历史快照</small><strong>{{ report.portfolio?.assessmentCount ?? 0 }}</strong></div>
        </div>
      </div>

      <div class="risk-dimension-grid">
        <article v-for="dimension in report.dimensions" :key="dimension.key" class="risk-dimension-card" :class="statusTone(dimension.status)">
          <div class="risk-dimension-head">
            <span>{{ dimensionIcon(dimension.key) }}</span>
            <div><small>{{ dimension.key }}</small><h3>{{ dimension.name }}</h3></div>
            <b>{{ dimension.status === 'NO_DATA' ? '—' : dimension.score }}</b>
          </div>
          <p>{{ dimension.description }}</p>
          <div class="risk-dimension-status">
            <i />
            {{ dimensionStatusText(dimension.status) }}
            <span>{{ dimension.evidence?.records || 0 }} 条证据</span>
          </div>
          <div class="risk-evidence-values">
            <span v-for="(value, key) in dimension.evidence?.values || {}" :key="key">
              <small>{{ evidenceLabel(key) }}</small>
              <b>{{ evidenceValue(key, value) }}</b>
            </span>
          </div>
          <div class="risk-finding">{{ dimension.finding }}</div>
        </article>
      </div>

      <div class="risk-two-grid">
        <section class="finance-card">
          <div class="finance-card-head">
            <strong>四源交叉验证</strong>
            <small>订单 ↔ 物流 ↔ 仓单 ↔ 生产</small>
          </div>
          <div class="risk-check-list">
            <div v-for="item in report.crossChecks" :key="item.key">
              <span class="risk-check-icon" :class="statusTone(item.status)">{{ statusSymbol(item.status) }}</span>
              <div><strong>{{ item.name }}</strong><small>{{ item.finding }}</small></div>
              <em :class="statusTone(item.status)">{{ crossText(item.status) }}</em>
            </div>
          </div>
        </section>

        <section class="finance-card">
          <div class="finance-card-head">
            <strong>风险预警</strong>
            <small>{{ report.alerts?.length || 0 }} 项</small>
          </div>
          <div class="risk-alert-list">
            <div v-for="(item, index) in report.alerts" :key="`${item.title}-${index}`" :class="levelTone(item.level)">
              <span>{{ item.level === 'HIGH' ? '!' : item.level === 'MEDIUM' ? '▲' : '✓' }}</span>
              <div><strong>{{ item.title }}</strong><small>{{ item.detail }}</small></div>
              <em>{{ item.level }}</em>
            </div>
          </div>
        </section>
      </div>

      <section class="finance-card">
        <div class="finance-card-head">
          <strong>生效风控策略</strong>
          <small>{{ report.rules?.length || 0 }} 条规则参与本次评估</small>
        </div>
        <div class="risk-rule-strip">
          <div v-for="rule in report.rules" :key="rule.ruleNo">
            <span>{{ rule.ruleType }}</span>
            <strong>{{ rule.ruleName }}</strong>
            <small>{{ rule.action }} · {{ rule.priority }}</small>
          </div>
          <div v-if="!report.rules?.length" class="finance-empty"><strong>暂无启用规则</strong></div>
        </div>
      </section>

      <section class="finance-card">
        <div class="finance-card-head">
          <strong>评估快照</strong>
          <small>每次评估形成可追溯的信用依据</small>
        </div>
        <el-table :data="snapshots" style="width: 100%">
          <el-table-column prop="assessmentNo" label="快照编号" min-width="165" />
          <el-table-column prop="subjectName" label="评估主体" min-width="120" />
          <el-table-column label="四维得分" min-width="190">
            <template #default="{ row }">{{ row.transactionScore }} / {{ row.logisticsScore }} / {{ row.warehouseScore }} / {{ row.productionScore }}</template>
          </el-table-column>
          <el-table-column prop="compositeScore" label="综合分" width="80" align="right" />
          <el-table-column prop="riskLevel" label="风险等级" width="95" />
          <el-table-column prop="decision" label="处置建议" min-width="130" />
          <el-table-column prop="dataCompleteness" label="完整度" width="80" align="right">
            <template #default="{ row }">{{ row.dataCompleteness }}%</template>
          </el-table-column>
          <el-table-column prop="evaluatedAt" label="评估时间" width="150" />
        </el-table>
      </section>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { operationsApi } from '@/api/operations'
import { compactMoney } from '@/api/finance'

const loading = ref(true)
const assessing = ref(false)
const error = ref('')
const report = ref(null)
const snapshots = ref([])
const subjectId = ref('')
const subjects = computed(() => report.value?.subjects || [])

const EVIDENCE_LABELS = {
  orderCount: '交易订单',
  totalAmount: '订单金额',
  fulfillmentRate: '履约率',
  settlementRate: '结算率',
  disputes: '争议订单',
  creditScore: '信用评分',
  creditLevel: '信用等级',
  overdueCount: '历史逾期',
  shipmentCount: '物流单数',
  deliveredCount: '已签收',
  inTransitCount: '运输中',
  signedCount: '签收节点',
  temperatureAlerts: '温控异常',
  crossMismatch: '状态不一致',
  averageTemperature: '平均温度',
  pledgeCount: '仓单数量',
  activeCount: '生效仓单',
  totalValue: '仓单价值',
  loanAmount: '质押融资',
  monitorCount: '监测次数',
  monitorAlerts: '仓储告警',
  weightDeviations: '重量偏差',
  deviceAbnormal: '设备异常',
  averageHumidity: '平均湿度',
  deviceCount: 'IoT 设备',
  onlineCount: '在线设备',
  onlineRate: '设备在线率',
  alertCount: 'IoT 告警',
  telemetryCount: '遥测记录',
  plotCount: '生产地块',
  averageBattery: '平均电量',
}

function evidenceLabel(key) {
  return EVIDENCE_LABELS[key] || key
}

function evidenceValue(key, value) {
  if (value == null) return '—'
  if (['totalAmount', 'loanAmount', 'totalValue'].includes(key)) return compactMoney(value)
  if (['fulfillmentRate', 'settlementRate', 'onlineRate'].includes(key)) return `${value}%`
  if (key === 'averageTemperature') return `${value}℃`
  if (key === 'averageHumidity') return `${value}%`
  return value
}

function dimensionIcon(key) {
  return {
    TRADE: '📦',
    LOGISTICS: '🚚',
    WAREHOUSE: '🏬',
    PRODUCTION_IOT: '📡',
  }[key] || '✓'
}

function dimensionStatusText(status) {
  return { PASS: '数据一致', WARN: '需要关注', RISK: '存在风险', NO_DATA: '数据未接入' }[status] || status
}

function crossText(status) {
  return { PASS: '通过', WARN: '关注', RISK: '冲突', NO_DATA: '数据不足' }[status] || status || '—'
}

function statusTone(status) {
  return { PASS: 'pass', WARN: 'warn', RISK: 'risk', NO_DATA: 'unknown' }[status] || 'unknown'
}

function statusSymbol(status) {
  return { PASS: '✓', WARN: '!', RISK: '×', NO_DATA: '—' }[status] || '—'
}

function levelTone(level) {
  if (level === 'HIGH' || level === '高风险') return 'risk'
  if (level === 'MEDIUM' || level === '中高风险' || level === '中低风险') return 'warn'
  if (level === 'LOW' || level === '低风险') return 'pass'
  return 'unknown'
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    if (!subjectId.value) {
      const list = await operationsApi.subjects()
      subjectId.value = list?.[0]?.subjectId || ''
    }
    if (!subjectId.value) {
      error.value = '还没有发生过融资业务的主体，暂无风控视图可看'
      return
    }
    report.value = await operationsApi.riskCenter(subjectId.value)
    subjectId.value = report.value.subjectId
    snapshots.value = await operationsApi.riskSnapshots(subjectId.value)
  } catch (err) {
    error.value = err.message || '风控中台数据加载失败'
  } finally {
    loading.value = false
  }
}

async function assess() {
  assessing.value = true
  try {
    report.value = await operationsApi.assessRiskCenter(subjectId.value)
    snapshots.value = await operationsApi.riskSnapshots(subjectId.value)
    ElMessage.success('交叉风控评估已完成，评估快照已保存')
  } catch (err) {
    ElMessage.error(err.message || '风控评估失败')
  } finally {
    assessing.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.risk-actions { align-items: center; }
.risk-error { padding: 12px 14px; border: 1px solid #efc9c4; border-radius: 10px; background: #fff4f2; color: #a94b42; font-size: var(--fin-fs-xs); }
.risk-hero { display: grid; grid-template-columns: 150px minmax(0, 1fr) 260px; align-items: center; gap: 20px; padding: 20px; border: 1px solid #dbe8df; border-radius: 17px; background: radial-gradient(circle at 88% 0, rgba(78, 186, 124, .13), transparent 260px), #fff; }
.risk-score-orb { display: grid; width: 132px; height: 132px; place-items: center; align-content: center; gap: 2px; border: 8px solid #e2f4e9; border-radius: 50%; background: #f8fcf9; }
.risk-score-orb strong { color: #176d47; font-family: ui-monospace, Consolas, monospace; font-size: 39px; line-height: 1; }
.risk-score-orb small, .risk-score-orb span { color: #789084; font-size: var(--fin-fs-xs); }
.risk-score-orb span { font-weight: 700; }
.risk-score-orb.warn { border-color: #fff0d2; }.risk-score-orb.warn strong { color: #b87816; }
.risk-score-orb.risk { border-color: #ffe2df; }.risk-score-orb.risk strong { color: #c34c42; }
.risk-score-orb.unknown { border-color: #edf1ee; }.risk-score-orb.unknown strong { color: #74827a; }
.risk-hero-main { display: grid; gap: 5px; }
.risk-subject { color: #74877b; font-size: var(--fin-fs-xs); }
.risk-hero-main h2 { margin: 0; color: #244432; font-size: 22px; }
.risk-hero-main p { margin: 0; color: #647a6d; font-size: var(--fin-fs-xs); }
.risk-hero-bar { height: 7px; margin-top: 5px; overflow: hidden; border-radius: 99px; background: #edf3ef; }
.risk-hero-bar i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #12764a, #51c783); }
.risk-hero-tags { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 5px; color: #91a097; font-size: var(--fin-fs-xs); }
.risk-portfolio { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
.risk-portfolio > div { display: grid; gap: 3px; padding: 10px; border-radius: 9px; background: #f6faf7; }
.risk-portfolio small { color: #7d9184; font-size: var(--fin-fs-xs); }.risk-portfolio strong { color: #2f543e; font-size: var(--fin-fs-xs); }
.risk-dimension-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 11px; }
.risk-dimension-card { display: grid; gap: 11px; padding: 15px; border: 1px solid #dfe9e2; border-radius: 15px; background: #fff; box-shadow: 0 8px 22px rgba(22, 66, 42, .035); }
.risk-dimension-card.pass { border-top: 3px solid #1a9a61; }.risk-dimension-card.warn { border-top: 3px solid #d7972d; }.risk-dimension-card.risk { border-top: 3px solid #ca4d43; }.risk-dimension-card.unknown { border-top: 3px solid #9aa8a0; }
.risk-dimension-head { display: grid; grid-template-columns: 38px 1fr auto; align-items: center; gap: 9px; }
.risk-dimension-head > span { display: grid; width: 38px; height: 38px; place-items: center; border-radius: 10px; background: #eff8f2; font-size: 20px; }
.risk-dimension-head small { color: #91a097; font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); }.risk-dimension-head h3 { margin: 1px 0 0; color: #315240; font-size: 12px; }
.risk-dimension-head > b { color: #286c49; font-family: ui-monospace, Consolas, monospace; font-size: 25px; }
.risk-dimension-card > p { min-height: 32px; margin: 0; color: #7b8e82; font-size: var(--fin-fs-xs); line-height: 1.6; }
.risk-dimension-status { display: flex; align-items: center; gap: 5px; color: #61786a; font-size: var(--fin-fs-xs); }.risk-dimension-status i { width: 7px; height: 7px; border-radius: 50%; background: #1a9a61; }.risk-dimension-card.warn .risk-dimension-status i { background: #d7972d; }.risk-dimension-card.risk .risk-dimension-status i { background: #ca4d43; }.risk-dimension-card.unknown .risk-dimension-status i { background: #9aa8a0; }.risk-dimension-status span { margin-left: auto; color: #9aa79f; font-size: var(--fin-fs-xs); }
.risk-evidence-values { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }.risk-evidence-values > span { display: grid; gap: 2px; padding: 7px; border-radius: 7px; background: #f7faf8; }.risk-evidence-values small { color: #91a097; font-size: var(--fin-fs-xs); }.risk-evidence-values b { color: #3c5949; font-size: var(--fin-fs-xs); overflow-wrap: anywhere; }
.risk-finding { padding: 8px; border-radius: 7px; background: #f3f8f5; color: #61766a; font-size: var(--fin-fs-xs); line-height: 1.55; }
.risk-two-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.risk-check-list, .risk-alert-list { display: grid; }
.risk-check-list > div, .risk-alert-list > div { display: grid; grid-template-columns: 28px 1fr auto; align-items: center; gap: 9px; padding: 10px 0; border-bottom: 1px solid #edf2ee; }
.risk-check-list > div:last-child, .risk-alert-list > div:last-child { border-bottom: 0; }
.risk-check-icon { display: grid; width: 25px; height: 25px; place-items: center; border-radius: 8px; font-size: var(--fin-fs-xs); font-weight: 800; }
.risk-check-icon.pass { background: #e8f7ef; color: #17794c; }.risk-check-icon.warn { background: #fff4df; color: #b87617; }.risk-check-icon.risk { background: #fff0ee; color: #bd493f; }.risk-check-icon.unknown { background: #eef2ef; color: #7b8b81; }
.risk-check-list strong, .risk-alert-list strong { display: block; color: #3a5747; font-size: var(--fin-fs-xs); }.risk-check-list small, .risk-alert-list small { display: block; margin-top: 2px; color: #82948a; font-size: var(--fin-fs-xs); line-height: 1.5; }.risk-check-list em, .risk-alert-list em { font-size: var(--fin-fs-xs); font-style: normal; font-weight: 700; }.risk-check-list em.pass { color: #197b4e; }.risk-check-list em.warn { color: #a96c16; }.risk-check-list em.risk { color: #b7473e; }.risk-check-list em.unknown { color: #7a8a80; }
.risk-alert-list > div > span { display: grid; width: 25px; height: 25px; place-items: center; border-radius: 50%; background: #fff4df; color: #a96c16; font-size: var(--fin-fs-xs); font-weight: 800; }.risk-alert-list > div.risk > span { background: #fff0ee; color: #b7473e; }.risk-alert-list > div.pass > span { background: #e8f7ef; color: #197b4e; }
.risk-rule-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }.risk-rule-strip > div { display: grid; gap: 4px; padding: 10px; border-radius: 8px; background: #f7faf8; }.risk-rule-strip span { color: #8a9a91; font-size: var(--fin-fs-xs); }.risk-rule-strip strong { color: #365443; font-size: var(--fin-fs-xs); }.risk-rule-strip small { color: #7f9187; font-size: var(--fin-fs-xs); }
@media (max-width: 1120px) { .risk-dimension-grid { grid-template-columns: repeat(2, 1fr); }.risk-hero { grid-template-columns: 135px 1fr; }.risk-portfolio { grid-column: 1 / -1; grid-template-columns: repeat(4, 1fr); }.risk-rule-strip { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 720px) { .risk-actions { align-items: stretch; flex-direction: column; width: 100%; }.risk-actions :deep(.el-select) { width: 100% !important; }.risk-hero { grid-template-columns: 1fr; }.risk-score-orb { margin: auto; }.risk-portfolio { grid-template-columns: 1fr 1fr; }.risk-dimension-grid, .risk-two-grid { grid-template-columns: 1fr; }.risk-rule-strip { grid-template-columns: 1fr; } }
</style>

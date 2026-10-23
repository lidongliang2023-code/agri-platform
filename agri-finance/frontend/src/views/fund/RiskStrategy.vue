<template>
  <section class="finance-page">
    <header class="finance-page-heading">
      <div><small>RISK STRATEGY</small><h1>风控策略</h1><p>配置信用、还款、质押与 IoT 风险规则，控制资产准入和贷后风险。</p></div>
      <div class="finance-page-heading-actions"><el-button class="finance-ghost-button" :loading="loading" @click="load">刷新规则</el-button></div>
    </header>

    <div class="finance-kpis">
      <article class="finance-kpi"><span>规则总数</span><strong>{{ rules.length }}<em> 条</em></strong><small>覆盖四类风险场景</small></article>
      <article class="finance-kpi"><span>已启用</span><strong>{{ enabledCount }}<em> 条</em></strong><small>自动预审实时生效</small></article>
      <article class="finance-kpi"><span>高风险规则</span><strong>{{ highPriorityCount }}<em> 条</em></strong><small>拒绝或转人工</small></article>
      <article class="finance-kpi"><span>触发次数</span><strong>{{ triggerCount }}<em> 次</em></strong><small>待审批与逾期命中</small></article>
    </div>

    <div class="risk-layout">
      <section class="finance-card">
        <div class="finance-card-head"><strong>风控规则</strong><small>调整后立即用于新申请预审</small></div>
        <el-table :data="rules" style="width: 100%">
          <el-table-column label="规则" min-width="180"><template #default="{ row }"><div class="rule-name"><span>{{ row.ruleType?.slice(0, 1) }}</span><div><strong>{{ row.ruleName }}</strong><small>{{ row.ruleNo }}</small></div></div></template></el-table-column>
          <el-table-column prop="ruleType" label="类型" width="90" />
          <el-table-column label="优先级" width="90"><template #default="{ row }"><FinanceStatus :value="row.priority" /></template></el-table-column>
          <el-table-column prop="conditions" label="触发条件" min-width="220" />
          <el-table-column prop="action" label="处置动作" min-width="100" />
          <el-table-column label="状态" width="85"><template #default="{ row }"><span :class="['rule-status', row.status === '启用' ? 'on' : 'off']">{{ row.status }}</span></template></el-table-column>
          <el-table-column label="操作" width="130" align="right"><template #default="{ row }"><el-button link class="finance-link-button" @click="editRule(row)">编辑</el-button><el-button link class="finance-link-button" @click="toggleRule(row)">{{ row.status === '启用' ? '停用' : '启用' }}</el-button></template></el-table-column>
        </el-table>
      </section>

      <aside class="finance-card">
        <div class="finance-card-head"><strong>风险策略说明</strong><small>分层控制</small></div>
        <div class="risk-strategy-guide">
          <div><b>准入</b><p>信用等级、历史逾期和多头融资规则决定是否进入人工复核。</p></div>
          <div><b>额度</b><p>结合质押率、订单回款和经营能力计算可投资金额。</p></div>
          <div><b>贷后</b><p>IoT、履约和还款预警触发后冻结新增提款并通知运营。</p></div>
        </div>
      </aside>
    </div>

    <el-dialog v-model="editOpen" title="编辑风控规则" width="min(580px, 92vw)">
      <el-form v-if="editing" label-position="top">
        <div class="finance-form-grid">
          <el-form-item label="优先级"><el-select v-model="editing.priority" style="width: 100%"><el-option label="高" value="HIGH" /><el-option label="中" value="MEDIUM" /><el-option label="低" value="LOW" /></el-select></el-form-item>
          <el-form-item label="处置动作"><el-input v-model="editing.action" /></el-form-item>
        </div>
        <el-form-item label="触发条件"><el-input v-model="editing.conditions" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="规则说明"><el-input v-model="editing.description" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer><el-button class="finance-ghost-button" @click="editOpen = false">取消</el-button><el-button class="finance-action-button" :loading="saving" @click="saveRule">保存规则</el-button></template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import FinanceStatus from '@/components/FinanceStatus.vue'
import { operationsApi } from '@/api/operations'

const loading = ref(true)
const saving = ref(false)
const rules = ref([])
const editOpen = ref(false)
const editing = ref(null)
const enabledCount = computed(() => rules.value.filter((item) => item.status === '启用').length)
const highPriorityCount = computed(() => rules.value.filter((item) => item.priority === 'HIGH').length)
const triggerCount = computed(() => 3)

function editRule(row) {
  editing.value = { ...row }
  editOpen.value = true
}

async function saveRule() {
  saving.value = true
  try {
    await operationsApi.updateRiskRule(editing.value)
    ElMessage.success('风控规则已保存')
    editOpen.value = false
    await load()
  } catch (err) {
    ElMessage.error(err.message || '规则保存失败')
  } finally {
    saving.value = false
  }
}

async function toggleRule(row) {
  try {
    await operationsApi.toggleRiskRule(row.id, row.status !== '启用')
    ElMessage.success(`规则已${row.status === '启用' ? '停用' : '启用'}`)
    await load()
  } catch (err) {
    ElMessage.error(err.message || '规则状态更新失败')
  }
}

async function load() {
  loading.value = true
  try { rules.value = (await operationsApi.riskRules()) || [] } catch (err) { ElMessage.error(err.message || '风控规则加载失败') } finally { loading.value = false }
}

onMounted(load)
</script>

<style scoped>
.finance-kpi em { color: #60776a; font-size: 10px; font-style: normal; }
.risk-layout { display: grid; grid-template-columns: minmax(0, 1fr) 280px; align-items: start; gap: 14px; }
.rule-name { display: flex; align-items: center; gap: 9px; }
.rule-name > span { display: grid; width: 32px; height: 32px; place-items: center; border-radius: 9px; background: #e8f5ee; color: var(--fin-green-700); font-size: 9px; font-weight: 700; }
.rule-name strong, .rule-name small { display: block; }
.rule-name strong { color: #395443; font-size: 10px; }
.rule-name small { margin-top: 2px; color: #8b9a92; font-family: ui-monospace, Consolas, monospace; font-size: 7px; }
.rule-status { display: inline-flex; padding: 3px 8px; border-radius: 99px; font-size: 8px; font-weight: 700; }
.rule-status.on { background: #e7f6ed; color: #18774d; }
.rule-status.off { background: #eef2ef; color: #75827a; }
.risk-strategy-guide { display: grid; padding: 14px 15px; }
.risk-strategy-guide > div { padding: 10px 0; border-top: 1px solid #edf2ee; }
.risk-strategy-guide > div:first-child { border-top: 0; }
.risk-strategy-guide b { color: #376149; font-size: 9px; }
.risk-strategy-guide p { margin: 3px 0 0; color: #75887c; font-size: 8.5px; line-height: 1.6; }
@media (max-width: 900px) { .risk-layout { grid-template-columns: 1fr; } }
</style>

<template>
  <section class="finance-page">
    <header class="finance-page-heading">
      <div><small>RISK STRATEGY</small><h1>风控策略</h1><p>配置信用、还款、质押与 IoT 风险规则，控制资产准入和贷后风险。</p></div>
      <div class="finance-page-heading-actions" />
    </header>

    <div class="finance-kpis">
      <article class="finance-kpi"><span>规则总数</span><strong>{{ rules.length }}<em> 条</em></strong><small>覆盖四类风险场景</small></article>
      <article class="finance-kpi"><span>已启用</span><strong>{{ enabledCount }}<em> 条</em></strong><small>自动预审实时生效</small></article>
      <article class="finance-kpi"><span>高风险规则</span><strong>{{ highPriorityCount }}<em> 条</em></strong><small>拒绝或转人工</small></article>
      <article class="finance-kpi"><span>触发次数</span><strong>{{ triggerCount }}<em> 次</em></strong><small>待审批与逾期命中</small></article>
    </div>

    <div class="risk-layout">
      <AgriElementListTable
        :columns="ruleColumns"
        :data="filteredRules"
        row-key="id"
        :loading="loading"
        client-pagination
        :column-settings-storage-key="canEditRules ? 'agri-finance:fund-risk-rules' : 'agri-finance:admin-risk-rules'"
        empty-text="暂无匹配的风控规则"
        @refresh="load"
      >
        <template #filter>
          <AgriVueFilterBar :field-count="3" :loading="loading" @search="applyFilter" @reset="resetFilter">
            <div class="agri-vue-filter-field">
              <label>关键字</label>
              <el-input v-model="draft.keyword" clearable placeholder="规则名称 / 编号 / 触发条件" @keyup.enter="applyFilter" />
            </div>
            <div class="agri-vue-filter-field">
              <label>优先级</label>
              <el-select v-model="draft.priority" clearable placeholder="全部优先级">
                <el-option label="全部" value="" />
                <el-option label="高优先级" value="HIGH" />
                <el-option label="中优先级" value="MEDIUM" />
                <el-option label="低优先级" value="LOW" />
              </el-select>
            </div>
            <div class="agri-vue-filter-field">
              <label>启用状态</label>
              <el-select v-model="draft.status" clearable placeholder="全部状态">
                <el-option label="全部" value="" />
                <el-option label="启用" value="启用" />
                <el-option label="停用" value="停用" />
              </el-select>
            </div>
          </AgriVueFilterBar>
        </template>
        <template #toolbar-left>
          <strong class="finance-table-title">风控规则</strong>
          <small class="finance-table-hint">{{ canEditRules ? '调整后立即用于新申请预审' : '只读查看 · 规则由资金机构维护' }}</small>
        </template>
        <template #cell-rule="{ row }">
          <div class="rule-name"><span>{{ row.ruleType?.slice(0, 1) }}</span><div><strong>{{ row.ruleName }}</strong><small>{{ row.ruleNo }}</small></div></div>
        </template>
        <template #cell-priority="{ row }"><FinanceStatus :value="row.priority" /></template>
        <template #cell-status="{ row }"><FinanceStatus :value="row.status === '启用' ? '启用' : '禁用'" :label="row.status" /></template>
        <template #cell-actions="{ row }">
          <AgriVueRowActions :actions="ruleRowActions(row)" />
        </template>
      </AgriElementListTable>

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
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { AgriElementListTable, AgriVueFilterBar, AgriVueRowActions } from '@agri/shared/vue/element'
import FinanceStatus from '@/components/FinanceStatus.vue'
import { operationsApi } from '@/api/operations'
import { hasFinancePermission } from '@/auth'

const loading = ref(true)
const saving = ref(false)
const rules = ref([])
const editOpen = ref(false)
const editing = ref(null)
const draft = reactive({ keyword: '', priority: '', status: '' })
const query = reactive({ keyword: '', priority: '', status: '' })
// 规则新增/编辑/启停后端要求 finance:fund；平台运营只有 finance:review，只读查看，不显示会被 403 的操作。
const canEditRules = computed(() => hasFinancePermission('finance:fund'))

const ruleColumns = computed(() => {
  const cols = [
    { key: 'rule', label: '规则', minWidth: 190, locked: true, ellipsis: false },
    { key: 'ruleType', prop: 'ruleType', label: '类型', width: 96 },
    { key: 'priority', prop: 'priority', label: '优先级', kind: 'status', width: 105 },
    { key: 'conditions', prop: 'conditions', label: '触发条件', minWidth: 210 },
    { key: 'action', prop: 'action', label: '处置动作', minWidth: 110 },
    { key: 'status', prop: 'status', label: '状态', kind: 'status', width: 92 },
  ]
  if (canEditRules.value) {
    cols.push({ key: 'actions', label: '操作', kind: 'action', width: 130 })
  }
  return cols
})

function applyFilter() {
  query.keyword = draft.keyword
  query.priority = draft.priority
  query.status = draft.status
}

function resetFilter() {
  draft.keyword = ''
  draft.priority = ''
  draft.status = ''
  applyFilter()
}

const filteredRules = computed(() => {
  const kw = query.keyword.trim().toLowerCase()
  return rules.value.filter((row) => {
    if (query.priority && row.priority !== query.priority) return false
    if (query.status && row.status !== query.status) return false
    if (kw && !`${row.ruleName || ''}${row.ruleNo || ''}${row.ruleType || ''}${row.conditions || ''}`.toLowerCase().includes(kw)) return false
    return true
  })
})

function ruleRowActions(row) {
  return [
    { key: 'edit', label: '编辑', onClick: () => editRule(row) },
    { key: 'toggle', label: row.status === '启用' ? '停用' : '启用', onClick: () => toggleRule(row) },
  ]
}
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
.finance-kpi em { color: #60776a; font-size: var(--fin-fs-xs); font-style: normal; }
.risk-layout { display: grid; grid-template-columns: minmax(0, 1fr) 280px; align-items: start; gap: 14px; }
.rule-name { display: flex; align-items: center; gap: 9px; }
.rule-name > span { display: grid; width: 32px; height: 32px; place-items: center; border-radius: 9px; background: #e8f5ee; color: var(--fin-green-700); font-size: var(--fin-fs-xs); font-weight: 600; }
.rule-name strong, .rule-name small { display: block; }
.rule-name strong { color: #395443; font-size: var(--fin-fs-xs); }
.rule-name small { margin-top: 2px; color: #8b9a92; font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); }
.rule-status { display: inline-flex; padding: 3px 8px; border-radius: 99px; font-size: var(--fin-fs-xs); font-weight: 600; }
.rule-status.on { background: #e7f6ed; color: #18774d; }
.rule-status.off { background: #eef2ef; color: #75827a; }
.risk-strategy-guide { display: grid; padding: 14px 15px; }
.risk-strategy-guide > div { padding: 10px 0; border-top: 1px solid #edf2ee; }
.risk-strategy-guide > div:first-child { border-top: 0; }
.risk-strategy-guide b { color: #376149; font-size: var(--fin-fs-xs); }
.risk-strategy-guide p { margin: 3px 0 0; color: #75887c; font-size: var(--fin-fs-xs); line-height: 1.6; }
@media (max-width: 900px) { .risk-layout { grid-template-columns: 1fr; } }
</style>

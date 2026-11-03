<template>
  <div class="mds-page">
    <PageHeader
      title="质量规则"
      subtitle="定义数据质量检测规则：检测对象、字段、表达式与阈值；规则由检测任务引用，被引用的规则不能删除。"
      source="数据治理 · 质量规则"
    >
      <template #actions>
        <button v-point="'POST /admin/masterdata/quality/rules'" class="mds-btn mds-btn--primary" @click="openCreate">+ 新建规则</button>
        <button class="mds-btn" :disabled="loading" @click="loadRules">刷新</button>
      </template>
    </PageHeader>

    <NoticeBar tone="info" title="表达式口径：">
      表达式按后端约定保存原文（支持正则，如 <code>^[\u4e00-\u9fa5]{2,20}$</code>）。
      检测引擎未接入时，规则只做配置与启停，不代表已经在跑检测。
    </NoticeBar>

    <div class="mds-card">
      <div class="mds-filter">
        <input
          v-model="filterKeyword"
          class="mds-input"
          type="search"
          placeholder="搜索规则名称"
        />
        <select v-model="filterType" class="mds-select">
          <option value="all">全部类型</option>
          <option value="completeness">完整性</option>
          <option value="accuracy">准确性</option>
          <option value="consistency">一致性</option>
          <option value="timeliness">时效性</option>
          <option value="uniqueness">唯一性</option>
        </select>
        <select v-model="filterStatus" class="mds-select">
          <option value="all">全部状态</option>
          <option value="enabled">启用</option>
          <option value="disabled">停用</option>
        </select>
        <span class="mds-hint">共 {{ filteredRules.length }} / {{ rules.length }} 条</span>
      </div>
    </div>

    <div v-if="!filteredRules.length" class="mds-card">
      <div class="mds-card-body">
        <EmptyState
          :title="rules.length ? '没有符合条件的规则' : '还没有质量规则'"
          :description="rules.length ? '调整类型/状态/关键字筛选。' : '新建规则后，检测任务才能引用它做巡检。'"
        />
      </div>
    </div>

    <div v-else class="rules-grid">
      <article v-for="rule in filteredRules" :key="rule.id" class="mds-card rule-card" :class="{ 'is-disabled': !rule.enabled }">
        <div class="mds-card-head">
          <div class="rule-head">
            <span class="rule-icon">{{ ruleIcon(rule.type) }}</span>
            <div>
              <h2 class="mds-card-title">{{ rule.name }}</h2>
              <p class="mds-card-sub">{{ ruleTypeName(rule.type) }} · {{ rule.code }}</p>
            </div>
          </div>
          <StatusTag :text="rule.enabled ? '启用' : '停用'" :tone="rule.enabled ? 'success' : 'gray'" />
        </div>
        <div class="mds-card-body">
          <p class="rule-desc">{{ rule.description || '未填写规则描述' }}</p>
          <div class="rule-config">
            <div class="cfg"><span>检测对象</span><b>{{ targetText(rule.target) }}</b></div>
            <div class="cfg"><span>检测字段</span><b class="mds-mono">{{ rule.field || '—' }}</b></div>
            <div class="cfg"><span>阈值</span><b>{{ rule.threshold ?? '—' }}%</b></div>
            <div class="cfg"><span>严重等级</span><b>{{ severityText(rule.severity) }}</b></div>
            <div class="cfg cfg--full"><span>规则表达式</span><b class="expr">{{ rule.expression || '—' }}</b></div>
          </div>
        </div>
        <div class="rule-footer">
          <button class="mds-btn mds-btn--sm" :disabled="busyId === rule.id" @click="toggleRule(rule)">
            {{ rule.enabled ? '停用' : '启用' }}
          </button>
          <button v-point="'PUT /admin/masterdata/quality/rules/{id}'" class="mds-btn mds-btn--sm" @click="editRule(rule)">编辑</button>
          <button v-point="'DELETE /admin/masterdata/quality/rules/{id}'" class="mds-btn mds-btn--sm mds-btn--danger" :disabled="busyId === rule.id" @click="deleteRule(rule)">
            删除
          </button>
        </div>
      </article>
    </div>

    <div v-if="showAddModal" class="mds-mask" @click="closeAddModal">
      <div class="mds-modal" @click.stop>
        <div class="mds-card-head">
          <h2 class="mds-card-title">{{ isEdit ? '编辑规则' : '新建规则' }}</h2>
          <button class="mds-btn mds-btn--link" @click="closeAddModal">关闭</button>
        </div>
        <div class="mds-card-body">
          <div class="mds-form">
            <label class="mds-field">
              <span class="mds-field__label mds-required">规则编码</span>
              <input v-model="form.code" class="mds-input" :disabled="isEdit" placeholder="如 RULE-USER-IDCARD" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label mds-required">规则名称</span>
              <input v-model="form.name" class="mds-input" placeholder="如 身份证号格式校验" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label mds-required">规则类型</span>
              <select v-model="form.type" class="mds-select">
                <option value="completeness">完整性规则</option>
                <option value="accuracy">准确性规则</option>
                <option value="consistency">一致性规则</option>
                <option value="timeliness">时效性规则</option>
                <option value="uniqueness">唯一性规则</option>
              </select>
            </label>
            <label class="mds-field">
              <span class="mds-field__label">严重等级</span>
              <select v-model="form.severity" class="mds-select">
                <option value="high">严重</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </label>
            <label class="mds-field">
              <span class="mds-field__label mds-required">检测对象</span>
              <select v-model="form.target" class="mds-select">
                <option value="user_master">用户主数据</option>
                <option value="organization">组织主数据</option>
                <option value="product">商品主数据</option>
                <option value="customer">客户主数据</option>
                <option value="supplier">供应商主数据</option>
              </select>
            </label>
            <label class="mds-field">
              <span class="mds-field__label mds-required">检测字段</span>
              <input v-model="form.field" class="mds-input" placeholder="表字段名，如 id_card" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label mds-required">质量阈值（%）</span>
              <input v-model.number="form.threshold" class="mds-input" type="number" min="0" max="100" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label">启用</span>
              <select v-model="form.enabled" class="mds-select">
                <option :value="true">启用</option>
                <option :value="false">停用</option>
              </select>
            </label>
            <label class="mds-field mds-field--full">
              <span class="mds-field__label mds-required">规则表达式</span>
              <input v-model="form.expression" class="mds-input" placeholder="如 ^[\u4e00-\u9fa5]{2,20}$" />
            </label>
            <label class="mds-field mds-field--full">
              <span class="mds-field__label">规则描述</span>
              <textarea v-model="form.description" class="mds-textarea" placeholder="这条规则查什么、命中后怎么处置" />
            </label>
          </div>
          <div class="mds-form-actions">
            <button class="mds-btn" @click="closeAddModal">取消</button>
            <button class="mds-btn mds-btn--primary" :disabled="saving" @click="saveRule">
              {{ saving ? '保存中…' : isEdit ? '保存修改' : '创建规则' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import {
  createQualityRule,
  deleteQualityRule,
  getQualityRuleList,
  updateQualityRule,
} from '../../utils/api'

const showAddModal = ref(false)
const isEdit = ref(false)
const filterType = ref('all')
const filterStatus = ref('all')
const filterKeyword = ref('')
const rules = ref([])
const loading = ref(false)
const saving = ref(false)
const busyId = ref(null)

const form = reactive({
  id: null,
  code: '',
  name: '',
  type: 'completeness',
  description: '',
  target: 'user_master',
  field: '',
  expression: '',
  threshold: 95,
  severity: 'medium',
  enabled: true,
})

const filteredRules = computed(() =>
  rules.value.filter((rule) => {
    const matchType = filterType.value === 'all' || rule.type === filterType.value
    const matchStatus =
      filterStatus.value === 'all' || (filterStatus.value === 'enabled' ? rule.enabled : !rule.enabled)
    const matchKeyword =
      !filterKeyword.value || String(rule.name || '').toLowerCase().includes(filterKeyword.value.toLowerCase())
    return matchType && matchStatus && matchKeyword
  }),
)

const TYPE_META = {
  completeness: { icon: '📋', name: '完整性规则' },
  accuracy: { icon: '✓', name: '准确性规则' },
  consistency: { icon: '🔄', name: '一致性规则' },
  timeliness: { icon: '⏱️', name: '时效性规则' },
  uniqueness: { icon: '🔑', name: '唯一性规则' },
}
const ruleIcon = (type) => TYPE_META[type]?.icon ?? '📊'
const ruleTypeName = (type) => TYPE_META[type]?.name ?? '未知类型'

const TARGET_TEXT = {
  user_master: '用户主数据',
  organization: '组织主数据',
  product: '商品主数据',
  customer: '客户主数据',
  supplier: '供应商主数据',
}
const targetText = (target) => TARGET_TEXT[target] ?? target ?? '—'
const SEVERITY_TEXT = { high: '严重', medium: '中', low: '低' }
const severityText = (value) => SEVERITY_TEXT[value] ?? value ?? '—'

/** 接口行 → 页面行（接口字段是 ruleCode / ruleName / targetTable / status） */
const toRow = (row) => ({
  id: row.id,
  code: row.ruleCode,
  name: row.ruleName,
  type: row.ruleType || 'completeness',
  description: row.description,
  target: row.targetTable,
  domain: row.targetDomain,
  field: row.targetField,
  expression: row.expression,
  threshold: row.threshold,
  severity: row.severity,
  // 接口用 StatusEnum（1 启用 / 0 禁用），页面用布尔
  enabled: Number(row.status) === 1,
})

const loadRules = async () => {
  loading.value = true
  try {
    const response = await getQualityRuleList()
    if (response.code !== 200) throw new Error(response.message || '加载质量规则失败')
    rules.value = (response.data ?? []).map(toRow)
  } catch (error) {
    rules.value = []
    message.error(error instanceof Error ? error.message : '加载质量规则失败')
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  Object.assign(form, {
    id: null,
    code: '',
    name: '',
    type: 'completeness',
    description: '',
    target: 'user_master',
    field: '',
    expression: '',
    threshold: 95,
    severity: 'medium',
    enabled: true,
  })
}

const openCreate = () => {
  resetForm()
  isEdit.value = false
  showAddModal.value = true
}

const editRule = (rule) => {
  isEdit.value = true
  Object.assign(form, {
    id: rule.id,
    code: rule.code ?? '',
    name: rule.name ?? '',
    type: rule.type ?? 'completeness',
    description: rule.description ?? '',
    target: rule.target ?? 'user_master',
    domain: rule.domain,
    field: rule.field ?? '',
    expression: rule.expression ?? '',
    threshold: Number(rule.threshold ?? 95),
    severity: rule.severity ?? 'medium',
    enabled: Boolean(rule.enabled),
  })
  showAddModal.value = true
}

const closeAddModal = () => {
  showAddModal.value = false
  isEdit.value = false
}

const deleteRule = async (rule) => {
  if (!window.confirm(`确定删除规则「${rule.name}」吗？被检测任务引用的规则会被后端拒绝删除。`)) return
  busyId.value = rule.id
  try {
    const response = await deleteQualityRule(rule.id)
    if (response.code !== 200) throw new Error(response.message || '删除失败')
    message.success('规则已删除')
    await loadRules()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '删除失败')
  } finally {
    busyId.value = null
  }
}

const toggleRule = async (rule) => {
  const nextStatus = rule.enabled ? 0 : 1
  busyId.value = rule.id
  try {
    // 只提交 status：后端是「只覆盖本次传了的字段」
    const response = await updateQualityRule(rule.id, { status: nextStatus })
    if (response.code !== 200) throw new Error(response.message || '操作失败')
    message.success(`规则已${nextStatus === 1 ? '启用' : '停用'}`)
    await loadRules()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '操作失败')
  } finally {
    busyId.value = null
  }
}

const saveRule = async () => {
  if (!form.code.trim()) {
    message.warning('请填写规则编码')
    return
  }
  if (!form.name.trim() || !form.field.trim() || !form.expression.trim()) {
    message.warning('规则名称、检测字段与表达式为必填')
    return
  }
  saving.value = true
  const payload = {
    ruleCode: form.code.trim(),
    ruleName: form.name.trim(),
    ruleType: form.type,
    description: form.description,
    targetTable: form.target,
    targetDomain: form.domain,
    targetField: form.field.trim(),
    expression: form.expression.trim(),
    threshold: Number(form.threshold) || 0,
    severity: form.severity,
    status: form.enabled ? 1 : 0,
  }
  try {
    const response = isEdit.value
      ? await updateQualityRule(form.id, payload)
      : await createQualityRule(payload)
    if (response.code !== 200) throw new Error(response.message || '保存失败')
    message.success(isEdit.value ? '规则已更新' : '规则已创建')
    closeAddModal()
    await loadRules()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(loadRules)
</script>

<style scoped>
.rules-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 16px;
}

.rule-card {
  margin-bottom: 0;
  display: flex;
  flex-direction: column;
}

.rule-card.is-disabled {
  opacity: 0.72;
}

.rule-head {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.rule-icon {
  width: 34px;
  height: 34px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--mds-brand-soft);
  font-size: 17px;
}

.rule-desc {
  margin: 0 0 10px;
  min-height: 40px;
  color: var(--mds-text-2);
  font-size: 12.5px;
  line-height: 1.6;
}

.rule-config {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 16px;
  padding-top: 10px;
  border-top: 1px dashed var(--mds-line);
}

.cfg {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  min-width: 0;
}

.cfg span {
  color: var(--mds-text-3);
}

.cfg b {
  font-weight: 600;
  color: var(--mds-text);
  word-break: break-all;
}

.cfg--full {
  grid-column: 1 / -1;
}

.expr {
  padding: 4px 8px;
  border-radius: 4px;
  background: #f6f8f7;
  font-family: var(--mds-mono);
  font-size: var(--agri-font-size-micro);
  font-weight: 400;
}

.rule-footer {
  display: flex;
  gap: 8px;
  padding: 10px 16px;
  border-top: 1px solid var(--mds-line-soft);
  background: #fcfdfc;
}

.rule-footer .mds-btn {
  flex: 1;
}

.mds-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  padding: 20px;
}

.mds-modal {
  width: 680px;
  max-width: 100%;
  max-height: 88vh;
  overflow: auto;
  border-radius: var(--mds-radius);
  background: var(--mds-card);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
}
</style>

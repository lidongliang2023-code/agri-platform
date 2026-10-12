<template>
  <div class="quality-rule">
    <div class="page-header">
      <div class="header-left">
        <h1>质量规则配置</h1>
        <p>定义数据质量检测规则</p>
      </div>
      <button class="add-btn" @click="showAddModal = true">+ 新建规则</button>
    </div>

    <div class="filter-bar">
      <select v-model="filterType" class="filter-select">
        <option value="all">全部类型</option>
        <option value="completeness">完整性规则</option>
        <option value="accuracy">准确性规则</option>
        <option value="consistency">一致性规则</option>
        <option value="timeliness">时效性规则</option>
      </select>
      <select v-model="filterStatus" class="filter-select">
        <option value="all">全部状态</option>
        <option value="enabled">启用</option>
        <option value="disabled">停用</option>
      </select>
      <input 
        type="text" 
        v-model="filterKeyword" 
        placeholder="搜索规则名称..." 
        class="filter-input"
      />
    </div>

    <div class="rules-grid">
      <div 
        class="rule-card" 
        v-for="rule in filteredRules" 
        :key="rule.id"
        :class="{disabled: !rule.enabled}"
      >
        <div class="rule-header">
          <div class="rule-icon" :class="rule.type">
            {{ getRuleIcon(rule.type) }}
          </div>
          <div class="rule-info">
            <h3>{{ rule.name }}</h3>
            <span class="rule-type">{{ getRuleTypeName(rule.type) }}</span>
          </div>
          <div class="rule-status" :class="rule.enabled ? 'enabled' : 'disabled'">
            {{ rule.enabled ? '启用' : '停用' }}
          </div>
        </div>
        <div class="rule-description">
          {{ rule.description }}
        </div>
        <div class="rule-config">
          <div class="config-item">
            <span class="config-label">检测对象:</span>
            <span class="config-value">{{ rule.target }}</span>
          </div>
          <div class="config-item">
            <span class="config-label">检测字段:</span>
            <span class="config-value">{{ rule.field }}</span>
          </div>
          <div class="config-item">
            <span class="config-label">规则表达式:</span>
            <span class="config-value code">{{ rule.expression }}</span>
          </div>
          <div class="config-item">
            <span class="config-label">阈值:</span>
            <span class="config-value">{{ rule.threshold }}%</span>
          </div>
        </div>
        <div class="rule-footer">
          <button 
            class="footer-btn toggle" 
            @click="toggleRule(rule)"
          >
            {{ rule.enabled ? '停用' : '启用' }}
          </button>
          <button class="footer-btn edit" @click="editRule(rule)">编辑</button>
          <button class="footer-btn delete" @click="deleteRule(rule)">删除</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" v-if="showAddModal" @click="closeAddModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ isEdit ? '编辑规则' : '新建规则' }}</h3>
          <button class="close-btn" @click="closeAddModal">×</button>
        </div>
        <div class="modal-body">
          <!-- 规则编码是后端的主键式标识（唯一索引），原来表单里没有这一项，
               不补上就没法新建规则。编辑时禁用，避免改掉已有编码。 -->
          <div class="form-group">
            <label>规则编码 *</label>
            <input type="text" v-model="form.code" class="form-input" placeholder="如 RULE-USER-IDCARD" :disabled="isEdit" />
          </div>
          <div class="form-group">
            <label>规则名称 *</label>
            <input type="text" v-model="form.name" class="form-input" placeholder="请输入规则名称" />
          </div>
          <div class="form-group">
            <label>规则类型 *</label>
            <select v-model="form.type" class="form-input">
              <option value="completeness">完整性规则</option>
              <option value="accuracy">准确性规则</option>
              <option value="consistency">一致性规则</option>
              <option value="timeliness">时效性规则</option>
              <option value="uniqueness">唯一性规则</option>
            </select>
          </div>
          <div class="form-group">
            <label>规则描述</label>
            <textarea v-model="form.description" class="form-input" placeholder="请输入规则描述" rows="3"></textarea>
          </div>
          <div class="form-group">
            <label>检测对象 *</label>
            <select v-model="form.target" class="form-input">
              <option value="user_master">用户主数据</option>
              <option value="organization">组织主数据</option>
              <option value="product">商品主数据</option>
              <option value="customer">客户主数据</option>
              <option value="supplier">供应商主数据</option>
            </select>
          </div>
          <div class="form-group">
            <label>检测字段 *</label>
            <input type="text" v-model="form.field" class="form-input" placeholder="请输入检测字段名" />
          </div>
          <div class="form-group">
            <label>规则表达式 *</label>
            <input type="text" v-model="form.expression" class="form-input" placeholder="请输入规则表达式" />
            <span class="form-hint">支持正则表达式，如: ^[\u4e00-\u9fa5]{2,20}$</span>
          </div>
          <div class="form-group">
            <label>质量阈值(%) *</label>
            <input type="number" v-model="form.threshold" class="form-input" placeholder="请输入阈值百分比" />
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" v-model="form.enabled" /> 启用规则
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="closeAddModal">取消</button>
          <button class="btn btn-primary" @click="saveRule">{{ isEdit ? '保存修改' : '创建规则' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { getQualityRuleList, createQualityRule, updateQualityRule, deleteQualityRule } from '../../utils/api'

const showAddModal = ref(false)
const isEdit = ref(false)
const filterType = ref('all')
const filterStatus = ref('all')
const filterKeyword = ref('')

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
  enabled: true
})

const rules = ref([])
// 原来这里是一份 8 条的写死规则数组：列表、新增、修改、删除、启停全在浏览器内存里，
// 刷新即复位。现在数据来自 /admin/masterdata/quality/rules。

const filteredRules = computed(() => {
  return rules.value.filter(rule => {
    const matchType = filterType.value === 'all' || rule.type === filterType.value
    const matchStatus = filterStatus.value === 'all' || (filterStatus.value === 'enabled' ? rule.enabled : !rule.enabled)
    const matchKeyword = !filterKeyword.value || rule.name.toLowerCase().includes(filterKeyword.value.toLowerCase())
    return matchType && matchStatus && matchKeyword
  })
})

const getRuleIcon = (type) => {
  const icons = {
    completeness: '📋',
    accuracy: '✓',
    consistency: '🔄',
    timeliness: '⏱️'
  }
  return icons[type] || '📊'
}

const getRuleTypeName = (type) => {
  const names = {
    completeness: '完整性规则',
    accuracy: '准确性规则',
    consistency: '一致性规则',
    timeliness: '时效性规则',
    uniqueness: '唯一性规则'
  }
  return names[type] || '未知类型'
}

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
  enabled: Number(row.status) === 1
})

const loadRules = async () => {
  try {
    const response = await getQualityRuleList()
    if (response.code !== 200) {
      message.error(response.message || '加载质量规则失败')
      rules.value = []
      return
    }
    // 不再回落到演示数据：失败就说失败
    rules.value = (response.data ?? []).map(toRow)
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载质量规则失败')
    rules.value = []
  }
}

onMounted(() => {
  loadRules()
})

const closeAddModal = () => {
  showAddModal.value = false
  isEdit.value = false
  Object.keys(form).forEach(key => {
    form[key] = key === 'type' ? 'completeness' : key === 'target' ? 'user_master' : key === 'threshold' ? 95 : key === 'enabled' ? true : ''
  })
}

const editRule = (rule) => {
  isEdit.value = true
  Object.assign(form, rule)
  showAddModal.value = true
}

const deleteRule = async (rule) => {
  if (!confirm(`确定删除规则 "${rule.name}" 吗？`)) {
    return
  }
  try {
    const response = await deleteQualityRule(rule.id)
    if (response.code === 200) {
      message.success('规则已删除')
      loadRules()
    } else {
      // 被任务引用的规则后端会拒绝删除，这里把原因透传给用户
      message.error(response.message || '删除失败')
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '删除失败')
  }
}

const toggleRule = async (rule) => {
  const nextStatus = rule.enabled ? 0 : 1
  try {
    // 只提交 status：后端是"只覆盖本次传了的字段"
    const response = await updateQualityRule(rule.id, { status: nextStatus })
    if (response.code === 200) {
      message.success(`规则已${nextStatus === 1 ? '启用' : '停用'}`)
      loadRules()
    } else {
      message.error(response.message || '操作失败')
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '操作失败')
  }
}

const saveRule = async () => {
  if (!form.code) {
    message.warning('请填写规则编码')
    return
  }
  if (!form.name || !form.field || !form.expression) {
    message.warning('请填写必填字段')
    return
  }

  const payload = {
    ruleCode: form.code,
    ruleName: form.name,
    ruleType: form.type,
    description: form.description,
    targetTable: form.target,
    targetDomain: form.domain,
    targetField: form.field,
    expression: form.expression,
    threshold: Number(form.threshold) || 0,
    severity: form.severity,
    status: form.enabled ? 1 : 0
  }

  try {
    const response = isEdit.value
      ? await updateQualityRule(form.id, payload)
      : await createQualityRule(payload)
    if (response.code === 200) {
      message.success(isEdit.value ? '规则已更新' : '规则已创建')
      closeAddModal()
      loadRules()
    } else {
      message.error(response.message || '保存失败')
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败')
  }
}
</script>

<style scoped>
.quality-rule {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.header-left h1 {
  font-size: 24px;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.header-left p {
  font-size: 14px;
  color: #a0aec0;
  margin: 4px 0 0;
}

.add-btn {
  padding: 10px 20px;
  background: linear-gradient(135deg, #238636 0%, #2ea043 100%);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.add-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(35, 134, 54, 0.3);
}

.filter-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.filter-select {
  padding: 8px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  cursor: pointer;
}

.filter-input {
  padding: 8px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  flex: 1;
  min-width: 200px;
}

.rules-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 20px;
}

.rule-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  transition: all 0.3s;
}

.rule-card.disabled {
  opacity: 0.7;
}

.rule-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #f8fafc;
  border-bottom: 1px solid #f0f0f0;
}

.rule-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.rule-icon.completeness {
  background: rgba(35, 134, 54, 0.1);
}

.rule-icon.accuracy {
  background: rgba(37, 99, 235, 0.1);
}

.rule-icon.consistency {
  background: rgba(168, 85, 247, 0.1);
}

.rule-icon.timeliness {
  background: rgba(210, 153, 34, 0.1);
}

.rule-info {
  flex: 1;
}

.rule-info h3 {
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 4px;
}

.rule-type {
  font-size: 12px;
  color: #718096;
}

.rule-status {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.rule-status.enabled {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.rule-status.disabled {
  background: rgba(156, 163, 175, 0.1);
  color: #6b7280;
}

.rule-description {
  padding: 12px 16px;
  font-size: 14px;
  color: #4a5568;
  line-height: 1.5;
}

.rule-config {
  padding: 0 16px;
  border-top: 1px dashed #e2e8f0;
}

.config-item {
  display: flex;
  padding: 10px 0;
  border-bottom: 1px dashed #f0f0f0;
}

.config-item:last-child {
  border-bottom: none;
}

.config-label {
  width: 100px;
  font-size: 13px;
  color: #718096;
}

.config-value {
  flex: 1;
  font-size: 13px;
  color: #2d3748;
  word-break: break-all;
}

.config-value.code {
  font-family: monospace;
  background: #f8fafc;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}

.rule-footer {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  background: #f8fafc;
}

.footer-btn {
  padding: 8px 14px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.footer-btn.toggle {
  flex: 1;
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
}

.footer-btn.edit {
  flex: 1;
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
}

.footer-btn.delete {
  flex: 1;
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.footer-btn:hover {
  opacity: 0.8;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #fff;
  border-radius: 12px;
  width: 600px;
  max-width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #f0f0f0;
  position: sticky;
  top: 0;
  background: #fff;
}

.modal-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #a0aec0;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.close-btn:hover {
  color: #2d3748;
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 14px;
  color: #4a5568;
  margin-bottom: 6px;
  font-weight: 500;
}

.form-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.form-input:focus {
  border-color: #238636;
}

.form-hint {
  display: block;
  font-size: 12px;
  color: #a0aec0;
  margin-top: 4px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid #f0f0f0;
}

.btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-cancel {
  background: #f0f0f0;
  color: #4a5568;
}

.btn-cancel:hover {
  background: #e2e8f0;
}

.btn-primary {
  background: linear-gradient(135deg, #238636 0%, #2ea043 100%);
  color: #fff;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(35, 134, 54, 0.3);
}
</style>

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

const showAddModal = ref(false)
const isEdit = ref(false)
const filterType = ref('all')
const filterStatus = ref('all')
const filterKeyword = ref('')

const form = reactive({
  id: null,
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

const mockRules = [
  { id: 1, name: '用户名完整性检查', type: 'completeness', description: '检查用户姓名是否完整填写', target: 'user_master', field: 'username', expression: 'not null', threshold: 99, enabled: true },
  { id: 2, name: '手机号格式验证', type: 'accuracy', description: '验证手机号格式是否正确', target: 'user_master', field: 'phone', expression: '^1[3-9]\\d{9}$', threshold: 98, enabled: true },
  { id: 3, name: '身份证号验证', type: 'accuracy', description: '验证身份证号码格式', target: 'user_master', field: 'id_card', expression: '^[1-9]\\d{5}(18|19|20)\\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\\d|3[01])\\d{3}[\\dXx]$', threshold: 95, enabled: true },
  { id: 4, name: '组织名称一致性', type: 'consistency', description: '检查组织名称在各系统中的一致性', target: 'organization', field: 'name', expression: 'same', threshold: 100, enabled: true },
  { id: 5, name: '商品编码唯一性', type: 'consistency', description: '确保商品编码全局唯一', target: 'product', field: 'code', expression: 'unique', threshold: 100, enabled: false },
  { id: 6, name: '数据更新时效性', type: 'timeliness', description: '检查数据更新是否及时', target: 'customer', field: 'update_time', expression: '< 30 days', threshold: 95, enabled: true },
  { id: 7, name: '邮箱格式验证', type: 'accuracy', description: '验证邮箱地址格式', target: 'user_master', field: 'email', expression: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$', threshold: 90, enabled: true },
  { id: 8, name: '供应商资质有效期', type: 'timeliness', description: '检查供应商资质是否过期', target: 'supplier', field: 'cert_expire_date', expression: '> now', threshold: 98, enabled: true }
]

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
    timeliness: '时效性规则'
  }
  return names[type] || '未知类型'
}

const loadRules = () => {
  rules.value = mockRules
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

const deleteRule = (rule) => {
  if (confirm(`确定删除规则 "${rule.name}" 吗？`)) {
    rules.value = rules.value.filter(r => r.id !== rule.id)
    alert('规则已删除')
  }
}

const toggleRule = (rule) => {
  rule.enabled = !rule.enabled
  alert(`规则已${rule.enabled ? '启用' : '停用'}`)
}

const saveRule = () => {
  if (!form.name || !form.field || !form.expression) {
    alert('请填写必填字段')
    return
  }

  if (isEdit.value) {
    const index = rules.value.findIndex(r => r.id === form.id)
    if (index !== -1) {
      rules.value[index] = { ...form }
    }
    alert('规则已更新')
  } else {
    rules.value.push({
      ...form,
      id: Date.now()
    })
    alert('规则已创建')
  }
  closeAddModal()
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
<template>
  <div class="notification-template">
    <div class="page-header">
      <div class="header-left">
        <h1>通知模板管理</h1>
        <p>管理系统通知消息模板</p>
      </div>
      <button class="add-btn" @click="showAddModal = true">+ 新增模板</button>
    </div>

    <div class="filter-bar">
      <select v-model="filterType" class="filter-select">
        <option value="all">全部类型</option>
        <option v-for="type in templateTypes" :key="type.value" :value="type.value">{{ type.label }}</option>
      </select>
      <input 
        type="text" 
        v-model="filterKeyword" 
        placeholder="搜索模板名称..." 
        class="filter-input"
      />
    </div>

    <div class="template-grid">
      <div 
        v-for="template in filteredTemplates" 
        :key="template.id" 
        class="template-card"
        :class="{active: template.enabled}"
      >
        <div class="card-header">
          <div class="header-left">
            <span class="type-badge" :class="template.type">{{ getTypeLabel(template.type) }}</span>
            <h3>{{ template.name }}</h3>
          </div>
          <span class="status-badge" :class="template.enabled ? 'enabled' : 'disabled'">
            {{ template.enabled ? '启用' : '禁用' }}
          </span>
        </div>
        <div class="card-body">
          <p class="description">{{ template.description }}</p>
          <div class="preview">
            <div class="preview-label">模板预览</div>
            <div class="preview-content">{{ template.content }}</div>
          </div>
        </div>
        <div class="card-footer">
          <div class="meta">
            <span>变量: {{ template.variables.join(', ') }}</span>
          </div>
          <div class="actions">
            <button class="action-btn edit" @click="editTemplate(template)">编辑</button>
            <button 
              class="action-btn toggle" 
              @click="toggleTemplate(template)"
            >{{ template.enabled ? '禁用' : '启用' }}</button>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-overlay" v-if="showAddModal" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ isEdit ? '编辑模板' : '新增模板' }}</h3>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>模板名称 *</label>
            <input type="text" v-model="form.name" class="form-input" placeholder="请输入模板名称" />
          </div>
          <div class="form-group">
            <label>模板类型 *</label>
            <select v-model="form.type" class="form-input">
              <option value="">请选择类型</option>
              <option v-for="type in templateTypes" :key="type.value" :value="type.value">{{ type.label }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>模板内容 *</label>
            <textarea v-model="form.content" class="form-input" rows="6" placeholder="请输入模板内容，支持变量如 ${name}"></textarea>
          </div>
          <div class="form-group">
            <label>变量定义</label>
            <input type="text" v-model="form.variablesInput" class="form-input" placeholder="变量名，用逗号分隔" />
            <p class="hint">如: name,email,date</p>
          </div>
          <div class="form-group">
            <label>描述</label>
            <textarea v-model="form.description" class="form-input" rows="3" placeholder="请输入模板描述"></textarea>
          </div>
          <div class="form-group">
            <label>是否启用</label>
            <div class="checkbox-option">
              <input type="checkbox" v-model="form.enabled" id="enabled" />
              <label for="enabled">启用</label>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="closeModal">取消</button>
          <button class="btn btn-primary" @click="saveTemplate">{{ isEdit ? '保存修改' : '新增模板' }}</button>
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
const filterKeyword = ref('')

const form = reactive({
  id: null,
  name: '',
  type: '',
  content: '',
  variablesInput: '',
  variables: [],
  description: '',
  enabled: true
})

const templateTypes = [
  { value: 'system', label: '系统通知' },
  { value: 'quality', label: '质量告警' },
  { value: 'tenant', label: '租户通知' },
  { value: 'audit', label: '审核通知' },
  { value: 'other', label: '其他' }
]

const templates = ref([])

const mockTemplates = [
  { id: 1, name: '质量检测异常告警', type: 'quality', content: '【数据质量告警】检测到 ${count} 条数据不符合规则 "${rule}"，请及时处理。', variables: ['count', 'rule'], description: '当质量检测发现异常时发送', enabled: true },
  { id: 2, name: '租户注册通知', type: 'tenant', content: '尊敬的 ${tenantName}，您的租户账号已创建成功，管理员账号：${username}。', variables: ['tenantName', 'username'], description: '租户注册成功后发送', enabled: true },
  { id: 3, name: '用户审核通过', type: 'audit', content: '您好 ${name}，您的账号审核已通过，请登录系统。', variables: ['name'], description: '用户审核通过通知', enabled: true },
  { id: 4, name: '系统维护通知', type: 'system', content: '【系统维护】系统将于 ${time} 进行维护，预计时长 ${duration}，请提前做好准备。', variables: ['time', 'duration'], description: '系统维护前通知', enabled: false },
  { id: 5, name: '工单处理提醒', type: 'quality', content: '您有 ${count} 条质量问题工单待处理，请及时处理。', variables: ['count'], description: '工单待处理提醒', enabled: true }
]

const filteredTemplates = computed(() => {
  return templates.value.filter(template => {
    const matchType = filterType.value === 'all' || template.type === filterType.value
    const matchKeyword = !filterKeyword.value || 
      template.name.toLowerCase().includes(filterKeyword.value.toLowerCase()) ||
      template.description.toLowerCase().includes(filterKeyword.value.toLowerCase())
    return matchType && matchKeyword
  })
})

const getTypeLabel = (type) => {
  const found = templateTypes.find(t => t.value === type)
  return found ? found.label : type
}

const loadData = () => {
  templates.value = mockTemplates
}

onMounted(() => {
  loadData()
})

const closeModal = () => {
  showAddModal.value = false
  isEdit.value = false
  Object.keys(form).forEach(key => {
    form[key] = key === 'enabled' ? true : key === 'variables' ? [] : ''
  })
}

const editTemplate = (template) => {
  isEdit.value = true
  Object.assign(form, template)
  form.variablesInput = template.variables.join(',')
  showAddModal.value = true
}

const toggleTemplate = (template) => {
  template.enabled = !template.enabled
  alert(`模板 "${template.name}" 已${template.enabled ? '启用' : '禁用'}`)
}

const saveTemplate = () => {
  if (!form.name || !form.type || !form.content) {
    alert('请填写必填字段')
    return
  }

  form.variables = form.variablesInput.split(',').map(v => v.trim()).filter(v => v)

  if (isEdit.value) {
    const index = templates.value.findIndex(t => t.id === form.id)
    if (index !== -1) {
      templates.value[index] = { ...templates.value[index], ...form }
    }
    alert('模板已更新')
  } else {
    templates.value.push({
      id: Date.now(),
      ...form
    })
    alert('模板已新增')
  }
  closeModal()
}
</script>

<style scoped>
.notification-template {
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

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;
}

.template-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  border-left: 4px solid #e2e8f0;
}

.template-card.active {
  border-left-color: #238636;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.header-left {
  flex: 1;
}

.header-left h3 {
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
  margin: 8px 0 0;
}

.type-badge {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
}

.type-badge.system {
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
}

.type-badge.quality {
  background: rgba(234, 88, 12, 0.1);
  color: #ea580c;
}

.type-badge.tenant {
  background: rgba(147, 51, 234, 0.1);
  color: #7c3aed;
}

.type-badge.audit {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.type-badge.other {
  background: rgba(156, 163, 175, 0.1);
  color: #6b7280;
}

.status-badge {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
}

.status-badge.enabled {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.status-badge.disabled {
  background: rgba(156, 163, 175, 0.1);
  color: #6b7280;
}

.card-body {
  padding: 16px;
}

.description {
  font-size: 13px;
  color: #718096;
  margin: 0 0 12px;
}

.preview {
  background: #f8fafc;
  border-radius: 8px;
  padding: 12px;
}

.preview-label {
  font-size: 12px;
  color: #a0aec0;
  margin-bottom: 8px;
}

.preview-content {
  font-size: 13px;
  color: #2d3748;
  font-family: monospace;
  word-break: break-all;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f8fafc;
}

.meta {
  font-size: 12px;
  color: #718096;
}

.actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  font-size: 12px;
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn.edit {
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
}

.action-btn.toggle {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
}

.action-btn:hover {
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

.hint {
  font-size: 12px;
  color: #a0aec0;
  margin: 4px 0 0;
}

.checkbox-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.checkbox-option input {
  width: 18px;
  height: 18px;
}

.checkbox-option label {
  margin: 0;
  font-weight: 400;
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
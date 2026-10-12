<template>
  <div class="system-params">
    <div class="page-header">
      <div class="header-left">
        <h1>系统参数配置</h1>
        <p>管理系统运行参数和配置项</p>
      </div>
      <button class="add-btn" @click="showAddModal = true">+ 新增参数</button>
    </div>

    <div class="filter-bar">
      <select v-model="filterGroup" class="filter-select">
        <option value="all">全部分组</option>
        <option v-for="group in paramGroups" :key="group" :value="group">{{ group }}</option>
      </select>
      <input 
        type="text" 
        v-model="filterKeyword" 
        placeholder="搜索参数名称..." 
        class="filter-input"
      />
    </div>

    <div class="params-table">
      <table class="data-table">
        <thead>
          <tr>
            <th>参数编码</th>
            <th>参数名称</th>
            <th>参数分组</th>
            <th>参数值</th>
            <th>数据类型</th>
            <th>是否启用</th>
            <th>描述</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="param in filteredParams" :key="param.id">
            <td class="code">{{ param.code }}</td>
            <td>{{ param.name }}</td>
            <td>
              <span class="group-badge">{{ param.group }}</span>
            </td>
            <td class="value-cell">{{ param.value }}</td>
            <td>
              <span class="type-badge">{{ getTypeText(param.type) }}</span>
            </td>
            <td>
              <span class="status-badge" :class="param.enabled ? 'enabled' : 'disabled'">
                {{ param.enabled ? '启用' : '禁用' }}
              </span>
            </td>
            <td class="desc-cell">{{ param.description }}</td>
            <td class="action-cell">
              <button class="action-btn edit" @click="editParam(param)">编辑</button>
              <button 
                class="action-btn toggle" 
                @click="toggleParam(param)"
              >{{ param.enabled ? '禁用' : '启用' }}</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="modal-overlay" v-if="showAddModal" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ isEdit ? '编辑参数' : '新增参数' }}</h3>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>参数编码 *</label>
            <input type="text" v-model="form.code" class="form-input" placeholder="请输入参数编码" :disabled="isEdit" />
          </div>
          <div class="form-group">
            <label>参数名称 *</label>
            <input type="text" v-model="form.name" class="form-input" placeholder="请输入参数名称" />
          </div>
          <div class="form-group">
            <label>参数分组</label>
            <select v-model="form.group" class="form-input">
              <option value="">请选择分组</option>
              <option v-for="group in paramGroups" :key="group" :value="group">{{ group }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>数据类型 *</label>
            <select v-model="form.type" class="form-input">
              <option value="string">字符串</option>
              <option value="number">数字</option>
              <option value="boolean">布尔值</option>
              <option value="json">JSON</option>
            </select>
          </div>
          <div class="form-group">
            <label>参数值 *</label>
            <textarea v-model="form.value" class="form-input" :rows="form.type === 'json' ? 4 : 2" placeholder="请输入参数值"></textarea>
          </div>
          <div class="form-group">
            <label>是否启用</label>
            <div class="checkbox-option">
              <input type="checkbox" v-model="form.enabled" id="enabled" />
              <label for="enabled">启用</label>
            </div>
          </div>
          <div class="form-group">
            <label>描述</label>
            <textarea v-model="form.description" class="form-input" rows="3" placeholder="请输入参数描述"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="closeModal">取消</button>
          <button class="btn btn-primary" @click="saveParam">{{ isEdit ? '保存修改' : '新增参数' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'

const showAddModal = ref(false)
const isEdit = ref(false)
const filterGroup = ref('all')
const filterKeyword = ref('')

const form = reactive({
  id: null,
  code: '',
  name: '',
  group: '',
  type: 'string',
  value: '',
  enabled: true,
  description: ''
})

const paramGroups = ['系统设置', '数据质量', '租户管理', '权限控制', '数据分发']

const params = ref([])

const mockParams = [
  { id: 1, code: 'SYS_NAME', name: '系统名称', group: '系统设置', type: 'string', value: '主数据管理系统', enabled: true, description: '系统显示名称' },
  { id: 2, code: 'SYS_VERSION', name: '系统版本', group: '系统设置', type: 'string', value: 'V1.0.0', enabled: true, description: '当前系统版本号' },
  { id: 3, code: 'MAX_TENANT_COUNT', name: '最大租户数', group: '租户管理', type: 'number', value: '100', enabled: true, description: '系统支持的最大租户数量' },
  { id: 4, code: 'DATA_EXPIRE_DAYS', name: '数据保留天数', group: '数据质量', type: 'number', value: '365', enabled: true, description: '检测数据保留天数' },
  { id: 5, code: 'AUTO_SYNC_ENABLE', name: '自动同步', group: '数据分发', type: 'boolean', value: 'true', enabled: true, description: '是否启用数据自动同步' },
  { id: 6, code: 'LOGIN_ATTEMPT_LIMIT', name: '登录尝试次数', group: '权限控制', type: 'number', value: '5', enabled: true, description: '登录失败最大尝试次数' },
  { id: 7, code: 'TOKEN_EXPIRE_HOURS', name: 'Token过期时间', group: '权限控制', type: 'number', value: '24', enabled: true, description: '访问Token过期时间（小时）' },
  { id: 8, code: 'QUALITY_CHECK_INTERVAL', name: '质量检测间隔', group: '数据质量', type: 'number', value: '60', enabled: false, description: '定时检测间隔（分钟）' }
]

const filteredParams = computed(() => {
  return params.value.filter(param => {
    const matchGroup = filterGroup.value === 'all' || param.group === filterGroup.value
    const matchKeyword = !filterKeyword.value || 
      param.code.toLowerCase().includes(filterKeyword.value.toLowerCase()) ||
      param.name.toLowerCase().includes(filterKeyword.value.toLowerCase())
    return matchGroup && matchKeyword
  })
})

const getTypeText = (type) => {
  const texts = {
    string: '字符串',
    number: '数字',
    boolean: '布尔',
    json: 'JSON'
  }
  return texts[type] || type
}

const loadData = () => {
  params.value = mockParams
}

onMounted(() => {
  loadData()
})

const closeModal = () => {
  showAddModal.value = false
  isEdit.value = false
  Object.keys(form).forEach(key => {
    form[key] = key === 'type' ? 'string' : key === 'enabled' ? true : ''
  })
}

const editParam = (param) => {
  isEdit.value = true
  Object.assign(form, param)
  showAddModal.value = true
}

const toggleParam = (param) => {
  param.enabled = !param.enabled
  alert(`参数 "${param.name}" 已${param.enabled ? '启用' : '禁用'}`)
}

const saveParam = () => {
  if (!form.code || !form.name || !form.value) {
    alert('请填写必填字段')
    return
  }

  if (isEdit.value) {
    const index = params.value.findIndex(p => p.id === form.id)
    if (index !== -1) {
      params.value[index] = { ...params.value[index], ...form }
    }
    alert('参数已更新')
  } else {
    params.value.push({
      id: Date.now(),
      ...form
    })
    alert('参数已新增')
  }
  closeModal()
}
</script>

<style scoped>
.system-params {
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

.params-table {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
}

.data-table th {
  font-size: 13px;
  font-weight: 600;
  color: #4a5568;
  background: #f8fafc;
}

.data-table td {
  font-size: 13px;
  color: #2d3748;
}

.code {
  font-family: monospace;
  color: #238636;
  font-weight: 500;
}

.value-cell {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.desc-cell {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-badge {
  padding: 4px 10px;
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
  border-radius: 4px;
  font-size: 12px;
}

.type-badge {
  padding: 4px 10px;
  background: rgba(147, 51, 234, 0.1);
  color: #7c3aed;
  border-radius: 4px;
  font-size: 12px;
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

.action-cell {
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

.form-input:disabled {
  background: #f8fafc;
  color: #a0aec0;
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
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
import { message } from 'ant-design-vue'
import { getSystemConfigList, createSystemConfig, updateSystemConfig } from '../../utils/api'

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

const params = ref([])

/**
 * 分组列表**从数据里推导**，不再写死。
 *
 * 写死的问题是：后端新增了一个分组（比如"数据安全"），筛选下拉里不会出现它，
 * 那一组参数就永远筛不出来 —— 而界面上完全看不出缺了什么。
 */
const paramGroups = computed(() => {
  const groups = new Set()
  params.value.forEach(p => { if (p.group) groups.add(p.group) })
  return Array.from(groups)
})

const filteredParams = computed(() => {
  return params.value.filter(param => {
    const matchGroup = filterGroup.value === 'all' || param.group === filterGroup.value
    const matchKeyword = !filterKeyword.value || 
      (param.code ?? '').toLowerCase().includes(filterKeyword.value.toLowerCase()) ||
      (param.name ?? '').toLowerCase().includes(filterKeyword.value.toLowerCase())
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

/** 接口字段 → 页面字段。两边命名不同（configKey/configName/… vs code/name/…），映射只在这一处做。 */
const toRow = (row) => ({
  id: row.id,
  code: row.configKey,
  name: row.configName,
  group: row.groupName,
  type: row.configType || 'string',
  value: row.configValue,
  // 接口给的是 StatusEnum 口径的数字（1 启用 / 0 禁用），页面用布尔开关
  enabled: Number(row.status) === 1,
  description: row.description
})

const loadData = async () => {
  try {
    const response = await getSystemConfigList()
    if (response.code !== 200) {
      message.error(response.message || '加载系统配置失败')
      params.value = []
      return
    }
    // 不再回落到演示数据：失败就说失败
    params.value = (response.data ?? []).map(toRow)
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载系统配置失败')
    params.value = []
  }
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

const toggleParam = async (param) => {
  const nextStatus = param.enabled ? 0 : 1
  try {
    // 只提交 status：接口侧是"只覆盖本次传了的字段"，不会被清空其它列
    const response = await updateSystemConfig(param.id, { status: nextStatus })
    if (response.code === 200) {
      message.success(`参数「${param.name}」已${nextStatus === 1 ? '启用' : '禁用'}`)
      loadData()
    } else {
      message.error(response.message || '操作失败')
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '操作失败')
  }
}

const saveParam = async () => {
  if (!form.code || !form.name || !form.value) {
    message.warning('请填写必填字段')
    return
  }

  const payload = {
    configKey: form.code,
    configName: form.name,
    groupName: form.group,
    configType: form.type,
    configValue: form.value,
    description: form.description,
    status: form.enabled ? 1 : 0
  }

  try {
    const response = isEdit.value
      ? await updateSystemConfig(form.id, payload)
      : await createSystemConfig(payload)
    if (response.code === 200) {
      message.success(isEdit.value ? '参数已更新' : '参数已新增')
      closeModal()
      loadData()
    } else {
      message.error(response.message || '保存失败')
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败')
  }
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

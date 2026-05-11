<template>
  <div class="device-type-list">
    <div class="page-header">
      <h2>设备类型管理</h2>
      <button class="add-btn" @click="showAddModal = true">+ 新增类型</button>
    </div>

    <div class="search-bar">
      <input v-model="searchText" placeholder="搜索设备类型名称" class="search-input" />
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>类型名称</th>
          <th>类型编码</th>
          <th>图标</th>
          <th>分类</th>
          <th>协议类型</th>
          <th>状态</th>
          <th>设备数量</th>
          <th>创建时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="type in deviceTypeList" :key="type.id">
          <td>{{ type.typeName }}</td>
          <td>{{ type.typeCode }}</td>
          <td><span class="icon-cell">{{ type.icon }}</span></td>
          <td><span :class="['category-badge', type.category]">{{ type.category }}</span></td>
          <td>{{ type.protocolType }}</td>
          <td>
            <span :class="['status-badge', type.status === 1 ? 'active' : 'inactive']">
              {{ type.status === 1 ? '启用' : '禁用' }}
            </span>
          </td>
          <td>{{ type.deviceCount }}</td>
          <td>{{ formatTime(type.createTime) }}</td>
          <td class="action-cell">
            <button class="action-btn edit" @click="editType(type)">编辑</button>
            <button class="action-btn toggle" @click="toggleStatus(type)">
              {{ type.status === 1 ? '禁用' : '启用' }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ editingType ? '编辑设备类型' : '新增设备类型' }}</h3>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        <form class="modal-form" @submit.prevent="saveType">
          <div class="form-group">
            <label>类型名称 *</label>
            <input v-model="form.typeName" placeholder="请输入类型名称" />
          </div>
          <div class="form-group">
            <label>类型编码</label>
            <input v-model="form.typeCode" placeholder="请输入类型编码" />
          </div>
          <div class="form-group">
            <label>图标</label>
            <input v-model="form.icon" placeholder="输入emoji图标" />
          </div>
          <div class="form-group">
            <label>分类</label>
            <select v-model="form.category">
              <option value="">请选择分类</option>
              <option value="传感器">传感器</option>
              <option value="控制器">控制器</option>
              <option value="网关">网关</option>
              <option value="摄像头">摄像头</option>
            </select>
          </div>
          <div class="form-group">
            <label>协议类型</label>
            <select v-model="form.protocolType">
              <option value="">请选择协议</option>
              <option value="MQTT">MQTT</option>
              <option value="HTTP">HTTP</option>
              <option value="Modbus">Modbus</option>
              <option value="WebSocket">WebSocket</option>
            </select>
          </div>
          <div class="form-group">
            <label>描述</label>
            <textarea v-model="form.description" placeholder="请输入类型描述"></textarea>
          </div>
          <div class="form-actions">
            <button type="button" class="cancel-btn" @click="closeModal">取消</button>
            <button type="submit" class="submit-btn">保存</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'

const searchText = ref('')
const showAddModal = ref(false)
const editingType = ref(null)

const form = reactive({
  typeName: '',
  typeCode: '',
  icon: '',
  category: '',
  protocolType: '',
  description: ''
})

const deviceTypeList = ref([
  { id: 1, typeName: '温湿度传感器', typeCode: 'TH001', icon: '🌡️', category: '传感器', protocolType: 'MQTT', status: 1, deviceCount: 15, createTime: '2024-01-15 10:30:00' },
  { id: 2, typeName: '土壤湿度传感器', typeCode: 'SM001', icon: '💧', category: '传感器', protocolType: 'Modbus', status: 1, deviceCount: 8, createTime: '2024-01-16 14:20:00' },
  { id: 3, typeName: '光照传感器', typeCode: 'LS001', icon: '☀️', category: '传感器', protocolType: 'HTTP', status: 1, deviceCount: 12, createTime: '2024-01-17 09:15:00' },
  { id: 4, typeName: 'CO2传感器', typeCode: 'CO001', icon: '🫧', category: '传感器', protocolType: 'MQTT', status: 0, deviceCount: 5, createTime: '2024-01-18 16:45:00' },
  { id: 5, typeName: '电磁阀控制器', typeCode: 'VALVE001', icon: '🔌', category: '控制器', protocolType: 'MQTT', status: 1, deviceCount: 20, createTime: '2024-01-19 11:00:00' },
  { id: 6, typeName: '智能网关', typeCode: 'GW001', icon: '🔗', category: '网关', protocolType: 'WebSocket', status: 1, deviceCount: 3, createTime: '2024-01-20 08:30:00' },
  { id: 7, typeName: '温室内置摄像头', typeCode: 'CAM001', icon: '📷', category: '摄像头', protocolType: 'HTTP', status: 1, deviceCount: 6, createTime: '2024-01-21 13:20:00' },
  { id: 8, typeName: '风机控制器', typeCode: 'FAN001', icon: '🌀', category: '控制器', protocolType: 'Modbus', status: 1, deviceCount: 10, createTime: '2024-01-22 15:40:00' }
])

const formatTime = (time) => {
  return time || '-'
}

const editType = (type) => {
  editingType.value = type
  form.typeName = type.typeName
  form.typeCode = type.typeCode
  form.icon = type.icon
  form.category = type.category
  form.protocolType = type.protocolType
  form.description = type.description || ''
  showAddModal.value = true
}

const toggleStatus = (type) => {
  type.status = type.status === 1 ? 0 : 1
  alert(`设备类型「${type.typeName}」已${type.status === 1 ? '启用' : '禁用'}`)
}

const closeModal = () => {
  showAddModal.value = false
  editingType.value = null
  form.typeName = ''
  form.typeCode = ''
  form.icon = ''
  form.category = ''
  form.protocolType = ''
  form.description = ''
}

const saveType = () => {
  if (!form.typeName) {
    alert('请填写类型名称')
    return
  }
  if (editingType.value) {
    const index = deviceTypeList.value.findIndex(t => t.id === editingType.value.id)
    if (index > -1) {
      deviceTypeList.value[index] = { ...deviceTypeList.value[index], ...form }
    }
    alert('修改成功')
  } else {
    deviceTypeList.value.push({
      id: Date.now(),
      ...form,
      status: 1,
      deviceCount: 0,
      createTime: new Date().toLocaleString('zh-CN')
    })
    alert('新增成功')
  }
  closeModal()
}
</script>

<style scoped>
.device-type-list {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #333;
}

.add-btn {
  background: #4080ff;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.search-bar {
  margin-bottom: 20px;
}

.search-input {
  width: 300px;
  padding: 10px 14px;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  font-size: 14px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.data-table th,
.data-table td {
  padding: 14px 16px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
}

.data-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #666;
  font-size: 13px;
}

.data-table tr:hover {
  background: #fafafa;
}

.icon-cell {
  font-size: 20px;
}

.category-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.category-badge.传感器 { background: #e6f7ff; color: #1890ff; }
.category-badge.控制器 { background: #f6ffed; color: #52c41a; }
.category-badge.网关 { background: #fffbe6; color: #faad14; }
.category-badge.摄像头 { background: #fff0f6; color: #eb2f96; }

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.active { background: #d1fae5; color: #065f46; }
.status-badge.inactive { background: #f3f4f6; color: #6b7280; }

.action-cell {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.action-btn.edit {
  background: #f0f0f0;
  color: #666;
}

.action-btn.toggle {
  background: #fffbe6;
  color: #d97706;
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
  width: 90%;
  max-width: 450px;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e8e8e8;
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #999;
  cursor: pointer;
}

.modal-form {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #666;
  margin-bottom: 6px;
}

.form-group input, .form-group select, .form-group textarea {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  font-size: 14px;
}

.form-group textarea {
  min-height: 80px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.cancel-btn {
  padding: 10px 20px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  background: #fff;
  color: #666;
}

.submit-btn {
  padding: 10px 20px;
  background: #4080ff;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}
</style>
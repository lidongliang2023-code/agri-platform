<template>
  <div class="firmware-list">
    <div class="page-header">
      <h2>固件管理</h2>
      <button class="add-btn" @click="showAddModal = true">+ 上传固件</button>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>固件名称</th>
          <th>版本号</th>
          <th>设备类型</th>
          <th>大小</th>
          <th>状态</th>
          <th>上传时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="firmware in firmwareList" :key="firmware.id">
          <td>{{ firmware.name }}</td>
          <td><span class="version-tag">{{ firmware.version }}</span></td>
          <td>{{ firmware.deviceType }}</td>
          <td>{{ firmware.size }}</td>
          <td><span :class="['status-tag', firmware.status]">{{ firmware.status === 'active' ? '启用' : '禁用' }}</span></td>
          <td>{{ firmware.uploadTime }}</td>
          <td>
            <button class="update-btn" @click="updateStatus(firmware)">
              {{ firmware.status === 'active' ? '禁用' : '启用' }}
            </button>
            <button class="delete-btn" @click="deleteFirmware(firmware.id)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3>上传固件</h3>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        <form class="modal-form" @submit.prevent="uploadFirmware">
          <div class="form-group">
            <label>固件名称</label>
            <input v-model="form.name" placeholder="请输入固件名称" />
          </div>
          <div class="form-group">
            <label>版本号</label>
            <input v-model="form.version" placeholder="请输入版本号" />
          </div>
          <div class="form-group">
            <label>设备类型</label>
            <select v-model="form.deviceType">
              <option value="">请选择设备类型</option>
              <option value="温湿度传感器">温湿度传感器</option>
              <option value="土壤湿度传感器">土壤湿度传感器</option>
              <option value="光照传感器">光照传感器</option>
              <option value="灌溉控制器">灌溉控制器</option>
            </select>
          </div>
          <div class="form-group">
            <label>固件文件</label>
            <div class="upload-area" @click="triggerFileInput">
              <input type="file" id="fileInput" class="file-input" @change="handleFile" />
              <span class="upload-icon">📁</span>
              <span class="upload-text">{{ selectedFile || '点击选择文件' }}</span>
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="cancel-btn" @click="closeModal">取消</button>
            <button type="submit" class="submit-btn">上传</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'

const showAddModal = ref(false)
const selectedFile = ref('')

const form = reactive({
  name: '',
  version: '',
  deviceType: ''
})

const firmwareList = ref([
  { id: 1, name: '温湿度传感器固件', version: 'v1.2.0', deviceType: '温湿度传感器', size: '1.5MB', status: 'active', uploadTime: '2024-01-10' },
  { id: 2, name: '灌溉控制器固件', version: 'v2.1.0', deviceType: '灌溉控制器', size: '2.3MB', status: 'active', uploadTime: '2024-01-12' },
  { id: 3, name: '土壤湿度传感器固件', version: 'v1.1.0', deviceType: '土壤湿度传感器', size: '1.2MB', status: 'disabled', uploadTime: '2024-01-08' }
])

const triggerFileInput = () => {
  document.getElementById('fileInput').click()
}

const handleFile = (e) => {
  const file = e.target.files[0]
  if (file) {
    selectedFile.value = file.name
  }
}

const updateStatus = (firmware) => {
  firmware.status = firmware.status === 'active' ? 'disabled' : 'active'
  alert(`${firmware.name}已${firmware.status === 'active' ? '启用' : '禁用'}`)
}

const deleteFirmware = (id) => {
  if (confirm('确定删除该固件？')) {
    firmwareList.value = firmwareList.value.filter(f => f.id !== id)
    alert('删除成功')
  }
}

const closeModal = () => {
  showAddModal.value = false
  selectedFile.value = ''
  form.name = ''
  form.version = ''
  form.deviceType = ''
}

const uploadFirmware = () => {
  if (!form.name || !form.version || !form.deviceType || !selectedFile.value) {
    alert('请填写完整信息并选择固件文件')
    return
  }
  firmwareList.value.push({
    id: Date.now(),
    name: form.name,
    version: form.version,
    deviceType: form.deviceType,
    size: '2.0MB',
    status: 'disabled',
    uploadTime: new Date().toLocaleDateString()
  })
  alert('上传成功')
  closeModal()
}
</script>

<style scoped>
.firmware-list {
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

.data-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.data-table thead th {
  background: #f8f9fa;
  text-align: left;
  padding: 14px;
  font-size: 13px;
  font-weight: 600;
  color: #666;
  border-bottom: 1px solid #e8e8e8;
}

.data-table tbody td {
  padding: 14px;
  font-size: 13px;
  color: #333;
  border-bottom: 1px solid #f5f5f5;
}

.version-tag {
  display: inline-block;
  padding: 2px 8px;
  background: #e6f7ff;
  color: #1890ff;
  border-radius: 4px;
  font-size: 12px;
}

.status-tag {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-tag.active { background: #d1fae5; color: #065f46; }
.status-tag.disabled { background: #f3f4f6; color: #6b7280; }

.update-btn, .delete-btn {
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  margin-right: 8px;
}

.update-btn {
  background: #f0f0f0;
  border: 1px solid #d9d9d9;
  color: #666;
}

.delete-btn {
  background: #fff2f0;
  border: 1px solid #ffccc7;
  color: #ff4d4f;
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

.form-group input, .form-group select {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  font-size: 14px;
}

.upload-area {
  border: 2px dashed #d9d9d9;
  border-radius: 6px;
  padding: 30px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.upload-area:hover {
  border-color: #4080ff;
}

.file-input {
  display: none;
}

.upload-icon {
  font-size: 32px;
  display: block;
  margin-bottom: 8px;
}

.upload-text {
  font-size: 14px;
  color: #999;
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
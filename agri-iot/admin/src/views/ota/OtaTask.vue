<template>
  <div class="ota-task">
    <div class="page-header">
      <h2>OTA升级管理</h2>
      <button class="add-btn" @click="showAddModal = true">+ 创建升级任务</button>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>任务名称</th>
          <th>固件版本</th>
          <th>目标设备</th>
          <th>状态</th>
          <th>进度</th>
          <th>创建时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="task in taskList" :key="task.id">
          <td>{{ task.name }}</td>
          <td>{{ task.version }}</td>
          <td>{{ task.targetDevices }}</td>
          <td><span :class="['status-tag', task.status]">{{ getStatusText(task.status) }}</span></td>
          <td>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: task.progress + '%' }"></div>
            </div>
            <span class="progress-text">{{ task.progress }}%</span>
          </td>
          <td>{{ task.createTime }}</td>
          <td>
            <button v-if="task.status === 'pending'" class="start-btn" @click="startTask(task)">启动</button>
            <button v-if="task.status === 'running'" class="stop-btn" @click="stopTask(task)">停止</button>
            <button v-if="task.status === 'completed'" class="retry-btn" @click="retryTask(task)">重试</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3>创建升级任务</h3>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        <form class="modal-form" @submit.prevent="createTask">
          <div class="form-group">
            <label>任务名称</label>
            <input v-model="form.name" placeholder="请输入任务名称" />
          </div>
          <div class="form-group">
            <label>选择固件</label>
            <select v-model="form.firmware">
              <option value="">请选择固件</option>
              <option value="温湿度传感器固件 v1.2.0">温湿度传感器固件 v1.2.0</option>
              <option value="灌溉控制器固件 v2.1.0">灌溉控制器固件 v2.1.0</option>
            </select>
          </div>
          <div class="form-group">
            <label>升级范围</label>
            <select v-model="form.scope">
              <option value="all">全部设备</option>
              <option value="group">指定分组</option>
              <option value="single">单个设备</option>
            </select>
          </div>
          <div class="form-group">
            <label>升级时间</label>
            <select v-model="form.timeType">
              <option value="immediate">立即升级</option>
              <option value="scheduled">定时升级</option>
            </select>
          </div>
          <div class="form-actions">
            <button type="button" class="cancel-btn" @click="closeModal">取消</button>
            <button type="submit" class="submit-btn">创建</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'

const showAddModal = ref(false)

const form = reactive({
  name: '',
  firmware: '',
  scope: 'all',
  timeType: 'immediate'
})

const taskList = ref([
  { id: 1, name: '温湿度传感器批量升级', version: 'v1.2.0', targetDevices: '25台设备', status: 'completed', progress: 100, createTime: '2024-01-10' },
  { id: 2, name: '灌溉控制器升级任务', version: 'v2.1.0', targetDevices: '18台设备', status: 'running', progress: 65, createTime: '2024-01-12' },
  { id: 3, name: '土壤传感器固件更新', version: 'v1.1.0', targetDevices: '12台设备', status: 'pending', progress: 0, createTime: '2024-01-15' }
])

const getStatusText = (status) => {
  const map = {
    pending: '待启动',
    running: '升级中',
    completed: '已完成',
    failed: '失败'
  }
  return map[status] || status
}

const startTask = (task) => {
  task.status = 'running'
  alert('任务已启动')
}

const stopTask = (task) => {
  task.status = 'pending'
  alert('任务已停止')
}

const retryTask = (task) => {
  task.status = 'running'
  task.progress = 0
  alert('任务已重启')
}

const closeModal = () => {
  showAddModal.value = false
  form.name = ''
  form.firmware = ''
  form.scope = 'all'
  form.timeType = 'immediate'
}

const createTask = () => {
  if (!form.name || !form.firmware) {
    alert('请填写任务名称并选择固件')
    return
  }
  taskList.value.push({
    id: Date.now(),
    name: form.name,
    version: form.firmware.split(' ').pop(),
    targetDevices: '10台设备',
    status: form.timeType === 'immediate' ? 'running' : 'pending',
    progress: form.timeType === 'immediate' ? 0 : 0,
    createTime: new Date().toLocaleDateString()
  })
  alert('任务创建成功')
  closeModal()
}
</script>

<style scoped>
.ota-task {
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

.status-tag {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-tag.pending { background: #fffbe6; color: #faad14; }
.status-tag.running { background: #e6f7ff; color: #1890ff; }
.status-tag.completed { background: #d1fae5; color: #065f46; }
.status-tag.failed { background: #fff2f0; color: #ff4d4f; }

.progress-bar {
  width: 100%;
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 4px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4080ff, #6699ff);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 12px;
  color: #666;
}

.start-btn, .stop-btn, .retry-btn {
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.start-btn {
  background: #52c41a;
  color: white;
  border: none;
}

.stop-btn {
  background: #faad14;
  color: white;
  border: none;
}

.retry-btn {
  background: #4080ff;
  color: white;
  border: none;
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
<template>
  <div class="gateway-list">
    <div class="page-header">
      <h2>网关管理</h2>
      <button class="add-btn" @click="showAddModal = true">+ 新增网关</button>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>网关编号</th>
          <th>网关名称</th>
          <th>IP地址</th>
          <th>设备数</th>
          <th>状态</th>
          <th>最后心跳</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="gateway in gatewayList" :key="gateway.id">
          <td>{{ gateway.code }}</td>
          <td>{{ gateway.name }}</td>
          <td>{{ gateway.ip }}</td>
          <td>{{ gateway.deviceCount }}</td>
          <td><span :class="['status-tag', gateway.status]">{{ gateway.status === 'online' ? '在线' : '离线' }}</span></td>
          <td>{{ gateway.lastHeartbeat }}</td>
          <td>
            <button class="edit-btn" @click="editGateway(gateway)">编辑</button>
            <button class="delete-btn" @click="deleteGateway(gateway.id)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ editingGateway ? '编辑网关' : '新增网关' }}</h3>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        <form class="modal-form" @submit.prevent="saveGateway">
          <div class="form-group">
            <label>网关编号</label>
            <input v-model="form.code" placeholder="请输入网关编号" />
          </div>
          <div class="form-group">
            <label>网关名称</label>
            <input v-model="form.name" placeholder="请输入网关名称" />
          </div>
          <div class="form-group">
            <label>IP地址</label>
            <input v-model="form.ip" placeholder="请输入IP地址" />
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

const showAddModal = ref(false)
const editingGateway = ref(null)

const form = reactive({
  code: '',
  name: '',
  ip: ''
})

const gatewayList = ref([
  { id: 1, code: 'GW001', name: '农业园区网关-01', ip: '192.168.1.101', deviceCount: 25, status: 'online', lastHeartbeat: '刚刚' },
  { id: 2, code: 'GW002', name: '温室大棚网关-02', ip: '192.168.1.102', deviceCount: 32, status: 'online', lastHeartbeat: '5分钟前' },
  { id: 3, code: 'GW003', name: '智能农场网关-03', ip: '192.168.1.103', deviceCount: 18, status: 'offline', lastHeartbeat: '1小时前' }
])

const editGateway = (gateway) => {
  editingGateway.value = gateway
  form.code = gateway.code
  form.name = gateway.name
  form.ip = gateway.ip
  showAddModal.value = true
}

const deleteGateway = (id) => {
  if (confirm('确定删除该网关？')) {
    gatewayList.value = gatewayList.value.filter(g => g.id !== id)
    alert('删除成功')
  }
}

const closeModal = () => {
  showAddModal.value = false
  editingGateway.value = null
  form.code = ''
  form.name = ''
  form.ip = ''
}

const saveGateway = () => {
  if (!form.code || !form.name) {
    alert('请填写网关编号和名称')
    return
  }
  if (editingGateway.value) {
    const index = gatewayList.value.findIndex(g => g.id === editingGateway.value.id)
    if (index > -1) {
      gatewayList.value[index] = { ...gatewayList.value[index], ...form }
    }
    alert('修改成功')
  } else {
    gatewayList.value.push({
      id: Date.now(),
      ...form,
      deviceCount: 0,
      status: 'offline',
      lastHeartbeat: '-'
    })
    alert('新增成功')
  }
  closeModal()
}
</script>

<style scoped>
.gateway-list {
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

.status-tag.online { background: #d1fae5; color: #065f46; }
.status-tag.offline { background: #f3f4f6; color: #6b7280; }

.edit-btn, .delete-btn {
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  margin-right: 8px;
}

.edit-btn {
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

.form-group input {
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
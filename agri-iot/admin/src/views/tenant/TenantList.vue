<template>
  <div class="tenant-list">
    <div class="page-header">
      <h2>租户管理</h2>
      <button class="add-btn" @click="showAddModal = true">+ 新增租户</button>
    </div>

    <div class="search-bar">
      <input v-model="searchText" placeholder="搜索租户名称或编码" class="search-input" />
      <select v-model="statusFilter" class="filter-select">
        <option value="">全部状态</option>
        <option value="1">启用</option>
        <option value="0">禁用</option>
      </select>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>租户名称</th>
          <th>租户编码</th>
          <th>联系人</th>
          <th>联系电话</th>
          <th>邮箱</th>
          <th>状态</th>
          <th>过期时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="tenant in tenantList" :key="tenant.id">
          <td>{{ tenant.tenantName }}</td>
          <td><span class="code-tag">{{ tenant.tenantCode }}</span></td>
          <td>{{ tenant.contactName }}</td>
          <td>{{ tenant.contactPhone }}</td>
          <td>{{ tenant.email }}</td>
          <td><span :class="['status-tag', tenant.status]">{{ tenant.status === 1 ? '启用' : '禁用' }}</span></td>
          <td>{{ tenant.expireTime || '永久' }}</td>
          <td>
            <button class="edit-btn" @click="editTenant(tenant)">编辑</button>
            <button class="toggle-btn" @click="toggleStatus(tenant)">
              {{ tenant.status === 1 ? '禁用' : '启用' }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ editingTenant ? '编辑租户' : '新增租户' }}</h3>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        <form class="modal-form" @submit.prevent="saveTenant">
          <div class="form-group">
            <label>租户名称 *</label>
            <input v-model="form.tenantName" placeholder="请输入租户名称" />
          </div>
          <div class="form-group">
            <label>租户编码 *</label>
            <input v-model="form.tenantCode" placeholder="请输入租户编码" />
          </div>
          <div class="form-group">
            <label>联系人</label>
            <input v-model="form.contactName" placeholder="请输入联系人" />
          </div>
          <div class="form-group">
            <label>联系电话</label>
            <input v-model="form.contactPhone" placeholder="请输入联系电话" />
          </div>
          <div class="form-group">
            <label>邮箱</label>
            <input v-model="form.email" type="email" placeholder="请输入邮箱" />
          </div>
          <div class="form-group">
            <label>地址</label>
            <textarea v-model="form.address" placeholder="请输入地址"></textarea>
          </div>
          <div class="form-group">
            <label>过期时间</label>
            <input v-model="form.expireTime" type="datetime-local" />
          </div>
          <div class="form-group">
            <label>备注</label>
            <textarea v-model="form.remark" placeholder="请输入备注"></textarea>
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
const statusFilter = ref('')
const showAddModal = ref(false)
const editingTenant = ref(null)

const form = reactive({
  tenantName: '',
  tenantCode: '',
  contactName: '',
  contactPhone: '',
  email: '',
  address: '',
  expireTime: '',
  remark: ''
})

const tenantList = ref([
  { id: 1, tenantName: '默认租户', tenantCode: 'default', contactName: '管理员', contactPhone: '13800138000', email: 'admin@example.com', address: '北京市朝阳区', status: 1, expireTime: '永久' },
  { id: 2, tenantName: '测试租户', tenantCode: 'test', contactName: '测试用户', contactPhone: '13800138001', email: 'test@example.com', address: '上海市浦东新区', status: 1, expireTime: '2025-12-31' },
  { id: 3, tenantName: '农业园区A', tenantCode: 'farm-a', contactName: '张三', contactPhone: '13800138002', email: 'zhangsan@example.com', address: '江苏省南京市', status: 0, expireTime: '2024-12-31' },
  { id: 4, tenantName: '智慧农场B', tenantCode: 'farm-b', contactName: '李四', contactPhone: '13800138003', email: 'lisi@example.com', address: '浙江省杭州市', status: 1, expireTime: '永久' }
])

const editTenant = (tenant) => {
  editingTenant.value = tenant
  form.tenantName = tenant.tenantName
  form.tenantCode = tenant.tenantCode
  form.contactName = tenant.contactName
  form.contactPhone = tenant.contactPhone
  form.email = tenant.email
  form.address = tenant.address || ''
  form.expireTime = tenant.expireTime !== '永久' ? tenant.expireTime : ''
  form.remark = tenant.remark || ''
  showAddModal.value = true
}

const toggleStatus = (tenant) => {
  tenant.status = tenant.status === 1 ? 0 : 1
  alert(`${tenant.tenantName}已${tenant.status === 1 ? '启用' : '禁用'}`)
}

const closeModal = () => {
  showAddModal.value = false
  editingTenant.value = null
  form.tenantName = ''
  form.tenantCode = ''
  form.contactName = ''
  form.contactPhone = ''
  form.email = ''
  form.address = ''
  form.expireTime = ''
  form.remark = ''
}

const saveTenant = () => {
  if (!form.tenantName || !form.tenantCode) {
    alert('请填写租户名称和编码')
    return
  }
  if (editingTenant.value) {
    const index = tenantList.value.findIndex(t => t.id === editingTenant.value.id)
    if (index > -1) {
      tenantList.value[index] = { ...tenantList.value[index], ...form }
    }
    alert('修改成功')
  } else {
    tenantList.value.push({
      id: Date.now(),
      ...form,
      status: 1,
      expireTime: form.expireTime || '永久'
    })
    alert('新增成功')
  }
  closeModal()
}
</script>

<style scoped>
.tenant-list {
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
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.search-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  font-size: 14px;
}

.filter-select {
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

.code-tag {
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

.status-tag.1 { background: #d1fae5; color: #065f46; }
.status-tag.0 { background: #f3f4f6; color: #6b7280; }

.edit-btn, .toggle-btn {
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

.toggle-btn {
  background: #fffbe6;
  border: 1px solid #ffe066;
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
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e8e8e8;
  position: sticky;
  top: 0;
  background: #fff;
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

.form-group input, .form-group textarea, .form-group select {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  font-size: 14px;
}

.form-group textarea {
  min-height: 80px;
  resize: vertical;
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
<template>
  <div class="user-management">
    <div class="page-header">
      <div class="header-left">
        <h1>用户管理</h1>
        <p>管理平台用户信息</p>
      </div>
      <div class="header-right">
        <button class="btn btn-primary" @click="openCreateModal">新建用户</button>
      </div>
    </div>

    <div class="filter-section">
      <div class="search-box">
        <input type="text" v-model="searchKeyword" placeholder="搜索用户名、邮箱或手机号..." class="search-input" />
        <button class="search-btn" @click="handleSearch">搜索</button>
      </div>
      <div class="filter-group">
        <select v-model="statusFilter" class="filter-select">
          <option value="">全部状态</option>
          <option value="active">启用</option>
          <option value="inactive">禁用</option>
        </select>
        <select v-model="roleFilter" class="filter-select">
          <option value="">全部角色</option>
          <option value="admin">管理员</option>
          <option value="data_admin">数据管理员</option>
          <option value="business_admin">业务管理员</option>
          <option value="user">普通用户</option>
        </select>
      </div>
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>用户ID</th>
            <th>用户名</th>
            <th>邮箱</th>
            <th>手机号</th>
            <th>角色</th>
            <th>状态</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in filteredUsers" :key="user.id">
            <td>{{ user.id }}</td>
            <td>{{ user.username }}</td>
            <td>{{ user.email }}</td>
            <td>{{ user.phone }}</td>
            <td><span class="role-badge">{{ getRoleLabel(user.role) }}</span></td>
            <td><span :class="['status-badge', user.status]">{{ getStatusLabel(user.status) }}</span></td>
            <td>{{ user.createTime }}</td>
            <td class="action-cell">
              <button class="action-btn view" @click="viewUser(user)">查看</button>
              <button class="action-btn edit" @click="editUser(user)">编辑</button>
              <button class="action-btn delete" @click="deleteUser(user)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pagination">
      <button class="page-btn" :disabled="currentPage === 1" @click="prevPage">上一页</button>
      <span class="page-info">第 {{ currentPage }} / {{ totalPages }} 页</span>
      <button class="page-btn" :disabled="currentPage === totalPages" @click="nextPage">下一页</button>
    </div>

    <div class="modal-overlay" v-if="modalVisible" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ isEdit ? '编辑用户' : '新建用户' }}</h3>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>用户名</label>
            <input type="text" v-model="formData.username" class="form-input" placeholder="请输入用户名" />
          </div>
          <div class="form-group">
            <label>昵称</label>
            <input type="text" v-model="formData.nickname" class="form-input" placeholder="请输入昵称" />
          </div>
          <div class="form-group">
            <label>邮箱</label>
            <input type="email" v-model="formData.email" class="form-input" placeholder="请输入邮箱" />
          </div>
          <div class="form-group">
            <label>手机号</label>
            <input type="tel" v-model="formData.phone" class="form-input" placeholder="请输入手机号" />
          </div>
          <div class="form-group">
            <label>角色</label>
            <select v-model="formData.role" class="form-select">
              <option value="admin">管理员</option>
              <option value="data_admin">数据管理员</option>
              <option value="business_admin">业务管理员</option>
              <option value="user">普通用户</option>
            </select>
          </div>
          <div class="form-group" v-if="!isEdit">
            <label>密码</label>
            <input type="password" v-model="formData.password" class="form-input" placeholder="请输入密码" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="closeModal">取消</button>
          <button class="btn btn-primary" @click="saveUser">{{ isEdit ? '保存修改' : '创建用户' }}</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" v-if="detailVisible" @click="detailVisible = false">
      <div class="modal-content detail-modal" @click.stop>
        <div class="modal-header">
          <h3>用户详情</h3>
          <button class="close-btn" @click="detailVisible = false">×</button>
        </div>
        <div class="modal-body" v-if="selectedUser">
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">用户ID</span>
              <span class="detail-value">{{ selectedUser.id }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">用户名</span>
              <span class="detail-value">{{ selectedUser.username }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">昵称</span>
              <span class="detail-value">{{ selectedUser.nickname }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">邮箱</span>
              <span class="detail-value">{{ selectedUser.email }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">手机号</span>
              <span class="detail-value">{{ selectedUser.phone }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">角色</span>
              <span class="detail-value">{{ getRoleLabel(selectedUser.role) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">状态</span>
              <span :class="['detail-value', 'status-badge', selectedUser.status]">{{ getStatusLabel(selectedUser.status) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">创建时间</span>
              <span class="detail-value">{{ selectedUser.createTime }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">最后登录</span>
              <span class="detail-value">{{ selectedUser.lastLogin }}</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" @click="detailVisible = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'

const searchKeyword = ref('')
const statusFilter = ref('')
const roleFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const modalVisible = ref(false)
const detailVisible = ref(false)
const isEdit = ref(false)
const selectedUser = ref(null)

const formData = reactive({
  username: '',
  nickname: '',
  email: '',
  phone: '',
  role: 'user',
  password: ''
})

const mockUsers = ref([
  { id: 1, username: 'admin', nickname: '管理员', email: 'admin@example.com', phone: '13800138000', role: 'admin', status: 'active', createTime: '2026-01-01 09:00:00', lastLogin: '2026-05-09 09:15:00' },
  { id: 2, username: 'data_admin', nickname: '数据管理员', email: 'data@example.com', phone: '13800138001', role: 'data_admin', status: 'active', createTime: '2026-01-05 10:00:00', lastLogin: '2026-05-08 16:30:00' },
  { id: 3, username: 'business_admin', nickname: '业务管理员', email: 'business@example.com', phone: '13800138002', role: 'business_admin', status: 'active', createTime: '2026-01-10 11:00:00', lastLogin: '2026-05-09 08:45:00' },
  { id: 4, username: 'user001', nickname: '张三', email: 'zhangsan@example.com', phone: '13800138003', role: 'user', status: 'active', createTime: '2026-02-01 09:30:00', lastLogin: '2026-05-09 10:00:00' },
  { id: 5, username: 'user002', nickname: '李四', email: 'lisi@example.com', phone: '13800138004', role: 'user', status: 'active', createTime: '2026-02-15 14:00:00', lastLogin: '2026-05-07 15:20:00' },
  { id: 6, username: 'user003', nickname: '王五', email: 'wangwu@example.com', phone: '13800138005', role: 'user', status: 'inactive', createTime: '2026-03-01 10:00:00', lastLogin: '2026-04-01 09:00:00' },
  { id: 7, username: 'dev001', nickname: '开发者A', email: 'dev001@example.com', phone: '13800138006', role: 'user', status: 'active', createTime: '2026-03-15 11:30:00', lastLogin: '2026-05-09 09:30:00' },
  { id: 8, username: 'test001', nickname: '测试用户', email: 'test@example.com', phone: '13800138007', role: 'user', status: 'active', createTime: '2026-04-01 09:00:00', lastLogin: '2026-05-08 14:00:00' }
])

const filteredUsers = computed(() => {
  return mockUsers.value.filter(user => {
    const matchKeyword = !searchKeyword.value || 
      user.username.includes(searchKeyword.value) ||
      user.email.includes(searchKeyword.value) ||
      user.phone.includes(searchKeyword.value)
    const matchStatus = !statusFilter.value || user.status === statusFilter.value
    const matchRole = !roleFilter.value || user.role === roleFilter.value
    return matchKeyword && matchStatus && matchRole
  })
})

const totalPages = computed(() => Math.ceil(filteredUsers.value.length / pageSize.value))

const getRoleLabel = (role) => {
  const labels = { admin: '管理员', data_admin: '数据管理员', business_admin: '业务管理员', user: '普通用户' }
  return labels[role] || role
}

const getStatusLabel = (status) => {
  return status === 'active' ? '启用' : '禁用'
}

const handleSearch = () => {
  currentPage.value = 1
}

const openCreateModal = () => {
  isEdit.value = false
  formData.username = ''
  formData.nickname = ''
  formData.email = ''
  formData.phone = ''
  formData.role = 'user'
  formData.password = ''
  modalVisible.value = true
}

const editUser = (user) => {
  isEdit.value = true
  formData.username = user.username
  formData.nickname = user.nickname
  formData.email = user.email
  formData.phone = user.phone
  formData.role = user.role
  selectedUser.value = user
  modalVisible.value = true
}

const viewUser = (user) => {
  selectedUser.value = user
  detailVisible.value = true
}

const deleteUser = (user) => {
  if (confirm(`确定要删除用户 ${user.username} 吗？`)) {
    const index = mockUsers.value.findIndex(u => u.id === user.id)
    if (index > -1) {
      mockUsers.value.splice(index, 1)
    }
  }
}

const saveUser = () => {
  if (!formData.username || !formData.email) {
    alert('请填写必填字段')
    return
  }
  if (!isEdit.value && !formData.password) {
    alert('请设置密码')
    return
  }
  if (isEdit.value) {
    const user = mockUsers.value.find(u => u.id === selectedUser.value.id)
    if (user) {
      user.username = formData.username
      user.nickname = formData.nickname
      user.email = formData.email
      user.phone = formData.phone
      user.role = formData.role
    }
    alert('用户信息已更新')
  } else {
    const newUser = {
      id: Date.now(),
      username: formData.username,
      nickname: formData.nickname,
      email: formData.email,
      phone: formData.phone,
      role: formData.role,
      status: 'active',
      createTime: new Date().toLocaleString(),
      lastLogin: '-'
    }
    mockUsers.value.push(newUser)
    alert('用户创建成功')
  }
  closeModal()
}

const closeModal = () => {
  modalVisible.value = false
  selectedUser.value = null
}

const prevPage = () => {
  if (currentPage.value > 1) currentPage.value--
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) currentPage.value++
}

onMounted(() => {})
</script>

<style scoped>
.user-management {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
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

.btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
}

.btn-primary {
  background: #238636;
  color: #fff;
}

.btn-cancel {
  background: #f0f0f0;
  color: #4a5568;
}

.filter-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 16px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.search-box {
  display: flex;
  gap: 8px;
}

.search-input {
  padding: 10px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  width: 300px;
  outline: none;
}

.search-btn {
  padding: 10px 24px;
  background: #238636;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

.filter-group {
  display: flex;
  gap: 12px;
}

.filter-select {
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: #4a5568;
  background: #fff;
}

.table-container {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 14px 16px;
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

.role-badge {
  padding: 4px 10px;
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  border-radius: 12px;
  font-size: 11px;
}

.status-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.status-badge.active {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.status-badge.inactive {
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
}

.action-btn.view {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.action-btn.edit {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
}

.action-btn.delete {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  padding: 20px;
}

.page-btn {
  padding: 8px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
  font-size: 13px;
  color: #4a5568;
  cursor: pointer;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 13px;
  color: #a0aec0;
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
  width: 500px;
  overflow: hidden;
}

.detail-modal {
  width: 600px;
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
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 13px;
  color: #4a5568;
  margin-bottom: 6px;
}

.form-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}

.form-select {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: #4a5568;
  background: #fff;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid #f0f0f0;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.detail-item {
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
}

.detail-label {
  display: block;
  font-size: 12px;
  color: #a0aec0;
  margin-bottom: 4px;
}

.detail-value {
  font-size: 14px;
  color: #2d3748;
  font-weight: 500;
}
</style>
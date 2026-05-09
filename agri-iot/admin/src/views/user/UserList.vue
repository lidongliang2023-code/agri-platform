<template>
  <div class="user-list">
    <div class="page-header">
      <h2>用户管理</h2>
      <button class="add-btn" @click="showAddModal = true">+ 新增用户</button>
    </div>

    <div class="search-bar">
      <input v-model="searchText" placeholder="搜索用户名" class="search-input" />
      <select v-model="statusFilter" class="filter-select">
        <option value="">全部状态</option>
        <option value="active">正常</option>
        <option value="disabled">禁用</option>
      </select>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>用户名</th>
          <th>邮箱</th>
          <th>手机号</th>
          <th>设备数</th>
          <th>注册时间</th>
          <th>状态</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="user in userList" :key="user.id">
          <td>{{ user.username }}</td>
          <td>{{ user.email }}</td>
          <td>{{ user.phone }}</td>
          <td>{{ user.deviceCount }}</td>
          <td>{{ user.registerTime }}</td>
          <td><span :class="['status-tag', user.status]">{{ user.status === 'active' ? '正常' : '禁用' }}</span></td>
          <td>
            <button class="edit-btn" @click="editUser(user)">编辑</button>
            <button class="delete-btn" @click="deleteUser(user.id)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ editingUser ? '编辑用户' : '新增用户' }}</h3>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        <form class="modal-form" @submit.prevent="saveUser">
          <div class="form-group">
            <label>用户名</label>
            <input v-model="form.username" placeholder="请输入用户名" />
          </div>
          <div class="form-group">
            <label>邮箱</label>
            <input v-model="form.email" type="email" placeholder="请输入邮箱" />
          </div>
          <div class="form-group">
            <label>手机号</label>
            <input v-model="form.phone" placeholder="请输入手机号" />
          </div>
          <div class="form-group">
            <label>状态</label>
            <select v-model="form.status">
              <option value="active">正常</option>
              <option value="disabled">禁用</option>
            </select>
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
const editingUser = ref(null)

const form = reactive({
  username: '',
  email: '',
  phone: '',
  status: 'active'
})

const userList = ref([
  { id: 1, username: '张三', email: 'zhangsan@example.com', phone: '13800138001', deviceCount: 15, registerTime: '2024-01-10', status: 'active' },
  { id: 2, username: '李四', email: 'lisi@example.com', phone: '13800138002', deviceCount: 8, registerTime: '2024-01-12', status: 'active' },
  { id: 3, username: '王五', email: 'wangwu@example.com', phone: '13800138003', deviceCount: 22, registerTime: '2024-01-15', status: 'disabled' },
  { id: 4, username: '赵六', email: 'zhaoliu@example.com', phone: '13800138004', deviceCount: 5, registerTime: '2024-01-18', status: 'active' }
])

const editUser = (user) => {
  editingUser.value = user
  form.username = user.username
  form.email = user.email
  form.phone = user.phone
  form.status = user.status
  showAddModal.value = true
}

const deleteUser = (id) => {
  if (confirm('确定删除该用户？')) {
    userList.value = userList.value.filter(u => u.id !== id)
    alert('删除成功')
  }
}

const closeModal = () => {
  showAddModal.value = false
  editingUser.value = null
  form.username = ''
  form.email = ''
  form.phone = ''
  form.status = 'active'
}

const saveUser = () => {
  if (!form.username || !form.email) {
    alert('请填写用户名和邮箱')
    return
  }
  if (editingUser.value) {
    const index = userList.value.findIndex(u => u.id === editingUser.value.id)
    if (index > -1) {
      userList.value[index] = { ...userList.value[index], ...form }
    }
    alert('修改成功')
  } else {
    userList.value.push({
      id: Date.now(),
      ...form,
      deviceCount: 0,
      registerTime: new Date().toLocaleDateString()
    })
    alert('新增成功')
  }
  closeModal()
}
</script>

<style scoped>
.user-list {
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

.status-tag {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-tag.active { background: #d1fae5; color: #065f46; }
.status-tag.disabled { background: #f3f4f6; color: #6b7280; }

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
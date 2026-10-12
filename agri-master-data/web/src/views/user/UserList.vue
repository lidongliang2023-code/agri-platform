<template>
  <div class="user-list">
    <div class="page-header">
      <div class="header-left">
        <h1>用户管理</h1>
        <p>管理系统用户信息</p>
      </div>
      <button class="add-btn" @click="openCreateModal">
        <span class="btn-icon">+</span>
        <span>新增用户</span>
      </button>
    </div>

    <div class="search-bar">
      <div class="search-group">
        <input 
          type="text" 
          v-model="searchForm.keyword" 
          placeholder="用户名/姓名/手机号..." 
          class="search-input"
        />
        <button class="search-btn" @click="loadData">搜索</button>
      </div>
      <div class="filter-group">
        <select v-model="searchForm.status" class="filter-select">
          <option value="">全部状态</option>
          <option value="active">正常</option>
          <option value="inactive">禁用</option>
        </select>
        <select v-model="searchForm.realNameStatus" class="filter-select">
          <option value="">实名状态</option>
          <option value="verified">已认证</option>
          <option value="unverified">未认证</option>
          <option value="pending">审核中</option>
        </select>
      </div>
    </div>

    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>用户编码</th>
            <th>用户名</th>
            <th>真实姓名</th>
            <th>手机号</th>
            <th>用户类型</th>
            <th>实名状态</th>
            <th>状态</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in tableData" :key="user.id">
            <td>{{ user.userCode }}</td>
            <td>{{ user.username }}</td>
            <td>{{ user.realName }}</td>
            <td>{{ user.phone }}</td>
            <td>
              <span class="type-badge" :class="user.userType">
                {{ user.userType === 'enterprise' ? '企业用户' : '个人用户' }}
              </span>
            </td>
            <td>
              <span class="status-badge" :class="user.realNameStatus">
                {{ getStatusLabel(user.realNameStatus) }}
              </span>
            </td>
            <td>
              <span class="status-badge" :class="user.userStatus">
                {{ user.userStatus === 'active' ? '正常' : '禁用' }}
              </span>
            </td>
            <td>{{ formatDate(user.createTime) }}</td>
            <td class="action-cell">
              <button class="action-btn view" @click="viewDetail(user.id)">详情</button>
              <button class="action-btn edit" @click="editUser(user)">编辑</button>
              <button 
                class="action-btn" 
                :class="user.userStatus === 'active' ? 'disable' : 'enable'"
                @click="toggleStatus(user)"
              >
                {{ user.userStatus === 'active' ? '禁用' : '启用' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="pagination">
        <button class="page-btn" :disabled="pageNum === 1" @click="handleCurrentChange(pageNum - 1)">上一页</button>
        <span class="page-info">第 {{ pageNum }} / {{ totalPages }} 页</span>
        <button class="page-btn" :disabled="pageNum === totalPages" @click="handleCurrentChange(pageNum + 1)">下一页</button>
      </div>
    </div>

    <div class="modal-overlay" v-if="modalVisible" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ form.id ? '编辑用户' : '新增用户' }}</h3>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>用户名 *</label>
            <input type="text" v-model="form.username" placeholder="请输入用户名" class="form-input" />
          </div>
          <div class="form-group">
            <label>真实姓名 *</label>
            <input type="text" v-model="form.realName" placeholder="请输入真实姓名" class="form-input" />
          </div>
          <div class="form-group">
            <label>手机号</label>
            <input type="text" v-model="form.phone" placeholder="请输入手机号" class="form-input" />
          </div>
          <div class="form-group">
            <label>邮箱</label>
            <input type="text" v-model="form.email" placeholder="请输入邮箱" class="form-input" />
          </div>
          <div class="form-group">
            <label>用户类型</label>
            <select v-model="form.userType" class="form-select">
              <option value="enterprise">企业用户</option>
              <option value="individual">个人用户</option>
            </select>
          </div>
          <div class="form-group" v-if="!form.id">
            <label>密码 *</label>
            <input type="password" v-model="form.password" placeholder="请输入密码" class="form-input" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="closeModal">取消</button>
          <button class="btn btn-primary" @click="saveUser">确认{{ form.id ? '修改' : '添加' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { getUserList, createUser, updateUser, changeStatus } from '../../utils/api'

const tableData = ref([])
const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(0)
const modalVisible = ref(false)

const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

const searchForm = reactive({
  keyword: '',
  status: '',
  realNameStatus: ''
})

const form = reactive({
  id: null,
  username: '',
  realName: '',
  phone: '',
  email: '',
  userType: 'individual',
  password: ''
})

const getStatusLabel = (status) => {
  const labels = { verified: '已认证', unverified: '未认证', pending: '审核中' }
  return labels[status] || status
}

const loadData = async () => {
  try {
    const response = await getUserList({
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      keyword: searchForm.keyword,
      userStatus: searchForm.status,
      realNameStatus: searchForm.realNameStatus
    })
    if (response.code === 200) {
      tableData.value = response.data.list || mockUsers
      total.value = response.data.total || mockUsers.length
    }
  } catch (error) {
    console.error('Failed to load users:', error)
    tableData.value = mockUsers
    total.value = mockUsers.length
  }
}

const mockUsers = [
  { id: 1, userCode: 'USER001', username: 'admin', realName: '管理员', phone: '13800138001', email: 'admin@test.com', userType: 'enterprise', realNameStatus: 'verified', userStatus: 'active', createTime: '2024-01-10 10:00:00' },
  { id: 2, userCode: 'USER002', username: 'zhangsan', realName: '张三', phone: '13800138002', email: 'zhangsan@test.com', userType: 'individual', realNameStatus: 'verified', userStatus: 'active', createTime: '2024-01-11 14:30:00' },
  { id: 3, userCode: 'USER003', username: 'lisi', realName: '李四', phone: '13800138003', email: 'lisi@test.com', userType: 'individual', realNameStatus: 'pending', userStatus: 'active', createTime: '2024-01-12 09:15:00' },
  { id: 4, userCode: 'USER004', username: 'wangwu', realName: '王五', phone: '13800138004', email: 'wangwu@test.com', userType: 'enterprise', realNameStatus: 'unverified', userStatus: 'inactive', createTime: '2024-01-13 16:45:00' },
  { id: 5, userCode: 'USER005', username: 'zhaoliu', realName: '赵六', phone: '13800138005', email: 'zhaoliu@test.com', userType: 'individual', realNameStatus: 'verified', userStatus: 'active', createTime: '2024-01-14 11:20:00' }
]

const handleCurrentChange = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    pageNum.value = page
    loadData()
  }
}

const openCreateModal = () => {
  form.id = null
  form.username = ''
  form.realName = ''
  form.phone = ''
  form.email = ''
  form.userType = 'individual'
  form.password = ''
  modalVisible.value = true
}

const editUser = (row) => {
  form.id = row.id
  form.username = row.username
  form.realName = row.realName
  form.phone = row.phone
  form.email = row.email
  form.userType = row.userType
  modalVisible.value = true
}

const closeModal = () => {
  modalVisible.value = false
}

const saveUser = async () => {
  if (!form.username || !form.realName) {
    alert('请填写必填项')
    return
  }
  
  if (!form.id && !form.password) {
    alert('请设置密码')
    return
  }
  
  try {
    let response
    if (form.id) {
      response = await updateUser(form.id, {
        realName: form.realName,
        phone: form.phone,
        email: form.email,
        userType: form.userType
      })
    } else {
      response = await createUser({
        username: form.username,
        password: form.password,
        realName: form.realName,
        phone: form.phone,
        email: form.email,
        userType: form.userType
      })
    }
    
    if (response.code === 200) {
      alert(form.id ? '修改成功' : '创建成功')
      closeModal()
      loadData()
    } else {
      alert(response.message || '操作失败')
    }
  } catch (error) {
    alert('操作失败')
  }
}

const toggleStatus = async (row) => {
  try {
    const response = await changeStatus(row.id, row.userStatus === 'active' ? 0 : 1)
    if (response.code === 200) {
      alert(row.userStatus === 'active' ? '禁用成功' : '启用成功')
      loadData()
    } else {
      alert(response.message || '操作失败')
    }
  } catch (error) {
    alert('操作失败')
  }
}

const viewDetail = (id) => {
  alert(`查看用户详情: ${id}`)
}

const formatDate = (date) => {
  if (!date) return ''
  return date.split(' ')[0]
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.user-list {
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
  display: flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #238636 0%, #2ea043 100%);
  color: #fff;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.add-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(35, 134, 54, 0.3);
}

.btn-icon {
  font-size: 18px;
}

.search-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.search-group {
  display: flex;
  flex: 1;
}

.search-input {
  flex: 1;
  padding: 10px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px 0 0 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.search-input:focus {
  border-color: #238636;
}

.search-btn {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-left: none;
  padding: 10px 24px;
  border-radius: 0 8px 8px 0;
  font-size: 14px;
  color: #238636;
  cursor: pointer;
}

.search-btn:hover {
  background: rgba(35, 134, 54, 0.1);
}

.filter-group {
  display: flex;
  gap: 12px;
}

.filter-select {
  padding: 10px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: #4a5568;
  background: #fff;
  cursor: pointer;
  outline: none;
}

.table-card {
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

.type-badge {
  font-size: 11px;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: 12px;
}

.type-badge.enterprise {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.type-badge.individual {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.status-badge {
  font-size: 11px;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: 12px;
}

.status-badge.active {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.status-badge.inactive {
  background: rgba(160, 174, 192, 0.1);
  color: #a0aec0;
}

.status-badge.verified {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.status-badge.unverified {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
}

.status-badge.pending {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
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

.action-btn.view {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.action-btn.edit {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
}

.action-btn.disable {
  background: rgba(218, 54, 51, 0.1);
  color: #da3633;
}

.action-btn.enable {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
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

.page-btn:hover:not(:disabled) {
  background: #f8fafc;
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
  max-width: 90%;
  overflow: hidden;
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
  box-sizing: border-box;
}

.form-input:focus {
  border-color: #238636;
}

.form-select {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: #4a5568;
  background: #fff;
  cursor: pointer;
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
  border: none;
}

.btn-cancel {
  background: #f0f0f0;
  color: #4a5568;
}

.btn-primary {
  background: linear-gradient(135deg, #238636 0%, #2ea043 100%);
  color: #fff;
}
</style>

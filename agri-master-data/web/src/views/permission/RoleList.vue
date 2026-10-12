<template>
  <div class="role-list">
    <div class="page-header">
      <div class="header-left">
        <h1>角色管理</h1>
        <p>管理系统角色与权限</p>
      </div>
      <button class="add-btn" @click="openCreateModal">
        <span class="btn-icon">+</span>
        <span>新增角色</span>
      </button>
    </div>

    <div class="search-bar">
      <div class="search-group">
        <input 
          type="text" 
          v-model="searchForm.keyword" 
          placeholder="角色名称/编码..." 
          class="search-input"
        />
        <button class="search-btn" @click="loadData">搜索</button>
      </div>
      <div class="filter-group">
        <select v-model="searchForm.status" class="filter-select">
          <option value="">全部状态</option>
          <option value="1">启用</option>
          <option value="0">禁用</option>
        </select>
      </div>
    </div>

    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>角色编码</th>
            <th>角色名称</th>
            <th>角色标识</th>
            <th>角色类型</th>
            <th>数据范围</th>
            <th>状态</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="role in tableData" :key="role.id">
            <td>{{ role.roleCode }}</td>
            <td>{{ role.roleName }}</td>
            <td>{{ role.roleKey }}</td>
            <td>
              <span class="type-badge" :class="role.roleType">
                {{ role.roleType === 'system' ? '系统角色' : '自定义' }}
              </span>
            </td>
            <td>{{ getDataScopeLabel(role.dataScope) }}</td>
            <td>
              <span class="status-badge" :class="role.status === 1 ? 'active' : 'inactive'">
                {{ role.status === 1 ? '启用' : '禁用' }}
              </span>
            </td>
            <td>{{ formatDate(role.createTime) }}</td>
            <td class="action-cell">
              <button class="action-btn edit" @click="editRole(role)">编辑</button>
              <button 
                class="action-btn" 
                :class="role.status === 1 ? 'disable' : 'enable'"
                @click="toggleStatus(role)"
                :disabled="role.roleType === 'system'"
              >
                {{ role.status === 1 ? '禁用' : '启用' }}
              </button>
              <button 
                class="action-btn delete" 
                @click="deleteRole(role.id)"
                :disabled="role.roleType === 'system'"
              >删除</button>
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
          <h3>{{ form.id ? '编辑角色' : '新增角色' }}</h3>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>角色编码 *</label>
            <input type="text" v-model="form.roleCode" placeholder="请输入角色编码" class="form-input" :disabled="form.id" />
          </div>
          <div class="form-group">
            <label>角色名称 *</label>
            <input type="text" v-model="form.roleName" placeholder="请输入角色名称" class="form-input" />
          </div>
          <div class="form-group">
            <label>角色标识</label>
            <input type="text" v-model="form.roleKey" placeholder="请输入角色标识" class="form-input" />
          </div>
          <div class="form-group">
            <label>角色类型</label>
            <select v-model="form.roleType" class="form-select">
              <option value="system">系统角色</option>
              <option value="custom">自定义</option>
            </select>
          </div>
          <div class="form-group">
            <label>数据范围</label>
            <select v-model="form.dataScope" class="form-select">
              <option :value="1">全部数据</option>
              <option :value="2">本部门数据</option>
              <option :value="3">本人数据</option>
              <option :value="4">自定义</option>
            </select>
          </div>
          <div class="form-group">
            <label>状态</label>
            <select v-model="form.status" class="form-select">
              <option :value="1">启用</option>
              <option :value="0">禁用</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="closeModal">取消</button>
          <button class="btn btn-primary" @click="saveRole">确认{{ form.id ? '修改' : '添加' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { getRoleList, createRole, updateRole, deleteRole as apiDeleteRole } from '../../utils/api'

const tableData = ref([])
const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(0)
const modalVisible = ref(false)

const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

const searchForm = reactive({
  keyword: '',
  status: ''
})

const form = reactive({
  id: null,
  roleCode: '',
  roleName: '',
  roleKey: '',
  roleType: 'custom',
  dataScope: 1,
  status: 1
})

const getDataScopeLabel = (scope) => {
  const labels = { 1: '全部数据', 2: '本部门数据', 3: '本人数据', 4: '自定义' }
  return labels[scope] || scope
}

const loadData = async () => {
  try {
    const response = await getRoleList({
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      keyword: searchForm.keyword,
      status: searchForm.status
    })
    if (response.code === 200) {
      tableData.value = response.data.list || mockRoles
      total.value = response.data.total || mockRoles.length
    }
  } catch (error) {
    console.error('Failed to load roles:', error)
    tableData.value = mockRoles
    total.value = mockRoles.length
  }
}

const mockRoles = [
  { id: 1, roleCode: 'ADMIN', roleName: '超级管理员', roleKey: 'admin', roleType: 'system', dataScope: 1, status: 1, createTime: '2024-01-01 00:00:00' },
  { id: 2, roleCode: 'TENANT_ADMIN', roleName: '租户管理员', roleKey: 'tenantAdmin', roleType: 'system', dataScope: 2, status: 1, createTime: '2024-01-01 00:00:00' },
  { id: 3, roleCode: 'OPERATOR', roleName: '操作员', roleKey: 'operator', roleType: 'custom', dataScope: 3, status: 1, createTime: '2024-01-10 10:00:00' },
  { id: 4, roleCode: 'AUDITOR', roleName: '审核员', roleKey: 'auditor', roleType: 'custom', dataScope: 2, status: 0, createTime: '2024-01-11 14:30:00' },
  { id: 5, roleCode: 'VIEWER', roleName: '查看员', roleKey: 'viewer', roleType: 'custom', dataScope: 3, status: 1, createTime: '2024-01-12 09:15:00' }
]

const handleCurrentChange = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    pageNum.value = page
    loadData()
  }
}

const openCreateModal = () => {
  form.id = null
  form.roleCode = ''
  form.roleName = ''
  form.roleKey = ''
  form.roleType = 'custom'
  form.dataScope = 1
  form.status = 1
  modalVisible.value = true
}

const editRole = (row) => {
  form.id = row.id
  form.roleCode = row.roleCode
  form.roleName = row.roleName
  form.roleKey = row.roleKey
  form.roleType = row.roleType
  form.dataScope = row.dataScope
  form.status = row.status
  modalVisible.value = true
}

const closeModal = () => {
  modalVisible.value = false
}

const saveRole = async () => {
  if (!form.roleCode || !form.roleName) {
    alert('请填写必填项')
    return
  }
  
  try {
    let response
    if (form.id) {
      response = await updateRole(form.id, form)
    } else {
      response = await createRole(form)
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
    const response = await updateRole(row.id, { status: row.status === 1 ? 0 : 1 })
    if (response.code === 200) {
      alert(row.status === 1 ? '禁用成功' : '启用成功')
      loadData()
    } else {
      alert(response.message || '操作失败')
    }
  } catch (error) {
    alert('操作失败')
  }
}

const deleteRole = async (id) => {
  if (!confirm('确定要删除该角色吗？')) return
  try {
    const response = await apiDeleteRole(id)
    if (response.code === 200) {
      alert('删除成功')
      loadData()
    } else {
      alert(response.message || '删除失败')
    }
  } catch (error) {
    alert('删除失败')
  }
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
.role-list {
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

.type-badge.system {
  background: rgba(218, 54, 51, 0.1);
  color: #da3633;
}

.type-badge.custom {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
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

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
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

.action-btn.delete {
  background: rgba(218, 54, 51, 0.1);
  color: #da3633;
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

.form-input:disabled {
  background: #f8fafc;
  color: #a0aec0;
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

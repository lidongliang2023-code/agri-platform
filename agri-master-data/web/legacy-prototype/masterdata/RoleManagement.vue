<template>
  <div class="role-management">
    <div class="page-header">
      <div class="header-left">
        <h1>角色管理</h1>
        <p>管理平台角色和权限配置</p>
      </div>
      <div class="header-right">
        <button class="btn btn-primary" @click="openCreateModal">新建角色</button>
      </div>
    </div>

    <div class="filter-section">
      <div class="search-box">
        <input type="text" v-model="searchKeyword" placeholder="搜索角色名称..." class="search-input" />
        <button class="search-btn" @click="handleSearch">搜索</button>
      </div>
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>角色ID</th>
            <th>角色名称</th>
            <th>角色编码</th>
            <th>描述</th>
            <th>成员数</th>
            <th>状态</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="role in filteredRoles" :key="role.id">
            <td>{{ role.id }}</td>
            <td>{{ role.name }}</td>
            <td>{{ role.code }}</td>
            <td>{{ role.description }}</td>
            <td>{{ role.memberCount }}</td>
            <td><span :class="['status-badge', role.status]">{{ getStatusLabel(role.status) }}</span></td>
            <td>{{ role.createTime }}</td>
            <td class="action-cell">
              <button class="action-btn view" @click="viewRole(role)">查看权限</button>
              <button class="action-btn edit" @click="editRole(role)">编辑</button>
              <button class="action-btn delete" @click="deleteRole(role)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="modal-overlay" v-if="modalVisible" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ isEdit ? '编辑角色' : '新建角色' }}</h3>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>角色名称</label>
            <input type="text" v-model="formData.name" class="form-input" placeholder="请输入角色名称" />
          </div>
          <div class="form-group">
            <label>角色编码</label>
            <input type="text" v-model="formData.code" class="form-input" placeholder="请输入角色编码" />
          </div>
          <div class="form-group">
            <label>角色描述</label>
            <textarea v-model="formData.description" class="form-textarea" placeholder="请输入角色描述"></textarea>
          </div>
          <div class="form-group">
            <label>状态</label>
            <select v-model="formData.status" class="form-select">
              <option value="active">启用</option>
              <option value="inactive">禁用</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="closeModal">取消</button>
          <button class="btn btn-primary" @click="saveRole">{{ isEdit ? '保存修改' : '创建角色' }}</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" v-if="permissionVisible" @click="permissionVisible = false">
      <div class="modal-content permission-modal" @click.stop>
        <div class="modal-header">
          <h3>{{ selectedRole?.name }} - 权限配置</h3>
          <button class="close-btn" @click="permissionVisible = false">×</button>
        </div>
        <div class="modal-body" v-if="selectedRole">
          <div class="permission-tree">
            <div v-for="module in permissionModules" :key="module.id" class="permission-module">
              <div class="module-header">
                <input type="checkbox" :checked="isModuleChecked(module.id)" @change="toggleModule(module.id)" />
                <span>{{ module.name }}</span>
              </div>
              <div class="module-permissions">
                <div v-for="perm in module.permissions" :key="perm.id" class="permission-item">
                  <input type="checkbox" :checked="hasPermission(perm.id)" @change="togglePermission(perm.id)" />
                  <span>{{ perm.name }}</span>
                  <span class="perm-code">{{ perm.code }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" @click="savePermissions">保存权限</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'

const searchKeyword = ref('')
const modalVisible = ref(false)
const permissionVisible = ref(false)
const isEdit = ref(false)
const selectedRole = ref(null)

const formData = reactive({
  name: '',
  code: '',
  description: '',
  status: 'active'
})

const mockRoles = ref([
  { id: 1, name: '超级管理员', code: 'SUPER_ADMIN', description: '系统最高权限', memberCount: 1, status: 'active', createTime: '2026-01-01 09:00:00' },
  { id: 2, name: '平台管理员', code: 'PLATFORM_ADMIN', description: '平台整体运维管理', memberCount: 3, status: 'active', createTime: '2026-01-05 10:00:00' },
  { id: 3, name: '数据管理员', code: 'DATA_ADMIN', description: '主数据日常运维', memberCount: 5, status: 'active', createTime: '2026-01-10 11:00:00' },
  { id: 4, name: '业务管理员', code: 'BUSINESS_ADMIN', description: '业务模块主数据需求', memberCount: 8, status: 'active', createTime: '2026-01-15 14:00:00' },
  { id: 5, name: '普通用户', code: 'NORMAL_USER', description: '基础查询权限', memberCount: 120, status: 'active', createTime: '2026-02-01 09:00:00' },
  { id: 6, name: '只读用户', code: 'READ_ONLY_USER', description: '仅查看权限', memberCount: 50, status: 'active', createTime: '2026-02-15 10:00:00' }
])

const permissionModules = ref([
  {
    id: 'tenant',
    name: '租户管理',
    permissions: [
      { id: 'tenant:list', name: '租户列表', code: 'tenant:list' },
      { id: 'tenant:create', name: '创建租户', code: 'tenant:create' },
      { id: 'tenant:edit', name: '编辑租户', code: 'tenant:edit' },
      { id: 'tenant:delete', name: '删除租户', code: 'tenant:delete' },
      { id: 'tenant:quota', name: '配额管理', code: 'tenant:quota' }
    ]
  },
  {
    id: 'user',
    name: '用户管理',
    permissions: [
      { id: 'user:list', name: '用户列表', code: 'user:list' },
      { id: 'user:create', name: '创建用户', code: 'user:create' },
      { id: 'user:edit', name: '编辑用户', code: 'user:edit' },
      { id: 'user:delete', name: '删除用户', code: 'user:delete' },
      { id: 'user:audit', name: '认证审核', code: 'user:audit' }
    ]
  },
  {
    id: 'org',
    name: '组织管理',
    permissions: [
      { id: 'org:list', name: '组织列表', code: 'org:list' },
      { id: 'org:create', name: '创建组织', code: 'org:create' },
      { id: 'org:edit', name: '编辑组织', code: 'org:edit' },
      { id: 'org:delete', name: '删除组织', code: 'org:delete' }
    ]
  },
  {
    id: 'product',
    name: '商品管理',
    permissions: [
      { id: 'product:list', name: '商品列表', code: 'product:list' },
      { id: 'product:create', name: '创建商品', code: 'product:create' },
      { id: 'product:edit', name: '编辑商品', code: 'product:edit' },
      { id: 'product:audit', name: '商品审核', code: 'product:audit' }
    ]
  },
  {
    id: 'quality',
    name: '数据质量',
    permissions: [
      { id: 'quality:rule', name: '规则配置', code: 'quality:rule' },
      { id: 'quality:task', name: '检测任务', code: 'quality:task' },
      { id: 'quality:issue', name: '问题工单', code: 'quality:issue' },
      { id: 'quality:dashboard', name: '质量仪表盘', code: 'quality:dashboard' }
    ]
  }
])

const rolePermissions = ref({
  1: ['tenant:list', 'tenant:create', 'tenant:edit', 'tenant:delete', 'tenant:quota',
      'user:list', 'user:create', 'user:edit', 'user:delete', 'user:audit',
      'org:list', 'org:create', 'org:edit', 'org:delete',
      'product:list', 'product:create', 'product:edit', 'product:audit',
      'quality:rule', 'quality:task', 'quality:issue', 'quality:dashboard'],
  2: ['tenant:list', 'tenant:create', 'tenant:edit', 'tenant:quota',
      'user:list', 'user:create', 'user:edit',
      'org:list', 'org:create', 'org:edit'],
  3: ['user:list', 'user:audit',
      'product:list', 'product:audit',
      'quality:rule', 'quality:task', 'quality:issue', 'quality:dashboard'],
  4: ['product:list', 'product:create', 'product:edit'],
  5: ['product:list'],
  6: ['product:list']
})

const filteredRoles = computed(() => {
  return mockRoles.value.filter(role => 
    !searchKeyword.value || 
    role.name.includes(searchKeyword.value) ||
    role.code.includes(searchKeyword.value)
  )
})

const getStatusLabel = (status) => {
  return status === 'active' ? '启用' : '禁用'
}

const handleSearch = () => {}

const openCreateModal = () => {
  isEdit.value = false
  formData.name = ''
  formData.code = ''
  formData.description = ''
  formData.status = 'active'
  modalVisible.value = true
}

const editRole = (role) => {
  isEdit.value = true
  formData.name = role.name
  formData.code = role.code
  formData.description = role.description
  formData.status = role.status
  selectedRole.value = role
  modalVisible.value = true
}

const viewRole = (role) => {
  selectedRole.value = role
  permissionVisible.value = true
}

const deleteRole = (role) => {
  if (confirm(`确定要删除角色 ${role.name} 吗？`)) {
    const index = mockRoles.value.findIndex(r => r.id === role.id)
    if (index > -1) {
      mockRoles.value.splice(index, 1)
    }
  }
}

const saveRole = () => {
  if (!formData.name || !formData.code) {
    alert('请填写必填字段')
    return
  }
  if (isEdit.value) {
    const role = mockRoles.value.find(r => r.id === selectedRole.value.id)
    if (role) {
      role.name = formData.name
      role.code = formData.code
      role.description = formData.description
      role.status = formData.status
    }
    alert('角色信息已更新')
  } else {
    const newRole = {
      id: Date.now(),
      name: formData.name,
      code: formData.code,
      description: formData.description,
      memberCount: 0,
      status: formData.status,
      createTime: new Date().toLocaleString()
    }
    mockRoles.value.push(newRole)
    alert('角色创建成功')
  }
  closeModal()
}

const closeModal = () => {
  modalVisible.value = false
  selectedRole.value = null
}

const hasPermission = (permId) => {
  if (!selectedRole.value) return false
  const perms = rolePermissions.value[selectedRole.value.id] || []
  return perms.includes(permId)
}

const isModuleChecked = (moduleId) => {
  if (!selectedRole.value) return false
  const module = permissionModules.value.find(m => m.id === moduleId)
  if (!module) return false
  const perms = rolePermissions.value[selectedRole.value.id] || []
  return module.permissions.every(p => perms.includes(p.id))
}

const toggleModule = (moduleId) => {
  if (!selectedRole.value) return
  const module = permissionModules.value.find(m => m.id === moduleId)
  if (!module) return
  const perms = rolePermissions.value[selectedRole.value.id] || []
  const modulePermIds = module.permissions.map(p => p.id)
  const allChecked = modulePermIds.every(p => perms.includes(p))
  
  if (allChecked) {
    modulePermIds.forEach(permId => {
      const index = perms.indexOf(permId)
      if (index > -1) perms.splice(index, 1)
    })
  } else {
    modulePermIds.forEach(permId => {
      if (!perms.includes(permId)) {
        perms.push(permId)
      }
    })
  }
}

const togglePermission = (permId) => {
  if (!selectedRole.value) return
  const perms = rolePermissions.value[selectedRole.value.id] || []
  const index = perms.indexOf(permId)
  if (index > -1) {
    perms.splice(index, 1)
  } else {
    perms.push(permId)
  }
}

const savePermissions = () => {
  alert('权限配置已保存')
  permissionVisible.value = false
}

onMounted(() => {})
</script>

<style scoped>
.role-management {
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
  margin-bottom: 20px;
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

.permission-modal {
  width: 700px;
  max-height: 80vh;
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
  overflow-y: auto;
  max-height: 60vh;
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

.form-textarea {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  min-height: 80px;
  resize: vertical;
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

.permission-tree {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.permission-module {
  background: #f8fafc;
  border-radius: 8px;
  overflow: hidden;
}

.module-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: #fff;
  font-weight: 500;
  color: #2d3748;
}

.module-header input {
  width: 18px;
  height: 18px;
}

.module-permissions {
  padding: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.permission-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #fff;
  border-radius: 6px;
}

.permission-item input {
  width: 16px;
  height: 16px;
}

.permission-item span:first-of-type {
  font-size: 13px;
  color: #2d3748;
}

.perm-code {
  font-size: 11px;
  color: #a0aec0;
  font-family: monospace;
}
</style>
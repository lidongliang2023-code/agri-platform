<template>
  <div class="tenant-list">
    <div class="page-header">
      <div class="header-left">
        <h1>租户管理</h1>
        <p>管理租户信息与配置</p>
      </div>
      <button class="add-btn" @click="showAddModal = true">
        <span class="btn-icon">+</span>
        <span>新增租户</span>
      </button>
    </div>

    <div class="search-bar">
      <div class="search-group">
        <input 
          type="text" 
          v-model="searchForm.keyword" 
          placeholder="搜索租户名称..." 
          class="search-input"
        />
        <button class="search-btn" @click="handleSearch">搜索</button>
      </div>
      <div class="filter-group">
        <select v-model="searchForm.status" class="filter-select">
          <option value="">全部状态</option>
          <option value="ACTIVE">启用</option>
          <option value="INACTIVE">禁用</option>
        </select>
      </div>
    </div>

    <div class="stats-row">
      <div class="stat-item">
        <span class="stat-num">{{ totalCount }}</span>
        <span class="stat-text">租户总数</span>
      </div>
      <div class="stat-item active">
        <span class="stat-num">{{ activeCount }}</span>
        <span class="stat-text">启用中</span>
      </div>
      <div class="stat-item inactive">
        <span class="stat-num">{{ inactiveCount }}</span>
        <span class="stat-text">已禁用</span>
      </div>
    </div>

    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>租户名称</th>
            <th>租户编码</th>
            <th>联系人</th>
            <th>联系电话</th>
            <th>状态</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tenant in tenantList" :key="tenant.id">
            <td class="name-cell">
              <span class="tenant-icon">🏢</span>
              <span class="tenant-name">{{ tenant.name }}</span>
            </td>
            <td>{{ tenant.code }}</td>
            <td>{{ tenant.contactPerson }}</td>
            <td>{{ tenant.contactPhone }}</td>
            <td>
              <span class="status-badge" :class="tenant.status.toLowerCase()">
                {{ tenant.status === 'ACTIVE' ? '启用' : '禁用' }}
              </span>
            </td>
            <td>{{ formatDate(tenant.createdAt) }}</td>
            <td class="action-cell">
              <button class="action-btn view" @click="viewTenant(tenant)">查看</button>
              <button class="action-btn edit" @click="editTenant(tenant)">编辑</button>
              <button 
                class="action-btn"
                :class="tenant.status === 'ACTIVE' ? 'disable' : 'enable'"
                @click="toggleTenantStatus(tenant)"
              >
                {{ tenant.status === 'ACTIVE' ? '禁用' : '启用' }}
              </button>
              <button 
                class="action-btn delete" 
                @click="deleteTenant(tenant.id)"
                v-if="tenant.status === 'INACTIVE'"
              >
                删除
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="pagination">
        <button class="page-btn" :disabled="currentPage === 1" @click="prevPage">上一页</button>
        <span class="page-info">第 {{ currentPage }} / {{ totalPages }} 页</span>
        <button class="page-btn" :disabled="currentPage === totalPages" @click="nextPage">下一页</button>
      </div>
    </div>

    <div class="modal-overlay" v-if="showAddModal" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ form.id ? '编辑租户' : '新增租户' }}</h3>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>租户名称 *</label>
            <input type="text" v-model="form.name" placeholder="请输入租户名称" class="form-input" />
          </div>
          <div class="form-group">
            <label>租户编码 *</label>
            <input type="text" v-model="form.code" placeholder="请输入租户编码" class="form-input" :disabled="form.id" />
          </div>
          <div class="form-group">
            <label>联系人</label>
            <input type="text" v-model="form.contactPerson" placeholder="请输入联系人" class="form-input" />
          </div>
          <div class="form-group">
            <label>联系电话</label>
            <input type="text" v-model="form.contactPhone" placeholder="请输入联系电话" class="form-input" />
          </div>
          <div class="form-group">
            <label>状态</label>
            <select v-model="form.status" class="form-select">
              <option value="ACTIVE">启用</option>
              <option value="INACTIVE">禁用</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="closeModal">取消</button>
          <button class="btn btn-primary" @click="handleAdd">确认{{ form.id ? '修改' : '添加' }}</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" v-if="showDetailModal" @click="showDetailModal = false">
      <div class="modal-content detail-modal" @click.stop>
        <div class="modal-header">
          <h3>租户详情</h3>
          <button class="close-btn" @click="showDetailModal = false">×</button>
        </div>
        <div class="modal-body" v-if="selectedTenant">
          <div class="detail-row">
            <span class="detail-label">租户名称</span>
            <span class="detail-value">{{ selectedTenant.name }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">租户编码</span>
            <span class="detail-value">{{ selectedTenant.code }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">联系人</span>
            <span class="detail-value">{{ selectedTenant.contactPerson }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">联系电话</span>
            <span class="detail-value">{{ selectedTenant.contactPhone }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">状态</span>
            <span class="status-badge" :class="selectedTenant.status.toLowerCase()">
              {{ selectedTenant.status === 'ACTIVE' ? '启用' : '禁用' }}
            </span>
          </div>
          <div class="detail-row">
            <span class="detail-label">创建时间</span>
            <span class="detail-value">{{ formatDate(selectedTenant.createdAt) }}</span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" @click="showDetailModal = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { getTenantList, createTenant, updateTenant, deleteTenant as apiDeleteTenant, updateTenantStatus } from '../../utils/api'

const searchForm = reactive({
  keyword: '',
  status: ''
})

const tenantList = ref([])
const currentPage = ref(1)
const totalCount = ref(0)
const totalPages = ref(1)

const activeCount = ref(0)
const inactiveCount = ref(0)

const showAddModal = ref(false)
const showDetailModal = ref(false)
const selectedTenant = ref(null)

const form = reactive({
  id: null,
  name: '',
  code: '',
  contactPerson: '',
  contactPhone: '',
  status: 'ACTIVE'
})

onMounted(() => {
  loadTenants()
})

const loadTenants = async () => {
  try {
    const response = await getTenantList({
      page: currentPage.value,
      size: 10,
      keyword: searchForm.keyword,
      status: searchForm.status
    })
    if (response.code === 200) {
      tenantList.value = response.data.list || mockTenants
      totalCount.value = response.data.total || mockTenants.length
      totalPages.value = Math.ceil(totalCount.value / 10)
      
      activeCount.value = tenantList.value.filter(t => t.status === 'ACTIVE').length
      inactiveCount.value = tenantList.value.filter(t => t.status === 'INACTIVE').length
    }
  } catch (error) {
    console.error('Failed to load tenants:', error)
    tenantList.value = mockTenants
    totalCount.value = mockTenants.length
    activeCount.value = mockTenants.filter(t => t.status === 'ACTIVE').length
    inactiveCount.value = mockTenants.filter(t => t.status === 'INACTIVE').length
  }
}

const mockTenants = [
  { id: 1, name: '阳光农场', code: 'TENANT001', contactPerson: '张三', contactPhone: '13800138001', status: 'ACTIVE', createdAt: '2024-01-15 10:30:00' },
  { id: 2, name: '绿色果园', code: 'TENANT002', contactPerson: '李四', contactPhone: '13800138002', status: 'ACTIVE', createdAt: '2024-01-16 14:20:00' },
  { id: 3, name: '生态农庄', code: 'TENANT003', contactPerson: '王五', contactPhone: '13800138003', status: 'INACTIVE', createdAt: '2024-01-17 09:15:00' },
  { id: 4, name: '现代农业园', code: 'TENANT004', contactPerson: '赵六', contactPhone: '13800138004', status: 'ACTIVE', createdAt: '2024-01-18 16:45:00' },
  { id: 5, name: '丰收农场', code: 'TENANT005', contactPerson: '钱七', contactPhone: '13800138005', status: 'ACTIVE', createdAt: '2024-01-19 11:00:00' }
]

const handleSearch = () => {
  currentPage.value = 1
  loadTenants()
}

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
    loadTenants()
  }
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    loadTenants()
  }
}

const viewTenant = (tenant) => {
  selectedTenant.value = tenant
  showDetailModal.value = true
}

const editTenant = (tenant) => {
  Object.assign(form, tenant)
  showAddModal.value = true
}

const closeModal = () => {
  showAddModal.value = false
  form.id = null
  form.name = ''
  form.code = ''
  form.contactPerson = ''
  form.contactPhone = ''
  form.status = 'ACTIVE'
}

const handleAdd = async () => {
  if (!form.name || !form.code) {
    alert('请填写必填项')
    return
  }
  
  try {
    let response
    if (form.id) {
      response = await updateTenant(form.id, form)
    } else {
      response = await createTenant(form)
    }
    if (response.code === 200) {
      alert(form.id ? '修改成功' : '创建成功')
      closeModal()
      loadTenants()
    } else {
      alert(response.message || '操作失败')
    }
  } catch (error) {
    alert('操作失败')
  }
}

const toggleTenantStatus = async (tenant) => {
  try {
    const response = await updateTenantStatus(tenant.id, tenant.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')
    if (response.code === 200) {
      alert(tenant.status === 'ACTIVE' ? '禁用成功' : '启用成功')
      loadTenants()
    } else {
      alert(response.message || '操作失败')
    }
  } catch (error) {
    alert('操作失败')
  }
}

const deleteTenant = async (id) => {
  if (!confirm('确定要删除该租户吗？')) return
  try {
    const response = await apiDeleteTenant(id)
    if (response.code === 200) {
      alert('删除成功')
      loadTenants()
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
</script>

<style scoped>
.tenant-list {
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
  transition: all 0.2s;
}

.search-btn:hover {
  background: rgba(35, 134, 54, 0.1);
}

.filter-group {
  display: flex;
  align-items: center;
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

.stats-row {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}

.stat-item {
  flex: 1;
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.stat-item.active {
  border-left: 4px solid #238636;
}

.stat-item.inactive {
  border-left: 4px solid #a0aec0;
}

.stat-num {
  font-size: 28px;
  font-weight: 700;
  color: #2d3748;
}

.stat-text {
  font-size: 13px;
  color: #a0aec0;
  margin-top: 4px;
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

.name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tenant-icon {
  font-size: 18px;
}

.tenant-name {
  font-weight: 500;
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

.action-btn.delete {
  background: rgba(218, 54, 51, 0.1);
  color: #da3633;
}

.action-btn:hover {
  opacity: 0.8;
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
  transition: all 0.2s;
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
  padding: 0;
  line-height: 1;
}

.close-btn:hover {
  color: #2d3748;
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
  transition: border-color 0.2s;
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
  outline: none;
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
  transition: all 0.2s;
  border: none;
}

.btn-cancel {
  background: #f0f0f0;
  color: #4a5568;
}

.btn-cancel:hover {
  background: #e2e8f0;
}

.btn-primary {
  background: linear-gradient(135deg, #238636 0%, #2ea043 100%);
  color: #fff;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(35, 134, 54, 0.3);
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  font-size: 13px;
  color: #a0aec0;
}

.detail-value {
  font-size: 13px;
  color: #2d3748;
  font-weight: 500;
}
</style>

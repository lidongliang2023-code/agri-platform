<template>
  <div class="tenant-quota">
    <div class="page-header">
      <div class="header-left">
        <h1>租户配额管理</h1>
        <p>管理租户资源配额配置</p>
      </div>
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
    </div>

    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>租户名称</th>
            <th>租户类型</th>
            <th>用户配额</th>
            <th>组织配额</th>
            <th>商品配额</th>
            <th>存储配额</th>
            <th>API配额</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tenant in tenantList" :key="tenant.id">
            <td class="name-cell">
              <span class="tenant-icon">🏢</span>
              <span class="tenant-name">{{ tenant.name }}</span>
            </td>
            <td>{{ tenant.type === 'ENTERPRISE' ? '企业租户' : '个人租户' }}</td>
            <td>
              <div class="quota-bar">
                <div class="quota-fill" :style="{width: tenant.userUsagePercent + '%'}"></div>
              </div>
              <span class="quota-text">{{ tenant.userUsed }} / {{ tenant.userLimit }}</span>
            </td>
            <td>
              <div class="quota-bar">
                <div class="quota-fill" :style="{width: tenant.orgUsagePercent + '%'}"></div>
              </div>
              <span class="quota-text">{{ tenant.orgUsed }} / {{ tenant.orgLimit }}</span>
            </td>
            <td>
              <div class="quota-bar">
                <div class="quota-fill" :style="{width: tenant.productUsagePercent + '%'}"></div>
              </div>
              <span class="quota-text">{{ tenant.productUsed }} / {{ tenant.productLimit }}</span>
            </td>
            <td>
              <div class="quota-bar">
                <div class="quota-fill" :style="{width: tenant.storageUsagePercent + '%'}"></div>
              </div>
              <span class="quota-text">{{ tenant.storageUsed }}GB / {{ tenant.storageLimit }}GB</span>
            </td>
            <td>
              <div class="quota-bar">
                <div class="quota-fill" :style="{width: tenant.apiUsagePercent + '%'}"></div>
              </div>
              <span class="quota-text">{{ tenant.apiUsed }} / {{ tenant.apiLimit }}</span>
            </td>
            <td class="action-cell">
              <button class="action-btn edit" @click="editQuota(tenant)">编辑配额</button>
              <button class="action-btn" @click="viewQuotaDetail(tenant)">查看详情</button>
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

    <div class="modal-overlay" v-if="showEditModal" @click="closeEditModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>编辑租户配额</h3>
          <button class="close-btn" @click="closeEditModal">×</button>
        </div>
        <div class="modal-body" v-if="editForm">
          <div class="form-group">
            <label>租户名称</label>
            <input type="text" :value="editForm.name" disabled class="form-input" />
          </div>
          <div class="form-group">
            <label>用户配额</label>
            <input type="number" v-model="editForm.userLimit" class="form-input" />
          </div>
          <div class="form-group">
            <label>组织配额</label>
            <input type="number" v-model="editForm.orgLimit" class="form-input" />
          </div>
          <div class="form-group">
            <label>商品配额</label>
            <input type="number" v-model="editForm.productLimit" class="form-input" />
          </div>
          <div class="form-group">
            <label>存储配额(GB)</label>
            <input type="number" v-model="editForm.storageLimit" class="form-input" />
          </div>
          <div class="form-group">
            <label>API配额(次/日)</label>
            <input type="number" v-model="editForm.apiLimit" class="form-input" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="closeEditModal">取消</button>
          <button class="btn btn-primary" @click="saveQuota">保存配置</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'

const searchForm = reactive({
  keyword: ''
})

const tenantList = ref([])
const currentPage = ref(1)
const totalCount = ref(0)
const totalPages = ref(1)

const showEditModal = ref(false)
const editForm = reactive({
  id: null,
  name: '',
  userLimit: 0,
  orgLimit: 0,
  productLimit: 0,
  storageLimit: 0,
  apiLimit: 0
})

const mockTenants = [
  { id: 1, name: '阳光农业集团', type: 'ENTERPRISE', userUsed: 1256, userLimit: 2000, orgUsed: 56, orgLimit: 100, productUsed: 3500, productLimit: 5000, storageUsed: 45.6, storageLimit: 100, apiUsed: 12345, apiLimit: 100000 },
  { id: 2, name: '绿野生态科技', type: 'ENTERPRISE', userUsed: 986, userLimit: 2000, orgUsed: 32, orgLimit: 100, productUsed: 2800, productLimit: 5000, storageUsed: 32.8, storageLimit: 100, apiUsed: 8567, apiLimit: 100000 },
  { id: 3, name: '丰收供应链', type: 'ENTERPRISE', userUsed: 856, userLimit: 1000, orgUsed: 28, orgLimit: 50, productUsed: 1500, productLimit: 2000, storageUsed: 18.5, storageLimit: 50, apiUsed: 6234, apiLimit: 50000 },
  { id: 4, name: '农资经销商001', type: 'PERSONAL', userUsed: 156, userLimit: 50, orgUsed: 3, orgLimit: 5, productUsed: 200, productLimit: 500, storageUsed: 5.2, storageLimit: 10, apiUsed: 1234, apiLimit: 10000 },
  { id: 5, name: '个体农户老李', type: 'PERSONAL', userUsed: 56, userLimit: 50, orgUsed: 1, orgLimit: 5, productUsed: 80, productLimit: 500, storageUsed: 2.1, storageLimit: 10, apiUsed: 856, apiLimit: 10000 }
]

const calculateUsagePercent = (used, limit) => {
  if (limit === 0) return 0
  return Math.min((used / limit) * 100, 100)
}

const loadTenants = () => {
  tenantList.value = mockTenants.map(t => ({
    ...t,
    userUsagePercent: calculateUsagePercent(t.userUsed, t.userLimit),
    orgUsagePercent: calculateUsagePercent(t.orgUsed, t.orgLimit),
    productUsagePercent: calculateUsagePercent(t.productUsed, t.productLimit),
    storageUsagePercent: calculateUsagePercent(t.storageUsed, t.storageLimit),
    apiUsagePercent: calculateUsagePercent(t.apiUsed, t.apiLimit)
  }))
  totalCount.value = tenantList.value.length
  totalPages.value = Math.ceil(totalCount.value / 10)
}

onMounted(() => {
  loadTenants()
})

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

const editQuota = (tenant) => {
  Object.assign(editForm, {
    id: tenant.id,
    name: tenant.name,
    userLimit: tenant.userLimit,
    orgLimit: tenant.orgLimit,
    productLimit: tenant.productLimit,
    storageLimit: tenant.storageLimit,
    apiLimit: tenant.apiLimit
  })
  showEditModal.value = true
}

const closeEditModal = () => {
  showEditModal.value = false
  Object.keys(editForm).forEach(key => editForm[key] = null)
}

const saveQuota = () => {
  alert('配额配置已更新')
  closeEditModal()
  loadTenants()
}

const viewQuotaDetail = (tenant) => {
  alert(`查看租户 ${tenant.name} 的配额详情`)
}
</script>

<style scoped>
.tenant-quota {
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

.quota-bar {
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 4px;
}

.quota-fill {
  height: 100%;
  background: linear-gradient(90deg, #238636, #2ea043);
  border-radius: 4px;
  transition: width 0.3s;
}

.quota-text {
  font-size: 12px;
  color: #718096;
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

.action-btn.edit {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
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
</style>
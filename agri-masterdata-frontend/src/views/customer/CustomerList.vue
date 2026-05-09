<template>
  <div class="customer-list">
    <div class="page-header">
      <div class="header-left">
        <h1>客户管理</h1>
        <p>管理客户信息与配置</p>
      </div>
      <button class="add-btn" @click="openCreateModal">
        <span class="btn-icon">+</span>
        <span>新增客户</span>
      </button>
    </div>

    <div class="search-bar">
      <div class="search-group">
        <input 
          type="text" 
          v-model="searchForm.keyword" 
          placeholder="客户名称/编码/联系人..." 
          class="search-input"
        />
        <button class="search-btn" @click="loadData">搜索</button>
      </div>
      <div class="filter-group">
        <select v-model="searchForm.customerType" class="filter-select">
          <option value="">全部类型</option>
          <option value="enterprise">企业客户</option>
          <option value="individual">个人客户</option>
        </select>
        <select v-model="searchForm.status" class="filter-select">
          <option value="">全部状态</option>
          <option value="1">正常</option>
          <option value="0">禁用</option>
        </select>
      </div>
    </div>

    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>客户编码</th>
            <th>客户名称</th>
            <th>客户类型</th>
            <th>联系人</th>
            <th>联系电话</th>
            <th>邮箱</th>
            <th>地址</th>
            <th>状态</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="customer in tableData" :key="customer.id">
            <td>{{ customer.customerCode }}</td>
            <td>{{ customer.customerName }}</td>
            <td>
              <span class="type-badge" :class="customer.customerType">
                {{ customer.customerType === 'enterprise' ? '企业客户' : '个人客户' }}
              </span>
            </td>
            <td>{{ customer.contactPerson }}</td>
            <td>{{ customer.contactPhone }}</td>
            <td>{{ customer.email }}</td>
            <td class="address-cell">{{ customer.address }}</td>
            <td>
              <span class="status-badge" :class="customer.status === 1 ? 'active' : 'inactive'">
                {{ customer.status === 1 ? '正常' : '禁用' }}
              </span>
            </td>
            <td>{{ formatDate(customer.createTime) }}</td>
            <td class="action-cell">
              <button class="action-btn view" @click="viewDetail(customer.id)">详情</button>
              <button class="action-btn edit" @click="editCustomer(customer)">编辑</button>
              <button 
                class="action-btn"
                :class="customer.status === 1 ? 'disable' : 'enable'"
                @click="toggleStatus(customer)"
              >
                {{ customer.status === 1 ? '禁用' : '启用' }}
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
          <h3>{{ form.id ? '编辑客户' : '新增客户' }}</h3>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>客户编码 *</label>
            <input type="text" v-model="form.customerCode" placeholder="请输入客户编码" class="form-input" :disabled="form.id" />
          </div>
          <div class="form-group">
            <label>客户名称 *</label>
            <input type="text" v-model="form.customerName" placeholder="请输入客户名称" class="form-input" />
          </div>
          <div class="form-group">
            <label>客户类型</label>
            <select v-model="form.customerType" class="form-select">
              <option value="enterprise">企业客户</option>
              <option value="individual">个人客户</option>
            </select>
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
            <label>邮箱</label>
            <input type="text" v-model="form.email" placeholder="请输入邮箱" class="form-input" />
          </div>
          <div class="form-group">
            <label>地址</label>
            <textarea v-model="form.address" placeholder="请输入地址" class="form-textarea"></textarea>
          </div>
          <div class="form-group">
            <label>状态</label>
            <select v-model="form.status" class="form-select">
              <option :value="1">正常</option>
              <option :value="0">禁用</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="closeModal">取消</button>
          <button class="btn btn-primary" @click="saveCustomer">确认{{ form.id ? '修改' : '添加' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { getCustomerList, createCustomer, updateCustomer } from '../../utils/api'

const tableData = ref([])
const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(0)
const modalVisible = ref(false)

const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

const searchForm = reactive({
  keyword: '',
  customerType: '',
  status: ''
})

const form = reactive({
  id: null,
  customerCode: '',
  customerName: '',
  customerType: 'enterprise',
  contactPerson: '',
  contactPhone: '',
  email: '',
  address: '',
  status: 1
})

const loadData = async () => {
  try {
    const response = await getCustomerList({
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      keyword: searchForm.keyword,
      customerType: searchForm.customerType,
      status: searchForm.status
    })
    if (response.code === 200) {
      tableData.value = response.data.list || mockCustomers
      total.value = response.data.total || mockCustomers.length
    }
  } catch (error) {
    console.error('Failed to load customers:', error)
    tableData.value = mockCustomers
    total.value = mockCustomers.length
  }
}

const mockCustomers = [
  { id: 1, customerCode: 'C001', customerName: '阳光超市', customerType: 'enterprise', contactPerson: '张三', contactPhone: '13800138001', email: 'zhang@sunny.com', address: '北京市朝阳区xxx路', status: 1, createTime: '2024-01-10 10:00:00' },
  { id: 2, customerCode: 'C002', customerName: '李四', customerType: 'individual', contactPerson: '李四', contactPhone: '13800138002', email: 'li@test.com', address: '上海市浦东新区xxx号', status: 1, createTime: '2024-01-11 14:30:00' },
  { id: 3, customerCode: 'C003', customerName: '绿色食品公司', customerType: 'enterprise', contactPerson: '王五', contactPhone: '13800138003', email: 'wang@green.com', address: '广东省广州市xxx区', status: 0, createTime: '2024-01-12 09:15:00' },
  { id: 4, customerCode: 'C004', customerName: '赵六', customerType: 'individual', contactPerson: '赵六', contactPhone: '13800138004', email: 'zhao@test.com', address: '江苏省南京市xxx街', status: 1, createTime: '2024-01-13 16:45:00' },
  { id: 5, customerCode: 'C005', customerName: '农产品批发中心', customerType: 'enterprise', contactPerson: '钱七', contactPhone: '13800138005', email: 'qian@wholesale.com', address: '浙江省杭州市xxx路', status: 1, createTime: '2024-01-14 11:20:00' }
]

const handleCurrentChange = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    pageNum.value = page
    loadData()
  }
}

const openCreateModal = () => {
  form.id = null
  form.customerCode = ''
  form.customerName = ''
  form.customerType = 'enterprise'
  form.contactPerson = ''
  form.contactPhone = ''
  form.email = ''
  form.address = ''
  form.status = 1
  modalVisible.value = true
}

const editCustomer = (row) => {
  form.id = row.id
  form.customerCode = row.customerCode
  form.customerName = row.customerName
  form.customerType = row.customerType
  form.contactPerson = row.contactPerson
  form.contactPhone = row.contactPhone
  form.email = row.email
  form.address = row.address
  form.status = row.status
  modalVisible.value = true
}

const closeModal = () => {
  modalVisible.value = false
}

const saveCustomer = async () => {
  if (!form.customerCode || !form.customerName) {
    alert('请填写必填项')
    return
  }
  
  try {
    let response
    if (form.id) {
      response = await updateCustomer(form.id, form)
    } else {
      response = await createCustomer(form)
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
    const response = await updateCustomer(row.id, { status: row.status === 1 ? 0 : 1 })
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

const viewDetail = (id) => {
  alert(`查看客户详情: ${id}`)
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
.customer-list {
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

.address-cell {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  box-sizing: border-box;
}

.form-input:focus {
  border-color: #238636;
}

.form-input:disabled {
  background: #f8fafc;
  color: #a0aec0;
}

.form-textarea {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
  min-height: 80px;
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
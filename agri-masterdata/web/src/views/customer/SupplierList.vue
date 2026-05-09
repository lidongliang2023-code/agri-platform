<template>
  <div class="supplier-list">
    <div class="page-header">
      <div class="header-left">
        <h1>供应商管理</h1>
        <p>管理供应商信息与配置</p>
      </div>
      <button class="add-btn" @click="openCreateModal">
        <span class="btn-icon">+</span>
        <span>新增供应商</span>
      </button>
    </div>

    <div class="search-bar">
      <div class="search-group">
        <input 
          type="text" 
          v-model="searchForm.keyword" 
          placeholder="供应商名称/编码/联系人..." 
          class="search-input"
        />
        <button class="search-btn" @click="loadData">搜索</button>
      </div>
      <div class="filter-group">
        <select v-model="searchForm.supplierType" class="filter-select">
          <option value="">全部类型</option>
          <option value="manufacturer">生产厂家</option>
          <option value="dealer">经销商</option>
          <option value="agent">代理商</option>
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
            <th>供应商编码</th>
            <th>供应商名称</th>
            <th>供应商类型</th>
            <th>联系人</th>
            <th>联系电话</th>
            <th>营业执照</th>
            <th>地址</th>
            <th>状态</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="supplier in tableData" :key="supplier.id">
            <td>{{ supplier.supplierCode }}</td>
            <td>{{ supplier.supplierName }}</td>
            <td>
              <span class="type-badge" :class="supplier.supplierType">
                {{ getTypeLabel(supplier.supplierType) }}
              </span>
            </td>
            <td>{{ supplier.contactPerson }}</td>
            <td>{{ supplier.contactPhone }}</td>
            <td>{{ supplier.businessLicense }}</td>
            <td class="address-cell">{{ supplier.address }}</td>
            <td>
              <span class="status-badge" :class="supplier.status === 1 ? 'active' : 'inactive'">
                {{ supplier.status === 1 ? '正常' : '禁用' }}
              </span>
            </td>
            <td>{{ formatDate(supplier.createTime) }}</td>
            <td class="action-cell">
              <button class="action-btn view" @click="viewDetail(supplier.id)">详情</button>
              <button class="action-btn edit" @click="editSupplier(supplier)">编辑</button>
              <button 
                class="action-btn"
                :class="supplier.status === 1 ? 'disable' : 'enable'"
                @click="toggleStatus(supplier)"
              >
                {{ supplier.status === 1 ? '禁用' : '启用' }}
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
          <h3>{{ form.id ? '编辑供应商' : '新增供应商' }}</h3>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>供应商编码 *</label>
            <input type="text" v-model="form.supplierCode" placeholder="请输入供应商编码" class="form-input" :disabled="form.id" />
          </div>
          <div class="form-group">
            <label>供应商名称 *</label>
            <input type="text" v-model="form.supplierName" placeholder="请输入供应商名称" class="form-input" />
          </div>
          <div class="form-group">
            <label>供应商类型</label>
            <select v-model="form.supplierType" class="form-select">
              <option value="manufacturer">生产厂家</option>
              <option value="dealer">经销商</option>
              <option value="agent">代理商</option>
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
            <label>营业执照</label>
            <input type="text" v-model="form.businessLicense" placeholder="请输入营业执照号" class="form-input" />
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
          <button class="btn btn-primary" @click="saveSupplier">确认{{ form.id ? '修改' : '添加' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { getSupplierList, createSupplier, updateSupplier } from '../../utils/api'

const tableData = ref([])
const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(0)
const modalVisible = ref(false)

const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

const searchForm = reactive({
  keyword: '',
  supplierType: '',
  status: ''
})

const form = reactive({
  id: null,
  supplierCode: '',
  supplierName: '',
  supplierType: 'manufacturer',
  contactPerson: '',
  contactPhone: '',
  businessLicense: '',
  address: '',
  status: 1
})

const getTypeLabel = (type) => {
  const labels = { manufacturer: '生产厂家', dealer: '经销商', agent: '代理商' }
  return labels[type] || type
}

const loadData = async () => {
  try {
    const response = await getSupplierList({
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      keyword: searchForm.keyword,
      supplierType: searchForm.supplierType,
      status: searchForm.status
    })
    if (response.code === 200) {
      tableData.value = response.data.list || mockSuppliers
      total.value = response.data.total || mockSuppliers.length
    }
  } catch (error) {
    console.error('Failed to load suppliers:', error)
    tableData.value = mockSuppliers
    total.value = mockSuppliers.length
  }
}

const mockSuppliers = [
  { id: 1, supplierCode: 'S001', supplierName: '农丰化肥厂', supplierType: 'manufacturer', contactPerson: '张三', contactPhone: '13800138001', businessLicense: '91110105XXXXXXXXX', address: '山东省济南市xxx区', status: 1, createTime: '2024-01-10 10:00:00' },
  { id: 2, supplierCode: 'S002', supplierName: '绿色农资经销', supplierType: 'dealer', contactPerson: '李四', contactPhone: '13800138002', businessLicense: '91110106XXXXXXXXX', address: '河南省郑州市xxx路', status: 1, createTime: '2024-01-11 14:30:00' },
  { id: 3, supplierCode: 'S003', supplierName: '华南总代理', supplierType: 'agent', contactPerson: '王五', contactPhone: '13800138003', businessLicense: '91110107XXXXXXXXX', address: '广东省广州市xxx街', status: 0, createTime: '2024-01-12 09:15:00' },
  { id: 4, supplierCode: 'S004', supplierName: '有机食品加工厂', supplierType: 'manufacturer', contactPerson: '赵六', contactPhone: '13800138004', businessLicense: '91110108XXXXXXXXX', address: '四川省成都市xxx园区', status: 1, createTime: '2024-01-13 16:45:00' },
  { id: 5, supplierCode: 'S005', supplierName: '农资批发中心', supplierType: 'dealer', contactPerson: '钱七', contactPhone: '13800138005', businessLicense: '91110109XXXXXXXXX', address: '浙江省杭州市xxx路', status: 1, createTime: '2024-01-14 11:20:00' }
]

const handleCurrentChange = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    pageNum.value = page
    loadData()
  }
}

const openCreateModal = () => {
  form.id = null
  form.supplierCode = ''
  form.supplierName = ''
  form.supplierType = 'manufacturer'
  form.contactPerson = ''
  form.contactPhone = ''
  form.businessLicense = ''
  form.address = ''
  form.status = 1
  modalVisible.value = true
}

const editSupplier = (row) => {
  form.id = row.id
  form.supplierCode = row.supplierCode
  form.supplierName = row.supplierName
  form.supplierType = row.supplierType
  form.contactPerson = row.contactPerson
  form.contactPhone = row.contactPhone
  form.businessLicense = row.businessLicense
  form.address = row.address
  form.status = row.status
  modalVisible.value = true
}

const closeModal = () => {
  modalVisible.value = false
}

const saveSupplier = async () => {
  if (!form.supplierCode || !form.supplierName) {
    alert('请填写必填项')
    return
  }
  
  try {
    let response
    if (form.id) {
      response = await updateSupplier(form.id, form)
    } else {
      response = await createSupplier(form)
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
    const response = await updateSupplier(row.id, { status: row.status === 1 ? 0 : 1 })
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
  alert(`查看供应商详情: ${id}`)
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
.supplier-list {
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

.type-badge.manufacturer {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.type-badge.dealer {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.type-badge.agent {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
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
<template>
  <div class="cs-management">
    <div class="page-header">
      <div class="header-left">
        <h1>客户供应商管理</h1>
        <p>管理客户和供应商档案信息</p>
      </div>
      <div class="header-right">
        <button class="btn btn-primary" @click="openCreateModal">{{ activeTab === 'customer' ? '新建客户' : '新建供应商' }}</button>
      </div>
    </div>

    <div class="tab-section">
      <button 
        v-for="tab in tabs" 
        :key="tab.key"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
        <span class="tab-count">{{ tab.count }}</span>
      </button>
    </div>

    <div class="filter-section">
      <div class="search-box">
        <select v-model="searchType" class="search-select">
          <option value="name">名称</option>
          <option value="code">编码</option>
          <option value="contact">联系人</option>
          <option value="phone">电话</option>
        </select>
        <input type="text" v-model="searchKeyword" placeholder="搜索关键词..." class="search-input" />
        <button class="search-btn" @click="handleSearch">搜索</button>
      </div>
      <div class="filter-group">
        <select v-model="statusFilter" class="filter-select">
          <option value="">全部状态</option>
          <option value="active">启用</option>
          <option value="inactive">禁用</option>
        </select>
        <select v-model="typeFilter" class="filter-select">
          <option value="">全部类型</option>
          <option v-for="type in currentTypes" :key="type.value" :value="type.value">{{ type.label }}</option>
        </select>
      </div>
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>编码</th>
            <th>名称</th>
            <th>类型</th>
            <th>联系人</th>
            <th>电话</th>
            <th>邮箱</th>
            <th>状态</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in filteredItems" :key="item.id">
            <td>{{ item.code }}</td>
            <td>{{ item.name }}</td>
            <td><span class="type-badge">{{ getTypeName(item.type) }}</span></td>
            <td>{{ item.contact }}</td>
            <td>{{ item.phone }}</td>
            <td>{{ item.email }}</td>
            <td><span :class="['status-badge', item.status]">{{ getStatusLabel(item.status) }}</span></td>
            <td>{{ item.createTime }}</td>
            <td class="action-cell">
              <button class="action-btn view" @click="viewItem(item)">查看</button>
              <button class="action-btn edit" @click="editItem(item)">编辑</button>
              <button class="action-btn delete" @click="deleteItem(item)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="modal-overlay" v-if="modalVisible" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ isEdit ? '编辑' + (activeTab === 'customer' ? '客户' : '供应商') : '新建' + (activeTab === 'customer' ? '客户' : '供应商') }}</h3>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group">
              <label>{{ activeTab === 'customer' ? '客户' : '供应商' }}名称</label>
              <input type="text" v-model="formData.name" class="form-input" placeholder="请输入名称" />
            </div>
            <div class="form-group">
              <label>{{ activeTab === 'customer' ? '客户' : '供应商' }}编码</label>
              <input type="text" v-model="formData.code" class="form-input" placeholder="请输入编码" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>类型</label>
              <select v-model="formData.type" class="form-select">
                <option value="">请选择类型</option>
                <option v-for="type in currentTypes" :key="type.value" :value="type.value">{{ type.label }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>联系人</label>
              <input type="text" v-model="formData.contact" class="form-input" placeholder="请输入联系人" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>电话</label>
              <input type="tel" v-model="formData.phone" class="form-input" placeholder="请输入电话" />
            </div>
            <div class="form-group">
              <label>邮箱</label>
              <input type="email" v-model="formData.email" class="form-input" placeholder="请输入邮箱" />
            </div>
          </div>
          <div class="form-group">
            <label>地址</label>
            <textarea v-model="formData.address" class="form-textarea" placeholder="请输入地址"></textarea>
          </div>
          <div class="form-group">
            <label>备注</label>
            <textarea v-model="formData.remark" class="form-textarea" placeholder="请输入备注"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="closeModal">取消</button>
          <button class="btn btn-primary" @click="saveItem">{{ isEdit ? '保存修改' : '创建' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'

const activeTab = ref('customer')
const searchKeyword = ref('')
const searchType = ref('name')
const statusFilter = ref('')
const typeFilter = ref('')
const modalVisible = ref(false)
const isEdit = ref(false)

const formData = reactive({
  name: '',
  code: '',
  type: '',
  contact: '',
  phone: '',
  email: '',
  address: '',
  remark: ''
})

const tabs = ref([
  { key: 'customer', label: '客户管理', count: 156 },
  { key: 'supplier', label: '供应商管理', count: 89 }
])

const customerTypes = [
  { value: 'retail', label: '零售客户' },
  { value: 'wholesale', label: '批发客户' },
  { value: 'enterprise', label: '企业客户' },
  { value: 'online', label: '电商客户' }
]

const supplierTypes = [
  { value: 'producer', label: '生产商' },
  { value: 'distributor', label: '经销商' },
  { value: 'agent', label: '代理商' },
  { value: 'import', label: '进口商' }
]

const mockCustomers = ref([
  { id: 1, code: 'CUST-001', name: 'ABC超市', type: 'retail', contact: '张经理', phone: '13900139001', email: 'zhang@abcmart.com', address: '北京市朝阳区XX路XX号', remark: '长期合作客户', status: 'active', createTime: '2026-01-15 09:00:00' },
  { id: 2, code: 'CUST-002', name: '生鲜电商平台', type: 'online', contact: '李总', phone: '13900139002', email: 'li@fresh.com', address: '上海市浦东新区XX路XX号', remark: '', status: 'active', createTime: '2026-02-01 10:30:00' },
  { id: 3, code: 'CUST-003', name: '农贸市场', type: 'wholesale', contact: '王老板', phone: '13900139003', email: 'wang@market.com', address: '广州市天河区XX市场', remark: '', status: 'active', createTime: '2026-02-15 14:00:00' },
  { id: 4, code: 'CUST-004', name: '餐饮连锁', type: 'enterprise', contact: '赵总', phone: '13900139004', email: 'zhao@foodchain.com', address: '深圳市南山区XX路XX号', remark: 'VIP客户', status: 'active', createTime: '2026-03-01 09:00:00' },
  { id: 5, code: 'CUST-005', name: '便利店', type: 'retail', contact: '钱店长', phone: '13900139005', email: 'qian@store.com', address: '杭州市西湖区XX街道', remark: '', status: 'inactive', createTime: '2026-03-15 11:00:00' }
])

const mockSuppliers = ref([
  { id: 1, code: 'SUPP-001', name: '农谷农场', type: 'producer', contact: '孙经理', phone: '13800138001', email: 'sun@farm.com', address: '江苏省苏州市XX农场', remark: '有机农产品', status: 'active', createTime: '2026-01-10 08:00:00' },
  { id: 2, code: 'SUPP-002', name: '绿源食品', type: 'producer', contact: '周厂长', phone: '13800138002', email: 'zhou@greenfood.com', address: '山东省济南市XX工业区', remark: '', status: 'active', createTime: '2026-01-20 09:30:00' },
  { id: 3, code: 'SUPP-003', name: '环球贸易', type: 'import', contact: '吴总', phone: '13800138003', email: 'wu@globaltrade.com', address: '广东省深圳市XX大厦', remark: '进口食品', status: 'active', createTime: '2026-02-05 10:00:00' },
  { id: 4, code: 'SUPP-004', name: '田园农业', type: 'producer', contact: '郑经理', phone: '13800138004', email: 'zheng@tianyuan.com', address: '四川省成都市XX农业基地', remark: '', status: 'active', createTime: '2026-02-20 14:00:00' },
  { id: 5, code: 'SUPP-005', name: '三江贸易', type: 'distributor', contact: '冯总', phone: '13800138005', email: 'feng@sanjang.com', address: '湖北省武汉市XX路XX号', remark: '', status: 'inactive', createTime: '2026-03-01 11:00:00' }
])

const currentTypes = computed(() => {
  return activeTab.value === 'customer' ? customerTypes : supplierTypes
})

const currentItems = computed(() => {
  return activeTab.value === 'customer' ? mockCustomers.value : mockSuppliers.value
})

const filteredItems = computed(() => {
  return currentItems.value.filter(item => {
    const matchKeyword = !searchKeyword.value || 
      String(item[searchType.value] || '').includes(searchKeyword.value)
    const matchStatus = !statusFilter.value || item.status === statusFilter.value
    const matchType = !typeFilter.value || item.type === typeFilter.value
    return matchKeyword && matchStatus && matchType
  })
})

const getTypeName = (type) => {
  const types = currentTypes.value
  const found = types.find(t => t.value === type)
  return found ? found.label : type
}

const getStatusLabel = (status) => {
  return status === 'active' ? '启用' : '禁用'
}

const handleSearch = () => {}

const openCreateModal = () => {
  isEdit.value = false
  formData.name = ''
  formData.code = ''
  formData.type = ''
  formData.contact = ''
  formData.phone = ''
  formData.email = ''
  formData.address = ''
  formData.remark = ''
  modalVisible.value = true
}

const editItem = (item) => {
  isEdit.value = true
  formData.name = item.name
  formData.code = item.code
  formData.type = item.type
  formData.contact = item.contact
  formData.phone = item.phone
  formData.email = item.email
  formData.address = item.address
  formData.remark = item.remark
  modalVisible.value = true
}

const viewItem = (item) => {
  alert(`查看${activeTab.value === 'customer' ? '客户' : '供应商'}: ${item.name}`)
}

const deleteItem = (item) => {
  if (confirm(`确定要删除${activeTab.value === 'customer' ? '客户' : '供应商'} ${item.name}吗？`)) {
    const list = activeTab.value === 'customer' ? mockCustomers.value : mockSuppliers.value
    const index = list.findIndex(i => i.id === item.id)
    if (index > -1) {
      list.splice(index, 1)
    }
  }
}

const saveItem = () => {
  if (!formData.name || !formData.code) {
    alert('请填写必填字段')
    return
  }
  if (isEdit.value) {
    alert(`${activeTab.value === 'customer' ? '客户' : '供应商'}信息已更新`)
  } else {
    alert(`${activeTab.value === 'customer' ? '客户' : '供应商'}创建成功`)
  }
  closeModal()
}

const closeModal = () => {
  modalVisible.value = false
}

onMounted(() => {})
</script>

<style scoped>
.cs-management {
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

.tab-section {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.tab-section button {
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tab-section button.active {
  background: #238636;
  color: #fff;
}

.tab-section button:not(.active) {
  background: #fff;
  color: #4a5568;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.tab-count {
  background: rgba(0, 0, 0, 0.1);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
}

.tab-section button.active .tab-count {
  background: rgba(255, 255, 255, 0.2);
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

.search-select {
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: #4a5568;
  background: #fff;
}

.search-input {
  padding: 10px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  width: 250px;
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

.type-badge {
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
  width: 600px;
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

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
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
</style>
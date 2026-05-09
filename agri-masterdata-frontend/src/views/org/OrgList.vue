<template>
  <div class="org-list">
    <div class="page-header">
      <div class="header-left">
        <h1>组织管理</h1>
        <p>管理组织信息与配置</p>
      </div>
      <button class="add-btn" @click="openCreateModal">
        <span class="btn-icon">+</span>
        <span>新增组织</span>
      </button>
    </div>

    <div class="search-bar">
      <div class="search-group">
        <input 
          type="text" 
          v-model="searchForm.keyword" 
          placeholder="组织名称/编码..." 
          class="search-input"
        />
        <button class="search-btn" @click="loadData">搜索</button>
      </div>
      <div class="filter-group">
        <select v-model="searchForm.orgType" class="filter-select">
          <option value="">全部类型</option>
          <option value="enterprise">企业</option>
          <option value="cooperative">合作社</option>
          <option value="farmer">农户</option>
        </select>
        <select v-model="searchForm.authStatus" class="filter-select">
          <option value="">认证状态</option>
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
            <th>组织编码</th>
            <th>组织名称</th>
            <th>组织类型</th>
            <th>法人</th>
            <th>联系人</th>
            <th>联系电话</th>
            <th>认证状态</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="org in tableData" :key="org.id">
            <td>{{ org.orgCode }}</td>
            <td>{{ org.orgName }}</td>
            <td>
              <span class="type-badge" :class="org.orgType">
                {{ getOrgTypeLabel(org.orgType) }}
              </span>
            </td>
            <td>{{ org.legalPerson }}</td>
            <td>{{ org.contactPerson }}</td>
            <td>{{ org.contactPhone }}</td>
            <td>
              <span class="status-badge" :class="org.authStatus">
                {{ getStatusLabel(org.authStatus) }}
              </span>
            </td>
            <td>{{ formatDate(org.createTime) }}</td>
            <td class="action-cell">
              <button class="action-btn view" @click="viewDetail(org.id)">详情</button>
              <button class="action-btn edit" @click="editOrg(org)">编辑</button>
              <button 
                class="action-btn delete" 
                @click="deleteOrgById(org.id)"
                v-if="org.authStatus === 'unverified'"
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
          <h3>{{ form.id ? '编辑组织' : '新增组织' }}</h3>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>组织名称 *</label>
            <input type="text" v-model="form.orgName" placeholder="请输入组织名称" class="form-input" />
          </div>
          <div class="form-group">
            <label>组织类型</label>
            <select v-model="form.orgType" class="form-select">
              <option value="enterprise">企业</option>
              <option value="cooperative">合作社</option>
              <option value="farmer">农户</option>
            </select>
          </div>
          <div class="form-group">
            <label>法人 *</label>
            <input type="text" v-model="form.legalPerson" placeholder="请输入法人姓名" class="form-input" />
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
            <label>地址</label>
            <textarea v-model="form.address" placeholder="请输入地址" class="form-textarea"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="closeModal">取消</button>
          <button class="btn btn-primary" @click="saveOrg">确认{{ form.id ? '修改' : '添加' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { getOrgList, createOrg, updateOrg, deleteOrg } from '../../utils/api'

const tableData = ref([])
const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(0)
const modalVisible = ref(false)

const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

const searchForm = reactive({
  keyword: '',
  orgType: '',
  authStatus: ''
})

const form = reactive({
  id: null,
  orgName: '',
  orgType: 'enterprise',
  legalPerson: '',
  contactPerson: '',
  contactPhone: '',
  address: ''
})

const getOrgTypeLabel = (type) => {
  const labels = { enterprise: '企业', cooperative: '合作社', farmer: '农户' }
  return labels[type] || type
}

const getStatusLabel = (status) => {
  const labels = { verified: '已认证', unverified: '未认证', pending: '审核中' }
  return labels[status] || status
}

const loadData = async () => {
  try {
    const response = await getOrgList({
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      orgName: searchForm.keyword,
      orgType: searchForm.orgType
    })
    if (response.code === 200) {
      tableData.value = response.data.list || mockOrgs
      total.value = response.data.total || mockOrgs.length
    }
  } catch (error) {
    console.error('Failed to load orgs:', error)
    tableData.value = mockOrgs
    total.value = mockOrgs.length
  }
}

const mockOrgs = [
  { id: 1, orgCode: 'ORG001', orgName: '阳光农业科技有限公司', orgType: 'enterprise', legalPerson: '张三', contactPerson: '李四', contactPhone: '13800138001', address: '北京市朝阳区xxx路xxx号', authStatus: 'verified', createTime: '2024-01-10 10:00:00' },
  { id: 2, orgCode: 'ORG002', orgName: '绿色果蔬合作社', orgType: 'cooperative', legalPerson: '王五', contactPerson: '赵六', contactPhone: '13800138002', address: '山东省济南市xxx区', authStatus: 'verified', createTime: '2024-01-11 14:30:00' },
  { id: 3, orgCode: 'ORG003', orgName: '李家农场', orgType: 'farmer', legalPerson: '李七', contactPerson: '李七', contactPhone: '13800138003', address: '河南省郑州市xxx村', authStatus: 'pending', createTime: '2024-01-12 09:15:00' },
  { id: 4, orgCode: 'ORG004', orgName: '现代农业示范园', orgType: 'enterprise', legalPerson: '钱八', contactPerson: '孙九', contactPhone: '13800138004', address: '四川省成都市xxx园区', authStatus: 'unverified', createTime: '2024-01-13 16:45:00' },
  { id: 5, orgCode: 'ORG005', orgName: '丰收果园', orgType: 'cooperative', legalPerson: '周十', contactPerson: '吴十一', contactPhone: '13800138005', address: '陕西省西安市xxx镇', authStatus: 'verified', createTime: '2024-01-14 11:20:00' }
]

const handleCurrentChange = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    pageNum.value = page
    loadData()
  }
}

const openCreateModal = () => {
  form.id = null
  form.orgName = ''
  form.orgType = 'enterprise'
  form.legalPerson = ''
  form.contactPerson = ''
  form.contactPhone = ''
  form.address = ''
  modalVisible.value = true
}

const editOrg = (row) => {
  form.id = row.id
  form.orgName = row.orgName
  form.orgType = row.orgType
  form.legalPerson = row.legalPerson
  form.contactPerson = row.contactPerson
  form.contactPhone = row.contactPhone
  form.address = row.address
  modalVisible.value = true
}

const closeModal = () => {
  modalVisible.value = false
}

const saveOrg = async () => {
  if (!form.orgName || !form.legalPerson) {
    alert('请填写必填项')
    return
  }
  
  try {
    let response
    if (form.id) {
      response = await updateOrg(form.id, form)
    } else {
      response = await createOrg(form)
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

const viewDetail = (id) => {
  alert(`查看组织详情: ${id}`)
}

const deleteOrgById = async (id) => {
  if (!confirm('确定要删除该组织吗？')) return
  try {
    const response = await deleteOrg(id)
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
.org-list {
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

.type-badge.enterprise {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.type-badge.cooperative {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.type-badge.farmer {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
}

.status-badge {
  font-size: 11px;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: 12px;
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

.btn-primary {
  background: linear-gradient(135deg, #238636 0%, #2ea043 100%);
  color: #fff;
}
</style>

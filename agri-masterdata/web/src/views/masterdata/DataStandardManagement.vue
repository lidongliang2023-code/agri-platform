<template>
  <div class="data-standard-management">
    <div class="page-header">
      <div class="header-left">
        <h1>数据标准管理</h1>
        <p>管理数据标准定义与审核流程</p>
      </div>
      <div class="header-right">
        <button class="btn btn-primary" @click="openCreateModal">新建标准</button>
      </div>
    </div>

    <div class="tabs-container">
      <div class="tabs">
        <button 
          v-for="tab in tabs" 
          :key="tab.key" 
          :class="['tab-btn', { active: activeTab === tab.key }]"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <div v-if="activeTab === 'standard'" class="tab-content">
      <div class="filter-section">
        <div class="search-box">
          <input type="text" v-model="searchKeyword" placeholder="搜索标准名称或编码..." class="search-input" />
          <button class="search-btn" @click="handleSearch">搜索</button>
        </div>
        <div class="filter-group">
          <select v-model="statusFilter" class="filter-select">
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="pending">待审核</option>
            <option value="approved">已发布</option>
            <option value="rejected">已驳回</option>
          </select>
          <select v-model="typeFilter" class="filter-select">
            <option value="">全部类型</option>
            <option value="field">字段标准</option>
            <option value="code">编码标准</option>
            <option value="naming">命名规范</option>
          </select>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>标准编码</th>
              <th>标准名称</th>
              <th>类型</th>
              <th>版本</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="standard in filteredStandards" :key="standard.id">
              <td>{{ standard.code }}</td>
              <td>{{ standard.name }}</td>
              <td><span class="type-badge">{{ getTypeLabel(standard.type) }}</span></td>
              <td>{{ standard.version }}</td>
              <td><span :class="['status-badge', standard.status]">{{ getStatusLabel(standard.status) }}</span></td>
              <td>{{ standard.createTime }}</td>
              <td class="action-cell">
                <button class="action-btn view" @click="viewStandard(standard)">查看</button>
                <button class="action-btn edit" @click="editStandard(standard)">编辑</button>
                <button v-if="standard.status === 'draft'" class="action-btn submit" @click="submitStandard(standard)">提交审核</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination">
        <button class="page-btn" :disabled="currentPage === 1" @click="prevPage">上一页</button>
        <span class="page-info">第 {{ currentPage }} / {{ totalPages }} 页</span>
        <button class="page-btn" :disabled="currentPage === totalPages" @click="nextPage">下一页</button>
      </div>
    </div>

    <div v-if="activeTab === 'audit'" class="tab-content">
      <div class="audit-filters">
        <select v-model="auditStatusFilter" class="filter-select">
          <option value="">全部审核状态</option>
          <option value="pending">待审核</option>
          <option value="approved">已通过</option>
          <option value="rejected">已驳回</option>
        </select>
      </div>

      <div class="audit-list">
        <div v-for="audit in auditList" :key="audit.id" class="audit-card">
          <div class="audit-header">
            <div class="audit-info">
              <span class="audit-code">{{ audit.standardCode }}</span>
              <span class="audit-name">{{ audit.standardName }}</span>
            </div>
            <span :class="['audit-status', audit.status]">{{ getAuditStatusLabel(audit.status) }}</span>
          </div>
          <div class="audit-body">
            <p class="audit-description">{{ audit.description }}</p>
            <div class="audit-meta">
              <span>提交人: {{ audit.submitter }}</span>
              <span>提交时间: {{ audit.submitTime }}</span>
            </div>
          </div>
          <div class="audit-footer" v-if="audit.status === 'pending'">
            <button class="btn btn-approve" @click="approveAudit(audit)">通过</button>
            <button class="btn btn-reject" @click="rejectAudit(audit)">驳回</button>
          </div>
          <div class="audit-footer" v-else>
            <span class="audit-result">{{ audit.resultNote }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'dict'" class="tab-content">
      <div class="dict-header">
        <input type="text" v-model="dictSearch" placeholder="搜索数据字典..." class="search-input" />
        <button class="btn btn-primary" @click="openDictModal">新建字典</button>
      </div>

      <div class="dict-tree-container">
        <div class="dict-tree">
          <div v-for="dict in dictList" :key="dict.code" class="dict-group">
            <div class="dict-group-header" @click="toggleDictExpand(dict.code)">
              <span class="expand-icon">{{ expandedDicts.includes(dict.code) ? '▼' : '▶' }}</span>
              <span class="dict-group-name">{{ dict.name }}</span>
              <span class="dict-group-count">({{ dict.items.length }})</span>
            </div>
            <div v-if="expandedDicts.includes(dict.code)" class="dict-items">
              <div v-for="item in dict.items" :key="item.value" class="dict-item">
                <span class="dict-item-value">{{ item.value }}</span>
                <span class="dict-item-label">{{ item.label }}</span>
                <button class="dict-item-edit" @click="editDictItem(dict, item)">编辑</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-overlay" v-if="modalVisible" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ isEdit ? '编辑标准' : '新建标准' }}</h3>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>标准编码</label>
            <input type="text" v-model="formData.code" class="form-input" placeholder="请输入标准编码" />
          </div>
          <div class="form-group">
            <label>标准名称</label>
            <input type="text" v-model="formData.name" class="form-input" placeholder="请输入标准名称" />
          </div>
          <div class="form-group">
            <label>类型</label>
            <select v-model="formData.type" class="form-select">
              <option value="field">字段标准</option>
              <option value="code">编码标准</option>
              <option value="naming">命名规范</option>
            </select>
          </div>
          <div class="form-group">
            <label>版本</label>
            <input type="text" v-model="formData.version" class="form-input" placeholder="请输入版本号" />
          </div>
          <div class="form-group">
            <label>描述</label>
            <textarea v-model="formData.description" class="form-textarea" placeholder="请输入标准描述"></textarea>
          </div>
          <div class="form-group">
            <label>内容</label>
            <textarea v-model="formData.content" class="form-textarea" placeholder="请输入标准内容"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="closeModal">取消</button>
          <button class="btn btn-primary" @click="saveStandard">{{ isEdit ? '保存修改' : '创建' }}</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" v-if="detailVisible" @click="detailVisible = false">
      <div class="modal-content detail-modal" @click.stop>
        <div class="modal-header">
          <h3>标准详情</h3>
          <button class="close-btn" @click="detailVisible = false">×</button>
        </div>
        <div class="modal-body" v-if="selectedStandard">
          <div class="detail-row">
            <span class="detail-label">标准编码</span>
            <span class="detail-value">{{ selectedStandard.code }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">标准名称</span>
            <span class="detail-value">{{ selectedStandard.name }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">类型</span>
            <span class="detail-value">{{ getTypeLabel(selectedStandard.type) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">版本</span>
            <span class="detail-value">{{ selectedStandard.version }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">状态</span>
            <span :class="['detail-value', 'status-badge', selectedStandard.status]">{{ getStatusLabel(selectedStandard.status) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">描述</span>
            <span class="detail-value block">{{ selectedStandard.description }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">内容</span>
            <pre class="detail-value code">{{ selectedStandard.content }}</pre>
          </div>
          <div class="detail-row">
            <span class="detail-label">创建时间</span>
            <span class="detail-value">{{ selectedStandard.createTime }}</span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" @click="detailVisible = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'

const tabs = [
  { key: 'standard', label: '标准定义' },
  { key: 'audit', label: '标准审核' },
  { key: 'dict', label: '数据字典' }
]

const activeTab = ref('standard')
const searchKeyword = ref('')
const statusFilter = ref('')
const typeFilter = ref('')
const auditStatusFilter = ref('')
const dictSearch = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const modalVisible = ref(false)
const detailVisible = ref(false)
const isEdit = ref(false)
const selectedStandard = ref(null)
const expandedDicts = ref([])

const formData = reactive({
  code: '',
  name: '',
  type: 'field',
  version: '1.0',
  description: '',
  content: ''
})

const mockStandards = ref([
  { id: 1, code: 'STD-FLD-001', name: '用户姓名标准', type: 'field', version: '1.0', status: 'approved', description: '定义用户姓名字段的格式规范', content: '长度限制：2-50个字符\n支持中文、英文、数字\n不允许特殊字符', createTime: '2026-01-10 10:00:00' },
  { id: 2, code: 'STD-CODE-001', name: '商品编码规则', type: 'code', version: '2.0', status: 'approved', description: '商品SKU编码规则定义', content: '编码格式：品类码(2位)+年份(4位)+序列号(6位)\n示例：PD2026000001', createTime: '2026-02-15 14:30:00' },
  { id: 3, code: 'STD-NAM-001', name: '数据库表命名规范', type: 'naming', version: '1.0', status: 'pending', description: '数据库表命名规则', content: '表名：模块缩写_业务名称\n字段名：小写字母+下划线\n示例：user_info, org_structure', createTime: '2026-05-01 09:00:00' },
  { id: 4, code: 'STD-FLD-002', name: '手机号字段标准', type: 'field', version: '1.0', status: 'draft', description: '手机号码字段格式规范', content: '长度：11位数字\n格式：中国大陆手机号', createTime: '2026-05-05 16:00:00' },
  { id: 5, code: 'STD-CODE-002', name: '组织机构编码规则', type: 'code', version: '1.0', status: 'approved', description: '组织机构代码编码规则', content: '编码格式：层级码(2位)+地区码(4位)+序号(4位)', createTime: '2026-03-20 11:00:00' },
  { id: 6, code: 'STD-NAM-002', name: 'API接口命名规范', type: 'naming', version: '1.0', status: 'rejected', description: 'RESTful API命名规范', content: '使用小写字母和连字符\n动词+资源\n示例：/api/users/list', createTime: '2026-04-10 15:00:00' }
])

const auditList = ref([
  { id: 1, standardCode: 'STD-NAM-001', standardName: '数据库表命名规范', status: 'pending', description: '数据库表命名规则的标准化定义', submitter: '张三', submitTime: '2026-05-01 09:00:00', resultNote: '' },
  { id: 2, standardCode: 'STD-FLD-002', standardName: '手机号字段标准', status: 'pending', description: '手机号码字段格式规范', submitter: '李四', submitTime: '2026-05-05 16:00:00', resultNote: '' },
  { id: 3, standardCode: 'STD-NAM-002', standardName: 'API接口命名规范', status: 'rejected', description: 'RESTful API命名规范', submitter: '王五', submitTime: '2026-04-10 15:00:00', resultNote: '规则不够详细，需要补充更多示例' },
  { id: 4, standardCode: 'STD-CODE-002', standardName: '组织机构编码规则', status: 'approved', description: '组织机构代码编码规则', submitter: '赵六', submitTime: '2026-03-20 11:00:00', resultNote: '审核通过' }
])

const dictList = ref([
  {
    code: 'user_status',
    name: '用户状态',
    items: [
      { value: 'active', label: '启用' },
      { value: 'inactive', label: '禁用' },
      { value: 'locked', label: '锁定' }
    ]
  },
  {
    code: 'product_category',
    name: '商品分类',
    items: [
      { value: 'food', label: '食品' },
      { value: 'clothing', label: '服装' },
      { value: 'electronics', label: '电子产品' },
      { value: 'home', label: '家居' }
    ]
  },
  {
    code: 'order_status',
    name: '订单状态',
    items: [
      { value: 'pending', label: '待处理' },
      { value: 'processing', label: '处理中' },
      { value: 'completed', label: '已完成' },
      { value: 'cancelled', label: '已取消' }
    ]
  }
])

const filteredStandards = computed(() => {
  return mockStandards.value.filter(standard => {
    const matchKeyword = !searchKeyword.value || 
      standard.code.includes(searchKeyword.value) ||
      standard.name.includes(searchKeyword.value)
    const matchStatus = !statusFilter.value || standard.status === statusFilter.value
    const matchType = !typeFilter.value || standard.type === typeFilter.value
    return matchKeyword && matchStatus && matchType
  })
})

const totalPages = computed(() => Math.ceil(filteredStandards.value.length / pageSize.value))

const getTypeLabel = (type) => {
  const labels = { field: '字段标准', code: '编码标准', naming: '命名规范' }
  return labels[type] || type
}

const getStatusLabel = (status) => {
  const labels = { draft: '草稿', pending: '待审核', approved: '已发布', rejected: '已驳回' }
  return labels[status] || status
}

const getAuditStatusLabel = (status) => {
  const labels = { pending: '待审核', approved: '已通过', rejected: '已驳回' }
  return labels[status] || status
}

const handleSearch = () => {
  currentPage.value = 1
}

const openCreateModal = () => {
  isEdit.value = false
  formData.code = ''
  formData.name = ''
  formData.type = 'field'
  formData.version = '1.0'
  formData.description = ''
  formData.content = ''
  modalVisible.value = true
}

const editStandard = (standard) => {
  isEdit.value = true
  formData.code = standard.code
  formData.name = standard.name
  formData.type = standard.type
  formData.version = standard.version
  formData.description = standard.description
  formData.content = standard.content
  selectedStandard.value = standard
  modalVisible.value = true
}

const viewStandard = (standard) => {
  selectedStandard.value = standard
  detailVisible.value = true
}

const submitStandard = (standard) => {
  if (confirm(`确定要提交标准 ${standard.name} 进行审核吗？`)) {
    standard.status = 'pending'
    alert('标准已提交审核')
  }
}

const saveStandard = () => {
  if (!formData.code || !formData.name) {
    alert('请填写必填字段')
    return
  }
  if (isEdit.value) {
    const standard = mockStandards.value.find(s => s.id === selectedStandard.value.id)
    if (standard) {
      standard.code = formData.code
      standard.name = formData.name
      standard.type = formData.type
      standard.version = formData.version
      standard.description = formData.description
      standard.content = formData.content
    }
    alert('标准信息已更新')
  } else {
    const newStandard = {
      id: Date.now(),
      code: formData.code,
      name: formData.name,
      type: formData.type,
      version: formData.version,
      status: 'draft',
      description: formData.description,
      content: formData.content,
      createTime: new Date().toLocaleString()
    }
    mockStandards.value.push(newStandard)
    alert('标准创建成功')
  }
  closeModal()
}

const closeModal = () => {
  modalVisible.value = false
  selectedStandard.value = null
}

const prevPage = () => {
  if (currentPage.value > 1) currentPage.value--
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) currentPage.value++
}

const approveAudit = (audit) => {
  if (confirm(`确定要通过标准 ${audit.standardName} 的审核吗？`)) {
    audit.status = 'approved'
    audit.resultNote = '审核通过'
    const standard = mockStandards.value.find(s => s.code === audit.standardCode)
    if (standard) {
      standard.status = 'approved'
    }
    alert('审核已通过')
  }
}

const rejectAudit = (audit) => {
  const note = prompt('请输入驳回原因：')
  if (note) {
    audit.status = 'rejected'
    audit.resultNote = note
    const standard = mockStandards.value.find(s => s.code === audit.standardCode)
    if (standard) {
      standard.status = 'rejected'
    }
    alert('审核已驳回')
  }
}

const toggleDictExpand = (code) => {
  const index = expandedDicts.value.indexOf(code)
  if (index > -1) {
    expandedDicts.value.splice(index, 1)
  } else {
    expandedDicts.value.push(code)
  }
}

const openDictModal = () => {
  alert('新建数据字典功能开发中...')
}

const editDictItem = (dict, item) => {
  const newLabel = prompt(`编辑字典项 ${item.value} 的标签：`, item.label)
  if (newLabel !== null) {
    item.label = newLabel
  }
}

onMounted(() => {})
</script>

<style scoped>
.data-standard-management {
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

.btn-approve {
  background: #238636;
  color: #fff;
}

.btn-reject {
  background: #dc2626;
  color: #fff;
}

.tabs-container {
  margin-bottom: 20px;
}

.tabs {
  display: flex;
  gap: 8px;
  background: #fff;
  padding: 4px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.tab-btn {
  padding: 10px 24px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  background: transparent;
  cursor: pointer;
  color: #6b7280;
}

.tab-btn.active {
  background: #238636;
  color: #fff;
}

.tab-content {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  padding: 20px;
}

.filter-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
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
  overflow-x: auto;
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
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
  border-radius: 12px;
  font-size: 11px;
}

.status-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.status-badge.draft {
  background: rgba(156, 163, 175, 0.1);
  color: #6b7280;
}

.status-badge.pending {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
}

.status-badge.approved {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.status-badge.rejected {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
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

.action-btn.submit {
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

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 13px;
  color: #a0aec0;
}

.audit-filters {
  margin-bottom: 20px;
}

.audit-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.audit-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
}

.audit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.audit-info {
  display: flex;
  gap: 12px;
}

.audit-code {
  font-size: 13px;
  font-weight: 600;
  color: #3b82f6;
}

.audit-name {
  font-size: 14px;
  color: #2d3748;
}

.audit-status {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.audit-status.pending {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
}

.audit-status.approved {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.audit-status.rejected {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}

.audit-body {
  padding: 16px;
}

.audit-description {
  font-size: 13px;
  color: #4a5568;
  margin: 0 0 12px;
}

.audit-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #a0aec0;
}

.audit-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px;
  border-top: 1px solid #e2e8f0;
}

.audit-result {
  font-size: 13px;
  color: #a0aec0;
}

.dict-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.dict-tree-container {
  max-height: 500px;
  overflow-y: auto;
}

.dict-group {
  margin-bottom: 8px;
}

.dict-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #f8fafc;
  border-radius: 8px;
  cursor: pointer;
}

.dict-group-name {
  flex: 1;
  font-size: 14px;
  color: #2d3748;
}

.dict-group-count {
  font-size: 12px;
  color: #a0aec0;
}

.dict-items {
  padding-left: 32px;
}

.dict-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.dict-item-value {
  font-size: 13px;
  color: #3b82f6;
  width: 80px;
}

.dict-item-label {
  flex: 1;
  font-size: 13px;
  color: #2d3748;
}

.dict-item-edit {
  font-size: 12px;
  padding: 4px 8px;
  background: transparent;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  color: #6b7280;
  cursor: pointer;
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

.detail-modal {
  width: 700px;
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
  height: 100px;
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
  resize: vertical;
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

.detail-row {
  display: flex;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.detail-label {
  font-size: 13px;
  color: #a0aec0;
  width: 120px;
}

.detail-value {
  flex: 1;
  font-size: 14px;
  color: #2d3748;
}

.detail-value.block {
  display: block;
}

.detail-value.code {
  font-family: monospace;
  white-space: pre-wrap;
  background: #f8fafc;
  padding: 12px;
  border-radius: 8px;
}

.expand-icon {
  font-size: 10px;
  color: #a0aec0;
  width: 16px;
}
</style>
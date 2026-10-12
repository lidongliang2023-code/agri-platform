<template>
  <div class="code-rule-list">
    <div class="page-header">
      <div class="header-left">
        <h1>编码规则管理</h1>
        <p>管理编码规则配置</p>
      </div>
      <button class="add-btn" @click="openCreateModal">
        <span class="btn-icon">+</span>
        <span>新增规则</span>
      </button>
    </div>

    <div class="search-bar">
      <div class="search-group">
        <input 
          type="text" 
          v-model="searchForm.keyword" 
          placeholder="搜索规则名称/编码..." 
          class="search-input"
        />
        <button class="search-btn" @click="loadData">搜索</button>
      </div>
      <div class="filter-group">
        <select v-model="searchForm.status" class="filter-select">
          <option value="">全部状态</option>
          <option :value="1">启用</option>
          <option :value="0">禁用</option>
        </select>
      </div>
    </div>

    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>规则编码</th>
            <th>规则名称</th>
            <th>编码格式</th>
            <th>规则类型</th>
            <th>前缀</th>
            <th>序号长度</th>
            <th>状态</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="rule in tableData" :key="rule.id">
            <td>{{ rule.ruleCode }}</td>
            <td>{{ rule.ruleName }}</td>
            <td>{{ rule.rulePattern }}</td>
            <td>
              <span class="type-badge" :class="rule.ruleType">
                {{ rule.ruleType === 'auto' ? '自动生成' : '手动输入' }}
              </span>
            </td>
            <td>{{ rule.prefix || '-' }}</td>
            <td>{{ rule.seqLength }}</td>
            <td>
              <span class="status-badge" :class="rule.status === 1 ? 'active' : 'inactive'">
                {{ rule.status === 1 ? '启用' : '禁用' }}
              </span>
            </td>
            <td>{{ formatDate(rule.createTime) }}</td>
            <td class="action-cell">
              <button class="action-btn edit" @click="editRule(rule)">编辑</button>
              <button 
                class="action-btn"
                :class="rule.status === 1 ? 'disable' : 'enable'"
                @click="toggleStatus(rule)"
              >
                {{ rule.status === 1 ? '禁用' : '启用' }}
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

    <div class="modal-overlay" v-if="modalVisible" @click="modalVisible = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ form.id ? '编辑规则' : '新增规则' }}</h3>
          <button class="close-btn" @click="modalVisible = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>规则编码 *</label>
            <input type="text" v-model="form.ruleCode" placeholder="请输入规则编码" class="form-input" :disabled="form.id" />
          </div>
          <div class="form-group">
            <label>规则名称 *</label>
            <input type="text" v-model="form.ruleName" placeholder="请输入规则名称" class="form-input" />
          </div>
          <div class="form-group">
            <label>规则类型</label>
            <select v-model="form.ruleType" class="form-select">
              <option value="auto">自动生成</option>
              <option value="manual">手动输入</option>
            </select>
          </div>
          <div class="form-group">
            <label>前缀</label>
            <input type="text" v-model="form.prefix" placeholder="请输入前缀" class="form-input" />
          </div>
          <div class="form-group">
            <label>序号长度</label>
            <input type="number" v-model="form.seqLength" placeholder="请输入序号长度" class="form-input" />
          </div>
          <div class="form-group">
            <label>编码格式示例</label>
            <input type="text" v-model="form.rulePattern" placeholder="请输入编码格式示例" class="form-input" />
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
          <button class="btn btn-cancel" @click="modalVisible = false">取消</button>
          <button class="btn btn-primary" @click="saveRule">确认{{ form.id ? '修改' : '添加' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getCodeRuleList, createCodeRule, updateCodeRule } from '../../utils/api'

const tableData = ref([])
const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(0)
const totalPages = ref(1)
const modalVisible = ref(false)

const searchForm = reactive({
  keyword: '',
  status: ''
})

const form = reactive({
  id: null,
  ruleCode: '',
  ruleName: '',
  ruleType: 'auto',
  prefix: '',
  seqLength: 6,
  rulePattern: '',
  status: 1
})

const loadData = async () => {
  try {
    const response = await getCodeRuleList({
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      keyword: searchForm.keyword,
      status: searchForm.status
    })
    if (response.code === 200) {
      tableData.value = response.data.list || mockRules
      total.value = response.data.total || mockRules.length
      totalPages.value = Math.ceil(total.value / pageSize.value)
    }
  } catch (error) {
    ElMessage.error('加载数据失败')
    tableData.value = mockRules
    total.value = mockRules.length
    totalPages.value = Math.ceil(total.value / pageSize.value)
  }
}

const mockRules = [
  { id: 1, ruleCode: 'RULE001', ruleName: '商品编码规则', rulePattern: 'PRD{yyyyMMdd}{seq}', ruleType: 'auto', prefix: 'PRD', seqLength: 6, status: 1, createTime: '2024-01-15 10:30:00' },
  { id: 2, ruleCode: 'RULE002', ruleName: '订单编码规则', rulePattern: 'ORD{yyyyMMdd}{seq}', ruleType: 'auto', prefix: 'ORD', seqLength: 8, status: 1, createTime: '2024-01-16 14:20:00' },
  { id: 3, ruleCode: 'RULE003', ruleName: '用户编码规则', rulePattern: 'USR{seq}', ruleType: 'auto', prefix: 'USR', seqLength: 6, status: 0, createTime: '2024-01-17 09:15:00' },
  { id: 4, ruleCode: 'RULE004', ruleName: '组织编码规则', rulePattern: 'ORG{seq}', ruleType: 'auto', prefix: 'ORG', seqLength: 6, status: 1, createTime: '2024-01-18 16:45:00' },
  { id: 5, ruleCode: 'RULE005', ruleName: '手动输入编码', rulePattern: 'MANUAL', ruleType: 'manual', prefix: '', seqLength: 0, status: 1, createTime: '2024-01-19 11:00:00' }
]

const handleSizeChange = (size) => {
  pageSize.value = size
  loadData()
}

const handleCurrentChange = (page) => {
  pageNum.value = page
  loadData()
}

const openCreateModal = () => {
  form.id = null
  form.ruleCode = ''
  form.ruleName = ''
  form.ruleType = 'auto'
  form.prefix = ''
  form.seqLength = 6
  form.rulePattern = ''
  form.status = 1
  modalVisible.value = true
}

const editRule = (row) => {
  form.id = row.id
  form.ruleCode = row.ruleCode
  form.ruleName = row.ruleName
  form.ruleType = row.ruleType
  form.prefix = row.prefix
  form.seqLength = row.seqLength
  form.rulePattern = row.rulePattern
  form.status = row.status
  modalVisible.value = true
}

const saveRule = async () => {
  if (!form.ruleCode || !form.ruleName) {
    ElMessage.warning('请填写必填项')
    return
  }
  
  try {
    let response
    if (form.id) {
      response = await updateCodeRule(form.id, form)
    } else {
      response = await createCodeRule(form)
    }
    
    if (response.code === 200) {
      ElMessage.success(form.id ? '修改成功' : '创建成功')
      modalVisible.value = false
      loadData()
    } else {
      ElMessage.error(response.message || '操作失败')
    }
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

const toggleStatus = async (row) => {
  try {
    const response = await updateCodeRule(row.id, { status: row.status === 1 ? 0 : 1 })
    if (response.code === 200) {
      ElMessage.success(row.status === 1 ? '禁用成功' : '启用成功')
      loadData()
    } else {
      ElMessage.error(response.message || '操作失败')
    }
  } catch (error) {
    ElMessage.error('操作失败')
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
.code-rule-list {
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

.type-badge.auto {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.type-badge.manual {
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
  transition: all 0.2s;
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
  width: 600px;
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
</style>
<template>
  <div class="quality-list">
    <div class="page-header">
      <div class="header-left">
        <h1>数据质量监控</h1>
        <p>监控数据质量问题</p>
      </div>
    </div>

    <div class="stats-row">
      <div class="stat-item">
        <span class="stat-num">{{ stats.totalIssues || 125 }}</span>
        <span class="stat-text">问题总数</span>
      </div>
      <div class="stat-item warning">
        <span class="stat-num">{{ stats.warningIssues || 45 }}</span>
        <span class="stat-text">警告问题</span>
      </div>
      <div class="stat-item danger">
        <span class="stat-num">{{ stats.criticalIssues || 12 }}</span>
        <span class="stat-text">严重问题</span>
      </div>
      <div class="stat-item success">
        <span class="stat-num">{{ stats.resolvedRate || '85%' }}</span>
        <span class="stat-text">解决率</span>
      </div>
    </div>

    <div class="search-bar">
      <div class="search-group">
        <input 
          type="text" 
          v-model="searchForm.keyword" 
          placeholder="搜索问题描述/关联数据..." 
          class="search-input"
        />
        <button class="search-btn" @click="loadData">搜索</button>
      </div>
      <div class="filter-group">
        <select v-model="searchForm.level" class="filter-select">
          <option value="">全部级别</option>
          <option value="critical">严重</option>
          <option value="warning">警告</option>
          <option value="info">提示</option>
        </select>
      </div>
      <div class="filter-group">
        <select v-model="searchForm.status" class="filter-select">
          <option value="">全部状态</option>
          <option value="pending">待处理</option>
          <option value="processing">处理中</option>
          <option value="resolved">已解决</option>
        </select>
      </div>
    </div>

    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>问题编码</th>
            <th>问题级别</th>
            <th>问题类型</th>
            <th>问题描述</th>
            <th>关联数据</th>
            <th>检测时间</th>
            <th>处理状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="issue in tableData" :key="issue.id">
            <td>{{ issue.issueCode }}</td>
            <td>
              <span class="level-badge" :class="issue.issueLevel">
                {{ getLevelLabel(issue.issueLevel) }}
              </span>
            </td>
            <td>{{ issue.issueType }}</td>
            <td>{{ issue.issueDesc }}</td>
            <td>{{ issue.relatedData }}</td>
            <td>{{ formatDate(issue.detectTime) }}</td>
            <td>
              <span class="status-badge" :class="issue.status">
                {{ getStatusLabel(issue.status) }}
              </span>
            </td>
            <td class="action-cell">
              <button class="action-btn view" @click="viewDetail(issue)">详情</button>
              <button 
                v-if="issue.status !== 'resolved'"
                class="action-btn handle"
                @click="handleIssue(issue)"
              >处理</button>
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

    <div class="modal-overlay" v-if="detailVisible" @click="detailVisible = false">
      <div class="modal-content detail-modal" @click.stop>
        <div class="modal-header">
          <h3>问题详情</h3>
          <button class="close-btn" @click="detailVisible = false">×</button>
        </div>
        <div class="modal-body" v-if="detailData">
          <div class="detail-row">
            <span class="detail-label">问题编码</span>
            <span class="detail-value">{{ detailData.issueCode }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">问题级别</span>
            <span class="level-badge" :class="detailData.issueLevel">
              {{ getLevelLabel(detailData.issueLevel) }}
            </span>
          </div>
          <div class="detail-row">
            <span class="detail-label">问题类型</span>
            <span class="detail-value">{{ detailData.issueType }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">问题描述</span>
            <span class="detail-value">{{ detailData.issueDesc }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">关联数据</span>
            <span class="detail-value">{{ detailData.relatedData }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">检测时间</span>
            <span class="detail-value">{{ detailData.detectTime }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">处理状态</span>
            <span class="status-badge" :class="detailData.status">
              {{ getStatusLabel(detailData.status) }}
            </span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="detailVisible = false">关闭</button>
          <button 
            v-if="detailData && detailData.status !== 'resolved'" 
            class="btn btn-primary" 
            @click="handleIssue(detailData)"
          >处理</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" v-if="handleModalVisible" @click="handleModalVisible = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>处理问题</h3>
          <button class="close-btn" @click="handleModalVisible = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>处理结果</label>
            <select v-model="handleForm.handleResult" class="form-select">
              <option value="">请选择处理结果</option>
              <option value="fixed">已修复</option>
              <option value="ignored">无需处理</option>
              <option value="pending">待确认</option>
            </select>
          </div>
          <div class="form-group">
            <label>处理备注</label>
            <textarea v-model="handleForm.handleNote" rows="3" class="form-textarea" placeholder="请输入处理备注"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="handleModalVisible = false">取消</button>
          <button class="btn btn-primary" @click="confirmHandle">确定处理</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getQualityList, handleQualityIssue } from '../../utils/api'

const tableData = ref([])
const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(0)
const totalPages = ref(1)
const detailVisible = ref(false)
const handleModalVisible = ref(false)
const detailData = ref(null)
const stats = ref({})

const searchForm = reactive({
  keyword: '',
  level: '',
  status: ''
})

const handleForm = reactive({
  handleResult: '',
  handleNote: ''
})

const getLevelLabel = (level) => {
  const labels = { critical: '严重', warning: '警告', info: '提示' }
  return labels[level] || level
}

const getStatusLabel = (status) => {
  const labels = { pending: '待处理', processing: '处理中', resolved: '已解决' }
  return labels[status] || status
}

const loadData = async () => {
  try {
    const response = await getQualityList({
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      keyword: searchForm.keyword,
      level: searchForm.level,
      status: searchForm.status
    })
    if (response.code === 200) {
      tableData.value = response.data.list || mockIssues
      total.value = response.data.total || mockIssues.length
      totalPages.value = Math.ceil(total.value / pageSize.value)
    }
  } catch (error) {
    ElMessage.error('加载数据失败')
    tableData.value = mockIssues
    total.value = mockIssues.length
    totalPages.value = Math.ceil(total.value / pageSize.value)
  }
}

const mockIssues = [
  { id: 1, issueCode: 'ISSUE001', issueLevel: 'critical', issueType: '数据缺失', issueDesc: '用户张三的身份证号码缺失', relatedData: '用户ID: 1', detectTime: '2024-01-15 10:30:00', status: 'pending' },
  { id: 2, issueCode: 'ISSUE002', issueLevel: 'warning', issueType: '数据格式错误', issueDesc: '商品价格格式不正确', relatedData: '商品ID: 1001', detectTime: '2024-01-15 09:15:00', status: 'processing' },
  { id: 3, issueCode: 'ISSUE003', issueLevel: 'info', issueType: '数据重复', issueDesc: '存在重复的组织名称', relatedData: '组织ID: 5', detectTime: '2024-01-15 14:20:00', status: 'resolved' },
  { id: 4, issueCode: 'ISSUE004', issueLevel: 'critical', issueType: '数据过期', issueDesc: '证书已过期', relatedData: '证书ID: 20', detectTime: '2024-01-15 16:45:00', status: 'pending' },
  { id: 5, issueCode: 'ISSUE005', issueLevel: 'warning', issueType: '数据不一致', issueDesc: '租户配额使用超出限制', relatedData: '租户ID: 1', detectTime: '2024-01-15 11:00:00', status: 'pending' }
]

const handleSizeChange = (size) => {
  pageSize.value = size
  loadData()
}

const handleCurrentChange = (page) => {
  pageNum.value = page
  loadData()
}

const viewDetail = (row) => {
  detailData.value = row
  detailVisible.value = true
}

const handleIssue = (row) => {
  detailData.value = row
  handleForm.handleResult = ''
  handleForm.handleNote = ''
  handleModalVisible.value = true
}

const confirmHandle = async () => {
  if (!handleForm.handleResult) {
    ElMessage.warning('请选择处理结果')
    return
  }
  
  try {
    const response = await handleQualityIssue(detailData.value.id, {
      handleResult: handleForm.handleResult,
      handleNote: handleForm.handleNote
    })
    if (response.code === 200) {
      ElMessage.success('处理成功')
      handleModalVisible.value = false
      detailVisible.value = false
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
.quality-list {
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

.stats-row {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}

.stat-item {
  flex: 1;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #fff;
}

.stat-item.warning {
  background: linear-gradient(135deg, #faad14 0%, #ffc53d 100%);
}

.stat-item.danger {
  background: linear-gradient(135deg, #f5222d 0%, #ff4d4f 100%);
}

.stat-item.success {
  background: linear-gradient(135deg, #52c41a 0%, #73d13d 100%);
}

.stat-num {
  font-size: 28px;
  font-weight: 700;
}

.stat-text {
  font-size: 14px;
  opacity: 0.9;
  margin-top: 4px;
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

.level-badge {
  font-size: 11px;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: 12px;
}

.level-badge.critical {
  background: rgba(218, 54, 51, 0.1);
  color: #da3633;
}

.level-badge.warning {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
}

.level-badge.info {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.status-badge {
  font-size: 11px;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: 12px;
}

.status-badge.pending {
  background: rgba(218, 54, 51, 0.1);
  color: #da3633;
}

.status-badge.processing {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
}

.status-badge.resolved {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
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

.action-btn.handle {
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

.form-textarea {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
  resize: vertical;
}

.form-textarea:focus {
  border-color: #238636;
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
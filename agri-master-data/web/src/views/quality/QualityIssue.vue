<template>
  <div class="quality-issue">
    <div class="page-header">
      <div class="header-left">
        <h1>质量问题工单</h1>
        <p>管理数据质量问题工单处理</p>
      </div>
      <button class="add-btn" @click="showAddModal = true">+ 新建工单</button>
    </div>

    <div class="filter-bar">
      <select v-model="filterStatus" class="filter-select">
        <option value="all">全部状态</option>
        <option value="pending">待处理</option>
        <option value="processing">处理中</option>
        <option value="resolved">已解决</option>
        <option value="closed">已关闭</option>
      </select>
      <select v-model="filterSeverity" class="filter-select">
        <option value="all">全部等级</option>
        <option value="critical">严重</option>
        <option value="high">高</option>
        <option value="medium">中</option>
        <option value="low">低</option>
      </select>
      <input 
        type="text" 
        v-model="filterKeyword" 
        placeholder="搜索问题描述..." 
        class="filter-input"
      />
    </div>

    <div class="stats-row">
      <div class="stat-item critical">
        <div class="stat-icon">🔴</div>
        <div class="stat-info">
          <div class="stat-value">{{ issueStats.critical }}</div>
          <div class="stat-label">严重</div>
        </div>
      </div>
      <div class="stat-item high">
        <div class="stat-icon">🟠</div>
        <div class="stat-info">
          <div class="stat-value">{{ issueStats.high }}</div>
          <div class="stat-label">高</div>
        </div>
      </div>
      <div class="stat-item medium">
        <div class="stat-icon">🟡</div>
        <div class="stat-info">
          <div class="stat-value">{{ issueStats.medium }}</div>
          <div class="stat-label">中</div>
        </div>
      </div>
      <div class="stat-item low">
        <div class="stat-icon">🟢</div>
        <div class="stat-info">
          <div class="stat-value">{{ issueStats.low }}</div>
          <div class="stat-label">低</div>
        </div>
      </div>
    </div>

    <div class="issue-table">
      <table class="data-table">
        <thead>
          <tr>
            <th>工单编号</th>
            <th>问题描述</th>
            <th>所属数据域</th>
            <th>严重等级</th>
            <th>状态</th>
            <th>创建时间</th>
            <th>处理人</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="issue in filteredIssues" :key="issue.id">
            <td class="code">{{ issue.code }}</td>
            <td class="description">{{ issue.description }}</td>
            <td>{{ issue.domain }}</td>
            <td>
              <span class="severity-badge" :class="issue.severity">
                {{ getSeverityText(issue.severity) }}
              </span>
            </td>
            <td>
              <span class="status-badge" :class="issue.status">
                {{ getStatusText(issue.status) }}
              </span>
            </td>
            <td>{{ issue.createTime }}</td>
            <td>{{ issue.assignee || '-' }}</td>
            <td class="action-cell">
              <button class="action-btn view" @click="viewIssue(issue)">查看</button>
              <button 
                class="action-btn process" 
                @click="processIssue(issue)"
                :disabled="issue.status === 'resolved' || issue.status === 'closed'"
              >处理</button>
              <button class="action-btn close" @click="closeIssue(issue)">关闭</button>
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

    <div class="modal-overlay" v-if="showAddModal" @click="closeAddModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ isEdit ? '编辑工单' : '新建工单' }}</h3>
          <button class="close-btn" @click="closeAddModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>问题描述 *</label>
            <textarea v-model="form.description" class="form-input" placeholder="请输入问题描述" rows="4"></textarea>
          </div>
          <div class="form-group">
            <label>所属数据域 *</label>
            <select v-model="form.domain" class="form-input">
              <option value="user">用户主数据</option>
              <option value="organization">组织主数据</option>
              <option value="product">商品主数据</option>
              <option value="customer">客户主数据</option>
              <option value="supplier">供应商主数据</option>
            </select>
          </div>
          <div class="form-group">
            <label>严重等级 *</label>
            <div class="severity-options">
              <label 
                v-for="s in severities" 
                :key="s.value"
                class="severity-option"
                :class="{selected: form.severity === s.value}"
              >
                <input type="radio" :value="s.value" v-model="form.severity" />
                <span class="severity-dot" :class="s.value"></span>
                <span>{{ s.label }}</span>
              </label>
            </div>
          </div>
          <div class="form-group">
            <label>关联规则</label>
            <select v-model="form.ruleId" class="form-input">
              <option value="">请选择关联规则</option>
              <option v-for="rule in availableRules" :key="rule.id" :value="rule.id">{{ rule.name }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>处理人</label>
            <input type="text" v-model="form.assignee" class="form-input" placeholder="请输入处理人姓名" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="closeAddModal">取消</button>
          <button class="btn btn-primary" @click="saveIssue">{{ isEdit ? '保存修改' : '创建工单' }}</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" v-if="showDetailModal" @click="closeDetailModal">
      <div class="modal-content detail-modal" @click.stop>
        <div class="modal-header">
          <h3>工单详情</h3>
          <button class="close-btn" @click="closeDetailModal">×</button>
        </div>
        <div class="modal-body" v-if="selectedIssue">
          <div class="detail-section">
            <div class="detail-row">
              <span class="detail-label">工单编号</span>
              <span class="detail-value code">{{ selectedIssue.code }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">问题描述</span>
              <span class="detail-value">{{ selectedIssue.description }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">所属数据域</span>
              <span class="detail-value">{{ selectedIssue.domain }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">严重等级</span>
              <span class="severity-badge" :class="selectedIssue.severity">
                {{ getSeverityText(selectedIssue.severity) }}
              </span>
            </div>
            <div class="detail-row">
              <span class="detail-label">状态</span>
              <span class="status-badge" :class="selectedIssue.status">
                {{ getStatusText(selectedIssue.status) }}
              </span>
            </div>
            <div class="detail-row">
              <span class="detail-label">创建时间</span>
              <span class="detail-value">{{ selectedIssue.createTime }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">处理人</span>
              <span class="detail-value">{{ selectedIssue.assignee || '-' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">处理进度</span>
              <div class="progress-bar">
                <div 
                  class="progress-fill" 
                  :style="{width: getProgressPercent(selectedIssue.status) + '%'}"
                ></div>
              </div>
            </div>
          </div>
          <div class="detail-section">
            <h4>处理日志</h4>
            <div class="log-list">
              <div v-for="(log, index) in selectedIssue.logs" :key="index" class="log-item">
                <span class="log-time">{{ log.time }}</span>
                <span class="log-action">{{ log.action }}</span>
                <span class="log-operator">{{ log.operator }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="closeDetailModal">关闭</button>
          <button 
            v-if="selectedIssue?.status !== 'resolved' && selectedIssue?.status !== 'closed'"
            class="btn btn-primary" 
            @click="processIssue(selectedIssue)"
          >开始处理</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'

const showAddModal = ref(false)
const showDetailModal = ref(false)
const isEdit = ref(false)
const filterStatus = ref('all')
const filterSeverity = ref('all')
const filterKeyword = ref('')
const currentPage = ref(1)
const totalPages = ref(1)

const form = reactive({
  id: null,
  description: '',
  domain: 'user',
  severity: 'medium',
  ruleId: '',
  assignee: ''
})

const selectedIssue = ref(null)

const severities = [
  { value: 'critical', label: '严重' },
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' }
]

const issues = ref([])
const availableRules = ref([])

const mockIssues = [
  { id: 1, code: 'QI-20260509-001', description: '检测到15条用户数据身份证号格式不正确', domain: '用户主数据', severity: 'high', status: 'pending', createTime: '2026-05-09 10:30:00', assignee: '张三', logs: [{ time: '2026-05-09 10:30:00', action: '工单创建', operator: '系统' }] },
  { id: 2, code: 'QI-20260509-002', description: '供应商资质证书即将到期', domain: '供应商主数据', severity: 'medium', status: 'processing', createTime: '2026-05-09 09:15:00', assignee: '李四', logs: [{ time: '2026-05-09 09:15:00', action: '工单创建', operator: '系统' }, { time: '2026-05-09 09:20:00', action: '开始处理', operator: '李四' }] },
  { id: 3, code: 'QI-20260508-003', description: '商品编码重复，存在重复数据', domain: '商品主数据', severity: 'critical', status: 'resolved', createTime: '2026-05-08 14:20:00', assignee: '王五', logs: [{ time: '2026-05-08 14:20:00', action: '工单创建', operator: '系统' }, { time: '2026-05-08 14:30:00', action: '开始处理', operator: '王五' }, { time: '2026-05-08 16:00:00', action: '问题已解决', operator: '王五' }] },
  { id: 4, code: 'QI-20260508-004', description: '客户联系电话缺失率超过阈值', domain: '客户主数据', severity: 'medium', status: 'pending', createTime: '2026-05-08 11:00:00', assignee: '', logs: [{ time: '2026-05-08 11:00:00', action: '工单创建', operator: '系统' }] },
  { id: 5, code: 'QI-20260507-005', description: '组织名称在多系统中不一致', domain: '组织主数据', severity: 'low', status: 'closed', createTime: '2026-05-07 16:45:00', assignee: '赵六', logs: [{ time: '2026-05-07 16:45:00', action: '工单创建', operator: '系统' }, { time: '2026-05-07 17:00:00', action: '开始处理', operator: '赵六' }, { time: '2026-05-07 17:30:00', action: '问题已解决', operator: '赵六' }, { time: '2026-05-07 17:35:00', action: '工单关闭', operator: '赵六' }] },
  { id: 6, code: 'QI-20260507-006', description: '用户邮箱格式验证失败', domain: '用户主数据', severity: 'low', status: 'pending', createTime: '2026-05-07 10:00:00', assignee: '', logs: [{ time: '2026-05-07 10:00:00', action: '工单创建', operator: '系统' }] }
]

const mockRules = [
  { id: 1, name: '用户名完整性检查' },
  { id: 2, name: '手机号格式验证' },
  { id: 3, name: '身份证号验证' },
  { id: 4, name: '组织名称一致性' },
  { id: 5, name: '商品编码唯一性' }
]

const filteredIssues = computed(() => {
  return issues.value.filter(issue => {
    const matchStatus = filterStatus.value === 'all' || issue.status === filterStatus.value
    const matchSeverity = filterSeverity.value === 'all' || issue.severity === filterSeverity.value
    const matchKeyword = !filterKeyword.value || issue.description.toLowerCase().includes(filterKeyword.value.toLowerCase())
    return matchStatus && matchSeverity && matchKeyword
  })
})

const issueStats = computed(() => ({
  critical: issues.value.filter(i => i.severity === 'critical').length,
  high: issues.value.filter(i => i.severity === 'high').length,
  medium: issues.value.filter(i => i.severity === 'medium').length,
  low: issues.value.filter(i => i.severity === 'low').length
}))

const getSeverityText = (severity) => {
  const texts = {
    critical: '严重',
    high: '高',
    medium: '中',
    low: '低'
  }
  return texts[severity] || severity
}

const getStatusText = (status) => {
  const texts = {
    pending: '待处理',
    processing: '处理中',
    resolved: '已解决',
    closed: '已关闭'
  }
  return texts[status] || status
}

const getProgressPercent = (status) => {
  const percent = {
    pending: 0,
    processing: 50,
    resolved: 100,
    closed: 100
  }
  return percent[status] || 0
}

const loadData = () => {
  issues.value = mockIssues
  availableRules.value = mockRules
  totalPages.value = Math.ceil(issues.value.length / 10)
}

onMounted(() => {
  loadData()
})

const closeAddModal = () => {
  showAddModal.value = false
  isEdit.value = false
  Object.keys(form).forEach(key => {
    form[key] = key === 'domain' ? 'user' : key === 'severity' ? 'medium' : ''
  })
}

const closeDetailModal = () => {
  showDetailModal.value = false
  selectedIssue.value = null
}

const viewIssue = (issue) => {
  selectedIssue.value = issue
  showDetailModal.value = true
}

const processIssue = (issue) => {
  if (issue.status === 'resolved' || issue.status === 'closed') return
  issue.status = 'processing'
  issue.assignee = issue.assignee || '当前用户'
  issue.logs.push({
    time: '刚刚',
    action: '开始处理',
    operator: issue.assignee
  })
  alert(`工单 "${issue.code}" 已开始处理`)
  if (showDetailModal.value) {
    selectedIssue.value = { ...issue }
  }
}

const closeIssue = (issue) => {
  if (confirm(`确定关闭工单 "${issue.code}" 吗？`)) {
    issue.status = 'closed'
    issue.logs.push({
      time: '刚刚',
      action: '工单关闭',
      operator: '当前用户'
    })
    alert('工单已关闭')
  }
}

const saveIssue = () => {
  if (!form.description) {
    alert('请填写问题描述')
    return
  }

  if (isEdit.value) {
    const index = issues.value.findIndex(i => i.id === form.id)
    if (index !== -1) {
      issues.value[index] = {
        ...issues.value[index],
        description: form.description,
        domain: form.domain,
        severity: form.severity,
        assignee: form.assignee
      }
    }
    alert('工单已更新')
  } else {
    const code = `QI-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${String(issues.value.length + 1).padStart(3, '0')}`
    issues.value.push({
      id: Date.now(),
      code,
      description: form.description,
      domain: form.domain === 'user' ? '用户主数据' : form.domain === 'organization' ? '组织主数据' : form.domain === 'product' ? '商品主数据' : form.domain === 'customer' ? '客户主数据' : '供应商主数据',
      severity: form.severity,
      status: 'pending',
      createTime: '刚刚',
      assignee: form.assignee,
      logs: [{ time: '刚刚', action: '工单创建', operator: '系统' }]
    })
    alert('工单已创建')
  }
  closeAddModal()
}

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}
</script>

<style scoped>
.quality-issue {
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
  padding: 10px 20px;
  background: linear-gradient(135deg, #238636 0%, #2ea043 100%);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.add-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(35, 134, 54, 0.3);
}

.filter-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.filter-select {
  padding: 8px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  cursor: pointer;
}

.filter-input {
  padding: 8px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  flex: 1;
  min-width: 200px;
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
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.stat-icon {
  font-size: 24px;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #2d3748;
  margin: 0;
}

.stat-label {
  font-size: 12px;
  color: #718096;
  margin: 2px 0 0;
}

.issue-table {
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

.code {
  font-family: monospace;
  color: #238636;
  font-weight: 500;
}

.description {
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.severity-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.severity-badge.critical {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.severity-badge.high {
  background: rgba(234, 88, 12, 0.1);
  color: #ea580c;
}

.severity-badge.medium {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
}

.severity-badge.low {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.pending {
  background: rgba(234, 88, 12, 0.1);
  color: #ea580c;
}

.status-badge.processing {
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
}

.status-badge.resolved {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.status-badge.closed {
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
  transition: all 0.2s;
}

.action-btn.view {
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
}

.action-btn.process {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
}

.action-btn.process:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn.close {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.action-btn:hover:not(:disabled) {
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
  max-height: 90vh;
  overflow-y: auto;
}

.modal-content.detail-modal {
  width: 800px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #f0f0f0;
  position: sticky;
  top: 0;
  background: #fff;
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

.severity-options {
  display: flex;
  gap: 20px;
}

.severity-option {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  transition: all 0.2s;
}

.severity-option.selected {
  background: rgba(35, 134, 54, 0.1);
  border-color: #238636;
}

.severity-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.severity-dot.critical {
  background: #dc2626;
}

.severity-dot.high {
  background: #ea580c;
}

.severity-dot.medium {
  background: #d29922;
}

.severity-dot.low {
  background: #238636;
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

.detail-section {
  margin-bottom: 24px;
}

.detail-section h4 {
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 16px;
}

.detail-row {
  display: flex;
  padding: 12px 0;
  border-bottom: 1px dashed #f0f0f0;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  width: 120px;
  font-size: 13px;
  color: #718096;
  font-weight: 500;
}

.detail-value {
  flex: 1;
  font-size: 13px;
  color: #2d3748;
}

.progress-bar {
  flex: 1;
  height: 10px;
  background: #e2e8f0;
  border-radius: 5px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #238636, #2ea043);
  border-radius: 5px;
  transition: width 0.3s;
}

.log-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.log-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 12px;
  background: #f8fafc;
  border-radius: 6px;
}

.log-time {
  font-size: 12px;
  color: #718096;
  width: 100px;
}

.log-action {
  flex: 1;
  font-size: 13px;
  color: #2d3748;
}

.log-operator {
  font-size: 12px;
  color: #238636;
}
</style>
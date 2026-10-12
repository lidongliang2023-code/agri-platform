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
          <!--
            原来这里有"关联规则"下拉与"处理人"输入，两处都去掉了 —— 不是懒得接，而是接上也是假的：
            - 质量规则族（/quality/rules）后端还没做，下拉恒为空，留着的效果是"选项点不出来"；
            - 登记接口不接收处理人：处理人由"谁点了处置"决定，服务端记当前登录用户。
          -->
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
import { message } from 'ant-design-vue'
import { getQualityList, getQualityDetail, handleQualityIssue, createQualityIssue } from '../../utils/api'

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
  // 处理人不在这里填：由"谁点了处置"决定，服务端记当前登录用户
  assignee: ''
})

const selectedIssue = ref(null)

const severities = [
  // 与后端 severity 口径一致：high / medium / low（原来多一个 critical，筛它永远没结果）
  { value: 'high', label: '严重' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' }
]

const issues = ref([])
// 原来这里是一份 6 条的写死工单数组：列表、处理、关闭、新增全部只改本地。
// 现在数据来自 /admin/masterdata/quality/issues，处置走 /issues/{id}/handle。

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
    closed: '已关闭',
    ignored: '已忽略'
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

/** 接口行 → 页面行。接口字段是 issueCode / handler / domainName，页面用的是 code / assignee / domain。 */
const toRow = (row) => ({
  id: row.id,
  code: row.issueCode,
  description: row.description,
  domain: row.domain || row.domainName || '—',
  domainCode: row.domainCode,
  severity: row.severity || 'medium',
  status: row.status || 'pending',
  createTime: row.createTime,
  assignee: row.handler,
  logs: []
})

const loadData = async () => {
  try {
    const response = await getQualityList({
      pageNum: currentPage.value,
      pageSize: 10,
      // 后端参数名是 severity
      severity: filterSeverity.value === 'all' ? '' : filterSeverity.value,
      status: filterStatus.value === 'all' ? '' : filterStatus.value
    })
    if (response.code !== 200) {
      message.error(response.message || '加载工单失败')
      issues.value = []
      totalPages.value = 1
      return
    }
    // 不再回落到演示数据：失败就说失败
    issues.value = (response.data.list ?? []).map(toRow)
    totalPages.value = Math.max(1, Math.ceil((response.data.total ?? 0) / 10))
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载工单失败')
    issues.value = []
    totalPages.value = 1
  }
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
  selectedIssue.value = { ...issue }
  showDetailModal.value = true
  // 处置历史单独取：列表不返回它（一页 10 行各带一串历史会把列表响应撑大）
  void (async () => {
    try {
      const response = await getQualityDetail(issue.id)
      if (response.code === 200 && selectedIssue.value && selectedIssue.value.id === issue.id) {
        const histories = response.data?.handleHistories ?? []
        selectedIssue.value = {
          ...selectedIssue.value,
          resolveRemark: response.data?.resolveRemark,
          logs: histories.map(h => ({ time: h.time, action: h.action, operator: h.operator, remark: h.remark }))
        }
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载处置历史失败')
    }
  })()
}

const processIssue = async (issue) => {
  if (issue.status === 'resolved' || issue.status === 'closed') return
  try {
    const response = await handleQualityIssue(issue.id, { status: 'processing', remark: '开始处理' })
    if (response.code === 200) {
      message.success(`工单「${issue.code}」已开始处理`)
      await loadData()
      if (showDetailModal.value) {
        viewIssue({ ...issue, status: 'processing' })
      }
    } else {
      message.error(response.message || '操作失败')
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '操作失败')
  }
}

const closeIssue = async (issue) => {
  if (!confirm(`确定关闭工单 "${issue.code}" 吗？`)) {
    return
  }
  try {
    // 关闭 = 标记为已解决（状态口径：pending / processing / resolved / ignored）
    const response = await handleQualityIssue(issue.id, { status: 'resolved', remark: '工单关闭' })
    if (response.code === 200) {
      message.success('工单已关闭')
      await loadData()
      closeDetailModal()
    } else {
      message.error(response.message || '操作失败')
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '操作失败')
  }
}

/** 页面上的数据域下拉值 → 后端用的域编码与名称 */
const DOMAIN_LABELS = {
  user: ['user', '用户主数据'],
  organization: ['org', '组织主数据'],
  product: ['product', '商品主数据'],
  customer: ['customer', '客户主数据'],
  supplier: ['supplier', '供应商主数据']
}

const saveIssue = async () => {
  if (!form.description) {
    message.warning('请填写问题描述')
    return
  }

  if (isEdit.value) {
    // 后端目前只支持"登记"与"处置"，不支持改问题描述 —— 改描述属于篡改检测结论，
    // 真要改应该重新登记一条。这里如实说明，不假装保存成功。
    message.warning('质量问题不支持修改描述，请关闭后重新登记')
    return
  }

  const [domainCode, domainName] = DOMAIN_LABELS[form.domain] ?? ['user', '用户主数据']
  try {
    const response = await createQualityIssue({
      description: form.description,
      domainCode,
      domainName,
      severity: form.severity
    })
    if (response.code === 200) {
      message.success('工单已创建')
      closeAddModal()
      await loadData()
    } else {
      message.error(response.message || '创建失败')
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '创建失败')
  }
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

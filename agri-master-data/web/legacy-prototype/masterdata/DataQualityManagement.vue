<template>
  <div class="data-quality-management">
    <div class="page-header">
      <div class="header-left">
        <h1>数据质量管理</h1>
        <p>配置质量规则，监控数据质量</p>
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

    <div v-if="activeTab === 'dashboard'" class="tab-content">
      <div class="dashboard-stats">
        <div class="stat-card">
          <div class="stat-icon quality">📊</div>
          <div class="stat-info">
            <span class="stat-value">{{ qualityScore }}</span>
            <span class="stat-label">整体质量评分</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon total">📋</div>
          <div class="stat-info">
            <span class="stat-value">{{ totalIssues }}</span>
            <span class="stat-label">问题总数</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon pending">🔴</div>
          <div class="stat-info">
            <span class="stat-value">{{ pendingIssues }}</span>
            <span class="stat-label">待处理问题</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon resolved">✅</div>
          <div class="stat-info">
            <span class="stat-value">{{ resolvedIssues }}</span>
            <span class="stat-label">已解决问题</span>
          </div>
        </div>
      </div>

      <div class="dashboard-row">
        <div class="chart-card">
          <h3>质量趋势</h3>
          <div class="chart-container">
            <div class="chart-bars">
              <div v-for="(item, index) in trendData" :key="index" class="chart-bar-item">
                <div class="bar-wrapper">
                  <div class="bar" :style="{ height: item.value + '%' }"></div>
                </div>
                <span class="bar-label">{{ item.label }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="chart-card">
          <h3>问题分布</h3>
          <div class="chart-container">
            <div class="pie-chart">
              <div class="pie" :style="pieStyle">
                <div class="pie-center">{{ issueDistribution.total }}</div>
              </div>
            </div>
            <div class="pie-legend">
              <div v-for="item in issueDistribution.items" :key="item.type" class="legend-item">
                <span class="legend-color" :style="{ background: item.color }"></span>
                <span class="legend-label">{{ item.label }}</span>
                <span class="legend-value">{{ item.count }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="recent-issues">
        <h3>最近问题</h3>
        <table class="issues-table">
          <thead>
            <tr>
              <th>问题ID</th>
              <th>类型</th>
              <th>严重程度</th>
              <th>状态</th>
              <th>发现时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="issue in recentIssues" :key="issue.id">
              <td>{{ issue.id }}</td>
              <td><span class="type-badge">{{ getIssueTypeLabel(issue.type) }}</span></td>
              <td><span :class="['severity-badge', issue.severity]">{{ getSeverityLabel(issue.severity) }}</span></td>
              <td><span :class="['status-badge', issue.status]">{{ getStatusLabel(issue.status) }}</span></td>
              <td>{{ issue.discoverTime }}</td>
              <td>
                <button class="action-btn" @click="viewIssue(issue)">查看</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="activeTab === 'rules'" class="tab-content">
      <div class="rules-header">
        <div class="filter-group">
          <select v-model="ruleTypeFilter" class="filter-select">
            <option value="">全部类型</option>
            <option value="completeness">完整性</option>
            <option value="accuracy">准确性</option>
            <option value="consistency">一致性</option>
            <option value="timeliness">时效性</option>
          </select>
        </div>
        <button class="btn btn-primary" @click="openRuleModal">新建规则</button>
      </div>

      <div class="rules-list">
        <div v-for="rule in rules" :key="rule.id" class="rule-card">
          <div class="rule-header">
            <div class="rule-info">
              <span class="rule-name">{{ rule.name }}</span>
              <span :class="['rule-type', rule.type]">{{ getRuleTypeLabel(rule.type) }}</span>
            </div>
            <span :class="['rule-status', rule.enabled ? 'enabled' : 'disabled']">
              {{ rule.enabled ? '启用' : '禁用' }}
            </span>
          </div>
          <div class="rule-body">
            <p>{{ rule.description }}</p>
          </div>
          <div class="rule-footer">
            <span class="rule-meta">适用范围: {{ rule.scope }}</span>
            <div class="rule-actions">
              <button class="action-btn edit" @click="editRule(rule)">编辑</button>
              <button class="action-btn delete" @click="deleteRule(rule)">删除</button>
              <button :class="['action-btn', rule.enabled ? 'disable' : 'enable']" @click="toggleRule(rule)">
                {{ rule.enabled ? '禁用' : '启用' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'tasks'" class="tab-content">
      <div class="tasks-header">
        <div class="filter-group">
          <select v-model="taskStatusFilter" class="filter-select">
            <option value="">全部状态</option>
            <option value="scheduled">待执行</option>
            <option value="running">运行中</option>
            <option value="completed">已完成</option>
            <option value="failed">失败</option>
          </select>
        </div>
        <button class="btn btn-primary" @click="openTaskModal">新建任务</button>
      </div>

      <div class="tasks-list">
        <div v-for="task in tasks" :key="task.id" class="task-card">
          <div class="task-header">
            <div class="task-info">
              <span class="task-name">{{ task.name }}</span>
              <span class="task-cron">{{ task.cron }}</span>
            </div>
            <span :class="['task-status', task.status]">{{ getTaskStatusLabel(task.status) }}</span>
          </div>
          <div class="task-body">
            <div class="task-meta">
              <span>规则数: {{ task.ruleCount }}</span>
              <span>上次执行: {{ task.lastRunTime || '-' }}</span>
              <span>下次执行: {{ task.nextRunTime }}</span>
            </div>
          </div>
          <div class="task-footer">
            <div class="task-actions">
              <button class="action-btn run" @click="runTask(task)">立即执行</button>
              <button class="action-btn edit" @click="editTask(task)">编辑</button>
              <button class="action-btn delete" @click="deleteTask(task)">删除</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'issues'" class="tab-content">
      <div class="issues-header">
        <div class="search-box">
          <input type="text" v-model="issueSearch" placeholder="搜索问题ID或描述..." class="search-input" />
          <button class="search-btn" @click="handleIssueSearch">搜索</button>
        </div>
        <div class="filter-group">
          <select v-model="issueStatusFilter" class="filter-select">
            <option value="">全部状态</option>
            <option value="discovered">已发现</option>
            <option value="analyzed">已分析</option>
            <option value="rectified">整改中</option>
            <option value="verified">已验证</option>
            <option value="resolved">已解决</option>
          </select>
          <select v-model="issueSeverityFilter" class="filter-select">
            <option value="">全部级别</option>
            <option value="critical">严重</option>
            <option value="high">高</option>
            <option value="medium">中</option>
            <option value="low">低</option>
          </select>
        </div>
      </div>

      <table class="issues-table">
        <thead>
          <tr>
            <th>问题ID</th>
            <th>类型</th>
            <th>严重程度</th>
            <th>状态</th>
            <th>发现时间</th>
            <th>处理人</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="issue in filteredIssues" :key="issue.id">
            <td>{{ issue.id }}</td>
            <td><span class="type-badge">{{ getIssueTypeLabel(issue.type) }}</span></td>
            <td><span :class="['severity-badge', issue.severity]">{{ getSeverityLabel(issue.severity) }}</span></td>
            <td><span :class="['status-badge', issue.status]">{{ getStatusLabel(issue.status) }}</span></td>
            <td>{{ issue.discoverTime }}</td>
            <td>{{ issue.assignee || '-' }}</td>
            <td>
              <button class="action-btn view" @click="viewIssue(issue)">查看</button>
              <button v-if="issue.status !== 'resolved'" class="action-btn process" @click="processIssue(issue)">处理</button>
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

    <div class="modal-overlay" v-if="modalVisible" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ isEditRule ? '编辑规则' : '新建规则' }}</h3>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>规则名称</label>
            <input type="text" v-model="ruleForm.name" class="form-input" placeholder="请输入规则名称" />
          </div>
          <div class="form-group">
            <label>规则类型</label>
            <select v-model="ruleForm.type" class="form-select">
              <option value="completeness">完整性</option>
              <option value="accuracy">准确性</option>
              <option value="consistency">一致性</option>
              <option value="timeliness">时效性</option>
            </select>
          </div>
          <div class="form-group">
            <label>适用范围</label>
            <input type="text" v-model="ruleForm.scope" class="form-input" placeholder="请输入适用范围" />
          </div>
          <div class="form-group">
            <label>规则描述</label>
            <textarea v-model="ruleForm.description" class="form-textarea" placeholder="请输入规则描述"></textarea>
          </div>
          <div class="form-group">
            <label>规则表达式</label>
            <textarea v-model="ruleForm.expression" class="form-textarea" placeholder="请输入规则表达式"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="closeModal">取消</button>
          <button class="btn btn-primary" @click="saveRule">{{ isEditRule ? '保存修改' : '创建' }}</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" v-if="issueDetailVisible" @click="issueDetailVisible = false">
      <div class="modal-content detail-modal" @click.stop>
        <div class="modal-header">
          <h3>问题详情</h3>
          <button class="close-btn" @click="issueDetailVisible = false">×</button>
        </div>
        <div class="modal-body" v-if="selectedIssue">
          <div class="detail-row">
            <span class="detail-label">问题ID</span>
            <span class="detail-value">{{ selectedIssue.id }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">类型</span>
            <span class="detail-value">{{ getIssueTypeLabel(selectedIssue.type) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">严重程度</span>
            <span :class="['detail-value', 'severity-badge', selectedIssue.severity]">{{ getSeverityLabel(selectedIssue.severity) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">状态</span>
            <span :class="['detail-value', 'status-badge', selectedIssue.status]">{{ getStatusLabel(selectedIssue.status) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">发现时间</span>
            <span class="detail-value">{{ selectedIssue.discoverTime }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">处理人</span>
            <span class="detail-value">{{ selectedIssue.assignee || '-' }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">问题描述</span>
            <span class="detail-value block">{{ selectedIssue.description }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">数据位置</span>
            <span class="detail-value">{{ selectedIssue.dataLocation }}</span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" @click="issueDetailVisible = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'

const tabs = [
  { key: 'dashboard', label: '质量仪表盘' },
  { key: 'rules', label: '规则配置' },
  { key: 'tasks', label: '检测任务' },
  { key: 'issues', label: '问题工单' }
]

const activeTab = ref('dashboard')
const ruleTypeFilter = ref('')
const taskStatusFilter = ref('')
const issueSearch = ref('')
const issueStatusFilter = ref('')
const issueSeverityFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const modalVisible = ref(false)
const issueDetailVisible = ref(false)
const isEditRule = ref(false)
const selectedIssue = ref(null)
const selectedRule = ref(null)

const qualityScore = ref(87)
const totalIssues = ref(156)
const pendingIssues = ref(23)
const resolvedIssues = ref(133)

const trendData = ref([
  { label: '周一', value: 78 },
  { label: '周二', value: 82 },
  { label: '周三', value: 75 },
  { label: '周四', value: 88 },
  { label: '周五', value: 85 },
  { label: '周六', value: 90 },
  { label: '周日', value: 87 }
])

const issueDistribution = ref({
  total: 156,
  items: [
    { type: 'completeness', label: '完整性问题', count: 45, color: '#dc2626' },
    { type: 'accuracy', label: '准确性问题', count: 38, color: '#d97706' },
    { type: 'consistency', label: '一致性问题', count: 42, color: '#2563eb' },
    { type: 'timeliness', label: '时效性问题', count: 31, color: '#16a34a' }
  ]
})

const pieStyle = computed(() => {
  const colors = issueDistribution.value.items.map(i => i.color)
  let gradient = 'conic-gradient('
  let currentAngle = 0
  issueDistribution.value.items.forEach(item => {
    const percentage = (item.count / issueDistribution.value.total) * 360
    gradient += `${item.color} ${currentAngle}deg ${currentAngle + percentage}deg`
    currentAngle += percentage
    if (item !== issueDistribution.value.items[issueDistribution.value.items.length - 1]) {
      gradient += ', '
    }
  })
  gradient += ')'
  return { background: gradient }
})

const rules = ref([
  { id: 1, name: '用户姓名非空校验', type: 'completeness', description: '校验用户姓名字段不能为空', scope: '用户主数据', expression: 'username != null && username != ""', enabled: true },
  { id: 2, name: '手机号格式校验', type: 'accuracy', description: '校验手机号格式是否正确', scope: '用户主数据', expression: '/^1[3-9]\\d{9}$/.test(phone)', enabled: true },
  { id: 3, name: '商品编码唯一性校验', type: 'consistency', description: '校验商品编码在系统中唯一', scope: '商品主数据', expression: 'count(productCode) == 1', enabled: true },
  { id: 4, name: '数据更新时间校验', type: 'timeliness', description: '校验数据更新时间是否在有效期内', scope: '所有主数据', expression: 'updateTime > now() - 30 days', enabled: false },
  { id: 5, name: '邮箱格式校验', type: 'accuracy', description: '校验邮箱格式是否正确', scope: '用户主数据', expression: '/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)', enabled: true },
  { id: 6, name: '组织名称唯一性校验', type: 'consistency', description: '校验组织名称在同一层级下唯一', scope: '组织主数据', expression: 'count(orgName) == 1', enabled: true }
])

const tasks = ref([
  { id: 1, name: '每日质量检测', cron: '0 0 2 * * ?', ruleCount: 6, status: 'scheduled', lastRunTime: '2026-05-08 02:00:00', nextRunTime: '2026-05-10 02:00:00' },
  { id: 2, name: '实时数据监控', cron: '*/5 * * * * ?', ruleCount: 3, status: 'running', lastRunTime: '2026-05-09 10:30:00', nextRunTime: '2026-05-09 10:35:00' },
  { id: 3, name: '周度质量报告', cron: '0 0 0 * * MON', ruleCount: 6, status: 'completed', lastRunTime: '2026-05-05 00:00:00', nextRunTime: '2026-05-12 00:00:00' },
  { id: 4, name: '数据完整性检查', cron: '0 0 1 * * ?', ruleCount: 2, status: 'scheduled', lastRunTime: '2026-05-08 01:00:00', nextRunTime: '2026-05-10 01:00:00' }
])

const issues = ref([
  { id: 'ISSUE-001', type: 'completeness', severity: 'critical', status: 'discovered', discoverTime: '2026-05-09 10:25:00', assignee: '', description: '用户ID=12345的姓名字段为空', dataLocation: '用户主数据表' },
  { id: 'ISSUE-002', type: 'accuracy', severity: 'high', status: 'analyzed', discoverTime: '2026-05-09 10:20:00', assignee: '张三', description: '手机号格式不正确', dataLocation: '用户主数据表' },
  { id: 'ISSUE-003', type: 'consistency', severity: 'medium', status: 'rectified', discoverTime: '2026-05-09 09:45:00', assignee: '李四', description: '商品编码重复', dataLocation: '商品主数据表' },
  { id: 'ISSUE-004', type: 'timeliness', severity: 'low', status: 'verified', discoverTime: '2026-05-09 09:30:00', assignee: '王五', description: '数据超过30天未更新', dataLocation: '客户主数据表' },
  { id: 'ISSUE-005', type: 'completeness', severity: 'high', status: 'resolved', discoverTime: '2026-05-08 16:00:00', assignee: '赵六', description: '邮箱字段为空', dataLocation: '用户主数据表' },
  { id: 'ISSUE-006', type: 'accuracy', severity: 'medium', status: 'discovered', discoverTime: '2026-05-09 10:15:00', assignee: '', description: '身份证号校验失败', dataLocation: '用户主数据表' }
])

const recentIssues = computed(() => issues.value.slice(0, 5))

const filteredIssues = computed(() => {
  return issues.value.filter(issue => {
    const matchKeyword = !issueSearch.value || issue.id.includes(issueSearch.value)
    const matchStatus = !issueStatusFilter.value || issue.status === issueStatusFilter.value
    const matchSeverity = !issueSeverityFilter.value || issue.severity === issueSeverityFilter.value
    return matchKeyword && matchStatus && matchSeverity
  })
})

const totalPages = computed(() => Math.ceil(filteredIssues.value.length / pageSize.value))

const ruleForm = reactive({
  name: '',
  type: 'completeness',
  scope: '',
  description: '',
  expression: ''
})

const getRuleTypeLabel = (type) => {
  const labels = { completeness: '完整性', accuracy: '准确性', consistency: '一致性', timeliness: '时效性' }
  return labels[type] || type
}

const getIssueTypeLabel = (type) => {
  const labels = { completeness: '完整性问题', accuracy: '准确性问题', consistency: '一致性问题', timeliness: '时效性问题' }
  return labels[type] || type
}

const getSeverityLabel = (severity) => {
  const labels = { critical: '严重', high: '高', medium: '中', low: '低' }
  return labels[severity] || severity
}

const getStatusLabel = (status) => {
  const labels = { discovered: '已发现', analyzed: '已分析', rectified: '整改中', verified: '已验证', resolved: '已解决' }
  return labels[status] || status
}

const getTaskStatusLabel = (status) => {
  const labels = { scheduled: '待执行', running: '运行中', completed: '已完成', failed: '失败' }
  return labels[status] || status
}

const openRuleModal = () => {
  isEditRule.value = false
  ruleForm.name = ''
  ruleForm.type = 'completeness'
  ruleForm.scope = ''
  ruleForm.description = ''
  ruleForm.expression = ''
  modalVisible.value = true
}

const editRule = (rule) => {
  isEditRule.value = true
  selectedRule.value = rule
  ruleForm.name = rule.name
  ruleForm.type = rule.type
  ruleForm.scope = rule.scope
  ruleForm.description = rule.description
  ruleForm.expression = rule.expression
  modalVisible.value = true
}

const deleteRule = (rule) => {
  if (confirm(`确定要删除规则 ${rule.name} 吗？`)) {
    const index = rules.value.findIndex(r => r.id === rule.id)
    if (index > -1) {
      rules.value.splice(index, 1)
    }
  }
}

const toggleRule = (rule) => {
  rule.enabled = !rule.enabled
}

const saveRule = () => {
  if (!ruleForm.name || !ruleForm.scope) {
    alert('请填写必填字段')
    return
  }
  if (isEditRule.value) {
    const rule = rules.value.find(r => r.id === selectedRule.value.id)
    if (rule) {
      rule.name = ruleForm.name
      rule.type = ruleForm.type
      rule.scope = ruleForm.scope
      rule.description = ruleForm.description
      rule.expression = ruleForm.expression
    }
    alert('规则已更新')
  } else {
    const newRule = {
      id: Date.now(),
      name: ruleForm.name,
      type: ruleForm.type,
      description: ruleForm.description,
      scope: ruleForm.scope,
      expression: ruleForm.expression,
      enabled: true
    }
    rules.value.push(newRule)
    alert('规则创建成功')
  }
  closeModal()
}

const closeModal = () => {
  modalVisible.value = false
  selectedRule.value = null
}

const openTaskModal = () => {
  alert('新建检测任务功能开发中...')
}

const editTask = (task) => {
  alert('编辑检测任务功能开发中...')
}

const deleteTask = (task) => {
  if (confirm(`确定要删除任务 ${task.name} 吗？`)) {
    const index = tasks.value.findIndex(t => t.id === task.id)
    if (index > -1) {
      tasks.value.splice(index, 1)
    }
  }
}

const runTask = (task) => {
  if (confirm(`确定要立即执行任务 ${task.name} 吗？`)) {
    task.status = 'running'
    task.lastRunTime = new Date().toLocaleString()
    alert('任务已启动')
  }
}

const viewIssue = (issue) => {
  selectedIssue.value = issue
  issueDetailVisible.value = true
}

const processIssue = (issue) => {
  const statuses = ['discovered', 'analyzed', 'rectified', 'verified', 'resolved']
  const currentIndex = statuses.indexOf(issue.status)
  if (currentIndex < statuses.length - 1) {
    issue.status = statuses[currentIndex + 1]
    if (!issue.assignee) {
      issue.assignee = '当前用户'
    }
    alert('问题状态已更新')
  }
}

const handleIssueSearch = () => {
  currentPage.value = 1
}

const prevPage = () => {
  if (currentPage.value > 1) currentPage.value--
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) currentPage.value++
}

onMounted(() => {})
</script>

<style scoped>
.data-quality-management {
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

.dashboard-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: #f8fafc;
  border-radius: 12px;
}

.stat-icon {
  font-size: 32px;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border-radius: 12px;
}

.stat-info {
  flex: 1;
}

.stat-value {
  display: block;
  font-size: 28px;
  font-weight: 700;
  color: #2d3748;
}

.stat-label {
  font-size: 13px;
  color: #a0aec0;
}

.dashboard-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.chart-card {
  background: #f8fafc;
  border-radius: 12px;
  padding: 20px;
}

.chart-card h3 {
  font-size: 16px;
  color: #2d3748;
  margin: 0 0 16px;
}

.chart-container {
  height: 200px;
}

.chart-bars {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  height: 100%;
  padding-bottom: 24px;
}

.chart-bar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.bar-wrapper {
  width: 30px;
  height: 150px;
  background: #e2e8f0;
  border-radius: 4px;
  display: flex;
  align-items: flex-end;
}

.bar {
  width: 100%;
  background: linear-gradient(to top, #238636, #3fb950);
  border-radius: 4px;
  transition: height 0.3s;
}

.bar-label {
  font-size: 12px;
  color: #a0aec0;
  margin-top: 8px;
}

.pie-chart {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 150px;
}

.pie {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pie-center {
  width: 60px;
  height: 60px;
  background: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
}

.pie-legend {
  margin-top: 16px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

.legend-label {
  flex: 1;
  font-size: 13px;
  color: #4a5568;
}

.legend-value {
  font-size: 13px;
  font-weight: 600;
  color: #2d3748;
}

.recent-issues {
  margin-top: 24px;
}

.recent-issues h3 {
  font-size: 16px;
  color: #2d3748;
  margin: 0 0 16px;
}

.issues-table {
  width: 100%;
  border-collapse: collapse;
}

.issues-table th,
.issues-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
}

.issues-table th {
  font-size: 13px;
  font-weight: 600;
  color: #4a5568;
  background: #f8fafc;
}

.issues-table td {
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

.severity-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.severity-badge.critical {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}

.severity-badge.high {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
}

.severity-badge.medium {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.severity-badge.low {
  background: rgba(156, 163, 175, 0.1);
  color: #6b7280;
}

.status-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.status-badge.discovered {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}

.status-badge.analyzed {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.status-badge.rectified {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
}

.status-badge.verified {
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
}

.status-badge.resolved {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
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

.action-btn.process {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
}

.action-btn.edit {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
}

.action-btn.delete {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}

.action-btn.run {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.action-btn.enable {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.action-btn.disable {
  background: rgba(156, 163, 175, 0.1);
  color: #6b7280;
}

.rules-header,
.tasks-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
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

.rules-list,
.tasks-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.rule-card,
.task-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
}

.rule-header,
.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.rule-info,
.task-info {
  display: flex;
  gap: 12px;
  align-items: center;
}

.rule-name,
.task-name {
  font-size: 14px;
  font-weight: 600;
  color: #2d3748;
}

.rule-type {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
}

.rule-type.completeness {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}

.rule-type.accuracy {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
}

.rule-type.consistency {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.rule-type.timeliness {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.rule-status {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 12px;
}

.rule-status.enabled {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.rule-status.disabled {
  background: rgba(156, 163, 175, 0.1);
  color: #6b7280;
}

.task-status {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 12px;
}

.task-status.scheduled {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.task-status.running {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
}

.task-status.completed {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.task-status.failed {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}

.rule-body,
.task-body {
  padding: 16px;
}

.rule-body p {
  font-size: 13px;
  color: #4a5568;
  margin: 0;
}

.task-meta {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #4a5568;
}

.task-cron {
  font-size: 12px;
  color: #a0aec0;
  font-family: monospace;
}

.rule-footer,
.task-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-top: 1px solid #e2e8f0;
}

.rule-meta {
  font-size: 12px;
  color: #a0aec0;
}

.rule-actions,
.task-actions {
  display: flex;
  gap: 8px;
}

.issues-header {
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
</style>
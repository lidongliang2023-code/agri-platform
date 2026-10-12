<template>
  <div class="quality-task">
    <div class="page-header">
      <div class="header-left">
        <h1>质量检测任务</h1>
        <p>管理质量检测任务调度与执行</p>
      </div>
      <button class="add-btn" @click="showAddModal = true">+ 新建任务</button>
    </div>

    <div class="filter-bar">
      <select v-model="filterStatus" class="filter-select">
        <option value="all">全部状态</option>
        <option value="scheduled">待执行</option>
        <option value="running">执行中</option>
        <option value="completed">已完成</option>
        <option value="failed">失败</option>
      </select>
      <input 
        type="text" 
        v-model="filterKeyword" 
        placeholder="搜索任务名称..." 
        class="filter-input"
      />
    </div>

    <div class="stats-row">
      <div class="stat-item">
        <div class="stat-value">{{ taskStats.total }}</div>
        <div class="stat-label">总任务数</div>
      </div>
      <div class="stat-item running">
        <div class="stat-value">{{ taskStats.running }}</div>
        <div class="stat-label">执行中</div>
      </div>
      <div class="stat-item completed">
        <div class="stat-value">{{ taskStats.completed }}</div>
        <div class="stat-label">已完成</div>
      </div>
      <div class="stat-item failed">
        <div class="stat-value">{{ taskStats.failed }}</div>
        <div class="stat-label">失败</div>
      </div>
    </div>

    <div class="task-table">
      <table class="data-table">
        <thead>
          <tr>
            <th>任务名称</th>
            <th>检测规则</th>
            <th>执行类型</th>
            <th>下次执行时间</th>
            <th>状态</th>
            <th>最近执行</th>
            <th>成功率</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="task in filteredTasks" :key="task.id">
            <td>
              <div class="task-name">
                <span class="task-icon">{{ getTaskIcon(task.type) }}</span>
                <span>{{ task.name }}</span>
              </div>
            </td>
            <td>{{ task.ruleNames.join(', ') }}</td>
            <td>
              <span class="type-badge" :class="task.type">
                {{ task.type === 'manual' ? '手动' : task.type === 'scheduled' ? '定时' : '实时' }}
              </span>
            </td>
            <td>{{ task.nextRunTime || '-' }}</td>
            <td>
              <span class="status-badge" :class="task.status">
                {{ getStatusText(task.status) }}
              </span>
            </td>
            <td>{{ task.lastRunTime || '-' }}</td>
            <td>
              <div class="success-rate">
                <div class="rate-bar">
                  <div 
                    class="rate-fill" 
                    :style="{width: task.successRate + '%'}"
                    :class="getRateClass(task.successRate)"
                  ></div>
                </div>
                <span>{{ task.successRate }}%</span>
              </div>
            </td>
            <td class="action-cell">
              <button 
                class="action-btn run" 
                @click="runTask(task)"
                :disabled="task.status === 'running'"
              >执行</button>
              <button class="action-btn edit" @click="editTask(task)">编辑</button>
              <button class="action-btn delete" @click="deleteTask(task)">删除</button>
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
          <h3>{{ isEdit ? '编辑任务' : '新建任务' }}</h3>
          <button class="close-btn" @click="closeAddModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>任务名称 *</label>
            <input type="text" v-model="form.name" class="form-input" placeholder="请输入任务名称" />
          </div>
          <div class="form-group">
            <label>执行类型 *</label>
            <select v-model="form.type" class="form-input" @change="onTypeChange">
              <option value="manual">手动执行</option>
              <option value="scheduled">定时执行</option>
              <option value="realtime">实时检测</option>
            </select>
          </div>
          <div class="form-group" v-if="form.type === 'scheduled'">
            <label>执行周期 *</label>
            <select v-model="form.cronExpression" class="form-input">
              <option value="0 0 2 * * ?">每天凌晨2点</option>
              <option value="0 0 2 * * MON">每周一凌晨2点</option>
              <option value="0 0 2 1 * ?">每月1日凌晨2点</option>
              <option value="0 */30 * * * ?">每30分钟</option>
              <option value="0 0 * * * ?">每小时</option>
            </select>
          </div>
          <div class="form-group">
            <label>关联规则 *</label>
            <div class="rule-select">
              <div 
                v-for="rule in availableRules" 
                :key="rule.id"
                class="rule-checkbox"
                :class="{selected: form.ruleIds.includes(rule.id)}"
                @click="toggleRule(rule.id)"
              >
                <input type="checkbox" :checked="form.ruleIds.includes(rule.id)" />
                <span>{{ rule.name }}</span>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" v-model="form.enabled" /> 启用任务
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="closeAddModal">取消</button>
          <button class="btn btn-primary" @click="saveTask">{{ isEdit ? '保存修改' : '创建任务' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'

const showAddModal = ref(false)
const isEdit = ref(false)
const filterStatus = ref('all')
const filterKeyword = ref('')
const currentPage = ref(1)
const totalPages = ref(1)

const form = reactive({
  id: null,
  name: '',
  type: 'manual',
  cronExpression: '0 0 2 * * ?',
  ruleIds: [],
  enabled: true
})

const tasks = ref([])
const availableRules = ref([])

const mockTasks = [
  { id: 1, name: '每日用户数据质量检测', type: 'scheduled', ruleNames: ['用户名完整性检查', '手机号格式验证'], ruleIds: [1, 2], nextRunTime: '2026-05-10 02:00:00', status: 'scheduled', lastRunTime: '2026-05-09 02:00:00', successRate: 99 },
  { id: 2, name: '实时用户认证检测', type: 'realtime', ruleNames: ['身份证号验证', '邮箱格式验证'], ruleIds: [3, 7], nextRunTime: '-', status: 'running', lastRunTime: '刚刚', successRate: 98 },
  { id: 3, name: '每周组织数据一致性检查', type: 'scheduled', ruleNames: ['组织名称一致性'], ruleIds: [4], nextRunTime: '2026-05-12 02:00:00', status: 'scheduled', lastRunTime: '2026-05-05 02:00:00', successRate: 100 },
  { id: 4, name: '供应商资质到期检测', type: 'scheduled', ruleNames: ['供应商资质有效期'], ruleIds: [8], nextRunTime: '2026-05-10 02:00:00', status: 'completed', lastRunTime: '2026-05-09 02:00:00', successRate: 95 },
  { id: 5, name: '商品编码唯一性检查', type: 'manual', ruleNames: ['商品编码唯一性'], ruleIds: [5], nextRunTime: '-', status: 'failed', lastRunTime: '2026-05-08 15:30:00', successRate: 90 },
  { id: 6, name: '客户数据时效性检测', type: 'scheduled', ruleNames: ['数据更新时效性'], ruleIds: [6], nextRunTime: '2026-05-10 02:00:00', status: 'scheduled', lastRunTime: '2026-05-09 02:00:00', successRate: 97 }
]

const mockRules = [
  { id: 1, name: '用户名完整性检查' },
  { id: 2, name: '手机号格式验证' },
  { id: 3, name: '身份证号验证' },
  { id: 4, name: '组织名称一致性' },
  { id: 5, name: '商品编码唯一性' },
  { id: 6, name: '数据更新时效性' },
  { id: 7, name: '邮箱格式验证' },
  { id: 8, name: '供应商资质有效期' }
]

const filteredTasks = computed(() => {
  return tasks.value.filter(task => {
    const matchStatus = filterStatus.value === 'all' || task.status === filterStatus.value
    const matchKeyword = !filterKeyword.value || task.name.toLowerCase().includes(filterKeyword.value.toLowerCase())
    return matchStatus && matchKeyword
  })
})

const taskStats = computed(() => ({
  total: tasks.value.length,
  running: tasks.value.filter(t => t.status === 'running').length,
  completed: tasks.value.filter(t => t.status === 'completed').length,
  failed: tasks.value.filter(t => t.status === 'failed').length
}))

const getTaskIcon = (type) => {
  const icons = {
    manual: '▶️',
    scheduled: '⏰',
    realtime: '⚡'
  }
  return icons[type] || '📋'
}

const getStatusText = (status) => {
  const texts = {
    scheduled: '待执行',
    running: '执行中',
    completed: '已完成',
    failed: '失败'
  }
  return texts[status] || status
}

const getRateClass = (rate) => {
  if (rate >= 95) return 'excellent'
  if (rate >= 90) return 'good'
  if (rate >= 80) return 'normal'
  return 'poor'
}

const toggleRule = (ruleId) => {
  const index = form.ruleIds.indexOf(ruleId)
  if (index === -1) {
    form.ruleIds.push(ruleId)
  } else {
    form.ruleIds.splice(index, 1)
  }
}

const onTypeChange = () => {
  if (form.type === 'scheduled') {
    form.cronExpression = '0 0 2 * * ?'
  }
}

const loadData = () => {
  tasks.value = mockTasks
  availableRules.value = mockRules
  totalPages.value = Math.ceil(tasks.value.length / 10)
}

onMounted(() => {
  loadData()
})

const closeAddModal = () => {
  showAddModal.value = false
  isEdit.value = false
  Object.keys(form).forEach(key => {
    form[key] = key === 'type' ? 'manual' : key === 'cronExpression' ? '0 0 2 * * ?' : key === 'ruleIds' ? [] : key === 'enabled' ? true : ''
  })
}

const editTask = (task) => {
  isEdit.value = true
  Object.assign(form, {
    id: task.id,
    name: task.name,
    type: task.type,
    ruleIds: [...task.ruleIds],
    enabled: task.status !== 'disabled'
  })
  showAddModal.value = true
}

const deleteTask = (task) => {
  if (confirm(`确定删除任务 "${task.name}" 吗？`)) {
    tasks.value = tasks.value.filter(t => t.id !== task.id)
    alert('任务已删除')
  }
}

const runTask = (task) => {
  if (task.status === 'running') return
  task.status = 'running'
  alert(`任务 "${task.name}" 已开始执行`)
  setTimeout(() => {
    task.status = 'completed'
    task.lastRunTime = '刚刚'
  }, 2000)
}

const saveTask = () => {
  if (!form.name || form.ruleIds.length === 0) {
    alert('请填写任务名称并选择至少一个检测规则')
    return
  }

  if (isEdit.value) {
    const index = tasks.value.findIndex(t => t.id === form.id)
    if (index !== -1) {
      const ruleNames = form.ruleIds.map(id => availableRules.value.find(r => r.id === id)?.name || '')
      tasks.value[index] = {
        ...tasks.value[index],
        name: form.name,
        type: form.type,
        ruleIds: [...form.ruleIds],
        ruleNames,
        status: form.enabled ? tasks.value[index].status : 'disabled'
      }
    }
    alert('任务已更新')
  } else {
    const ruleNames = form.ruleIds.map(id => availableRules.value.find(r => r.id === id)?.name || '')
    tasks.value.push({
      id: Date.now(),
      name: form.name,
      type: form.type,
      ruleIds: [...form.ruleIds],
      ruleNames,
      nextRunTime: form.type === 'scheduled' ? '2026-05-10 02:00:00' : '-',
      status: form.enabled ? 'scheduled' : 'disabled',
      lastRunTime: '-',
      successRate: 0
    })
    alert('任务已创建')
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
.quality-task {
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
  padding: 20px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.stat-item.running .stat-value {
  color: #238636;
}

.stat-item.completed .stat-value {
  color: #2563eb;
}

.stat-item.failed .stat-value {
  color: #dc2626;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #2d3748;
  margin: 0;
}

.stat-label {
  font-size: 13px;
  color: #718096;
  margin: 4px 0 0;
}

.task-table {
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

.task-name {
  display: flex;
  align-items: center;
  gap: 10px;
}

.task-icon {
  font-size: 16px;
}

.type-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.type-badge.manual {
  background: rgba(156, 163, 175, 0.1);
  color: #6b7280;
}

.type-badge.scheduled {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
}

.type-badge.realtime {
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

.status-badge.scheduled {
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
}

.status-badge.running {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.status-badge.completed {
  background: rgba(156, 163, 175, 0.1);
  color: #6b7280;
}

.status-badge.failed {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.success-rate {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rate-bar {
  width: 60px;
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
}

.rate-fill {
  height: 100%;
  border-radius: 3px;
}

.rate-fill.excellent {
  background: #238636;
}

.rate-fill.good {
  background: #2ea043;
}

.rate-fill.normal {
  background: #d29922;
}

.rate-fill.poor {
  background: #dc2626;
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

.action-btn.run {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.action-btn.run:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn.edit {
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
}

.action-btn.delete {
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

.rule-select {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.rule-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.rule-checkbox.selected {
  background: rgba(35, 134, 54, 0.1);
  border-color: #238636;
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
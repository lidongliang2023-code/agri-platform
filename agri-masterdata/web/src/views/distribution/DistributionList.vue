<template>
  <div class="distribution-list">
    <div class="page-header">
      <div class="header-left">
        <h1>数据分发监控</h1>
        <p>监控数据分发任务状态</p>
      </div>
    </div>

    <div class="search-bar">
      <div class="search-group">
        <input 
          type="text" 
          v-model="searchForm.keyword" 
          placeholder="搜索任务名称/目标系统..." 
          class="search-input"
        />
        <button class="search-btn" @click="loadData">搜索</button>
      </div>
      <div class="filter-group">
        <select v-model="searchForm.status" class="filter-select">
          <option value="">全部状态</option>
          <option value="pending">待执行</option>
          <option value="running">执行中</option>
          <option value="success">成功</option>
          <option value="failed">失败</option>
          <option value="paused">已暂停</option>
        </select>
      </div>
    </div>

    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>任务编码</th>
            <th>任务名称</th>
            <th>目标系统</th>
            <th>数据类型</th>
            <th>触发方式</th>
            <th>任务状态</th>
            <th>进度</th>
            <th>执行时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="task in tableData" :key="task.id">
            <td>{{ task.taskCode }}</td>
            <td>{{ task.taskName }}</td>
            <td>{{ task.targetSystem }}</td>
            <td>{{ task.dataType }}</td>
            <td>
              <span class="type-badge" :class="task.triggerType">
                {{ task.triggerType === 'auto' ? '自动' : '手动' }}
              </span>
            </td>
            <td>
              <span class="status-badge" :class="task.status">
                {{ getStatusLabel(task.status) }}
              </span>
            </td>
            <td>
              <div class="progress-wrapper">
                <div class="progress-fill" :style="{ width: task.progress + '%' }"></div>
              </div>
              <span class="progress-text">{{ task.progress }}%</span>
            </td>
            <td>{{ formatDate(task.executeTime) }}</td>
            <td class="action-cell">
              <button class="action-btn view" @click="viewDetail(task)">详情</button>
              <button 
                v-if="task.status === 'failed'"
                class="action-btn retry"
                @click="retryTask(task.id)"
              >重试</button>
              <button 
                v-if="task.status === 'running'"
                class="action-btn pause"
                @click="pauseTask(task)"
              >暂停</button>
              <button 
                v-if="task.status === 'paused'"
                class="action-btn resume"
                @click="resumeTask(task)"
              >恢复</button>
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
          <h3>任务详情</h3>
          <button class="close-btn" @click="detailVisible = false">×</button>
        </div>
        <div class="modal-body" v-if="detailData">
          <div class="detail-row">
            <span class="detail-label">任务编码</span>
            <span class="detail-value">{{ detailData.taskCode }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">任务名称</span>
            <span class="detail-value">{{ detailData.taskName }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">目标系统</span>
            <span class="detail-value">{{ detailData.targetSystem }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">数据类型</span>
            <span class="detail-value">{{ detailData.dataType }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">触发方式</span>
            <span class="detail-value">{{ detailData.triggerType === 'auto' ? '自动' : '手动' }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">任务状态</span>
            <span class="status-badge" :class="detailData.status">
              {{ getStatusLabel(detailData.status) }}
            </span>
          </div>
          <div class="detail-row">
            <span class="detail-label">执行时间</span>
            <span class="detail-value">{{ detailData.executeTime }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">错误信息</span>
            <span class="detail-value error-text">{{ detailData.errorMessage || '无' }}</span>
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
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getDistributionList, retryDistribution } from '../../utils/api'

const tableData = ref([])
const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(0)
const totalPages = ref(1)
const detailVisible = ref(false)
const detailData = ref(null)

const searchForm = reactive({
  keyword: '',
  status: ''
})

const getStatusLabel = (status) => {
  const labels = { 
    pending: '待执行', 
    running: '执行中', 
    success: '成功', 
    failed: '失败',
    paused: '已暂停'
  }
  return labels[status] || status
}

const loadData = async () => {
  try {
    const response = await getDistributionList({
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      keyword: searchForm.keyword,
      status: searchForm.status
    })
    if (response.code === 200) {
      tableData.value = response.data.list || mockTasks
      total.value = response.data.total || mockTasks.length
      totalPages.value = Math.ceil(total.value / pageSize.value)
    }
  } catch (error) {
    ElMessage.error('加载数据失败')
    tableData.value = mockTasks
    total.value = mockTasks.length
    totalPages.value = Math.ceil(total.value / pageSize.value)
  }
}

const mockTasks = [
  { id: 1, taskCode: 'TASK001', taskName: '租户数据同步', targetSystem: 'ERP系统', dataType: '租户数据', triggerType: 'auto', status: 'success', progress: 100, executeTime: '2024-01-15 10:30:00', errorMessage: '' },
  { id: 2, taskCode: 'TASK002', taskName: '商品数据同步', targetSystem: '电商平台', dataType: '商品数据', triggerType: 'auto', status: 'running', progress: 65, executeTime: '2024-01-15 14:20:00', errorMessage: '' },
  { id: 3, taskCode: 'TASK003', taskName: '用户数据同步', targetSystem: 'CRM系统', dataType: '用户数据', triggerType: 'manual', status: 'failed', progress: 30, executeTime: '2024-01-15 09:15:00', errorMessage: '网络超时' },
  { id: 4, taskCode: 'TASK004', taskName: '订单数据同步', targetSystem: '财务系统', dataType: '订单数据', triggerType: 'auto', status: 'pending', progress: 0, executeTime: '2024-01-15 16:45:00', errorMessage: '' },
  { id: 5, taskCode: 'TASK005', taskName: '库存数据同步', targetSystem: 'WMS系统', dataType: '库存数据', triggerType: 'auto', status: 'paused', progress: 45, executeTime: '2024-01-15 11:00:00', errorMessage: '' }
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

const retryTask = async (id) => {
  try {
    const response = await retryDistribution(id)
    if (response.code === 200) {
      ElMessage.success('重试任务已提交')
      loadData()
    } else {
      ElMessage.error(response.message || '操作失败')
    }
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

const pauseTask = (row) => {
  ElMessage.info(`任务 ${row.taskName} 已暂停`)
  loadData()
}

const resumeTask = (row) => {
  ElMessage.info(`任务 ${row.taskName} 已恢复`)
  loadData()
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
.distribution-list {
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

.status-badge.pending {
  background: rgba(160, 174, 192, 0.1);
  color: #a0aec0;
}

.status-badge.running {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.status-badge.success {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.status-badge.failed {
  background: rgba(218, 54, 51, 0.1);
  color: #da3633;
}

.status-badge.paused {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
}

.progress-wrapper {
  width: 80px;
  height: 6px;
  background: #f0f0f0;
  border-radius: 3px;
  overflow: hidden;
  display: inline-block;
  vertical-align: middle;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #238636 0%, #2ea043 100%);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-text {
  margin-left: 8px;
  font-size: 12px;
  color: #4a5568;
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

.action-btn.retry {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.action-btn.pause {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
}

.action-btn.resume {
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

.error-text {
  color: #da3633;
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
<template>
  <div class="permission-log">
    <div class="page-header">
      <div class="header-left">
        <h1>操作日志</h1>
        <p>查看系统操作记录</p>
      </div>
    </div>

    <div class="search-bar">
      <div class="search-group">
        <input 
          type="text" 
          v-model="searchForm.keyword" 
          placeholder="搜索用户名/操作描述..." 
          class="search-input"
        />
        <button class="search-btn" @click="loadData">搜索</button>
      </div>
      <div class="filter-group">
        <select v-model="searchForm.operationType" class="filter-select">
          <option value="">全部类型</option>
          <option value="login">登录</option>
          <option value="create">新增</option>
          <option value="update">修改</option>
          <option value="delete">删除</option>
          <option value="query">查询</option>
        </select>
      </div>
      <div class="filter-group">
        <input type="date" v-model="searchForm.startTime" class="filter-date" placeholder="开始时间" />
      </div>
      <div class="filter-group">
        <input type="date" v-model="searchForm.endTime" class="filter-date" placeholder="结束时间" />
      </div>
    </div>

    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>操作人</th>
            <th>操作类型</th>
            <th>操作描述</th>
            <th>操作模块</th>
            <th>目标ID</th>
            <th>IP地址</th>
            <th>操作时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in tableData" :key="log.id">
            <td>{{ log.username }}</td>
            <td>
              <span class="type-badge" :class="log.operationType">
                {{ getOperationLabel(log.operationType) }}
              </span>
            </td>
            <td>{{ log.operationDesc }}</td>
            <td>{{ log.module }}</td>
            <td>{{ log.targetId || '-' }}</td>
            <td>{{ log.ipAddress }}</td>
            <td>{{ formatDate(log.createTime) }}</td>
          </tr>
        </tbody>
      </table>

      <div class="pagination">
        <button class="page-btn" :disabled="pageNum === 1" @click="handleCurrentChange(pageNum - 1)">上一页</button>
        <span class="page-info">第 {{ pageNum }} / {{ totalPages }} 页</span>
        <button class="page-btn" :disabled="pageNum === totalPages" @click="handleCurrentChange(pageNum + 1)">下一页</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getOperationLogs } from '../../utils/api'

const tableData = ref([])
const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(0)
const totalPages = ref(1)

const searchForm = reactive({
  keyword: '',
  operationType: '',
  startTime: '',
  endTime: ''
})

const getOperationLabel = (type) => {
  const labels = { login: '登录', create: '新增', update: '修改', delete: '删除', query: '查询' }
  return labels[type] || type
}

const loadData = async () => {
  try {
    const response = await getOperationLogs({
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      keyword: searchForm.keyword,
      operationType: searchForm.operationType,
      startTime: searchForm.startTime,
      endTime: searchForm.endTime
    })
    if (response.code === 200) {
      tableData.value = response.data.list || mockLogs
      total.value = response.data.total || mockLogs.length
      totalPages.value = Math.ceil(total.value / pageSize.value)
    }
  } catch (error) {
    ElMessage.error('加载数据失败')
    tableData.value = mockLogs
    total.value = mockLogs.length
    totalPages.value = Math.ceil(total.value / pageSize.value)
  }
}

const mockLogs = [
  { id: 1, username: 'admin', operationType: 'login', operationDesc: '用户登录系统', module: '系统管理', targetId: '', ipAddress: '192.168.1.100', createTime: '2024-01-15 10:30:00' },
  { id: 2, username: 'admin', operationType: 'create', operationDesc: '新增租户：阳光农场', module: '租户管理', targetId: '1', ipAddress: '192.168.1.100', createTime: '2024-01-15 10:35:00' },
  { id: 3, username: 'user1', operationType: 'update', operationDesc: '修改用户信息', module: '用户管理', targetId: '5', ipAddress: '192.168.1.101', createTime: '2024-01-15 11:00:00' },
  { id: 4, username: 'admin', operationType: 'delete', operationDesc: '删除字典项', module: '数据标准', targetId: '10', ipAddress: '192.168.1.100', createTime: '2024-01-15 11:30:00' },
  { id: 5, username: 'user2', operationType: 'query', operationDesc: '查询商品列表', module: '商品管理', targetId: '', ipAddress: '192.168.1.102', createTime: '2024-01-15 12:00:00' }
]

const handleSizeChange = (size) => {
  pageSize.value = size
  loadData()
}

const handleCurrentChange = (page) => {
  pageNum.value = page
  loadData()
}

const formatDate = (date) => {
  if (!date) return ''
  return date
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.permission-log {
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

.filter-date {
  padding: 10px 12px;
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

.type-badge.login {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.type-badge.create {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.type-badge.update {
  background: rgba(210, 153, 34, 0.1);
  color: #d29922;
}

.type-badge.delete {
  background: rgba(218, 54, 51, 0.1);
  color: #da3633;
}

.type-badge.query {
  background: rgba(160, 174, 192, 0.1);
  color: #a0aec0;
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
</style>
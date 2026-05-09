<template>
  <div class="alert-list">
    <div class="search-bar">
      <el-input v-model="searchForm.keyword" placeholder="告警内容" class="search-input" />
      <el-select v-model="searchForm.level" placeholder="告警级别">
        <el-option label="全部" value="" />
        <el-option label="严重" value="critical" />
        <el-option label="警告" value="warning" />
        <el-option label="信息" value="info" />
      </el-select>
      <el-select v-model="searchForm.status" placeholder="处理状态">
        <el-option label="全部" value="" />
        <el-option label="待处理" value="pending" />
        <el-option label="已处理" value="handled" />
      </el-select>
      <el-button type="primary" @click="handleSearch">搜索</el-button>
    </div>

    <el-table :data="alertList" border class="alert-table">
      <el-table-column prop="deviceName" label="设备名称" />
      <el-table-column prop="alertType" label="告警类型" />
      <el-table-column prop="level" label="告警级别">
        <template #default="scope">
          <el-tag :type="scope.row.level === 'critical' ? 'danger' : scope.row.level === 'warning' ? 'warning' : 'info'">
            {{ scope.row.level === 'critical' ? '严重' : scope.row.level === 'warning' ? '警告' : '信息' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="content" label="告警内容" />
      <el-table-column prop="plotName" label="所属地块" />
      <el-table-column prop="status" label="处理状态">
        <template #default="scope">
          <el-tag :type="scope.row.status === 'pending' ? 'danger' : 'success'">
            {{ scope.row.status === 'pending' ? '待处理' : '已处理' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createTime" label="告警时间" />
      <el-table-column label="操作">
        <template #default="scope">
          <el-button v-if="scope.row.status === 'pending'" type="primary" size="small" @click="handleHandle(scope.row)">处理</el-button>
          <el-button type="success" size="small" @click="handleView(scope.row)">查看详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      :total="total"
      :page-size="pageSize"
      :current-page="pageNum"
      @current-change="handlePageChange"
      class="pagination"
    />

    <el-dialog title="告警详情" :visible.sync="detailDialogVisible">
      <div v-if="currentAlert">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="设备名称">{{ currentAlert.deviceName }}</el-descriptions-item>
          <el-descriptions-item label="告警类型">{{ currentAlert.alertType }}</el-descriptions-item>
          <el-descriptions-item label="告警级别">
            <el-tag :type="currentAlert.level === 'critical' ? 'danger' : currentAlert.level === 'warning' ? 'warning' : 'info'">
              {{ currentAlert.level === 'critical' ? '严重' : currentAlert.level === 'warning' ? '警告' : '信息' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="所属地块">{{ currentAlert.plotName }}</el-descriptions-item>
          <el-descriptions-item label="告警内容" :span="2">{{ currentAlert.content }}</el-descriptions-item>
          <el-descriptions-item label="告警时间">{{ currentAlert.createTime }}</el-descriptions-item>
          <el-descriptions-item label="处理状态">
            <el-tag :type="currentAlert.status === 'pending' ? 'danger' : 'success'">
              {{ currentAlert.status === 'pending' ? '待处理' : '已处理' }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>
        <div v-if="currentAlert.handleTime" class="handle-info">
          <h4>处理记录</h4>
          <p><strong>处理时间：</strong>{{ currentAlert.handleTime }}</p>
          <p><strong>处理人：</strong>{{ currentAlert.handler }}</p>
          <p><strong>处理备注：</strong>{{ currentAlert.handleRemark }}</p>
        </div>
      </div>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
        <el-button v-if="currentAlert?.status === 'pending'" type="primary" @click="handleHandleSubmit">处理告警</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'

const searchForm = reactive({
  keyword: '',
  level: '',
  status: ''
})

const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(50)

const alertList = ref([
  { id: 1, deviceName: '温湿度传感器-001', alertType: '温度异常', level: 'critical', content: '温度超过35°C阈值', plotName: '地块A', status: 'pending', createTime: '2024-01-15 10:30:00' },
  { id: 2, deviceName: '土壤湿度传感器-002', alertType: '湿度偏低', level: 'warning', content: '土壤湿度低于20%', plotName: '地块A', status: 'pending', createTime: '2024-01-15 10:25:00' },
  { id: 3, deviceName: '灌溉控制器-004', alertType: '设备离线', level: 'critical', content: '设备离线超过1小时', plotName: '地块B', status: 'handled', createTime: '2024-01-15 09:00:00', handleTime: '2024-01-15 09:30:00', handler: '管理员', handleRemark: '已重启设备' }
])

const detailDialogVisible = ref(false)
const currentAlert = ref(null)

const handleSearch = () => {
  ElMessage.info('搜索功能')
}

const handleHandle = (alert) => {
  currentAlert.value = alert
  detailDialogVisible.value = true
}

const handleView = (alert) => {
  currentAlert.value = alert
  detailDialogVisible.value = true
}

const handleHandleSubmit = () => {
  detailDialogVisible.value = false
  ElMessage.success('告警处理成功')
}

const handlePageChange = (page) => {
  pageNum.value = page
}
</script>

<style scoped>
.alert-list {
  background: #fff;
  padding: 20px;
  border-radius: 12px;
}

.search-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  align-items: center;
}

.search-input {
  width: 200px;
}

.alert-table {
  margin-bottom: 20px;
}

.handle-info {
  margin-top: 20px;
  padding: 16px;
  background: #f9fafc;
  border-radius: 8px;
}

.handle-info h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #303133;
}

.handle-info p {
  margin: 4px 0;
  color: #606266;
}

.pagination {
  text-align: right;
}
</style>
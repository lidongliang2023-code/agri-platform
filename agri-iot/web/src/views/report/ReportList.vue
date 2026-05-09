<template>
  <div class="report-list">
    <div class="search-bar">
      <el-input v-model="searchForm.reportName" placeholder="报表名称" class="search-input" />
      <el-select v-model="searchForm.reportType" placeholder="报表类型">
        <el-option label="全部" value="" />
        <el-option label="日报" value="daily" />
        <el-option label="周报" value="weekly" />
        <el-option label="月报" value="monthly" />
      </el-select>
      <el-button type="primary" @click="handleSearch">搜索</el-button>
      <el-button type="success" @click="handleAdd">新建报表</el-button>
    </div>

    <el-table :data="reportList" border class="report-table">
      <el-table-column prop="reportName" label="报表名称" />
      <el-table-column prop="reportType" label="报表类型">
        <template #default="scope">
          <el-tag type="info">{{ scope.row.reportType === 'daily' ? '日报' : scope.row.reportType === 'weekly' ? '周报' : '月报' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="dataSource" label="数据源" />
      <el-table-column prop="scheduleType" label="调度类型">
        <template #default="scope">
          <el-tag :type="scope.row.scheduleType === 'auto' ? 'success' : 'warning'">
            {{ scope.row.scheduleType === 'auto' ? '自动' : '手动' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="lastGenerateTime" label="上次生成" />
      <el-table-column prop="status" label="状态">
        <template #default="scope">
          <el-tag :type="scope.row.status === 'active' ? 'success' : 'danger'">
            {{ scope.row.status === 'active' ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作">
        <template #default="scope">
          <el-button type="primary" size="small" @click="handleGenerate(scope.row.id)">生成</el-button>
          <el-button type="success" size="small" @click="handleExport(scope.row.id)">导出</el-button>
          <el-button type="warning" size="small" @click="handleEdit(scope.row)">编辑</el-button>
          <el-button type="danger" size="small" @click="handleDelete(scope.row.id)">删除</el-button>
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

    <el-dialog title="新建报表" :visible.sync="addDialogVisible">
      <el-form :model="addForm" label-width="120px">
        <el-form-item label="报表名称">
          <el-input v-model="addForm.reportName" />
        </el-form-item>
        <el-form-item label="报表类型">
          <el-select v-model="addForm.reportType">
            <el-option label="日报" value="daily" />
            <el-option label="周报" value="weekly" />
            <el-option label="月报" value="monthly" />
          </el-select>
        </el-form-item>
        <el-form-item label="数据源">
          <el-select v-model="addForm.dataSource">
            <el-option label="设备数据" value="device" />
            <el-option label="告警数据" value="alert" />
            <el-option label="地块数据" value="plot" />
          </el-select>
        </el-form-item>
        <el-form-item label="调度类型">
          <el-select v-model="addForm.scheduleType">
            <el-option label="自动" value="auto" />
            <el-option label="手动" value="manual" />
          </el-select>
        </el-form-item>
        <el-form-item label="调度时间">
          <el-time-picker v-model="addForm.scheduleTime" format="HH:mm" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'

const searchForm = reactive({
  reportName: '',
  reportType: ''
})

const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(20)

const reportList = ref([
  { id: 1, reportName: '设备日报', reportType: 'daily', dataSource: '设备数据', scheduleType: 'auto', lastGenerateTime: '2024-01-15 08:00:00', status: 'active' },
  { id: 2, reportName: '告警周报', reportType: 'weekly', dataSource: '告警数据', scheduleType: 'auto', lastGenerateTime: '2024-01-14 00:00:00', status: 'active' },
  { id: 3, reportName: '地块月报', reportType: 'monthly', dataSource: '地块数据', scheduleType: 'manual', lastGenerateTime: '2024-01-01 00:00:00', status: 'active' }
])

const addDialogVisible = ref(false)
const addForm = reactive({
  reportName: '',
  reportType: '',
  dataSource: '',
  scheduleType: '',
  scheduleTime: ''
})

const handleSearch = () => {
  ElMessage.info('搜索功能')
}

const handleAdd = () => {
  addDialogVisible.value = true
}

const handleSave = () => {
  addDialogVisible.value = false
  ElMessage.success('报表创建成功')
}

const handleGenerate = (id) => {
  ElMessage.success('报表生成成功')
}

const handleExport = (id) => {
  ElMessage.success('报表导出成功')
}

const handleEdit = (report) => {
  addForm.reportName = report.reportName
  addForm.reportType = report.reportType
  addForm.dataSource = report.dataSource
  addForm.scheduleType = report.scheduleType
  addDialogVisible.value = true
}

const handleDelete = (id) => {
  ElMessage.success('报表删除成功')
}

const handlePageChange = (page) => {
  pageNum.value = page
}
</script>

<style scoped>
.report-list {
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

.report-table {
  margin-bottom: 20px;
}

.pagination {
  text-align: right;
}
</style>
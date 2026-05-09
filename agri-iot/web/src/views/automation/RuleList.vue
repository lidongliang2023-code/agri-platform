<template>
  <div class="rule-list">
    <div class="search-bar">
      <el-input v-model="searchForm.ruleName" placeholder="规则名称" class="search-input" />
      <el-select v-model="searchForm.status" placeholder="规则状态">
        <el-option label="全部" value="" />
        <el-option label="启用" value="enabled" />
        <el-option label="禁用" value="disabled" />
      </el-select>
      <el-button type="primary" @click="handleSearch">搜索</el-button>
      <el-button type="success" @click="handleAdd">添加规则</el-button>
    </div>

    <el-table :data="ruleList" border class="rule-table">
      <el-table-column prop="ruleName" label="规则名称" />
      <el-table-column prop="ruleType" label="规则类型">
        <template #default="scope">
          <el-tag type="info">{{ scope.row.ruleType === 'threshold' ? '阈值触发' : '定时任务' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="conditionGroup" label="条件组" />
      <el-table-column prop="actionGroup" label="动作组" />
      <el-table-column prop="status" label="状态">
        <template #default="scope">
          <el-tag :type="scope.row.status === 'enabled' ? 'success' : 'danger'">
            {{ scope.row.status === 'enabled' ? '启用' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="triggerCount" label="触发次数" />
      <el-table-column prop="lastTriggerTime" label="上次触发" />
      <el-table-column prop="createTime" label="创建时间" />
      <el-table-column label="操作">
        <template #default="scope">
          <el-button type="primary" size="small" @click="handleDetail(scope.row)">详情</el-button>
          <el-button v-if="scope.row.status === 'enabled'" type="warning" size="small" @click="handleDisable(scope.row.id)">禁用</el-button>
          <el-button v-if="scope.row.status === 'disabled'" type="success" size="small" @click="handleEnable(scope.row.id)">启用</el-button>
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

    <el-dialog title="添加规则" :visible.sync="addDialogVisible">
      <el-form :model="addForm" label-width="120px">
        <el-form-item label="规则名称">
          <el-input v-model="addForm.ruleName" />
        </el-form-item>
        <el-form-item label="规则类型">
          <el-select v-model="addForm.ruleType">
            <el-option label="阈值触发" value="threshold" />
            <el-option label="定时任务" value="schedule" />
          </el-select>
        </el-form-item>
        <el-form-item label="条件组">
          <el-input v-model="addForm.conditionGroup" placeholder="JSON格式条件配置" />
        </el-form-item>
        <el-form-item label="动作组">
          <el-input v-model="addForm.actionGroup" placeholder="JSON格式动作配置" />
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
  ruleName: '',
  status: ''
})

const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(30)

const ruleList = ref([
  { id: 1, ruleName: '温度过高自动降温', ruleType: 'threshold', conditionGroup: '温度>35°C', actionGroup: '开启降温设备', status: 'enabled', triggerCount: 15, lastTriggerTime: '2024-01-15 10:00:00', createTime: '2024-01-01 10:00:00' },
  { id: 2, ruleName: '定时灌溉任务', ruleType: 'schedule', conditionGroup: '每天08:00', actionGroup: '开启灌溉系统', status: 'enabled', triggerCount: 30, lastTriggerTime: '2024-01-15 08:00:00', createTime: '2024-01-02 10:00:00' },
  { id: 3, ruleName: '湿度低于阈值告警', ruleType: 'threshold', conditionGroup: '湿度<20%', actionGroup: '发送告警通知', status: 'disabled', triggerCount: 5, lastTriggerTime: '2024-01-10 09:00:00', createTime: '2024-01-03 10:00:00' }
])

const addDialogVisible = ref(false)
const addForm = reactive({
  ruleName: '',
  ruleType: '',
  conditionGroup: '',
  actionGroup: ''
})

const handleSearch = () => {
  ElMessage.info('搜索功能')
}

const handleAdd = () => {
  addDialogVisible.value = true
}

const handleSave = () => {
  addDialogVisible.value = false
  ElMessage.success('规则添加成功')
}

const handleDetail = (rule) => {
  addForm.ruleName = rule.ruleName
  addForm.ruleType = rule.ruleType
  addForm.conditionGroup = rule.conditionGroup
  addForm.actionGroup = rule.actionGroup
  addDialogVisible.value = true
}

const handleEnable = (id) => {
  ElMessage.success('规则已启用')
}

const handleDisable = (id) => {
  ElMessage.success('规则已禁用')
}

const handleDelete = (id) => {
  ElMessage.success('规则删除成功')
}

const handlePageChange = (page) => {
  pageNum.value = page
}
</script>

<style scoped>
.rule-list {
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

.rule-table {
  margin-bottom: 20px;
}

.pagination {
  text-align: right;
}
</style>
<template>
  <div class="tasks-page">
    <div class="header-section">
      <div class="header-left">
        <h1>农事任务</h1>
        <p>管理农场日常农事作业任务</p>
      </div>
      <div class="header-right">
        <el-button type="primary" class="add-btn" @click="showAddModal = true">
          <el-icon name="plus"></el-icon>
          新建任务
        </el-button>
      </div>
    </div>

    <div class="stats-row">
      <el-card class="stat-card">
        <div class="stat-icon-wrap blue">
          <el-icon name="list-checks"></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.total }}</div>
          <div class="stat-label">总任务</div>
        </div>
      </el-card>

      <el-card class="stat-card">
        <div class="stat-icon-wrap yellow">
          <el-icon name="clock"></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.pending }}</div>
          <div class="stat-label">待执行</div>
        </div>
      </el-card>

      <el-card class="stat-card">
        <div class="stat-icon-wrap purple">
          <el-icon name="loader"></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.inProgress }}</div>
          <div class="stat-label">进行中</div>
        </div>
      </el-card>

      <el-card class="stat-card">
        <div class="stat-icon-wrap green">
          <el-icon name="check-circle"></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.completed }}</div>
          <div class="stat-label">已完成</div>
        </div>
      </el-card>
    </div>

    <div class="filter-section">
      <el-input v-model="searchText" placeholder="搜索任务名称或编号..." class="search-input" />
      <el-select v-model="statusFilter" placeholder="全部状态">
        <el-option label="全部状态" value="" />
        <el-option label="待执行" value="pending" />
        <el-option label="进行中" value="in_progress" />
        <el-option label="已完成" value="completed" />
      </el-select>
    </div>

    <el-table :data="taskList" border class="task-table">
      <el-table-column prop="taskCode" label="任务编号" width="120" />
      <el-table-column prop="taskName" label="任务名称" />
      <el-table-column prop="taskType" label="任务类型" width="100" />
      <el-table-column prop="farmName" label="所属农场" width="140" />
      <el-table-column prop="executor" label="执行人" width="100" />
      <el-table-column prop="planDate" label="计划日期" width="120" />
      <el-table-column prop="priority" label="优先级" width="80">
        <template #default="scope">
          <el-tag :type="getPriorityType(scope.row.priority)">
            {{ getPriorityText(scope.row.priority) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="scope">
          <el-tag :type="getStatusType(scope.row.status)">
            {{ getStatusText(scope.row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="80">
        <template #default="scope">
          <el-button size="small" @click="viewDetail(scope.row)">查看</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog title="新建任务" :visible.sync="showAddModal" width="600px">
      <el-form :model="formData" label-width="120px">
        <el-form-item label="任务名称">
          <el-input v-model="formData.taskName" />
        </el-form-item>
        <el-form-item label="任务类型">
          <el-select v-model="formData.taskType">
            <el-option label="播种" value="sowing" />
            <el-option label="施肥" value="fertilizing" />
            <el-option label="灌溉" value="irrigation" />
            <el-option label="病虫害防治" value="pest_control" />
            <el-option label="采收" value="harvesting" />
          </el-select>
        </el-form-item>
        <el-form-item label="所属农场">
          <el-select v-model="formData.farmName">
            <el-option label="绿源生态农场" value="绿源生态农场" />
            <el-option label="金穗农业基地" value="金穗农业基地" />
          </el-select>
        </el-form-item>
        <el-form-item label="执行人">
          <el-input v-model="formData.executor" />
        </el-form-item>
        <el-form-item label="计划日期">
          <el-date-picker v-model="formData.planDate" type="date" />
        </el-form-item>
        <el-form-item label="优先级">
          <el-select v-model="formData.priority">
            <el-option label="高" value="high" />
            <el-option label="中" value="medium" />
            <el-option label="低" value="low" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddModal = false">取消</el-button>
        <el-button type="primary" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'

const searchText = ref('')
const statusFilter = ref('')
const showAddModal = ref(false)

const stats = reactive({
  total: 5,
  pending: 2,
  inProgress: 2,
  completed: 1
})

const formData = reactive({
  taskName: '',
  taskType: '',
  farmName: '',
  executor: '',
  planDate: '',
  priority: ''
})

const taskList = ref([
  { id: 1, taskCode: 'TASK001', taskName: '水稻播种', taskType: '播种', farmName: '绿源生态农场', executor: '张师傅', planDate: '2026/05/01', priority: 'high', status: 'pending' },
  { id: 2, taskCode: 'TASK002', taskName: '番茄追肥', taskType: '施肥', farmName: '绿源生态农场', executor: '李师傅', planDate: '2026/04/28', priority: 'medium', status: 'in_progress' },
  { id: 3, taskCode: 'TASK003', taskName: '番茄追肥', taskType: '施肥', farmName: '绿源生态农场', executor: '李师傅', planDate: '2026/04/28', priority: 'medium', status: 'in_progress' },
  { id: 4, taskCode: 'TASK004', taskName: '柑橘病虫害防治', taskType: '病虫害防治', farmName: '绿源生态农场', executor: '王师傅', planDate: '2026/04/25', priority: 'high', status: 'completed' },
  { id: 5, taskCode: 'TASK005', taskName: '小麦收割', taskType: '采收', farmName: '金穗农业基地', executor: '赵师傅', planDate: '2026/04/29', priority: 'high', status: 'in_progress' }
])

const getPriorityType = (priority) => {
  const types = { high: 'danger', medium: 'warning', low: 'info' }
  return types[priority] || 'default'
}

const getPriorityText = (priority) => {
  const texts = { high: '高', medium: '中', low: '低' }
  return texts[priority] || priority
}

const getStatusType = (status) => {
  const types = { pending: 'warning', in_progress: 'info', completed: 'success' }
  return types[status] || 'default'
}

const getStatusText = (status) => {
  const texts = { pending: '待执行', in_progress: '进行中', completed: '已完成' }
  return texts[status] || status
}

const viewDetail = (row) => {
  console.log('查看详情:', row)
}

const submitForm = () => {
  console.log('提交:', formData)
  showAddModal.value = false
}
</script>

<style scoped>
.tasks-page { padding: 24px; }
.header-section { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.header-left h1 { margin: 0; font-size: 24px; color: #1a365d; }
.header-left p { margin: 4px 0 0; color: #718096; }
.add-btn { background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); border: none; padding: 10px 24px; }

.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.stat-card { padding: 20px; display: flex; align-items: center; gap: 16px; }
.stat-icon-wrap { width: 48px; height: 48px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 22px; color: white; }
.stat-icon-wrap.blue { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
.stat-icon-wrap.yellow { background: linear-gradient(135deg, #ed8936 0%, #dd6b20 100%); }
.stat-icon-wrap.purple { background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%); }
.stat-icon-wrap.green { background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); }
.stat-content { }
.stat-value { font-size: 28px; font-weight: 600; color: #1a365d; }
.stat-label { font-size: 14px; color: #718096; margin-top: 4px; }

.filter-section { display: flex; gap: 16px; margin-bottom: 24px; }
.search-input { width: 300px; }

.task-table { }
</style>

<template>
  <div class="sop-page">
    <div class="page-header">
      <h2>SOP标准作业管理</h2>
      <el-button type="primary" @click="showAddModal = true">
        <el-icon><component :is="icons.Plus" /></el-icon>
        新增模板
      </el-button>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="SOP模板" name="templates">
        <div class="search-bar">
          <el-input v-model="searchForm.templateName" placeholder="模板名称" class="search-input" />
          <el-select v-model="searchForm.cropType" placeholder="适用作物">
            <el-option label="全部" value="" />
            <el-option label="番茄" value="番茄" />
            <el-option label="黄瓜" value="黄瓜" />
            <el-option label="草莓" value="草莓" />
          </el-select>
          <el-button type="primary" @click="searchTemplates">搜索</el-button>
        </div>
        <el-table :data="templates" border>
          <el-table-column prop="templateCode" label="模板编码" />
          <el-table-column prop="templateName" label="模板名称" />
          <el-table-column prop="cropType" label="适用作物" />
          <el-table-column prop="taskType" label="任务类型" />
          <el-table-column prop="version" label="版本" />
          <el-table-column prop="isEnabled" label="状态">
            <template #default="scope"><el-tag :type="scope.row.isEnabled === 1 ? 'success' : 'warning'">{{ scope.row.isEnabled === 1 ? '启用' : '禁用' }}</el-tag></template>
          </el-table-column>
          <el-table-column prop="createTime" label="创建时间" />
          <el-table-column label="操作">
            <template #default="scope">
              <el-button size="small" @click="viewTemplate(scope.row)">查看详情</el-button>
              <el-button size="small" @click="editTemplate(scope.row)">编辑</el-button>
              <el-button size="small" type="danger" @click="deleteTemplate(scope.row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="执行记录" name="executions">
        <div class="search-bar">
          <el-input v-model="searchForm.executionCode" placeholder="执行编号" class="search-input" />
          <el-select v-model="searchForm.status" placeholder="执行状态">
            <el-option label="全部" value="" />
            <el-option label="待执行" value="pending" />
            <el-option label="执行中" value="executing" />
            <el-option label="已完成" value="completed" />
          </el-select>
          <el-button type="primary" @click="searchExecutions">搜索</el-button>
        </div>
        <el-table :data="executions" border>
          <el-table-column prop="executionCode" label="执行编号" />
          <el-table-column prop="templateName" label="SOP模板" />
          <el-table-column prop="plotName" label="执行地块" />
          <el-table-column prop="executor" label="执行人" />
          <el-table-column prop="status" label="状态">
            <template #default="scope"><el-tag :type="getStatusType(scope.row.status)">{{ getStatusText(scope.row.status) }}</el-tag></template>
          </el-table-column>
          <el-table-column prop="startTime" label="开始时间" />
          <el-table-column prop="endTime" label="结束时间" />
          <el-table-column label="操作">
            <template #default="scope">
              <el-button v-if="scope.row.status === 'pending'" size="small" type="primary" @click="startExecution(scope.row)">开始执行</el-button>
              <el-button size="small" @click="viewExecution(scope.row)">查看进度</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="执行统计" name="statistics">
        <div class="stats-grid">
          <el-card>
            <div class="stat-icon blue">
              <el-icon><component :is="icons.FileText" /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.totalTemplates }}</div>
              <div class="stat-label">SOP模板数</div>
            </div>
          </el-card>
          <el-card>
            <div class="stat-icon green">
              <el-icon><component :is="icons.CheckCircle" /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.completedExecutions }}</div>
              <div class="stat-label">已完成执行</div>
            </div>
          </el-card>
          <el-card>
            <div class="stat-icon orange">
              <el-icon><component :is="icons.Clock" /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.executingCount }}</div>
              <div class="stat-label">执行中</div>
            </div>
          </el-card>
          <el-card>
            <div class="stat-icon purple">
              <el-icon><component :is="icons.TrendingUp" /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ complianceRate }}%</div>
              <div class="stat-label">合规率</div>
            </div>
          </el-card>
        </div>
        <el-card style="margin-top: 20px;">
          <h3>SOP执行趋势</h3>
          <div ref="trendChart" class="chart"></div>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-dialog title="新增SOP模板" :visible.sync="showAddModal" width="700px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="模板名称" prop="templateName">
          <el-input v-model="form.templateName" />
        </el-form-item>
        <el-form-item label="适用作物" prop="cropType">
          <el-input v-model="form.cropType" />
        </el-form-item>
        <el-form-item label="任务类型" prop="taskType">
          <el-select v-model="form.taskType">
            <el-option label="灌溉" value="irrigation" />
            <el-option label="施肥" value="fertilization" />
            <el-option label="植保" value="plantProtection" />
            <el-option label="采收" value="harvest" />
          </el-select>
        </el-form-item>
        <el-form-item label="版本" prop="version">
          <el-input v-model="form.version" placeholder="如: 1.0" />
        </el-form-item>
        <el-form-item label="操作步骤" prop="steps">
          <el-table :data="form.steps" border>
            <el-table-column prop="stepNo" label="步骤" />
            <el-table-column prop="stepName" label="步骤名称" />
            <el-table-column prop="description" label="操作说明" />
            <el-table-column label="操作">
              <template #default="scope">
                <el-button size="small" type="danger" @click="removeStep(scope.$index)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-button type="text" @click="addStep">+ 添加步骤</el-button>
        </el-form-item>
        <el-form-item label="注意事项" prop="notes">
          <el-textarea v-model="form.notes" rows="3" />
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="showAddModal = false">取消</el-button>
        <el-button type="primary" @click="saveTemplate">保存</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import * as icons from '@element-plus/icons-vue'
import * as echarts from 'echarts'

const showAddModal = ref(false)
const activeTab = ref('templates')
const searchForm = reactive({ templateName: '', cropType: '', executionCode: '', status: '' })
const stats = reactive({ totalTemplates: 25, completedExecutions: 156, executingCount: 12 })
const complianceRate = computed(() => 94)
let trendChartInstance = null

const form = reactive({
  id: null,
  templateName: '',
  cropType: '',
  taskType: 'irrigation',
  version: '1.0',
  steps: [],
  notes: ''
})

const templates = ref([
  { id: 1, templateCode: 'SOP001', templateName: '番茄浇水标准流程', cropType: '番茄', taskType: '灌溉', version: '1.0', isEnabled: 1, createTime: '2024-01-15' },
  { id: 2, templateCode: 'SOP002', templateName: '黄瓜施肥规范', cropType: '黄瓜', taskType: '施肥', version: '2.0', isEnabled: 1, createTime: '2024-02-20' },
  { id: 3, templateCode: 'SOP003', templateName: '草莓病虫害防治', cropType: '草莓', taskType: '植保', version: '1.0', isEnabled: 1, createTime: '2024-03-10' },
  { id: 4, templateCode: 'SOP004', templateName: '西瓜采收流程', cropType: '西瓜', taskType: '采收', version: '1.0', isEnabled: 0, createTime: '2024-04-05' },
  { id: 5, templateCode: 'SOP005', templateName: '番茄植保作业规范', cropType: '番茄', taskType: '植保', version: '1.1', isEnabled: 1, createTime: '2024-05-18' }
])

const executions = ref([
  { id: 1, executionCode: 'EXEC001', templateName: '番茄浇水标准流程', plotName: 'A区-01', executor: '张三', status: 'completed', startTime: '2024-07-19 08:00', endTime: '2024-07-19 09:30' },
  { id: 2, executionCode: 'EXEC002', templateName: '黄瓜施肥规范', plotName: 'A区-02', executor: '李四', status: 'executing', startTime: '2024-07-20 09:00', endTime: '' },
  { id: 3, executionCode: 'EXEC003', templateName: '草莓病虫害防治', plotName: 'B区-01', executor: '王五', status: 'pending', startTime: '', endTime: '' },
  { id: 4, executionCode: 'EXEC004', templateName: '番茄浇水标准流程', plotName: 'A区-01', executor: '赵六', status: 'pending', startTime: '', endTime: '' },
  { id: 5, executionCode: 'EXEC005', templateName: '西瓜采收流程', plotName: 'C区-01', executor: '孙七', status: 'completed', startTime: '2024-07-18 14:00', endTime: '2024-07-18 16:00' }
])

const getStatusType = (status) => {
  const types = { pending: 'warning', executing: 'primary', completed: 'success' }
  return types[status] || 'default'
}

const getStatusText = (status) => {
  const texts = { pending: '待执行', executing: '执行中', completed: '已完成' }
  return texts[status] || status
}

const addStep = () => {
  form.steps.push({ stepNo: form.steps.length + 1, stepName: '', description: '' })
}

const removeStep = (index) => {
  form.steps.splice(index, 1)
  form.steps.forEach((step, i) => step.stepNo = i + 1)
}

const searchTemplates = () => { console.log('搜索模板:', searchForm) }
const searchExecutions = () => { console.log('搜索执行:', searchForm) }
const viewTemplate = (row) => { console.log('查看模板:', row) }
const editTemplate = (row) => { Object.assign(form, row); showAddModal.value = true }
const deleteTemplate = (row) => { console.log('删除模板:', row) }
const startExecution = (row) => { console.log('开始执行:', row) }
const viewExecution = (row) => { console.log('查看进度:', row) }
const saveTemplate = () => { console.log('保存模板:', form); showAddModal.value = false }

const initChart = () => {
  if (trendChartInstance) trendChartInstance.dispose()
  trendChartInstance = echarts.init(document.querySelector('.sop-page .chart'))
  trendChartInstance.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: ['1月', '2月', '3月', '4月', '5月', '6月'] },
    yAxis: { type: 'value' },
    series: [{
      name: '执行次数',
      type: 'bar',
      data: [20, 25, 32, 45, 58, 65],
      itemStyle: { color: '#409EFF' }
    }]
  })
}

onMounted(() => {
  initChart()
  window.addEventListener('resize', initChart)
})

onUnmounted(() => {
  window.removeEventListener('resize', initChart)
  if (trendChartInstance) trendChartInstance.dispose()
})
</script>

<style scoped>
.sop-page { padding: 20px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.search-bar { display: flex; gap: 12px; margin-bottom: 20px; }
.search-input { width: 200px; }
.dialog-footer { text-align: right; }
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.stat-icon { width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; color: white; }
.stat-icon.blue { background: linear-gradient(135deg, #409EFF, #67B8F8); }
.stat-icon.green { background: linear-gradient(135deg, #67C23A, #85CE61); }
.stat-icon.orange { background: linear-gradient(135deg, #E6A23C, #F0C78A); }
.stat-icon.purple { background: linear-gradient(135deg, #909399, #B4BCCC); }
.stat-info { margin-left: 16px; }
.stat-value { font-size: 28px; font-weight: 600; color: #303133; }
.stat-label { font-size: 14px; color: #909399; }
.chart { height: 300px; }
</style>
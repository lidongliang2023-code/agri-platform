<template>
  <div class="alerts-page">
    <div class="page-header">
      <h2>告警管理</h2>
      <el-button type="primary" @click="showAddModal = true">
        <el-icon><component :is="icons.Plus" /></el-icon>
        新增规则
      </el-button>
    </div>

    <div class="stats-row">
      <el-card class="stat-item">
        <div class="stat-num red">{{ stats.total }}</div>
        <div class="stat-label">总告警</div>
      </el-card>
      <el-card class="stat-item">
        <div class="stat-num orange">{{ stats.unhandled }}</div>
        <div class="stat-label">待处理</div>
      </el-card>
      <el-card class="stat-item">
        <div class="stat-num blue">{{ stats.rules }}</div>
        <div class="stat-label">告警规则</div>
      </el-card>
      <el-card class="stat-item">
        <div class="stat-num green">{{ stats.handled }}</div>
        <div class="stat-label">已处理</div>
      </el-card>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="告警记录" name="records">
        <div class="search-bar">
          <el-select v-model="searchForm.level" placeholder="告警级别">
            <el-option label="全部" value="" />
            <el-option label="紧急" value="critical" />
            <el-option label="重要" value="important" />
            <el-option label="一般" value="normal" />
          </el-select>
          <el-select v-model="searchForm.status" placeholder="处理状态">
            <el-option label="全部" value="" />
            <el-option label="待处理" value="unhandled" />
            <el-option label="处理中" value="handling" />
            <el-option label="已处理" value="handled" />
          </el-select>
          <el-button type="primary" @click="search">搜索</el-button>
        </div>
        <el-table :data="alertRecords" border>
          <el-table-column prop="alertCode" label="告警编码" />
          <el-table-column prop="alertName" label="告警名称" />
          <el-table-column prop="level" label="级别">
            <template #default="scope">
              <el-tag :type="getLevelType(scope.row.level)">{{ getLevelText(scope.row.level) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="sourceName" label="来源" />
          <el-table-column prop="content" label="告警内容" />
          <el-table-column prop="status" label="状态">
            <template #default="scope">
              <el-tag :type="getStatusType(scope.row.status)">{{ getStatusText(scope.row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="createTime" label="触发时间" />
          <el-table-column label="操作">
            <template #default="scope">
              <el-button v-if="scope.row.status !== 'handled'" size="small" type="primary" @click="handleAlert(scope.row)">处理</el-button>
              <el-button size="small" @click="viewDetail(scope.row)">详情</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="告警规则" name="rules">
        <div class="search-bar">
          <el-input v-model="searchForm.ruleName" placeholder="规则名称" class="search-input" />
          <el-button type="primary" @click="searchRules">搜索</el-button>
        </div>
        <el-table :data="alertRules" border>
          <el-table-column prop="ruleCode" label="规则编码" />
          <el-table-column prop="ruleName" label="规则名称" />
          <el-table-column prop="alertType" label="告警类型" />
          <el-table-column prop="level" label="级别">
            <template #default="scope"><el-tag :type="getLevelType(scope.row.level)">{{ getLevelText(scope.row.level) }}</el-tag></template>
          </el-table-column>
          <el-table-column prop="sourceType" label="来源类型" />
          <el-table-column prop="isEnabled" label="状态">
            <template #default="scope"><el-tag :type="scope.row.isEnabled === 1 ? 'success' : 'warning'">{{ scope.row.isEnabled === 1 ? '启用' : '禁用' }}</el-tag></template>
          </el-table-column>
          <el-table-column label="操作">
            <template #default="scope">
              <el-button size="small" @click="editRule(scope.row)">编辑</el-button>
              <el-button size="small" type="danger" @click="deleteRule(scope.row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="应急预案" name="plans">
        <el-table :data="emergencyPlans" border>
          <el-table-column prop="planCode" label="预案编码" />
          <el-table-column prop="planName" label="预案名称" />
          <el-table-column prop="planType" label="预案类型" />
          <el-table-column prop="level" label="适用级别">
            <template #default="scope"><el-tag :type="getLevelType(scope.row.level)">{{ getLevelText(scope.row.level) }}</el-tag></template>
          </el-table-column>
          <el-table-column prop="isEnabled" label="状态">
            <template #default="scope"><el-tag :type="scope.row.isEnabled === 1 ? 'success' : 'warning'">{{ scope.row.isEnabled === 1 ? '启用' : '禁用' }}</el-tag></template>
          </el-table-column>
          <el-table-column label="操作">
            <template #default="scope">
              <el-button size="small" @click="viewPlan(scope.row)">查看</el-button>
              <el-button size="small" @click="editPlan(scope.row)">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <el-dialog title="新增/编辑告警规则" :visible.sync="showAddModal" width="600px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="规则名称" prop="ruleName">
          <el-input v-model="form.ruleName" />
        </el-form-item>
        <el-form-item label="告警类型" prop="alertType">
          <el-select v-model="form.alertType">
            <el-option label="设备告警" value="device" />
            <el-option label="环境告警" value="environment" />
            <el-option label="任务告警" value="task" />
            <el-option label="质量告警" value="quality" />
          </el-select>
        </el-form-item>
        <el-form-item label="告警级别" prop="level">
          <el-select v-model="form.level">
            <el-option label="紧急" value="critical" />
            <el-option label="重要" value="important" />
            <el-option label="一般" value="normal" />
          </el-select>
        </el-form-item>
        <el-form-item label="来源类型" prop="sourceType">
          <el-select v-model="form.sourceType">
            <el-option label="IoT设备" value="iot" />
            <el-option label="传感器" value="sensor" />
            <el-option label="任务系统" value="task" />
          </el-select>
        </el-form-item>
        <el-form-item label="阈值最小值" prop="thresholdMin">
          <el-input v-model.number="form.thresholdMin" type="number" />
        </el-form-item>
        <el-form-item label="阈值最大值" prop="thresholdMax">
          <el-input v-model.number="form.thresholdMax" type="number" />
        </el-form-item>
        <el-form-item label="单位" prop="unit">
          <el-input v-model="form.unit" />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-textarea v-model="form.description" rows="3" />
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="showAddModal = false">取消</el-button>
        <el-button type="primary" @click="saveRule">保存</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import * as icons from '@element-plus/icons-vue'

const showAddModal = ref(false)
const activeTab = ref('records')
const stats = reactive({ total: 56, unhandled: 12, rules: 28, handled: 44 })
const searchForm = reactive({ level: '', status: '', ruleName: '' })

const form = reactive({
  id: null,
  ruleName: '',
  alertType: 'device',
  level: 'normal',
  sourceType: 'iot',
  thresholdMin: null,
  thresholdMax: null,
  unit: '',
  description: ''
})

const alertRecords = ref([
  { id: 1, alertCode: 'ALT001', alertName: '温度异常', level: 'critical', sourceName: '温湿度传感器-A1', content: '温度超过35度预警阈值', status: 'unhandled', createTime: '2024-07-20 14:30:00' },
  { id: 2, alertCode: 'ALT002', alertName: '湿度异常', level: 'important', sourceName: '温湿度传感器-B2', content: '湿度低于40%', status: 'handling', createTime: '2024-07-20 14:25:00' },
  { id: 3, alertCode: 'ALT003', alertName: '设备离线', level: 'critical', sourceName: '灌溉控制器-C1', content: '设备通讯中断超过10分钟', status: 'handled', createTime: '2024-07-20 13:45:00' },
  { id: 4, alertCode: 'ALT004', alertName: '土壤湿度低', level: 'normal', sourceName: '土壤传感器-D1', content: '土壤湿度低于20%', status: 'unhandled', createTime: '2024-07-20 12:30:00' },
  { id: 5, alertCode: 'ALT005', alertName: '任务超时', level: 'important', sourceName: '番茄浇水任务', content: '任务执行时间超过预期', status: 'handled', createTime: '2024-07-20 10:15:00' }
])

const alertRules = ref([
  { id: 1, ruleCode: 'RULE001', ruleName: '温度过高预警', alertType: '环境告警', level: 'critical', sourceType: 'sensor', isEnabled: 1 },
  { id: 2, ruleCode: 'RULE002', ruleName: '湿度异常检测', alertType: '环境告警', level: 'important', sourceType: 'sensor', isEnabled: 1 },
  { id: 3, ruleCode: 'RULE003', ruleName: '设备离线监测', alertType: '设备告警', level: 'critical', sourceType: 'iot', isEnabled: 1 },
  { id: 4, ruleCode: 'RULE004', ruleName: '土壤湿度预警', alertType: '环境告警', level: 'normal', sourceType: 'sensor', isEnabled: 0 },
  { id: 5, ruleCode: 'RULE005', ruleName: '任务超时提醒', alertType: '任务告警', level: 'important', sourceType: 'task', isEnabled: 1 }
])

const emergencyPlans = ref([
  { id: 1, planCode: 'PLAN001', planName: '高温应急预案', planType: '环境应急', level: 'critical', isEnabled: 1 },
  { id: 2, planCode: 'PLAN002', planName: '病虫害防治预案', planType: '植保应急', level: 'important', isEnabled: 1 },
  { id: 3, planCode: 'PLAN003', planName: '设备故障应急', planType: '设备应急', level: 'critical', isEnabled: 1 },
  { id: 4, planCode: 'PLAN004', planName: '采收延误预案', planType: '生产应急', level: 'normal', isEnabled: 0 }
])

const getLevelType = (level) => {
  const types = { critical: 'danger', important: 'warning', normal: 'info' }
  return types[level] || 'default'
}

const getLevelText = (level) => {
  const texts = { critical: '紧急', important: '重要', normal: '一般' }
  return texts[level] || level
}

const getStatusType = (status) => {
  const types = { unhandled: 'danger', handling: 'warning', handled: 'success' }
  return types[status] || 'default'
}

const getStatusText = (status) => {
  const texts = { unhandled: '待处理', handling: '处理中', handled: '已处理' }
  return texts[status] || status
}

const search = () => { console.log('搜索告警:', searchForm) }
const searchRules = () => { console.log('搜索规则:', searchForm) }
const handleAlert = (row) => { console.log('处理告警:', row) }
const viewDetail = (row) => { console.log('查看详情:', row) }
const editRule = (row) => { Object.assign(form, row); showAddModal.value = true }
const deleteRule = (row) => { console.log('删除规则:', row) }
const viewPlan = (row) => { console.log('查看预案:', row) }
const editPlan = (row) => { console.log('编辑预案:', row) }
const saveRule = () => { console.log('保存规则:', form); showAddModal.value = false }
</script>

<style scoped>
.alerts-page { padding: 20px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
.stat-item { text-align: center; }
.stat-num { font-size: 32px; font-weight: 600; }
.stat-num.red { color: #F56C6C; }
.stat-num.orange { color: #E6A23C; }
.stat-num.blue { color: #409EFF; }
.stat-num.green { color: #67C23A; }
.stat-label { color: #909399; font-size: 14px; }
.search-bar { display: flex; gap: 12px; margin-bottom: 20px; }
.search-input { width: 200px; }
.dialog-footer { text-align: right; }
</style>
<template>
  <div class="admin-page">
    <div class="page-header">
      <h2>运营管理后台</h2>
    </div>

    <el-tabs v-model="activeTab" type="card">
      <el-tab-pane label="数据概览" name="overview">
        <div class="stats-grid">
          <el-card class="stat-card">
            <div class="stat-info">
              <div class="stat-value">{{ stats.farmCount }}</div>
              <div class="stat-label">农场总数</div>
            </div>
          </el-card>
          <el-card class="stat-card">
            <div class="stat-info">
              <div class="stat-value">{{ stats.taskCount }}</div>
              <div class="stat-label">任务总数</div>
            </div>
          </el-card>
          <el-card class="stat-card">
            <div class="stat-info">
              <div class="stat-value">{{ stats.alertCount }}</div>
              <div class="stat-label">待处理告警</div>
            </div>
          </el-card>
        </div>
      </el-tab-pane>

      <el-tab-pane label="农场管理" name="farms">
        <el-table :data="farmList" border>
          <el-table-column prop="farmName" label="农场名称" />
          <el-table-column prop="province" label="省份" />
          <el-table-column prop="status" label="状态" />
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="告警监控" name="alerts">
        <el-table :data="alertList" border>
          <el-table-column prop="title" label="告警名称" />
          <el-table-column prop="level" label="级别" />
          <el-table-column prop="status" label="状态" />
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="租户管理" name="tenants">
        <el-table :data="tenantList" border>
          <el-table-column prop="tenantName" label="租户名称" />
          <el-table-column prop="tenantType" label="租户类型" />
          <el-table-column prop="status" label="状态" />
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="系统日志" name="logs">
        <el-table :data="logs" border>
          <el-table-column prop="logTime" label="时间" />
          <el-table-column prop="content" label="内容" />
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="系统配置" name="config">
        <el-form :model="systemConfig" label-width="150px">
          <el-form-item label="系统名称">
            <el-input v-model="systemConfig.systemName" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="saveConfig">保存配置</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { adminAPI } from '@/api'

const activeTab = ref('overview')

const stats = reactive({
  farmCount: 0,
  taskCount: 0,
  alertCount: 0
})

const systemConfig = reactive({
  systemName: '农业生产管理系统'
})

const farmList = ref([
  { id: 1, farmName: '示范农场', province: '山东省', status: 'active' },
  { id: 2, farmName: '绿色生态园', province: '河南省', status: 'active' }
])

const alertList = ref([])

const tenantList = ref([
  { id: 1, tenantName: '山东农业集团', tenantType: '企业', status: 'active' },
  { id: 2, tenantName: '河南绿色农业', tenantType: '合作社', status: 'active' }
])

const logs = ref([
  { id: 1, logTime: '2024-07-20 15:30:00', content: '系统启动' },
  { id: 2, logTime: '2024-07-20 15:31:00', content: '数据同步完成' }
])

const loadOverview = async () => {
  try {
    const response = await adminAPI.overview()
    if (response.data) {
      stats.farmCount = response.data.farmCount || 0
      stats.taskCount = response.data.taskCount || 0
      stats.alertCount = response.data.alertCount || 0
    }
  } catch (error) {
    console.error('加载概览数据失败:', error)
  }
}

const saveConfig = () => {
  console.log('保存配置:', systemConfig)
}

onMounted(() => {
  loadOverview()
})
</script>

<style scoped>
.admin-page { padding: 20px; }
.page-header { margin-bottom: 20px; }
.stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px; }
.stat-card { padding: 20px; }
.stat-value { font-size: 28px; font-weight: 600; }
.stat-label { font-size: 14px; color: #909399; }
</style>

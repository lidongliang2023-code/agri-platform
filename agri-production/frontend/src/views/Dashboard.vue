<template>
  <div class="dashboard-page">
    <div class="header-section">
      <div class="header-left">
        <h1>数据看板</h1>
        <p>实时监控农场生产运营状况</p>
      </div>
      <div class="header-right">
        <div class="weather-info">
          <span class="weather-icon">
            <el-icon name="sunny"></el-icon>
          </span>
          <span class="weather-text">晴 25°C</span>
        </div>
      </div>
    </div>

    <div class="stats-row">
      <el-card class="stat-card">
        <div class="stat-header">
          <div class="stat-icon blue">
            <el-icon name="crop"></el-icon>
          </div>
          <div class="stat-trend">
            <el-icon name="trending-up"></el-icon>
            <span>+10%</span>
          </div>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ cropCount }}</div>
          <div class="stat-label">在田作物</div>
        </div>
      </el-card>

      <el-card class="stat-card">
        <div class="stat-header">
          <div class="stat-icon green">
            <el-icon name="leaf"></el-icon>
          </div>
          <div class="stat-trend">
            <el-icon name="trending-up"></el-icon>
            <span>+5%</span>
          </div>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ growthCount }}</div>
          <div class="stat-label">苗情长势</div>
        </div>
      </el-card>

      <el-card class="stat-card">
        <div class="stat-header">
          <div class="stat-icon purple">
            <el-icon name="list-checks"></el-icon>
          </div>
          <div class="stat-trend warning">
            <el-icon name="trending-down"></el-icon>
            <span>-2项</span>
          </div>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ taskCount }}</div>
          <div class="stat-label">待办任务</div>
        </div>
      </el-card>

      <el-card class="stat-card">
        <div class="stat-header">
          <div class="stat-icon orange">
            <el-icon name="wallet"></el-icon>
          </div>
          <div class="stat-trend">
            <el-icon name="trending-down"></el-icon>
            <span>-8%</span>
          </div>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ inputAmount }}</div>
          <div class="stat-label">今日投入</div>
        </div>
      </el-card>
    </div>

    <div class="charts-section">
      <el-card class="chart-card">
        <div class="card-header">
          <h3>任务完成趋势</h3>
        </div>
        <div ref="taskChart" class="chart"></div>
      </el-card>

      <el-card class="chart-card">
        <div class="card-header">
          <h3>采收量统计</h3>
        </div>
        <div ref="harvestChart" class="chart"></div>
      </el-card>
    </div>

    <div class="bottom-section">
      <el-card class="info-card">
        <div class="card-header">
          <h3>区块链存证统计</h3>
        </div>
        <div class="chain-stats">
          <div class="chain-stat-item">
            <div class="chain-value">12</div>
            <div class="chain-label">今日上链记录</div>
          </div>
          <div class="chain-divider"></div>
          <div class="chain-stat-item">
            <div class="chain-value">1,234</div>
            <div class="chain-label">链上总记录</div>
          </div>
        </div>
      </el-card>

      <el-card class="info-card">
        <div class="card-header">
          <h3>预警中心</h3>
          <span class="no-data">暂无预警信息</span>
        </div>
      </el-card>

      <el-card class="info-card">
        <div class="card-header">
          <h3>待办任务</h3>
          <button class="view-all">查看全部</button>
        </div>
        <div class="task-list">
          <div class="task-item" v-for="task in taskList" :key="task.id">
            <div class="task-info">
              <div class="task-name">{{ task.name }}</div>
              <div class="task-meta">{{ task.farm }} · {{ task.time }}</div>
            </div>
            <el-tag :type="task.priority === 'high' ? 'danger' : 'warning'">
              {{ task.priority === 'high' ? '紧急' : '普通' }}
            </el-tag>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'

const cropCount = ref(12)
const growthCount = ref(86)
const taskCount = ref(5)
const inputAmount = ref('¥2,350')

const taskList = ref([
  { id: 1, name: '水稻播种', farm: '绿源生态农场', time: '今天 09:00', priority: 'high' },
  { id: 2, name: '番茄施肥', farm: '绿源生态农场', time: '今天 14:00', priority: 'normal' },
  { id: 3, name: '病虫害防治', farm: '金穗农业基地', time: '明天 08:30', priority: 'high' }
])

let taskChartInstance = null
let harvestChartInstance = null

const initCharts = () => {
  if (taskChartInstance) taskChartInstance.dispose()
  const taskChartEl = document.querySelector('.dashboard-page .charts-section .chart-card:nth-child(1) .chart')
  if (taskChartEl) {
    taskChartInstance = echarts.init(taskChartEl)
    taskChartInstance.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] },
      yAxis: { type: 'value' },
      series: [{
        name: '完成任务',
        type: 'bar',
        data: [8, 12, 10, 15, 11, 9, 6],
        itemStyle: { color: '#48bb78', borderRadius: [4, 4, 0, 0] }
      }]
    })
  }

  if (harvestChartInstance) harvestChartInstance.dispose()
  const harvestChartEl = document.querySelector('.dashboard-page .charts-section .chart-card:nth-child(2) .chart')
  if (harvestChartEl) {
    harvestChartInstance = echarts.init(harvestChartEl)
    harvestChartInstance.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: ['1月', '2月', '3月', '4月', '5月', '6月'] },
      yAxis: { type: 'value' },
      series: [{
        name: '采收量',
        type: 'line',
        smooth: true,
        data: [120, 150, 180, 220, 280, 350],
        lineStyle: { color: '#4299e1', width: 3 },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(66, 153, 225, 0.3)' },
          { offset: 1, color: 'rgba(66, 153, 225, 0.05)' }
        ]) }
      }]
    })
  }
}

onMounted(() => {
  setTimeout(() => initCharts(), 300)
  window.addEventListener('resize', initCharts)
})

onUnmounted(() => {
  window.removeEventListener('resize', initCharts)
  if (taskChartInstance) taskChartInstance.dispose()
  if (harvestChartInstance) harvestChartInstance.dispose()
})
</script>

<style scoped>
.dashboard-page { padding: 24px; }
.header-section { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.header-left h1 { margin: 0; font-size: 24px; color: #1a365d; }
.header-left p { margin: 4px 0 0; color: #718096; }
.weather-info { display: flex; align-items: center; gap: 8px; padding: 8px 16px; background: #f7fafc; border-radius: 8px; }
.weather-icon { color: #ed8936; font-size: 20px; }
.weather-text { font-size: 14px; color: #1a365d; }

.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.stat-card { padding: 20px; }
.stat-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.stat-icon { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; color: white; }
.stat-icon.blue { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
.stat-icon.green { background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); }
.stat-icon.purple { background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%); }
.stat-icon.orange { background: linear-gradient(135deg, #ed8936 0%, #dd6b20 100%); }
.stat-trend { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #48bb78; }
.stat-trend.warning { color: #ed8936; }
.stat-body { }
.stat-value { font-size: 32px; font-weight: 600; color: #1a365d; }
.stat-label { font-size: 14px; color: #718096; margin-top: 4px; }

.charts-section { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px; }
.chart-card { height: 280px; }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.card-header h3 { margin: 0; font-size: 16px; color: #1a365d; }
.no-data { font-size: 14px; color: #a0aec0; }
.chart { height: calc(100% - 50px); }

.bottom-section { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.info-card { }
.view-all { background: none; border: none; color: #4299e1; font-size: 12px; cursor: pointer; }
.chain-stats { display: flex; align-items: center; justify-content: center; padding: 20px; }
.chain-stat-item { text-align: center; }
.chain-value { font-size: 36px; font-weight: 600; color: #1a365d; }
.chain-label { font-size: 14px; color: #718096; margin-top: 4px; }
.chain-divider { width: 1px; height: 60px; background: #e2e8f0; margin: 0 40px; }

.task-list { }
.task-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f7fafc; }
.task-item:last-child { border-bottom: none; }
.task-info { }
.task-name { font-size: 14px; color: #1a365d; font-weight: 500; }
.task-meta { font-size: 12px; color: #a0aec0; margin-top: 2px; }
</style>

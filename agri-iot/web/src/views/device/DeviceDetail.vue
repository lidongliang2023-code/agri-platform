<template>
  <div class="device-detail">
    <el-button type="primary" @click="goBack" class="back-btn">返回</el-button>
    
    <div class="detail-header">
      <div class="device-info">
        <h2>{{ deviceDetail.deviceName }}</h2>
        <div class="status-tag">
          <el-tag :type="deviceDetail.status === 'online' ? 'success' : 'danger'">
            {{ deviceDetail.status === 'online' ? '在线' : '离线' }}
          </el-tag>
        </div>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-card">
        <h3>基本信息</h3>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="设备编号">{{ deviceDetail.deviceCode }}</el-descriptions-item>
          <el-descriptions-item label="设备类型">{{ deviceDetail.deviceTypeName }}</el-descriptions-item>
          <el-descriptions-item label="所属地块">{{ deviceDetail.plotName }}</el-descriptions-item>
          <el-descriptions-item label="网关名称">{{ deviceDetail.gatewayName }}</el-descriptions-item>
          <el-descriptions-item label="固件版本">{{ deviceDetail.firmwareVersion }}</el-descriptions-item>
          <el-descriptions-item label="安装位置">{{ deviceDetail.installLocation }}</el-descriptions-item>
          <el-descriptions-item label="最后在线">{{ deviceDetail.lastOnlineTime }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ deviceDetail.createTime }}</el-descriptions-item>
        </el-descriptions>
      </div>

      <div class="info-card">
        <h3>实时数据</h3>
        <div class="realtime-data">
          <div class="data-item" v-for="(value, key) in realtimeData" :key="key">
            <div class="data-label">{{ key }}</div>
            <div class="data-value">{{ value }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="chart-section">
      <h3>历史数据趋势</h3>
      <div ref="historyChart" class="chart"></div>
    </div>

    <div class="control-section">
      <h3>设备控制</h3>
      <el-form :model="controlForm" label-width="120px">
        <el-form-item label="控制命令">
          <el-select v-model="controlForm.command" style="width: 200px;">
            <el-option label="开启" value="on" />
            <el-option label="关闭" value="off" />
            <el-option label="重启" value="reboot" />
          </el-select>
        </el-form-item>
        <el-form-item label="参数">
          <el-input v-model="controlForm.params" placeholder="JSON格式参数" style="width: 300px;" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleControl">执行命令</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import * as echarts from 'echarts'
import { ElMessage } from 'element-plus'

const deviceDetail = ref({
  deviceName: '温湿度传感器-001',
  deviceCode: 'D001',
  deviceTypeName: '温湿度传感器',
  plotName: '地块A',
  gatewayName: '网关-001',
  firmwareVersion: 'V1.0.2',
  installLocation: '地块A-区域1',
  status: 'online',
  lastOnlineTime: '刚刚',
  createTime: '2024-01-01 10:00:00'
})

const realtimeData = ref({
  '温度': '25.6°C',
  '湿度': '65%',
  '电池电量': '88%',
  '信号强度': '-65dBm'
})

const controlForm = reactive({
  command: '',
  params: ''
})

const historyChart = ref(null)

const goBack = () => {
  window.history.back()
}

const handleControl = () => {
  if (!controlForm.command) {
    ElMessage.warning('请选择控制命令')
    return
  }
  ElMessage.success('控制命令已发送')
}

onMounted(() => {
  initChart()
})

const initChart = () => {
  const chart = echarts.init(historyChart.value)
  chart.setOption({
    grid: { top: 30, left: 50, right: 30, bottom: 50 },
    xAxis: {
      type: 'category',
      data: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
      axisLine: { lineStyle: { color: '#ddd' } }
    },
    yAxis: [
      { type: 'value', name: '温度(°C)', axisLine: { show: false } },
      { type: 'value', name: '湿度(%)', axisLine: { show: false } }
    ],
    series: [
      { type: 'line', name: '温度', data: [22, 24, 28, 30, 27, 24], yAxisIndex: 0, smooth: true, lineStyle: { color: '#f57c00' } },
      { type: 'line', name: '湿度', data: [70, 68, 62, 58, 60, 65], yAxisIndex: 1, smooth: true, lineStyle: { color: '#409eff' } }
    ],
    legend: { data: ['温度', '湿度'], top: 0 }
  })
}
</script>

<style scoped>
.device-detail {
  background: #fff;
  padding: 20px;
  border-radius: 12px;
}

.back-btn {
  margin-bottom: 20px;
}

.detail-header {
  margin-bottom: 20px;
}

.device-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.device-info h2 {
  margin: 0;
}

.status-tag {
  margin-top: 6px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-bottom: 20px;
}

.info-card {
  background: #f9fafc;
  padding: 20px;
  border-radius: 8px;
}

.info-card h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #303133;
}

.realtime-data {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.data-item {
  background: #fff;
  padding: 12px;
  border-radius: 8px;
  text-align: center;
}

.data-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}

.data-value {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
}

.chart-section {
  background: #f9fafc;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.chart-section h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #303133;
}

.chart {
  height: 300px;
}

.control-section {
  background: #f9fafc;
  padding: 20px;
  border-radius: 8px;
}

.control-section h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #303133;
}
</style>
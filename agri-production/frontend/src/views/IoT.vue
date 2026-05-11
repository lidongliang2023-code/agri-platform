<template>
  <div class="iot-page">
    <div class="page-header">
      <el-button type="primary" @click="showAddDialog = true">
        <el-icon><Plus /></el-icon> 添加设备
      </el-button>
      <el-select v-model="statusFilter" placeholder="状态筛选" class="status-select">
        <el-option label="全部" value="" />
        <el-option label="在线" value="online" />
        <el-option label="离线" value="offline" />
      </el-select>
      <el-select v-model="typeFilter" placeholder="类型筛选" class="type-select">
        <el-option label="全部" value="" />
        <el-option label="土壤传感器" value="soil" />
        <el-option label="气象站" value="weather" />
        <el-option label="摄像头" value="camera" />
      </el-select>
    </div>

    <div class="devices-grid">
      <el-card v-for="device in devices" :key="device.id" class="device-card">
        <div class="device-header">
          <div class="device-icon" :class="device.status">
            <el-icon><Cpu /></el-icon>
          </div>
          <div class="device-info">
            <h3>{{ device.deviceName }}</h3>
            <p>{{ device.deviceCode }}</p>
          </div>
          <el-tag :type="device.status === 'online' ? 'success' : 'danger'" class="status-tag">
            {{ device.status === 'online' ? '在线' : '离线' }}
          </el-tag>
        </div>
        <div class="device-details">
          <div class="detail-item">
            <span class="label">类型:</span>
            <span>{{ getTypeText(device.deviceType) }}</span>
          </div>
          <div class="detail-item">
            <span class="label">位置:</span>
            <span>{{ device.location }}</span>
          </div>
          <div class="detail-item">
            <span class="label">所属地块:</span>
            <span>{{ device.plotName }}</span>
          </div>
          <div class="detail-item">
            <span class="label">最后连接:</span>
            <span>{{ device.lastConnectTime }}</span>
          </div>
        </div>
        <div v-if="device.status === 'online' && device.latestData" class="device-data">
          <h4>实时数据</h4>
          <div class="data-grid">
            <div class="data-item" v-for="(value, key) in device.latestData" :key="key">
              <span class="data-label">{{ getDataLabel(key) }}</span>
              <span class="data-value">{{ value }}</span>
            </div>
          </div>
        </div>
        <div class="device-actions">
          <el-button size="small" @click="viewData(device)">查看数据</el-button>
          <el-button 
            v-if="device.status === 'offline'" 
            size="small" 
            type="success" 
            @click="connectDevice(device.id)"
          >连接</el-button>
          <el-button 
            v-if="device.status === 'online'" 
            size="small" 
            type="warning" 
            @click="disconnectDevice(device.id)"
          >断开</el-button>
        </div>
      </el-card>
    </div>

    <el-dialog :title="editForm.id ? '编辑设备' : '添加设备'" :visible.sync="showAddDialog">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="设备名称" prop="deviceName">
          <el-input v-model="editForm.deviceName" />
        </el-form-item>
        <el-form-item label="设备编码" prop="deviceCode">
          <el-input v-model="editForm.deviceCode" />
        </el-form-item>
        <el-form-item label="设备类型" prop="deviceType">
          <el-select v-model="editForm.deviceType">
            <el-option label="土壤传感器" value="soil" />
            <el-option label="气象站" value="weather" />
            <el-option label="摄像头" value="camera" />
            <el-option label="灌溉设备" value="irrigation" />
          </el-select>
        </el-form-item>
        <el-form-item label="位置" prop="location">
          <el-input v-model="editForm.location" />
        </el-form-item>
        <el-form-item label="所属地块" prop="plotId">
          <el-select v-model="editForm.plotId">
            <el-option v-for="plot in plotOptions" :key="plot.value" :label="plot.label" :value="plot.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="IP地址" prop="ipAddress">
          <el-input v-model="editForm.ipAddress" />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-textarea v-model="editForm.remark" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="saveDevice">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog title="设备数据详情" :visible.sync="showDataDialog" width="800px">
      <div v-if="currentDevice">
        <h3>{{ currentDevice.deviceName }} - 历史数据</h3>
        <div ref="dataChart" class="chart"></div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import { Plus, Cpu } from '@element-plus/icons-vue'

const statusFilter = ref('')
const typeFilter = ref('')
const showAddDialog = ref(false)
const showDataDialog = ref(false)

const plotOptions = ref([
  { value: 1, label: '地块A1 - 阳光农场' },
  { value: 2, label: '地块A2 - 阳光农场' },
  { value: 3, label: '地块B1 - 绿色田园' },
  { value: 4, label: '地块C1 - 生态农庄' },
  { value: 5, label: '地块D1 - 现代农业园' }
])

const devices = ref([
  { id: 1, deviceName: '土壤传感器-001', deviceCode: 'D001', deviceType: 'soil', location: '地块A1-东北角', plotId: 1, plotName: '地块A1', ipAddress: '192.168.1.101', status: 'online', lastConnectTime: '2024-01-15 10:30', latestData: { temperature: '25.3°C', humidity: '65%', pH: '6.8', moisture: '28%' } },
  { id: 2, deviceName: '气象站-001', deviceCode: 'D002', deviceType: 'weather', location: '农场中心', plotId: 1, plotName: '阳光农场', ipAddress: '192.168.1.102', status: 'online', lastConnectTime: '2024-01-15 10:30', latestData: { temperature: '26.1°C', humidity: '60%', windSpeed: '5.2m/s', rainfall: '0mm' } },
  { id: 3, deviceName: '摄像头-001', deviceCode: 'D003', deviceType: 'camera', location: '地块B1', plotId: 3, plotName: '地块B1', ipAddress: '192.168.1.103', status: 'online', lastConnectTime: '2024-01-15 10:28', latestData: {} },
  { id: 4, deviceName: '灌溉控制器-001', deviceCode: 'D004', deviceType: 'irrigation', location: '地块A2', plotId: 2, plotName: '地块A2', ipAddress: '192.168.1.104', status: 'offline', lastConnectTime: '2024-01-14 18:00', latestData: null },
  { id: 5, deviceName: '土壤传感器-002', deviceCode: 'D005', deviceType: 'soil', location: '地块C1', plotId: 4, plotName: '地块C1', ipAddress: '192.168.1.105', status: 'online', lastConnectTime: '2024-01-15 10:29', latestData: { temperature: '24.8°C', humidity: '70%', pH: '7.1', moisture: '32%' } }
])

const editForm = reactive({
  id: null,
  deviceName: '',
  deviceCode: '',
  deviceType: 'soil',
  location: '',
  plotId: '',
  ipAddress: '',
  remark: ''
})

const currentDevice = ref(null)
const dataChart = ref(null)

const getTypeText = (type) => {
  const texts = { soil: '土壤传感器', weather: '气象站', camera: '摄像头', irrigation: '灌溉设备' }
  return texts[type] || type
}

const getDataLabel = (key) => {
  const labels = { temperature: '温度', humidity: '湿度', pH: 'pH值', moisture: '含水率', windSpeed: '风速', rainfall: '降雨量' }
  return labels[key] || key
}

const viewData = (device) => {
  currentDevice.value = device
  showDataDialog.value = true
  nextTick(() => {
    if (dataChart.value) {
      const chart = echarts.init(dataChart.value)
      chart.setOption({
        tooltip: { trigger: 'axis' },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category', data: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00'] },
        yAxis: { type: 'value' },
        series: [{
          name: '温度',
          type: 'line',
          data: [23, 24, 25, 26, 27, 26, 25]
        }, {
          name: '湿度',
          type: 'line',
          data: [60, 62, 65, 68, 70, 68, 65]
        }]
      })
    }
  })
}

const connectDevice = (id) => {
  const device = devices.value.find(d => d.id === id)
  if (device) {
    device.status = 'online'
    device.lastConnectTime = new Date().toLocaleString()
    device.latestData = { temperature: '25°C', humidity: '60%' }
    ElMessage.success('连接成功')
  }
}

const disconnectDevice = (id) => {
  const device = devices.value.find(d => d.id === id)
  if (device) {
    device.status = 'offline'
    ElMessage.success('已断开连接')
  }
}

const saveDevice = () => {
  const plot = plotOptions.value.find(p => p.value === editForm.plotId)
  const plotName = plot?.label?.split(' - ')[0] || ''
  
  if (editForm.id) {
    const index = devices.value.findIndex(d => d.id === editForm.id)
    if (index > -1) {
      devices.value[index] = { ...editForm, plotName, status: 'offline', lastConnectTime: '未连接', latestData: null }
    }
    ElMessage.success('更新成功')
  } else {
    const newDevice = {
      ...editForm,
      id: Date.now(),
      plotName,
      status: 'offline',
      lastConnectTime: '未连接',
      latestData: null
    }
    devices.value.push(newDevice)
    ElMessage.success('添加成功')
  }
  showAddDialog.value = false
  resetForm()
}

const resetForm = () => {
  editForm.id = null
  editForm.deviceName = ''
  editForm.deviceCode = ''
  editForm.deviceType = 'soil'
  editForm.location = ''
  editForm.plotId = ''
  editForm.ipAddress = ''
  editForm.remark = ''
}

onMounted(() => {})
</script>

<style scoped>
.iot-page {
  padding: 20px;
}

.page-header {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.status-select, .type-select {
  width: 150px;
}

.devices-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 20px;
}

.device-card {
  height: 100%;
}

.device-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #eee;
}

.device-icon {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.device-icon.online {
  background: #f6ffed;
  color: #52c41a;
}

.device-icon.offline {
  background: #fff2f0;
  color: #ff4d4f;
}

.device-info h3 {
  margin: 0;
  font-size: 16px;
}

.device-info p {
  margin: 4px 0 0;
  color: #999;
  font-size: 12px;
}

.status-tag {
  margin-left: auto;
}

.device-details {
  margin-bottom: 16px;
}

.detail-item {
  display: flex;
  padding: 4px 0;
  font-size: 14px;
}

.detail-item .label {
  width: 80px;
  color: #999;
}

.device-data h4 {
  margin: 0 0 12px;
  font-size: 14px;
}

.data-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.data-item {
  background: #f8f9fa;
  padding: 8px;
  border-radius: 4px;
}

.data-label {
  display: block;
  font-size: 12px;
  color: #999;
}

.data-value {
  display: block;
  font-size: 16px;
  font-weight: bold;
}

.device-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #eee;
}

.chart {
  height: 300px;
}
</style>
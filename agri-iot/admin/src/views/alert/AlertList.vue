<template>
  <div class="alert-list">
    <div class="page-header">
      <h2>告警管理</h2>
    </div>

    <div class="stats-row">
      <div class="stat-item critical">
        <span class="stat-value">{{ criticalCount }}</span>
        <span class="stat-label">紧急告警</span>
      </div>
      <div class="stat-item warning">
        <span class="stat-value">{{ warningCount }}</span>
        <span class="stat-label">警告</span>
      </div>
      <div class="stat-item info">
        <span class="stat-value">{{ infoCount }}</span>
        <span class="stat-label">信息</span>
      </div>
    </div>

    <div class="search-bar">
      <select v-model="levelFilter" class="filter-select">
        <option value="">全部级别</option>
        <option value="critical">紧急</option>
        <option value="warning">警告</option>
        <option value="info">信息</option>
      </select>
      <select v-model="statusFilter" class="filter-select">
        <option value="">全部状态</option>
        <option value="pending">待处理</option>
        <option value="handled">已处理</option>
      </select>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>设备名称</th>
          <th>告警类型</th>
          <th>级别</th>
          <th>状态</th>
          <th>时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="alert in alertList" :key="alert.id">
          <td>{{ alert.deviceName }}</td>
          <td>{{ alert.type }}</td>
          <td><span :class="['level-tag', alert.level]">{{ alert.level === 'critical' ? '紧急' : alert.level === 'warning' ? '警告' : '信息' }}</span></td>
          <td><span :class="['status-tag', alert.status]">{{ alert.status === 'pending' ? '待处理' : '已处理' }}</span></td>
          <td>{{ alert.time }}</td>
          <td>
            <button v-if="alert.status === 'pending'" class="handle-btn" @click="handleAlert(alert.id)">处理</button>
            <span v-else class="handled-text">已处理</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const levelFilter = ref('')
const statusFilter = ref('')

const alertList = ref([
  { id: 1, deviceName: '温湿度传感器-001', type: '温度异常', level: 'critical', status: 'pending', time: '10分钟前' },
  { id: 2, deviceName: '灌溉控制器-004', type: '设备离线', level: 'critical', status: 'pending', time: '25分钟前' },
  { id: 3, deviceName: '土壤传感器-002', type: '湿度偏低', level: 'warning', status: 'pending', time: '40分钟前' },
  { id: 4, deviceName: '光照传感器-003', type: '光照不足', level: 'warning', status: 'handled', time: '1小时前' },
  { id: 5, deviceName: 'CO2传感器-005', type: '浓度过高', level: 'info', status: 'handled', time: '2小时前' },
  { id: 6, deviceName: '风速传感器-006', type: '设备上线', level: 'info', status: 'handled', time: '3小时前' }
])

const criticalCount = computed(() => alertList.value.filter(a => a.level === 'critical' && a.status === 'pending').length)
const warningCount = computed(() => alertList.value.filter(a => a.level === 'warning' && a.status === 'pending').length)
const infoCount = computed(() => alertList.value.filter(a => a.level === 'info' && a.status === 'pending').length)

const handleAlert = (id) => {
  const alert = alertList.value.find(a => a.id === id)
  if (alert) {
    alert.status = 'handled'
    alert('告警已处理')
  }
}
</script>

<style scoped>
.alert-list {
  padding: 20px;
}

.page-header {
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #333;
}

.stats-row {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}

.stat-item {
  flex: 1;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
}

.stat-item.critical { background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); }
.stat-item.warning { background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); }
.stat-item.info { background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); }

.stat-item.critical .stat-value { color: #ef4444; }
.stat-item.warning .stat-value { color: #f59e0b; }
.stat-item.info .stat-value { color: #3b82f6; }

.stat-value {
  display: block;
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 13px;
  color: #666;
}

.search-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.filter-select {
  padding: 10px 14px;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  font-size: 14px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.data-table thead th {
  background: #f8f9fa;
  text-align: left;
  padding: 14px;
  font-size: 13px;
  font-weight: 600;
  color: #666;
  border-bottom: 1px solid #e8e8e8;
}

.data-table tbody td {
  padding: 14px;
  font-size: 13px;
  color: #333;
  border-bottom: 1px solid #f5f5f5;
}

.level-tag {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.level-tag.critical { background: #fff2f0; color: #ff4d4f; }
.level-tag.warning { background: #fffbe6; color: #faad14; }
.level-tag.info { background: #e6f7ff; color: #1890ff; }

.status-tag {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-tag.pending { background: #fff2f0; color: #ff4d4f; }
.status-tag.handled { background: #f6ffed; color: #52c41a; }

.handle-btn {
  padding: 6px 12px;
  background: #4080ff;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.handled-text {
  font-size: 12px;
  color: #999;
}
</style>
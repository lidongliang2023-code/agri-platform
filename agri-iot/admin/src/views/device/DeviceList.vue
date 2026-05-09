<template>
  <div class="device-list">
    <div class="page-header">
      <h2>设备管理</h2>
    </div>

    <div class="stats-row">
      <div class="stat-item">
        <span class="stat-value">{{ totalCount }}</span>
        <span class="stat-label">设备总数</span>
      </div>
      <div class="stat-item online">
        <span class="stat-value">{{ onlineCount }}</span>
        <span class="stat-label">在线设备</span>
      </div>
      <div class="stat-item offline">
        <span class="stat-value">{{ offlineCount }}</span>
        <span class="stat-label">离线设备</span>
      </div>
    </div>

    <div class="search-bar">
      <input v-model="searchText" placeholder="搜索设备名称或编号" class="search-input" />
      <select v-model="statusFilter" class="filter-select">
        <option value="">全部状态</option>
        <option value="online">在线</option>
        <option value="offline">离线</option>
      </select>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>设备编号</th>
          <th>设备名称</th>
          <th>设备类型</th>
          <th>所属用户</th>
          <th>状态</th>
          <th>最后在线</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="device in deviceList" :key="device.id">
          <td>{{ device.code }}</td>
          <td>{{ device.name }}</td>
          <td>{{ device.type }}</td>
          <td>{{ device.user }}</td>
          <td><span :class="['status-tag', device.status]">{{ device.status === 'online' ? '在线' : '离线' }}</span></td>
          <td>{{ device.lastOnline }}</td>
          <td>
            <button class="view-btn" @click="viewDetail(device)">查看</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const searchText = ref('')
const statusFilter = ref('')

const deviceList = ref([
  { id: 1, code: 'D001', name: '温湿度传感器-001', type: '温湿度传感器', user: '张三', status: 'online', lastOnline: '刚刚' },
  { id: 2, code: 'D002', name: '土壤湿度传感器-002', type: '土壤湿度传感器', user: '张三', status: 'online', lastOnline: '5分钟前' },
  { id: 3, code: 'D003', name: '光照传感器-003', type: '光照传感器', user: '李四', status: 'offline', lastOnline: '30分钟前' },
  { id: 4, code: 'D004', name: '灌溉控制器-004', type: '灌溉控制器', user: '王五', status: 'online', lastOnline: '刚刚' },
  { id: 5, code: 'D005', name: 'CO2传感器-005', type: 'CO2传感器', user: '赵六', status: 'online', lastOnline: '10分钟前' },
  { id: 6, code: 'D006', name: '风速传感器-006', type: '风速传感器', user: '李四', status: 'offline', lastOnline: '2小时前' }
])

const totalCount = computed(() => deviceList.value.length)
const onlineCount = computed(() => deviceList.value.filter(d => d.status === 'online').length)
const offlineCount = computed(() => deviceList.value.filter(d => d.status === 'offline').length)

const viewDetail = (device) => {
  alert(`设备详情：${device.name}`)
}
</script>

<style scoped>
.device-list {
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
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.stat-item.online .stat-value { color: #52c41a; }
.stat-item.offline .stat-value { color: #ff4d4f; }

.stat-value {
  display: block;
  font-size: 32px;
  font-weight: 700;
  color: #333;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 13px;
  color: #999;
}

.search-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.search-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  font-size: 14px;
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

.status-tag {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-tag.online { background: #d1fae5; color: #065f46; }
.status-tag.offline { background: #f3f4f6; color: #6b7280; }

.view-btn {
  padding: 6px 12px;
  background: #f0f0f0;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  color: #666;
}
</style>
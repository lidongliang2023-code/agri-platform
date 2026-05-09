<template>
  <div class="push-message">
    <div class="page-header">
      <div class="header-left">
        <h2>消息记录</h2>
      </div>
      <div class="header-right">
        <el-input v-model="searchText" placeholder="搜索消息内容" class="search-input" />
        <el-button type="primary" @click="handleSearch">搜索</el-button>
      </div>
    </div>

    <div class="filter-bar">
      <el-select v-model="filter.channel" placeholder="推送渠道">
        <el-option label="全部" value="" />
        <el-option label="微信" value="wechat" />
        <el-option label="短信" value="sms" />
        <el-option label="邮件" value="email" />
      </el-select>
      <el-select v-model="filter.status" placeholder="发送状态">
        <el-option label="全部" value="" />
        <el-option label="成功" value="success" />
        <el-option label="失败" value="failed" />
        <el-option label="待发送" value="pending" />
      </el-select>
      <el-date-picker v-model="filter.date" type="date" placeholder="选择日期" />
    </div>

    <el-table :data="messageList" border class="message-table">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="title" label="消息标题" />
      <el-table-column prop="content" label="消息内容" />
      <el-table-column prop="channel" label="推送渠道">
        <template #default="scope">
          <el-tag :type="getChannelType(scope.row.channel)">{{ getChannelName(scope.row.channel) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="target" label="接收人" />
      <el-table-column prop="status" label="发送状态">
        <template #default="scope">
          <el-tag :type="getStatusType(scope.row.status)">
            {{ getStatusName(scope.row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="sendTime" label="发送时间" />
      <el-table-column prop="errorMsg" label="错误信息" />
      <el-table-column label="操作" width="120">
        <template #default="scope">
          <el-button type="text" @click="retrySend(scope.row)">重发</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination">
      <el-pagination
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
        :current-page="currentPage"
        :page-sizes="[10, 20, 50, 100]"
        :page-size="pageSize"
        layout="total, sizes, prev, pager, next, jumper"
        :total="total"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'

const searchText = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(42)

const filter = reactive({
  channel: '',
  status: '',
  date: ''
})

const messageList = ref([
  { id: 1, title: '设备离线告警', content: '温湿度传感器-001 设备离线，请及时检查', channel: 'wechat', target: '管理员', status: 'success', sendTime: '2024-01-15 10:30:00', errorMsg: '' },
  { id: 2, title: '温度异常告警', content: '地块A温度超过35°C，当前温度36.5°C', channel: 'sms', target: '操作员A', status: 'success', sendTime: '2024-01-15 10:25:00', errorMsg: '' },
  { id: 3, title: '土壤湿度告警', content: '土壤湿度低于阈值，建议灌溉', channel: 'email', target: '操作员B', status: 'failed', sendTime: '2024-01-15 10:20:00', errorMsg: '邮箱服务器连接超时' },
  { id: 4, title: '设备上线通知', content: '灌溉控制器-001 已上线', channel: 'wechat', target: '管理员', status: 'success', sendTime: '2024-01-15 10:15:00', errorMsg: '' },
  { id: 5, title: '报表生成通知', content: '每日报表已生成，请查看', channel: 'wechat', target: '管理员', status: 'pending', sendTime: '--', errorMsg: '' }
])

const getChannelName = (channel) => {
  const map = { wechat: '微信', sms: '短信', email: '邮件' }
  return map[channel] || channel
}

const getChannelType = (channel) => {
  const map = { wechat: 'success', sms: 'warning', email: 'info' }
  return map[channel] || 'default'
}

const getStatusName = (status) => {
  const map = { success: '成功', failed: '失败', pending: '待发送' }
  return map[status] || status
}

const getStatusType = (status) => {
  const map = { success: 'success', failed: 'danger', pending: 'warning' }
  return map[status] || 'default'
}

const handleSearch = () => {
  uni.showToast({ title: '搜索功能', icon: 'none' })
}

const handleSizeChange = (val) => {
  pageSize.value = val
}

const handleCurrentChange = (val) => {
  currentPage.value = val
}

const retrySend = (row) => {
  uni.showToast({ title: `重发消息 ${row.id}`, icon: 'none' })
}
</script>

<style scoped>
.push-message {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
  color: #333;
}

.header-right {
  display: flex;
  gap: 12px;
}

.search-input {
  width: 250px;
}

.filter-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
}

.filter-bar .el-select {
  width: 150px;
}

.message-table {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.pagination {
  margin-top: 20px;
  text-align: right;
}
</style>
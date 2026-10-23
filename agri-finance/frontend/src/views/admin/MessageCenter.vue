<template>
  <div class="message-center-container">
    <header class="header">
      <div class="logo-area">
        <div class="logo-icon">🔒</div>
        <div class="logo-text">农链金服 - 运营风控端</div>
      </div>
      <nav class="nav">
        <router-link to="/admin/workbench" class="nav-item">工作台</router-link>
        <router-link to="/admin/message-center" class="nav-item active">消息中心</router-link>
        <router-link to="/admin/approval" class="nav-item">审批管理</router-link>
        <router-link to="/admin/overdue" class="nav-item">逾期管理</router-link>
        <router-link to="/admin/report" class="nav-item">报表中心</router-link>
      </nav>
    </header>
    <main class="main-content">
      <div class="page-header">
        <h1>消息中心</h1>
        <p>查看和处理系统消息通知</p>
      </div>
      <div class="message-tabs">
        <el-tabs v-model="activeTab" @tab-click="handleTabClick">
          <el-tab-pane label="全部" name="all"></el-tab-pane>
          <el-tab-pane label="待处理" name="pending"></el-tab-pane>
          <el-tab-pane label="审批通知" name="approval"></el-tab-pane>
          <el-tab-pane label="风控预警" name="risk"></el-tab-pane>
          <el-tab-pane label="系统通知" name="system"></el-tab-pane>
        </el-tabs>
      </div>
      <div class="message-list">
        <div class="message-card" v-for="message in messages" :key="message.id">
          <div class="message-icon" :class="message.type">{{ message.icon }}</div>
          <div class="message-content">
            <div class="message-header">
              <h3>{{ message.title }}</h3>
              <span class="message-time">{{ message.time }}</span>
            </div>
            <p>{{ message.description }}</p>
            <div class="message-meta">
              <span class="message-type-tag" :class="message.type">{{ message.typeText }}</span>
              <span class="message-status" :class="message.status">{{ message.statusText }}</span>
            </div>
          </div>
          <div class="message-actions">
            <el-button size="small" @click="viewDetail(message)" v-if="message.status === 'pending'">处理</el-button>
            <el-button size="small" @click="markRead(message)">已读</el-button>
          </div>
        </div>
      </div>
      <div class="pagination">
        <el-pagination
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
          :current-page="currentPage"
          :page-sizes="[10, 20, 50]"
          :page-size="pageSize"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper">
        </el-pagination>
      </div>
    </main>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'

const activeTab = ref('all')
const currentPage = 1
const pageSize = 10
const total = 45

const messages = [
  { id: 1, icon: '⚠️', type: 'risk', typeText: '风控预警', title: '质押物价格下跌预警', description: '黑龙江玉米质押物价格下跌超过5%，当前质押率已超过预警线80%，请及时处理。', time: '5分钟前', status: 'pending', statusText: '待处理' },
  { id: 2, icon: '📝', type: 'approval', typeText: '审批通知', title: '新的借款审批申请', description: '用户张三提交了50万元农业收购贷申请，信用评分720分，已通过初审，请进行风控审核。', time: '15分钟前', status: 'pending', statusText: '待处理' },
  { id: 3, icon: '🔔', type: 'system', typeText: '系统通知', title: '系统维护公告', description: '系统将于今晚22:00-00:00进行例行维护，期间部分功能可能无法使用，请提前做好准备。', time: '1小时前', status: 'read', statusText: '已阅读' },
  { id: 4, icon: '⚠️', type: 'risk', typeText: '风控预警', title: '逾期风险提醒', description: '用户李四的贷款将于3天后到期，尚未还款，请关注并提前催收。', time: '2小时前', status: 'pending', statusText: '待处理' },
  { id: 5, icon: '📝', type: 'approval', typeText: '审批通知', title: '借款申请审批通过', description: '用户王五的30万元农机贷申请已通过审批，合同已生成，请通知用户确认。', time: '3小时前', status: 'read', statusText: '已阅读' },
  { id: 6, icon: '📊', type: 'system', typeText: '系统通知', title: '每日运营报表已生成', description: '今日运营报表已自动生成，请查看报表中心获取详细数据。', time: '今天 09:00', status: 'read', statusText: '已阅读' },
  { id: 7, icon: '⚠️', type: 'risk', typeText: '风控预警', title: '企业信用评级变更', description: '合作企业黑龙江省丰收农业发展有限公司信用评级从AA降为A，请评估相关贷款风险。', time: '昨天', status: 'pending', statusText: '待处理' },
  { id: 8, icon: '📝', type: 'approval', typeText: '审批通知', title: '质押物审核通过', description: '用户赵六提交的小麦质押物审核通过，评估价值50万元。', time: '昨天', status: 'read', statusText: '已阅读' }
]

const handleTabClick = () => {}
const viewDetail = (message) => {
  alert(`处理消息: ${message.title}`)
}
const markRead = (message) => {
  alert(`标记已读: ${message.title}`)
}
const handleSizeChange = () => {}
const handleCurrentChange = () => {}
</script>

<style scoped>
.message-center-container {
  min-height: 100vh;
  background: #f5f7fa;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 30px;
  height: 60px;
  background: linear-gradient(180deg, #0d2818 0%, #04471c 100%);
  color: white;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-icon {
  font-size: 28px;
}

.logo-text {
  font-size: 20px;
  font-weight: bold;
}

.nav {
  display: flex;
  gap: 30px;
}

.nav-item {
  color: rgba(255, 255, 255, 0.85);
  text-decoration: none;
  font-size: 14px;
  padding: 8px 12px;
  border-radius: 6px;
  transition: all 0.3s;
}

.nav-item:hover,
.nav-item.active {
  color: white;
  background: rgba(255, 255, 255, 0.1);
}

.main-content {
  padding: 30px;
}

.page-header {
  margin-bottom: 30px;
}

.page-header h1 {
  font-size: 24px;
  color: #333;
  margin-bottom: 5px;
}

.page-header p {
  font-size: 14px;
  color: #666;
}

.message-tabs {
  margin-bottom: 20px;
}

.message-list {
  display: grid;
  gap: 15px;
}

.message-card {
  display: flex;
  gap: 15px;
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.message-icon {
  font-size: 28px;
  flex-shrink: 0;
}

.message-content {
  flex: 1;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.message-header h3 {
  font-size: 15px;
  color: #333;
}

.message-time {
  font-size: 12px;
  color: #999;
}

.message-content p {
  font-size: 14px;
  color: #666;
  line-height: 1.5;
  margin-bottom: 10px;
}

.message-meta {
  display: flex;
  gap: 10px;
}

.message-type-tag {
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 12px;
}

.message-type-tag.risk {
  background: #fee2e2;
  color: #991b1b;
}

.message-type-tag.approval {
  background: #dbeafe;
  color: #1e40af;
}

.message-type-tag.system {
  background: #f3f4f6;
  color: #6b7280;
}

.message-status {
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 12px;
}

.message-status.pending {
  background: #fef3c7;
  color: #92400e;
}

.message-status.read {
  background: #d1fae5;
  color: #065f46;
}

.message-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 30px;
}
</style>
<template>
  <div class="post-loan-monitor-container">
    <header class="header">
      <div class="logo-area">
        <div class="logo-icon">🔒</div>
        <div class="logo-text">农链金服 - 运营风控端</div>
      </div>
      <nav class="nav">
        <router-link to="/admin/workbench" class="nav-item">工作台</router-link>
        <router-link to="/admin/approval" class="nav-item">审批管理</router-link>
        <router-link to="/admin/post-loan" class="nav-item active">贷后监控</router-link>
        <router-link to="/admin/risk-config" class="nav-item">风控配置</router-link>
      </nav>
    </header>
    <main class="main-content">
      <div class="page-header">
        <h1>贷后监控</h1>
        <p>监控和管理贷后风险</p>
      </div>
      <div class="monitor-overview">
        <div class="overview-card">
          <div class="overview-header">
            <h3>贷后监控概览</h3>
            <div class="live-indicator">
              <span class="live-dot"></span>
              <span>实时</span>
            </div>
          </div>
          <div class="overview-stats">
            <div class="overview-stat">
              <div class="stat-value">¥{{ overview.outstandingLoan }}</div>
              <div class="stat-label">存量贷款</div>
            </div>
            <div class="overview-stat">
              <div class="stat-value">{{ overview.monitoringCount }}</div>
              <div class="stat-label">监控中</div>
            </div>
            <div class="overview-stat">
              <div class="stat-value">{{ overview.warningCount }}</div>
              <div class="stat-label">风险预警</div>
            </div>
            <div class="overview-stat">
              <div class="stat-value">{{ overview.overdueRate }}%</div>
              <div class="stat-label">逾期率</div>
            </div>
          </div>
        </div>
      </div>
      <div class="monitor-grid">
        <div class="monitor-card">
          <h3>风险预警列表</h3>
          <div class="alert-list">
            <div class="alert-item" v-for="item in alerts" :key="item.id">
              <div class="alert-level" :class="item.level">{{ item.level }}</div>
              <div class="alert-content">
                <div class="alert-header">
                  <span class="alert-type">{{ item.type }}</span>
                  <span class="alert-time">{{ item.time }}</span>
                </div>
                <div class="alert-desc">{{ item.description }}</div>
              </div>
              <el-button size="small" @click="handleAlert(item)">处理</el-button>
            </div>
          </div>
        </div>
        <div class="monitor-card">
          <h3>待还款提醒</h3>
          <div class="reminder-list">
            <div class="reminder-item" v-for="item in reminders" :key="item.id">
              <div class="reminder-info">
                <div class="reminder-header">
                  <span class="reminder-company">{{ item.companyName }}</span>
                  <span class="reminder-days" :class="item.days <= 3 ? 'urgent' : ''">{{ item.days }}天后到期</span>
                </div>
                <div class="reminder-details">
                  <span>金额: ¥{{ item.amount }}</span>
                  <span>到期日: {{ item.dueDate }}</span>
                </div>
              </div>
              <el-button size="small" @click="remind(item)">提醒</el-button>
            </div>
          </div>
        </div>
      </div>
      <div class="monitor-card full-width">
        <h3>贷后监控列表</h3>
        <div class="filter-row">
          <el-select v-model="filterStatus" placeholder="监控状态" class="filter-select">
            <el-option label="全部" value="all"></el-option>
            <el-option label="正常" value="normal"></el-option>
            <el-option label="预警" value="warning"></el-option>
          </el-select>
          <el-input v-model="searchKeyword" placeholder="搜索企业名称" class="filter-input"></el-input>
          <el-button type="primary" @click="searchMonitor">搜索</el-button>
        </div>
        <el-table :data="monitorList" border style="width: 100%">
          <el-table-column prop="companyName" label="企业名称" />
          <el-table-column prop="loanAmount" label="贷款金额" />
          <el-table-column prop="remainingAmount" label="剩余金额" />
          <el-table-column prop="interestRate" label="利率" />
          <el-table-column prop="dueDate" label="到期日期" />
          <el-table-column prop="status" label="监控状态">
            <template #default="scope">
              <span class="status-tag" :class="scope.row.status">{{ scope.row.statusText }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作">
            <template #default="scope">
              <el-button size="small" @click="viewMonitor(scope.row)">查看监控</el-button>
              <el-button size="small" @click="sendReminder(scope.row)">发送提醒</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </main>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'

const overview = reactive({
  outstandingLoan: '35,000,000',
  monitoringCount: 120,
  warningCount: 8,
  overdueRate: 3.8
})

const alerts = [
  { id: 1, level: 'high', type: '逾期预警', time: '10:30', description: '四川牧丰养殖贷款已逾期100天，金额20万元' },
  { id: 2, level: 'medium', type: '质押物价格下跌', time: '10:25', description: '黑龙江丰收农业玉米质押物价格下跌超过5%' },
  { id: 3, level: 'medium', type: '还款能力下降', time: '10:20', description: '云南普洱茶业近3个月收入下降30%' },
  { id: 4, level: 'low', type: '经营异常', time: '10:15', description: 'XX农产品贸易公司连续3个月无交易记录' }
]

const reminders = [
  { id: 1, companyName: '山东绿源科技', amount: '300,000', dueDate: '2024-02-28', days: 3 },
  { id: 2, companyName: '河南金麦农业', amount: '200,000', dueDate: '2024-03-05', days: 8 },
  { id: 3, companyName: '黑龙江省农垦集团', amount: '750,000', dueDate: '2024-03-10', days: 13 },
  { id: 4, companyName: '云南普洱茶业', amount: '100,000', dueDate: '2024-03-15', days: 18 }
]

const monitorList = [
  { companyName: '黑龙江丰收农业', loanAmount: '¥500,000', remainingAmount: '¥450,000', interestRate: '8.5%', dueDate: '2024-07-15', status: 'normal', statusText: '正常' },
  { companyName: '山东绿源科技', loanAmount: '¥300,000', remainingAmount: '¥280,000', interestRate: '8.0%', dueDate: '2024-02-28', status: 'normal', statusText: '正常' },
  { companyName: '四川牧丰养殖', loanAmount: '¥200,000', remainingAmount: '¥200,000', interestRate: '9.0%', dueDate: '2023-11-10', status: 'warning', statusText: '预警' },
  { companyName: '河南金麦农业', loanAmount: '¥200,000', remainingAmount: '¥180,000', interestRate: '8.5%', dueDate: '2024-03-05', status: 'normal', statusText: '正常' },
  { companyName: '云南普洱茶业', loanAmount: '¥100,000', remainingAmount: '¥100,000', interestRate: '8.0%', dueDate: '2024-02-01', status: 'warning', statusText: '预警' }
]

const filterStatus = ref('all')
const searchKeyword = ref('')

const handleAlert = (alert) => {
  alert(`处理预警: ${alert.type}`)
}

const remind = (item) => {
  alert(`发送提醒: ${item.companyName}`)
}

const searchMonitor = () => {
  alert('搜索功能即将开放')
}

const viewMonitor = (item) => {
  alert(`查看监控: ${item.companyName}`)
}

const sendReminder = (item) => {
  alert(`发送提醒: ${item.companyName}`)
}
</script>

<style scoped>
.post-loan-monitor-container {
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

.monitor-overview {
  margin-bottom: 30px;
}

.overview-card {
  background: white;
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.overview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
}

.overview-header h3 {
  font-size: 16px;
  color: #333;
}

.live-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #10b981;
  font-size: 14px;
}

.live-dot {
  width: 8px;
  height: 8px;
  background: #10b981;
  border-radius: 50%;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.overview-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.overview-stat {
  text-align: center;
  padding: 20px;
  background: #f9fafb;
  border-radius: 10px;
}

.overview-stat .stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #333;
}

.overview-stat .stat-label {
  font-size: 14px;
  color: #666;
  margin-top: 8px;
}

.monitor-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-bottom: 30px;
}

.monitor-card {
  background: white;
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.monitor-card.full-width {
  grid-column: span 2;
}

.monitor-card h3 {
  font-size: 16px;
  color: #333;
  margin-bottom: 20px;
}

.alert-list,
.reminder-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.alert-item,
.reminder-item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px;
  background: #f9fafb;
  border-radius: 8px;
}

.alert-level {
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

.alert-level.high {
  background: #fee2e2;
  color: #991b1b;
}

.alert-level.medium {
  background: #fef3c7;
  color: #92400e;
}

.alert-level.low {
  background: #dbeafe;
  color: #1e40af;
}

.alert-content {
  flex: 1;
}

.alert-header,
.reminder-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
}

.alert-type,
.reminder-company {
  font-size: 14px;
  font-weight: bold;
  color: #333;
}

.alert-time {
  font-size: 12px;
  color: #999;
}

.alert-desc,
.reminder-details {
  font-size: 13px;
  color: #666;
}

.reminder-days {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 4px;
  background: #dbeafe;
  color: #1e40af;
}

.reminder-days.urgent {
  background: #fee2e2;
  color: #991b1b;
}

.filter-row {
  display: flex;
  gap: 15px;
  margin-bottom: 20px;
}

.filter-select {
  width: 150px;
}

.filter-input {
  width: 250px;
}

.status-tag {
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 12px;
}

.status-tag.normal {
  background: #d1fae5;
  color: #065f46;
}

.status-tag.warning {
  background: #fee2e2;
  color: #991b1b;
}
</style>
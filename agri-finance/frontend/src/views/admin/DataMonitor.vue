<template>
  <div class="data-monitor-container">
    <header class="header">
      <div class="logo-area">
        <div class="logo-icon">🔒</div>
        <div class="logo-text">农链金服 - 运营风控端</div>
      </div>
      <nav class="nav">
        <router-link to="/admin/workbench" class="nav-item">工作台</router-link>
        <router-link to="/admin/approval" class="nav-item">审批管理</router-link>
        <router-link to="/admin/data-monitor" class="nav-item active">数据监控</router-link>
        <router-link to="/admin/pledge" class="nav-item">质押物管理</router-link>
      </nav>
    </header>
    <main class="main-content">
      <div class="page-header">
        <h1>数据监控</h1>
        <p>实时监控平台运营数据和风险指标</p>
      </div>
      <div class="monitor-overview">
        <div class="overview-card">
          <div class="overview-header">
            <h3>实时监控概览</h3>
            <div class="live-indicator">
              <span class="live-dot"></span>
              <span>实时</span>
            </div>
          </div>
          <div class="overview-stats">
            <div class="overview-stat">
              <div class="stat-value">{{ overview.totalUsers }}</div>
              <div class="stat-label">注册用户</div>
            </div>
            <div class="overview-stat">
              <div class="stat-value">{{ overview.activeUsers }}</div>
              <div class="stat-label">今日活跃</div>
            </div>
            <div class="overview-stat">
              <div class="stat-value">{{ overview.todayApplications }}</div>
              <div class="stat-label">今日申请</div>
            </div>
            <div class="overview-stat">
              <div class="stat-value">¥{{ overview.todayLoan }}</div>
              <div class="stat-label">今日放款</div>
            </div>
            <div class="overview-stat">
              <div class="stat-value">{{ overview.pendingApprovals }}</div>
              <div class="stat-label">待审批</div>
            </div>
            <div class="overview-stat">
              <div class="stat-value">{{ overview.riskAlerts }}</div>
              <div class="stat-label">风险预警</div>
            </div>
          </div>
        </div>
      </div>
      <div class="monitor-grid">
        <div class="monitor-card">
          <h3>风险指标监控</h3>
          <div class="risk-indicators">
            <div class="indicator-item" :class="{ warning: item.warning }">
              <div class="indicator-header">
                <span class="indicator-name">{{ item.name }}</span>
                <span class="indicator-value" :class="{ warning: item.warning }">{{ item.value }}</span>
              </div>
              <div class="indicator-bar">
                <div class="indicator-fill" :style="{ width: item.percentage + '%' }" :class="{ warning: item.warning }"></div>
              </div>
              <div class="indicator-meta">
                <span>预警线: {{ item.threshold }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="monitor-card">
          <h3>系统状态</h3>
          <div class="system-status">
            <div class="status-item" :class="item.status">
              <div class="status-icon">{{ item.icon }}</div>
              <div class="status-info">
                <div class="status-name">{{ item.name }}</div>
                <div class="status-detail">{{ item.detail }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="monitor-grid">
        <div class="monitor-card">
          <h3>实时交易流水</h3>
          <div class="transaction-list">
            <div class="transaction-item" v-for="item in transactions" :key="item.id">
              <div class="transaction-icon">{{ item.icon }}</div>
              <div class="transaction-content">
                <div class="transaction-header">
                  <span class="transaction-type">{{ item.type }}</span>
                  <span class="transaction-time">{{ item.time }}</span>
                </div>
                <div class="transaction-desc">{{ item.description }}</div>
              </div>
              <div class="transaction-amount" :class="item.amountType">{{ item.amount }}</div>
            </div>
          </div>
        </div>
        <div class="monitor-card">
          <h3>异常行为监控</h3>
          <div class="abnormal-list">
            <div class="abnormal-item" v-for="item in abnormals" :key="item.id">
              <div class="abnormal-level" :class="item.level">{{ item.level }}</div>
              <div class="abnormal-content">
                <div class="abnormal-header">
                  <span class="abnormal-type">{{ item.type }}</span>
                  <span class="abnormal-time">{{ item.time }}</span>
                </div>
                <div class="abnormal-desc">{{ item.description }}</div>
              </div>
              <el-button size="small" @click="handleAbnormal(item)">处理</el-button>
            </div>
          </div>
        </div>
      </div>
      <div class="monitor-card full-width">
        <h3>质押物监控</h3>
        <div class="pledge-monitor">
          <div class="pledge-item" v-for="item in pledges" :key="item.id">
            <div class="pledge-info">
              <div class="pledge-header">
                <span class="pledge-name">{{ item.name }}</span>
                <span class="pledge-status" :class="item.status">{{ item.statusText }}</span>
              </div>
              <div class="pledge-details">
                <span>当前价格: ¥{{ item.currentPrice }}</span>
                <span>质押率: {{ item.pledgeRate }}%</span>
                <span>预警线: {{ item.warningRate }}%</span>
              </div>
            </div>
            <div class="pledge-trend">
              <div class="trend-chart">
                <div class="trend-line" :class="item.trend"></div>
              </div>
              <div class="trend-text" :class="item.trend">{{ item.trendText }}</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { reactive } from 'vue'

const overview = reactive({
  totalUsers: 5236,
  activeUsers: 185,
  todayApplications: 23,
  todayLoan: '1,250,000',
  pendingApprovals: 12,
  riskAlerts: 3
})

const riskIndicators = [
  { name: '逾期率', value: '3.8%', threshold: '5%', percentage: 76, warning: false },
  { name: '质押率', value: '72%', threshold: '80%', percentage: 90, warning: true },
  { name: '不良贷款率', value: '1.2%', threshold: '2%', percentage: 60, warning: false },
  { name: '资金利用率', value: '84%', threshold: '90%', percentage: 93, warning: false },
  { name: '审批通过率', value: '92.5%', threshold: '85%', percentage: 100, warning: false }
]

const systemStatus = [
  { icon: '✅', name: 'API服务', status: 'normal', detail: '运行正常' },
  { icon: '✅', name: '数据库', status: 'normal', detail: '连接正常，延迟15ms' },
  { icon: '✅', name: '缓存服务', status: 'normal', detail: '运行正常' },
  { icon: '⚠️', name: '消息队列', status: 'warning', detail: '队列积压，建议关注' },
  { icon: '✅', name: '定时任务', status: 'normal', detail: '运行正常' }
]

const transactions = [
  { id: 1, icon: '💰', type: '放款', time: '10:35', description: '黑龙江丰收农业 50万元', amount: '+¥500,000', amountType: 'income' },
  { id: 2, icon: '🔄', type: '还款', time: '10:32', description: '河南金麦农业 20万元', amount: '-¥200,000', amountType: 'expense' },
  { id: 3, icon: '📝', type: '申请', time: '10:30', description: '山东绿源科技提交贷款申请', amount: '¥300,000', amountType: 'neutral' },
  { id: 4, icon: '💰', type: '放款', time: '10:25', description: '四川牧丰养殖 20万元', amount: '+¥200,000', amountType: 'income' },
  { id: 5, icon: '✅', type: '审批', time: '10:20', description: '云南普洱茶业申请通过', amount: '¥100,000', amountType: 'neutral' }
]

const abnormals = [
  { id: 1, level: 'high', type: '异常登录', time: '10:30', description: '用户张三在异地登录，IP: 192.168.1.100' },
  { id: 2, level: 'medium', type: '频繁操作', time: '10:25', description: '用户李四在5分钟内提交3次贷款申请' },
  { id: 3, level: 'low', type: '敏感操作', time: '10:20', description: '用户王五修改了绑定手机号' }
]

const pledges = [
  { id: 1, name: '玉米库存', status: 'normal', statusText: '正常', currentPrice: '2,150/吨', pledgeRate: 70, warningRate: 80, trend: 'down', trendText: '-2.5%' },
  { id: 2, name: '小麦库存', status: 'normal', statusText: '正常', currentPrice: '2,350/吨', pledgeRate: 65, warningRate: 80, trend: 'up', trendText: '+1.2%' },
  { id: 3, name: '生猪库存', status: 'warning', statusText: '预警', currentPrice: '15,200/吨', pledgeRate: 78, warningRate: 80, trend: 'down', trendText: '-3.8%' },
  { id: 4, name: '蔬菜库存', status: 'normal', statusText: '正常', currentPrice: '1,850/吨', pledgeRate: 60, warningRate: 80, trend: 'stable', trendText: '0%' }
]

const handleAbnormal = (item) => {
  alert(`处理异常: ${item.type}`)
}
</script>

<style scoped>
.data-monitor-container {
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
  grid-template-columns: repeat(6, 1fr);
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

.risk-indicators {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.indicator-item {
  padding: 15px;
  background: #f9fafb;
  border-radius: 8px;
}

.indicator-item.warning {
  border-left: 4px solid #f59e0b;
}

.indicator-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.indicator-name {
  font-size: 14px;
  color: #666;
}

.indicator-value {
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

.indicator-value.warning {
  color: #f59e0b;
}

.indicator-bar {
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 5px;
}

.indicator-fill {
  height: 100%;
  background: #10b981;
  border-radius: 3px;
  transition: width 0.3s;
}

.indicator-fill.warning {
  background: #f59e0b;
}

.indicator-meta {
  font-size: 12px;
  color: #999;
}

.system-status {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px;
  background: #f9fafb;
  border-radius: 8px;
}

.status-item.normal {
  border-left: 4px solid #10b981;
}

.status-item.warning {
  border-left: 4px solid #f59e0b;
}

.status-icon {
  font-size: 20px;
}

.status-info {
  flex: 1;
}

.status-name {
  font-size: 14px;
  font-weight: bold;
  color: #333;
}

.status-detail {
  font-size: 12px;
  color: #666;
}

.transaction-list,
.abnormal-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.transaction-item,
.abnormal-item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px;
  background: #f9fafb;
  border-radius: 8px;
}

.transaction-icon {
  font-size: 20px;
}

.transaction-content {
  flex: 1;
}

.transaction-header,
.abnormal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
}

.transaction-type,
.abnormal-type {
  font-size: 14px;
  font-weight: bold;
  color: #333;
}

.transaction-time,
.abnormal-time {
  font-size: 12px;
  color: #999;
}

.transaction-desc,
.abnormal-desc {
  font-size: 13px;
  color: #666;
}

.transaction-amount {
  font-size: 16px;
  font-weight: bold;
}

.transaction-amount.income {
  color: #10b981;
}

.transaction-amount.expense {
  color: #ef4444;
}

.transaction-amount.neutral {
  color: #333;
}

.abnormal-level {
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

.abnormal-level.high {
  background: #fee2e2;
  color: #991b1b;
}

.abnormal-level.medium {
  background: #fef3c7;
  color: #92400e;
}

.abnormal-level.low {
  background: #dbeafe;
  color: #1e40af;
}

.pledge-monitor {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.pledge-item {
  background: #f9fafb;
  border-radius: 10px;
  padding: 20px;
}

.pledge-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.pledge-name {
  font-size: 14px;
  font-weight: bold;
  color: #333;
}

.pledge-status {
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 12px;
}

.pledge-status.normal {
  background: #d1fae5;
  color: #065f46;
}

.pledge-status.warning {
  background: #fee2e2;
  color: #991b1b;
}

.pledge-details {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 15px;
}

.pledge-details span {
  font-size: 13px;
  color: #666;
}

.pledge-trend {
  display: flex;
  align-items: center;
  gap: 10px;
}

.trend-chart {
  flex: 1;
  height: 30px;
  background: #e5e7eb;
  border-radius: 4px;
  position: relative;
}

.trend-line {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 50%;
  border-radius: 4px;
}

.trend-line.up {
  background: #10b981;
}

.trend-line.down {
  background: #ef4444;
}

.trend-line.stable {
  background: #6b7280;
}

.trend-text {
  font-size: 14px;
  font-weight: bold;
}

.trend-text.up {
  color: #10b981;
}

.trend-text.down {
  color: #ef4444;
}

.trend-text.stable {
  color: #6b7280;
}
</style>
<template>
  <div class="report-center-container">
    <header class="header">
      <div class="logo-area">
        <div class="logo-icon">🔒</div>
        <div class="logo-text">农链金服 - 运营风控端</div>
      </div>
      <nav class="nav">
        <router-link to="/admin/workbench" class="nav-item">工作台</router-link>
        <router-link to="/admin/approval" class="nav-item">审批管理</router-link>
        <router-link to="/admin/report" class="nav-item active">报表中心</router-link>
        <router-link to="/admin/blacklist" class="nav-item">黑名单</router-link>
      </nav>
    </header>
    <main class="main-content">
      <div class="page-header">
        <h1>报表中心</h1>
        <p>查看和导出运营数据报表</p>
      </div>
      <div class="report-tabs">
        <el-tabs v-model="activeTab" @tab-click="handleTabClick">
          <el-tab-pane label="运营概览" name="overview"></el-tab-pane>
          <el-tab-pane label="贷款统计" name="loan"></el-tab-pane>
          <el-tab-pane label="风险分析" name="risk"></el-tab-pane>
          <el-tab-pane label="资金分析" name="fund"></el-tab-pane>
        </el-tabs>
      </div>
      <div class="overview-section" v-if="activeTab === 'overview'">
        <div class="stats-row">
          <div class="stat-card">
            <div class="stat-icon">💰</div>
            <div class="stat-content">
              <div class="stat-value">¥{{ overview.totalLoan }}</div>
              <div class="stat-label">累计放款金额</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">📝</div>
            <div class="stat-content">
              <div class="stat-value">{{ overview.totalApplications }}</div>
              <div class="stat-label">申请总笔数</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">✅</div>
            <div class="stat-content">
              <div class="stat-value">{{ overview.approvalRate }}%</div>
              <div class="stat-label">审批通过率</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">⚠️</div>
            <div class="stat-content">
              <div class="stat-value">{{ overview.overdueRate }}%</div>
              <div class="stat-label">逾期率</div>
            </div>
          </div>
        </div>
        <div class="chart-row">
          <div class="chart-card">
            <h3>月度放款趋势</h3>
            <div class="chart-placeholder">
              <div class="bar-chart">
                <div class="bar" style="height: 60%">1月</div>
                <div class="bar" style="height: 75%">2月</div>
                <div class="bar" style="height: 85%">3月</div>
                <div class="bar" style="height: 90%">4月</div>
                <div class="bar" style="height: 70%">5月</div>
                <div class="bar" style="height: 100%">6月</div>
              </div>
            </div>
          </div>
          <div class="chart-card">
            <h3>产品分布</h3>
            <div class="chart-placeholder">
              <div class="pie-chart">
                <div class="pie-item" style="background: #10b981">收购贷 40%</div>
                <div class="pie-item" style="background: #3b82f6">销售贷 30%</div>
                <div class="pie-item" style="background: #f59e0b">农机贷 20%</div>
                <div class="pie-item" style="background: #8b5cf6">数据贷 10%</div>
              </div>
            </div>
          </div>
        </div>
        <div class="table-section">
          <h3>区域分布</h3>
          <el-table :data="regionData" border style="width: 100%">
            <el-table-column prop="region" label="地区" />
            <el-table-column prop="amount" label="放款金额" />
            <el-table-column prop="count" label="笔数" />
            <el-table-column prop="rate" label="占比" />
          </el-table>
        </div>
      </div>
      <div class="loan-section" v-if="activeTab === 'loan'">
        <div class="stats-row">
          <div class="stat-card">
            <div class="stat-icon">📊</div>
            <div class="stat-content">
              <div class="stat-value">{{ loanStats.monthLoan }}</div>
              <div class="stat-label">本月放款笔数</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">💰</div>
            <div class="stat-content">
              <div class="stat-value">¥{{ loanStats.monthAmount }}</div>
              <div class="stat-label">本月放款金额</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">📈</div>
            <div class="stat-content">
              <div class="stat-value">¥{{ loanStats.outstanding }}</div>
              <div class="stat-label">存量贷款</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🔄</div>
            <div class="stat-content">
              <div class="stat-value">¥{{ loanStats.repaid }}</div>
              <div class="stat-label">已还款金额</div>
            </div>
          </div>
        </div>
        <div class="table-section">
          <h3>贷款明细</h3>
          <el-table :data="loanDetails" border style="width: 100%">
            <el-table-column prop="no" label="贷款编号" />
            <el-table-column prop="company" label="企业名称" />
            <el-table-column prop="amount" label="金额" />
            <el-table-column prop="term" label="期限" />
            <el-table-column prop="rate" label="利率" />
            <el-table-column prop="status" label="状态" />
            <el-table-column prop="date" label="放款日期" />
          </el-table>
        </div>
      </div>
      <div class="risk-section" v-if="activeTab === 'risk'">
        <div class="stats-row">
          <div class="stat-card">
            <div class="stat-icon">⚠️</div>
            <div class="stat-content">
              <div class="stat-value">{{ riskStats.overdueCount }}</div>
              <div class="stat-label">逾期笔数</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">💰</div>
            <div class="stat-content">
              <div class="stat-value">¥{{ riskStats.overdueAmount }}</div>
              <div class="stat-label">逾期金额</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">📊</div>
            <div class="stat-content">
              <div class="stat-value">{{ riskStats.riskRate }}%</div>
              <div class="stat-label">风险率</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🔒</div>
            <div class="stat-content">
              <div class="stat-value">{{ riskStats.earlyWarning }}</div>
              <div class="stat-label">预警数量</div>
            </div>
          </div>
        </div>
        <div class="table-section">
          <h3>风险预警列表</h3>
          <el-table :data="riskWarnings" border style="width: 100%">
            <el-table-column prop="company" label="企业名称" />
            <el-table-column prop="type" label="预警类型" />
            <el-table-column prop="level" label="预警级别">
              <template #default="scope">
                <span class="level-tag" :class="scope.row.level">{{ scope.row.level }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="description" label="预警描述" />
            <el-table-column prop="time" label="预警时间" />
            <el-table-column label="操作">
              <template #default="scope">
                <el-button size="small" @click="handleWarning(scope.row)">处理</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
      <div class="fund-section" v-if="activeTab === 'fund'">
        <div class="stats-row">
          <div class="stat-card">
            <div class="stat-icon">💰</div>
            <div class="stat-content">
              <div class="stat-value">¥{{ fundStats.totalFund }}</div>
              <div class="stat-label">资金总额</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">📊</div>
            <div class="stat-content">
              <div class="stat-value">¥{{ fundStats.invested }}</div>
              <div class="stat-label">已投资金额</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">📈</div>
            <div class="stat-content">
              <div class="stat-value">{{ fundStats.utilizationRate }}%</div>
              <div class="stat-label">资金利用率</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">💰</div>
            <div class="stat-content">
              <div class="stat-value">¥{{ fundStats.income }}</div>
              <div class="stat-label">累计收益</div>
            </div>
          </div>
        </div>
        <div class="table-section">
          <h3>资金流向</h3>
          <el-table :data="fundFlow" border style="width: 100%">
            <el-table-column prop="date" label="日期" />
            <el-table-column prop="type" label="类型" />
            <el-table-column prop="amount" label="金额" />
            <el-table-column prop="balance" label="余额" />
            <el-table-column prop="description" label="说明" />
          </el-table>
        </div>
      </div>
      <div class="report-actions">
        <el-button type="primary" @click="exportReport">导出报表</el-button>
        <el-button @click="generateReport">生成报告</el-button>
      </div>
    </main>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'

const activeTab = ref('overview')

const overview = reactive({
  totalLoan: '50,000,000',
  totalApplications: 1256,
  approvalRate: 92.5,
  overdueRate: 3.8
})

const regionData = [
  { region: '黑龙江', amount: '¥15,000,000', count: 380, rate: '30%' },
  { region: '山东', amount: '¥10,000,000', count: 250, rate: '20%' },
  { region: '河南', amount: '¥8,000,000', count: 200, rate: '16%' },
  { region: '四川', amount: '¥7,000,000', count: 180, rate: '14%' },
  { region: '其他', amount: '¥10,000,000', count: 246, rate: '20%' }
]

const loanStats = reactive({
  monthLoan: 85,
  monthAmount: '4,250,000',
  outstanding: '35,000,000',
  repaid: '15,000,000'
})

const loanDetails = [
  { no: 'LN202401010001', company: '黑龙江丰收农业', amount: '¥500,000', term: '6个月', rate: '8.5%', status: '还款中', date: '2024-01-05' },
  { no: 'LN202401020002', company: '山东绿源科技', amount: '¥300,000', term: '12个月', rate: '8.0%', status: '还款中', date: '2024-01-08' },
  { no: 'LN202401030003', company: '河南金麦农业', amount: '¥200,000', term: '6个月', rate: '8.5%', status: '已结清', date: '2023-07-01' },
  { no: 'LN202401040004', company: '四川牧丰养殖', amount: '¥200,000', term: '12个月', rate: '9.0%', status: '还款中', date: '2024-01-01' }
]

const riskStats = reactive({
  overdueCount: 23,
  overdueAmount: '1,250,000',
  riskRate: 3.8,
  earlyWarning: 8
})

const riskWarnings = [
  { company: '黑龙江丰收农业', type: '质押物价格下跌', level: 'high', description: '玉米质押物价格下跌超过5%', time: '2024-01-15' },
  { company: '云南普洱茶业', type: '逾期预警', level: 'medium', description: '贷款将于3天后到期', time: '2024-01-14' },
  { company: 'XX农业科技', type: '信用降级', level: 'high', description: '企业信用评级从AA降为A', time: '2024-01-13' },
  { company: '四川牧丰养殖', type: '逾期预警', level: 'high', description: '已逾期100天', time: '2024-01-12' }
]

const fundStats = reactive({
  totalFund: '50,000,000',
  invested: '42,000,000',
  utilizationRate: 84,
  income: '2,500,000'
})

const fundFlow = [
  { date: '2024-01-15', type: '投资', amount: '¥500,000', balance: '¥42,000,000', description: '黑龙江玉米收购贷' },
  { date: '2024-01-14', type: '回款', amount: '¥200,000', balance: '¥41,500,000', description: '河南小麦收购贷到期' },
  { date: '2024-01-12', type: '投资', amount: '¥300,000', balance: '¥41,300,000', description: '山东蔬菜种植贷' },
  { date: '2024-01-10', type: '回款', amount: '¥150,000', balance: '¥41,000,000', description: '四川生猪养殖贷利息' }
]

const handleTabClick = () => {}
const handleWarning = (warning) => {
  alert(`处理预警: ${warning.company}`)
}
const exportReport = () => {
  alert('导出报表功能即将开放')
}
const generateReport = () => {
  alert('生成报告功能即将开放')
}
</script>

<style scoped>
.report-center-container {
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

.report-tabs {
  margin-bottom: 20px;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 15px;
  background: white;
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.stat-icon {
  font-size: 36px;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #333;
}

.stat-label {
  font-size: 14px;
  color: #666;
}

.chart-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-bottom: 30px;
}

.chart-card {
  background: white;
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.chart-card h3 {
  font-size: 16px;
  color: #333;
  margin-bottom: 20px;
}

.chart-placeholder {
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f9fafb;
  border-radius: 8px;
}

.bar-chart {
  display: flex;
  align-items: flex-end;
  gap: 30px;
  height: 150px;
}

.bar {
  width: 40px;
  background: linear-gradient(180deg, #10b981, #059669);
  border-radius: 4px 4px 0 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 5px;
  font-size: 12px;
  color: white;
}

.pie-chart {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pie-item {
  padding: 10px 20px;
  border-radius: 6px;
  color: white;
  font-size: 14px;
}

.table-section {
  background: white;
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  margin-bottom: 30px;
}

.table-section h3 {
  font-size: 16px;
  color: #333;
  margin-bottom: 20px;
}

.level-tag {
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 12px;
}

.level-tag.high {
  background: #fee2e2;
  color: #991b1b;
}

.level-tag.medium {
  background: #fef3c7;
  color: #92400e;
}

.report-actions {
  display: flex;
  justify-content: flex-end;
  gap: 15px;
}
</style>
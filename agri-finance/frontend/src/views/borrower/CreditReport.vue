<template>
  <div class="credit-report-container">
    <header class="header">
      <div class="logo-area">
        <div class="logo-icon">💰</div>
        <div class="logo-text">农链金服</div>
      </div>
      <nav class="nav">
        <router-link to="/borrower/home" class="nav-item">首页</router-link>
        <router-link to="/borrower/credit" class="nav-item">信用中心</router-link>
        <router-link to="/borrower/credit-report" class="nav-item active">信用报告</router-link>
        <router-link to="/borrower/loan-apply" class="nav-item">融资申请</router-link>
        <router-link to="/borrower/loan-management" class="nav-item">借款管理</router-link>
        <router-link to="/borrower/pledge" class="nav-item">质押管理</router-link>
      </nav>
    </header>
    <main class="main-content">
      <div class="page-header">
        <h1>信用报告</h1>
        <p>查看详细的信用评估报告</p>
      </div>
      <div class="report-card">
        <div class="report-header">
          <div class="report-info">
            <div class="report-title">农业供应链金融信用报告</div>
            <div class="report-meta">
              <span>报告编号：{{ reportData.reportNo }}</span>
              <span>评估时间：{{ reportData.evaluationTime }}</span>
            </div>
          </div>
          <div class="report-actions">
            <el-button type="primary" @click="generateReport">重新评估</el-button>
            <el-button @click="downloadReport">下载报告</el-button>
          </div>
        </div>
        <div class="report-body">
          <div class="summary-section">
            <h2>评估摘要</h2>
            <div class="summary-grid">
              <div class="summary-item">
                <div class="summary-label">综合评分</div>
                <div class="summary-value score">{{ reportData.compositeScore }}</div>
                <div class="summary-level">{{ reportData.creditLevel }}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">授信额度</div>
                <div class="summary-value">¥{{ reportData.suggestedAmount }}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">参考利率</div>
                <div class="summary-value">{{ reportData.referenceRate }}%</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">数据来源</div>
                <div class="summary-value small">{{ reportData.dataSources }}</div>
              </div>
            </div>
          </div>
          <div class="dimensions-section">
            <h2>维度评分</h2>
            <div class="dimensions-grid">
              <div class="dimension-card" v-for="(item, key) in dimensionScores" :key="key">
                <div class="dimension-header">
                  <span class="dimension-name">{{ item.name }}</span>
                  <span class="dimension-score">{{ item.score }}分</span>
                </div>
                <div class="dimension-bar">
                  <div class="bar-fill" :style="{ width: item.score + '%', background: item.color }"></div>
                </div>
                <div class="dimension-description">{{ item.description }}</div>
              </div>
            </div>
          </div>
          <div class="alerts-section" v-if="reportData.riskAlerts">
            <h2>风险预警</h2>
            <div class="alert-content">
              <div class="alert-icon">⚠️</div>
              <div class="alert-text">{{ reportData.riskAlerts }}</div>
            </div>
          </div>
          <div class="suggestions-section">
            <h2>改进建议</h2>
            <ul class="suggestions-list">
              <li v-for="(suggestion, index) in suggestions" :key="index">{{ suggestion }}</li>
            </ul>
          </div>
        </div>
      </div>
      <div class="history-section">
        <h2>报告历史</h2>
        <el-table :data="reportHistory" border style="width: 100%">
          <el-table-column prop="reportNo" label="报告编号" />
          <el-table-column prop="evaluationTime" label="评估时间" />
          <el-table-column prop="compositeScore" label="综合评分" />
          <el-table-column prop="creditLevel" label="信用等级" />
          <el-table-column prop="suggestedAmount" label="授信额度" />
          <el-table-column label="操作">
            <template #default="scope">
              <el-button size="small" @click="viewReport(scope.row)">查看</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </main>
  </div>
</template>

<script setup>
import { reactive } from 'vue'

const reportData = reactive({
  reportNo: 'CR20240115001',
  evaluationTime: '2024-01-15 14:30:00',
  compositeScore: 820,
  creditLevel: 'AA',
  suggestedAmount: '500,000',
  referenceRate: '7.2',
  dataSources: '交易数据、履约记录、财务数据、征信数据',
  riskAlerts: '暂无风险预警',
  improvementSuggestions: '建议保持良好的履约记录，提高交易频率'
})

const dimensionScores = {
  businessAbility: { name: '经营能力', score: 85, color: '#10b981', description: '基于近期经营收入、利润情况评估' },
  debtAbility: { name: '偿债能力', score: 92, color: '#3b82f6', description: '基于资产负债率、流动比率评估' },
  creditRecord: { name: '信用记录', score: 95, color: '#f59e0b', description: '基于历史还款记录、逾期情况评估' },
  stability: { name: '稳定性', score: 78, color: '#8b5cf6', description: '基于经营年限、业务稳定性评估' }
}

const suggestions = [
  '保持按时还款，维持良好的还款记录',
  '增加平台交易频率，提升经营活跃度',
  '考虑增加质押物，提高授信额度',
  '定期更新财务信息，保持数据完整性'
]

const reportHistory = [
  { reportNo: 'CR20240115001', evaluationTime: '2024-01-15', compositeScore: 820, creditLevel: 'AA', suggestedAmount: '500,000' },
  { reportNo: 'CR20240101002', evaluationTime: '2024-01-01', compositeScore: 815, creditLevel: 'AA', suggestedAmount: '480,000' },
  { reportNo: 'CR20231215003', evaluationTime: '2023-12-15', compositeScore: 808, creditLevel: 'AA', suggestedAmount: '450,000' },
  { reportNo: 'CR20231201004', evaluationTime: '2023-12-01', compositeScore: 800, creditLevel: 'A', suggestedAmount: '420,000' }
]

const generateReport = () => {
  alert('正在生成新的信用报告...')
}

const downloadReport = () => {
  alert('报告下载功能即将开放')
}

const viewReport = (row) => {
  alert(`查看报告: ${row.reportNo}`)
}
</script>

<style scoped>
.credit-report-container {
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

.report-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  margin-bottom: 30px;
  overflow: hidden;
}

.report-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 25px 30px;
  background: #f9fafb;
  border-bottom: 1px solid #f3f4f6;
}

.report-title {
  font-size: 20px;
  font-weight: bold;
  color: #333;
  margin-bottom: 10px;
}

.report-meta {
  display: flex;
  gap: 30px;
  font-size: 14px;
  color: #666;
}

.report-body {
  padding: 30px;
}

.summary-section {
  margin-bottom: 30px;
}

.summary-section h2 {
  font-size: 16px;
  color: #333;
  margin-bottom: 20px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.summary-item {
  background: #f9fafb;
  border-radius: 10px;
  padding: 20px;
  text-align: center;
}

.summary-label {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}

.summary-value {
  font-size: 24px;
  font-weight: bold;
  color: #333;
}

.summary-value.score {
  font-size: 36px;
  color: #10b981;
}

.summary-value.small {
  font-size: 12px;
  font-weight: normal;
}

.summary-level {
  font-size: 14px;
  color: #10b981;
  margin-top: 5px;
}

.dimensions-section {
  margin-bottom: 30px;
}

.dimensions-section h2 {
  font-size: 16px;
  color: #333;
  margin-bottom: 20px;
}

.dimensions-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.dimension-card {
  background: #f9fafb;
  border-radius: 10px;
  padding: 20px;
}

.dimension-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.dimension-name {
  font-size: 14px;
  font-weight: bold;
  color: #333;
}

.dimension-score {
  font-size: 18px;
  font-weight: bold;
  color: #10b981;
}

.dimension-bar {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 10px;
}

.bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s;
}

.dimension-description {
  font-size: 12px;
  color: #666;
}

.alerts-section {
  margin-bottom: 30px;
}

.alerts-section h2 {
  font-size: 16px;
  color: #333;
  margin-bottom: 15px;
}

.alert-content {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 20px;
  background: #fef3c7;
  border-radius: 10px;
}

.alert-icon {
  font-size: 32px;
}

.alert-text {
  font-size: 14px;
  color: #92400e;
}

.suggestions-section {
  margin-bottom: 20px;
}

.suggestions-section h2 {
  font-size: 16px;
  color: #333;
  margin-bottom: 15px;
}

.suggestions-list {
  padding-left: 20px;
}

.suggestions-list li {
  font-size: 14px;
  color: #666;
  margin-bottom: 10px;
}

.history-section {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  padding: 25px;
}

.history-section h2 {
  font-size: 16px;
  color: #333;
  margin-bottom: 20px;
}
</style>
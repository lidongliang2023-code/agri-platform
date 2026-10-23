<template>
  <div class="asset-detail-container">
    <header class="header">
      <div class="logo-area">
        <div class="logo-icon">💰</div>
        <div class="logo-text">农链金服 - 资金方端</div>
      </div>
      <nav class="nav">
        <router-link to="/fund/workbench" class="nav-item">工作台</router-link>
        <router-link to="/fund/asset-market" class="nav-item">资产市场</router-link>
        <router-link to="/fund/asset-detail" class="nav-item active">资产详情</router-link>
        <router-link to="/fund/my-investment" class="nav-item">我的投资</router-link>
        <router-link to="/fund/approval" class="nav-item">审批管理</router-link>
      </nav>
    </header>
    <main class="main-content">
      <div class="page-header">
        <h1>资产详情</h1>
        <p>查看融资资产的详细信息</p>
      </div>
      <div class="asset-card">
        <div class="asset-header">
          <div class="asset-title">
            <h2>{{ assetInfo.assetName }}</h2>
            <span class="asset-tag" :class="assetInfo.status">{{ assetInfo.status }}</span>
          </div>
          <div class="asset-actions">
            <el-button type="primary" @click="investAsset">立即投资</el-button>
            <el-button @click="addToWatchlist">加入关注</el-button>
          </div>
        </div>
        <div class="asset-summary">
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-label">资产金额</div>
              <div class="summary-value">¥{{ assetInfo.amount }}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">预期收益率</div>
              <div class="summary-value highlight">{{ assetInfo.expectedReturn }}%</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">期限</div>
              <div class="summary-value">{{ assetInfo.term }}个月</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">质押率</div>
              <div class="summary-value">{{ assetInfo.pledgeRate }}%</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">融资场景</div>
              <div class="summary-value">{{ assetInfo.financingScenario }}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">AI推荐评分</div>
              <div class="summary-value">{{ assetInfo.aiRecommendationScore }}分</div>
            </div>
          </div>
        </div>
        <div class="borrower-info">
          <h3>融资方信息</h3>
          <div class="borrower-grid">
            <div class="borrower-item">
              <span class="borrower-label">企业名称</span>
              <span class="borrower-value">{{ borrowerInfo.companyName }}</span>
            </div>
            <div class="borrower-item">
              <span class="borrower-label">信用评级</span>
              <span class="borrower-value highlight">{{ borrowerInfo.rating }}</span>
            </div>
            <div class="borrower-item">
              <span class="borrower-label">经营年限</span>
              <span class="borrower-value">{{ borrowerInfo.businessYears }}年</span>
            </div>
            <div class="borrower-item">
              <span class="borrower-label">平台交易金额</span>
              <span class="borrower-value">¥{{ borrowerInfo.transactionAmount }}</span>
            </div>
            <div class="borrower-item">
              <span class="borrower-label">履约率</span>
              <span class="borrower-value">{{ borrowerInfo.fulfillmentRate }}%</span>
            </div>
            <div class="borrower-item">
              <span class="borrower-label">逾期次数</span>
              <span class="borrower-value">{{ borrowerInfo.overdueCount }}次</span>
            </div>
          </div>
        </div>
        <div class="collateral-info">
          <h3>质押物信息</h3>
          <div class="collateral-grid">
            <div class="collateral-item">
              <span class="collateral-label">质押物类型</span>
              <span class="collateral-value">{{ collateralInfo.type }}</span>
            </div>
            <div class="collateral-item">
              <span class="collateral-label">评估价值</span>
              <span class="collateral-value">¥{{ collateralInfo.value }}</span>
            </div>
            <div class="collateral-item">
              <span class="collateral-label">监管方式</span>
              <span class="collateral-value">{{ collateralInfo.monitoring }}</span>
            </div>
            <div class="collateral-item">
              <span class="collateral-label">仓储地点</span>
              <span class="collateral-value">{{ collateralInfo.location }}</span>
            </div>
          </div>
        </div>
        <div class="ai-analysis">
          <h3>AI风险分析</h3>
          <div class="analysis-content">
            <div class="analysis-score">
              <div class="score-circle">
                <div class="score-value">{{ assetInfo.aiRecommendationScore }}</div>
                <div class="score-label">推荐指数</div>
              </div>
            </div>
            <div class="analysis-reason">
              <h4>推荐理由</h4>
              <p>{{ assetInfo.recommendationReason }}</p>
            </div>
          </div>
        </div>
        <div class="investment-form">
          <h3>投资申请</h3>
          <el-form :model="investForm" label-width="100px">
            <el-form-item label="投资金额">
              <el-input v-model="investForm.amount" placeholder="请输入投资金额（万元）"></el-input>
            </el-form-item>
            <el-form-item label="投资期限">
              <el-select v-model="investForm.term" placeholder="请选择期限">
                <el-option label="3个月" value="3"></el-option>
                <el-option label="6个月" value="6"></el-option>
                <el-option label="12个月" value="12"></el-option>
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="submitInvest">确认投资</el-button>
            </el-form-item>
          </el-form>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { reactive } from 'vue'

const assetInfo = reactive({
  assetName: '黑龙江玉米收购融资项目',
  status: '可投资',
  amount: '500,000',
  expectedReturn: '8.5',
  term: 6,
  pledgeRate: 70,
  financingScenario: '农业收购贷',
  aiRecommendationScore: 88,
  recommendationReason: '融资方信用评级AA，经营稳定，交易履约率高，质押物充足，风险可控。建议投资。'
})

const borrowerInfo = reactive({
  companyName: '黑龙江省丰收农业发展有限公司',
  rating: 'AA',
  businessYears: 8,
  transactionAmount: '2,580,000',
  fulfillmentRate: 98.5,
  overdueCount: 0
})

const collateralInfo = reactive({
  type: '玉米库存',
  value: '714,285',
  monitoring: 'IoT实时监控',
  location: '哈尔滨粮库'
})

const investForm = reactive({
  amount: '',
  term: ''
})

const investAsset = () => {
  alert('跳转投资页面...')
}

const addToWatchlist = () => {
  alert('已加入关注列表')
}

const submitInvest = () => {
  alert('投资申请已提交，等待审核')
}
</script>

<style scoped>
.asset-detail-container {
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

.asset-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.asset-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 25px 30px;
  background: #f9fafb;
  border-bottom: 1px solid #f3f4f6;
}

.asset-title h2 {
  font-size: 20px;
  color: #333;
  margin-bottom: 10px;
}

.asset-tag {
  padding: 5px 15px;
  border-radius: 20px;
  font-size: 12px;
}

.asset-tag.可投资 {
  background: #d1fae5;
  color: #065f46;
}

.asset-tag.已售罄 {
  background: #f3f4f6;
  color: #6b7280;
}

.asset-summary,
.borrower-info,
.collateral-info,
.ai-analysis,
.investment-form {
  padding: 30px;
  border-bottom: 1px solid #f3f4f6;
}

.asset-summary:last-child,
.borrower-info:last-child,
.collateral-info:last-child,
.ai-analysis:last-child,
.investment-form:last-child {
  border-bottom: none;
}

.asset-summary h3,
.borrower-info h3,
.collateral-info h3,
.ai-analysis h3,
.investment-form h3 {
  font-size: 16px;
  color: #333;
  margin-bottom: 20px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
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

.summary-value.highlight {
  color: #10b981;
}

.borrower-grid,
.collateral-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
}

.borrower-item,
.collateral-item {
  display: flex;
  justify-content: space-between;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
}

.borrower-label,
.collateral-label {
  font-size: 14px;
  color: #666;
}

.borrower-value,
.collateral-value {
  font-size: 14px;
  font-weight: bold;
  color: #333;
}

.borrower-value.highlight {
  color: #10b981;
}

.analysis-content {
  display: flex;
  gap: 40px;
}

.analysis-score {
  flex: 1;
}

.score-circle {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 150px;
  height: 150px;
  background: linear-gradient(135deg, #10b981, #059669);
  border-radius: 50%;
  color: white;
}

.score-value {
  font-size: 48px;
  font-weight: bold;
}

.score-label {
  font-size: 14px;
  margin-top: 5px;
}

.analysis-reason {
  flex: 2;
}

.analysis-reason h4 {
  font-size: 14px;
  color: #333;
  margin-bottom: 10px;
}

.analysis-reason p {
  font-size: 14px;
  color: #666;
  line-height: 1.6;
}

.investment-form {
  background: #f9fafb;
}
</style>
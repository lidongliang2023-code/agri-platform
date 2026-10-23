<template>
  <div class="approval-detail-container">
    <header class="header">
      <div class="logo-area">
        <div class="logo-icon">🔒</div>
        <div class="logo-text">农链金服 - 运营风控端</div>
      </div>
      <nav class="nav">
        <router-link to="/admin/workbench" class="nav-item">工作台</router-link>
        <router-link to="/admin/approval" class="nav-item active">审批管理</router-link>
        <router-link to="/admin/overdue" class="nav-item">逾期管理</router-link>
        <router-link to="/admin/report" class="nav-item">报表中心</router-link>
      </nav>
    </header>
    <main class="main-content">
      <div class="page-header">
        <h1>借款审批详情</h1>
        <p>查看和处理借款申请审批</p>
      </div>
      <div class="approval-card">
        <div class="approval-header">
          <div class="approval-title">
            <h2>{{ approvalInfo.applicationNo }}</h2>
            <span class="approval-status" :class="approvalInfo.status">{{ approvalInfo.statusText }}</span>
          </div>
          <div class="approval-actions">
            <el-button type="primary" @click="approve">通过</el-button>
            <el-button type="danger" @click="reject">拒绝</el-button>
          </div>
        </div>
        <div class="step-progress">
          <div class="step" :class="{ active: true, completed: true }">
            <div class="step-icon">1</div>
            <div class="step-label">用户提交</div>
            <div class="step-time">2024-01-15 10:30</div>
          </div>
          <div class="step-line"></div>
          <div class="step" :class="{ active: true, completed: true }">
            <div class="step-icon">2</div>
            <div class="step-label">资料审核</div>
            <div class="step-time">2024-01-15 14:00</div>
          </div>
          <div class="step-line"></div>
          <div class="step" :class="{ active: true }">
            <div class="step-icon">3</div>
            <div class="step-label">风控评估</div>
            <div class="step-time">进行中</div>
          </div>
          <div class="step-line"></div>
          <div class="step">
            <div class="step-icon">4</div>
            <div class="step-label">终审</div>
            <div class="step-time">-</div>
          </div>
        </div>
        <div class="borrower-section">
          <h3>融资方信息</h3>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">企业名称</span>
              <span class="info-value">{{ borrowerInfo.companyName }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">信用代码</span>
              <span class="info-value">{{ borrowerInfo.creditCode }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">法定代表人</span>
              <span class="info-value">{{ borrowerInfo.legalPerson }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">经营年限</span>
              <span class="info-value">{{ borrowerInfo.businessYears }}年</span>
            </div>
            <div class="info-item">
              <span class="info-label">注册资本</span>
              <span class="info-value">¥{{ borrowerInfo.registeredCapital }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">联系人</span>
              <span class="info-value">{{ borrowerInfo.contactPerson }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">联系电话</span>
              <span class="info-value">{{ borrowerInfo.contactPhone }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">所在地区</span>
              <span class="info-value">{{ borrowerInfo.region }}</span>
            </div>
          </div>
        </div>
        <div class="loan-section">
          <h3>借款申请信息</h3>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">融资产品</span>
              <span class="info-value">{{ loanInfo.productName }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">借款金额</span>
              <span class="info-value highlight">¥{{ loanInfo.amount }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">借款期限</span>
              <span class="info-value">{{ loanInfo.term }}个月</span>
            </div>
            <div class="info-item">
              <span class="info-label">年化利率</span>
              <span class="info-value">{{ loanInfo.rate }}%</span>
            </div>
            <div class="info-item">
              <span class="info-label">还款方式</span>
              <span class="info-value">{{ loanInfo.repaymentMethod }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">资金用途</span>
              <span class="info-value">{{ loanInfo.purpose }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">申请日期</span>
              <span class="info-value">{{ loanInfo.applyDate }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">期望放款日</span>
              <span class="info-value">{{ loanInfo.expectedDate }}</span>
            </div>
          </div>
        </div>
        <div class="credit-section">
          <h3>信用评估信息</h3>
          <div class="credit-content">
            <div class="credit-score">
              <div class="score-circle">
                <div class="score-value">{{ creditInfo.score }}</div>
                <div class="score-label">信用评分</div>
              </div>
              <div class="score-level">{{ creditInfo.level }}</div>
            </div>
            <div class="credit-details">
              <div class="detail-row">
                <span class="detail-label">历史还款记录</span>
                <span class="detail-value">{{ creditInfo.paymentHistory }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">逾期次数</span>
                <span class="detail-value">{{ creditInfo.overdueCount }}次</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">平台交易金额</span>
                <span class="detail-value">¥{{ creditInfo.transactionAmount }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">履约率</span>
                <span class="detail-value">{{ creditInfo.fulfillmentRate }}%</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">企业资质评级</span>
                <span class="detail-value">{{ creditInfo.enterpriseRating }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">行业信用评级</span>
                <span class="detail-value">{{ creditInfo.industryRating }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="collateral-section">
          <h3>质押物信息</h3>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">质押物类型</span>
              <span class="info-value">{{ collateralInfo.type }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">评估价值</span>
              <span class="info-value">¥{{ collateralInfo.value }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">质押率</span>
              <span class="info-value">{{ collateralInfo.pledgeRate }}%</span>
            </div>
            <div class="info-item">
              <span class="info-label">监管方式</span>
              <span class="info-value">{{ collateralInfo.monitoring }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">仓储地点</span>
              <span class="info-value">{{ collateralInfo.location }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">存放数量</span>
              <span class="info-value">{{ collateralInfo.quantity }}</span>
            </div>
          </div>
        </div>
        <div class="review-section">
          <h3>审核意见</h3>
          <el-form :model="reviewForm">
            <el-form-item label="审核意见">
              <el-textarea v-model="reviewForm.comment" rows="4" placeholder="请输入审核意见"></el-textarea>
            </el-form-item>
            <el-form-item label="审批结果">
              <el-select v-model="reviewForm.result" placeholder="请选择审批结果">
                <el-option label="通过" value="approved"></el-option>
                <el-option label="拒绝" value="rejected"></el-option>
                <el-option label="退回修改" value="returned"></el-option>
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="submitReview">提交审核</el-button>
            </el-form-item>
          </el-form>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { reactive } from 'vue'

const approvalInfo = reactive({
  applicationNo: 'LN202401150001',
  status: 'pending',
  statusText: '待审核'
})

const borrowerInfo = reactive({
  companyName: '黑龙江省丰收农业发展有限公司',
  creditCode: '91230100MA123456789',
  legalPerson: '张建国',
  businessYears: 8,
  registeredCapital: '500万',
  contactPerson: '李明',
  contactPhone: '13800138000',
  region: '黑龙江省哈尔滨市'
})

const loanInfo = reactive({
  productName: '农业收购贷',
  amount: '500,000',
  term: 6,
  rate: 8.5,
  repaymentMethod: '等额本息',
  purpose: '玉米收购资金',
  applyDate: '2024-01-15',
  expectedDate: '2024-01-20'
})

const creditInfo = reactive({
  score: 720,
  level: 'AA',
  paymentHistory: '良好',
  overdueCount: 0,
  transactionAmount: '2,580,000',
  fulfillmentRate: 98.5,
  enterpriseRating: 'AA',
  industryRating: 'A+'
})

const collateralInfo = reactive({
  type: '玉米库存',
  value: '714,285',
  pledgeRate: 70,
  monitoring: 'IoT实时监控',
  location: '哈尔滨粮库',
  quantity: '500吨'
})

const reviewForm = reactive({
  comment: '',
  result: ''
})

const approve = () => {
  alert('审批通过')
}

const reject = () => {
  alert('审批拒绝')
}

const submitReview = () => {
  alert('审核已提交')
}
</script>

<style scoped>
.approval-detail-container {
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

.approval-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.approval-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 25px 30px;
  background: #f9fafb;
  border-bottom: 1px solid #f3f4f6;
}

.approval-title h2 {
  font-size: 20px;
  color: #333;
  margin-bottom: 10px;
}

.approval-status {
  padding: 5px 15px;
  border-radius: 20px;
  font-size: 12px;
}

.approval-status.pending {
  background: #fef3c7;
  color: #92400e;
}

.step-progress {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 30px;
  background: #f9fafb;
  border-bottom: 1px solid #f3f4f6;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.step-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: bold;
  color: #666;
}

.step.active .step-icon {
  background: #10b981;
  color: white;
}

.step.completed .step-icon {
  background: #10b981;
  color: white;
}

.step-label {
  font-size: 14px;
  color: #666;
}

.step.active .step-label,
.step.completed .step-label {
  color: #333;
}

.step-time {
  font-size: 12px;
  color: #999;
}

.step-line {
  width: 80px;
  height: 3px;
  background: #e5e7eb;
  margin: 0 10px;
}

.step.active + .step-line,
.step.completed + .step-line {
  background: #10b981;
}

.borrower-section,
.loan-section,
.credit-section,
.collateral-section,
.review-section {
  padding: 30px;
  border-bottom: 1px solid #f3f4f6;
}

.borrower-section:last-child,
.loan-section:last-child,
.credit-section:last-child,
.collateral-section:last-child,
.review-section:last-child {
  border-bottom: none;
}

.borrower-section h3,
.loan-section h3,
.credit-section h3,
.collateral-section h3,
.review-section h3 {
  font-size: 16px;
  color: #333;
  margin-bottom: 20px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 15px;
}

.info-item {
  display: flex;
  flex-direction: column;
  padding: 15px;
  background: #f9fafb;
  border-radius: 8px;
}

.info-label {
  font-size: 13px;
  color: #666;
  margin-bottom: 5px;
}

.info-value {
  font-size: 14px;
  font-weight: bold;
  color: #333;
}

.info-value.highlight {
  color: #10b981;
}

.credit-content {
  display: flex;
  gap: 40px;
}

.credit-score {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
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

.score-level {
  font-size: 24px;
  font-weight: bold;
  color: #10b981;
  margin-top: 15px;
}

.credit-details {
  flex: 2;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
}

.detail-label {
  font-size: 14px;
  color: #666;
}

.detail-value {
  font-size: 14px;
  font-weight: bold;
  color: #333;
}

.review-section {
  background: #f9fafb;
}
</style>
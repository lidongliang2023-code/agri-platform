<template>
  <div class="loan-product-container">
    <header class="header">
      <div class="logo-area">
        <div class="logo-icon">💰</div>
        <div class="logo-text">农链金服</div>
      </div>
      <nav class="nav">
        <router-link to="/borrower/home" class="nav-item">首页</router-link>
        <router-link to="/borrower/credit" class="nav-item">信用中心</router-link>
        <router-link to="/borrower/loan-apply" class="nav-item">融资申请</router-link>
        <router-link to="/borrower/loan-management" class="nav-item">借款管理</router-link>
        <router-link to="/borrower/pledge" class="nav-item">质押管理</router-link>
      </nav>
    </header>
    <main class="main-content">
      <div class="page-header">
        <h1>数据信用贷</h1>
        <p>基于平台交易数据的纯信用贷款产品</p>
      </div>
      <div class="product-card">
        <div class="product-header">
          <div class="product-icon">📊</div>
          <div class="product-info">
            <h2>数据信用贷</h2>
            <p>以数据为信用，无需抵押担保</p>
          </div>
        </div>
        <div class="product-features">
          <h3>产品特点</h3>
          <div class="features-grid">
            <div class="feature-item">
              <div class="feature-icon">💳</div>
              <div class="feature-text">纯信用，无需抵押</div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">🔢</div>
              <div class="feature-text">数据驱动授信</div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">⚡</div>
              <div class="feature-text">最快当天放款</div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">📈</div>
              <div class="feature-text">最高可贷100万</div>
            </div>
          </div>
        </div>
        <div class="product-details">
          <h3>产品详情</h3>
          <div class="details-grid">
            <div class="detail-item">
              <span class="detail-label">适用场景</span>
              <span class="detail-value">日常经营周转、流动资金</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">贷款期限</span>
              <span class="detail-value">1-12个月</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">还款方式</span>
              <span class="detail-value">按月付息，到期还本</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">担保方式</span>
              <span class="detail-value">纯信用，无需担保</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">申请条件</span>
              <span class="detail-value">平台交易满6个月，信用评分≥700</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">审批时间</span>
              <span class="detail-value">最快当天</span>
            </div>
          </div>
        </div>
        <div class="data-analysis">
          <h3>数据授信分析</h3>
          <div class="analysis-grid">
            <div class="analysis-item">
              <div class="analysis-label">平台交易金额</div>
              <div class="analysis-value">¥{{ dataAnalysis.totalTransaction }}</div>
            </div>
            <div class="analysis-item">
              <div class="analysis-label">交易笔数</div>
              <div class="analysis-value">{{ dataAnalysis.transactionCount }}笔</div>
            </div>
            <div class="analysis-item">
              <div class="analysis-label">履约率</div>
              <div class="analysis-value">{{ dataAnalysis.fulfillmentRate }}%</div>
            </div>
            <div class="analysis-item">
              <div class="analysis-label">建议授信额度</div>
              <div class="analysis-value highlight">¥{{ dataAnalysis.suggestedAmount }}</div>
            </div>
          </div>
        </div>
        <div class="product-documents">
          <h3>所需材料</h3>
          <ul>
            <li>营业执照及法定代表人身份证明</li>
            <li>平台交易授权书</li>
            <li>信用承诺书</li>
          </ul>
        </div>
        <div class="product-apply">
          <div class="apply-form">
            <h3>立即申请</h3>
            <el-form :model="applyForm" label-width="100px">
              <el-form-item label="申请金额">
                <el-input v-model="applyForm.amount" placeholder="请输入申请金额（万元）"></el-input>
              </el-form-item>
              <el-form-item label="贷款期限">
                <el-select v-model="applyForm.term" placeholder="请选择期限">
                  <el-option label="1个月" value="1"></el-option>
                  <el-option label="3个月" value="3"></el-option>
                  <el-option label="6个月" value="6"></el-option>
                  <el-option label="12个月" value="12"></el-option>
                </el-select>
              </el-form-item>
              <el-form-item label="资金用途">
                <el-textarea v-model="applyForm.purpose" placeholder="请描述资金用途"></el-textarea>
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="submitApply">提交申请</el-button>
              </el-form-item>
            </el-form>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { reactive } from 'vue'

const applyForm = reactive({
  amount: '',
  term: '',
  purpose: ''
})

const dataAnalysis = reactive({
  totalTransaction: '2,580,000',
  transactionCount: 156,
  fulfillmentRate: 98.5,
  suggestedAmount: '80,000'
})

const submitApply = () => {
  alert('申请已提交，正在审核中...')
}
</script>

<style scoped>
.loan-product-container {
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

.product-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.product-header {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 30px;
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
  color: white;
}

.product-icon {
  font-size: 56px;
}

.product-info h2 {
  font-size: 24px;
  margin-bottom: 8px;
}

.product-info p {
  font-size: 14px;
  opacity: 0.9;
}

.product-features,
.product-details,
.data-analysis,
.product-documents,
.product-apply {
  padding: 30px;
  border-bottom: 1px solid #f3f4f6;
}

.product-features:last-child,
.product-details:last-child,
.data-analysis:last-child,
.product-documents:last-child,
.product-apply:last-child {
  border-bottom: none;
}

.product-features h3,
.product-details h3,
.data-analysis h3,
.product-documents h3,
.product-apply h3 {
  font-size: 16px;
  color: #333;
  margin-bottom: 20px;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 15px;
  background: #f9fafb;
  border-radius: 10px;
}

.feature-icon {
  font-size: 28px;
}

.feature-text {
  font-size: 14px;
  color: #333;
}

.details-grid,
.analysis-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.detail-item,
.analysis-item {
  display: flex;
  justify-content: space-between;
  padding: 15px;
  background: #f9fafb;
  border-radius: 10px;
}

.detail-label,
.analysis-label {
  font-size: 14px;
  color: #666;
}

.detail-value,
.analysis-value {
  font-size: 14px;
  font-weight: bold;
  color: #333;
}

.analysis-value.highlight {
  color: #10b981;
  font-size: 18px;
}

.product-documents ul {
  padding-left: 20px;
}

.product-documents li {
  font-size: 14px;
  color: #666;
  margin-bottom: 10px;
}

.apply-form {
  background: #f9fafb;
  padding: 25px;
  border-radius: 10px;
}
</style>
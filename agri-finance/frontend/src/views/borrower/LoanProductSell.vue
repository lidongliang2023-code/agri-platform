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
        <h1>应收账款融资</h1>
        <p>基于销售订单和应收账款的融资服务</p>
      </div>
      <div class="product-card">
        <div class="product-header">
          <div class="product-icon">📋</div>
          <div class="product-info">
            <h2>应收账款融资</h2>
            <p>盘活应收账款，加速资金周转</p>
          </div>
        </div>
        <div class="product-features">
          <h3>产品特点</h3>
          <div class="features-grid">
            <div class="feature-item">
              <div class="feature-icon">💳</div>
              <div class="feature-text">最高可贷应收账款80%</div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">⚡</div>
              <div class="feature-text">最快24小时放款</div>
            </div>
            <div class="feature-icon">📉</div>
            <div class="feature-text">低至5.8%年利率</div>
            <div class="feature-item">
              <div class="feature-icon">🔄</div>
              <div class="feature-text">随借随还，灵活便捷</div>
            </div>
          </div>
        </div>
        <div class="product-details">
          <h3>产品详情</h3>
          <div class="details-grid">
            <div class="detail-item">
              <span class="detail-label">适用场景</span>
              <span class="detail-value">农产品销售、订单融资</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">贷款期限</span>
              <span class="detail-value">1-6个月</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">还款方式</span>
              <span class="detail-value">到期一次性还款</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">担保方式</span>
              <span class="detail-value">应收账款质押</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">申请条件</span>
              <span class="detail-value">信用评分≥650，有真实订单</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">审批时间</span>
              <span class="detail-value">1-2个工作日</span>
            </div>
          </div>
        </div>
        <div class="product-documents">
          <h3>所需材料</h3>
          <ul>
            <li>营业执照及法定代表人身份证明</li>
            <li>销售合同或订单</li>
            <li>发票或发货凭证</li>
            <li>应收账款确认函</li>
            <li>信用承诺书</li>
          </ul>
        </div>
        <div class="product-apply">
          <div class="apply-form">
            <h3>立即申请</h3>
            <el-form :model="applyForm" label-width="100px">
              <el-form-item label="应收账款金额">
                <el-input v-model="applyForm.invoiceAmount" placeholder="请输入应收账款金额（万元）"></el-input>
              </el-form-item>
              <el-form-item label="申请金额">
                <el-input v-model="applyForm.amount" placeholder="请输入申请金额（万元）"></el-input>
              </el-form-item>
              <el-form-item label="贷款期限">
                <el-select v-model="applyForm.term" placeholder="请选择期限">
                  <el-option label="1个月" value="1"></el-option>
                  <el-option label="2个月" value="2"></el-option>
                  <el-option label="3个月" value="3"></el-option>
                  <el-option label="6个月" value="6"></el-option>
                </el-select>
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
  invoiceAmount: '',
  amount: '',
  term: ''
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
  background: linear-gradient(135deg, #3b82f6, #2563eb);
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
.product-documents,
.product-apply {
  padding: 30px;
  border-bottom: 1px solid #f3f4f6;
}

.product-features:last-child,
.product-details:last-child,
.product-documents:last-child,
.product-apply:last-child {
  border-bottom: none;
}

.product-features h3,
.product-details h3,
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

.details-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  padding: 15px;
  background: #f9fafb;
  border-radius: 10px;
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
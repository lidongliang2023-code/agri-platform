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
        <h1>农机融资租赁</h1>
        <p>为农业机械采购提供融资租赁服务</p>
      </div>
      <div class="product-card">
        <div class="product-header">
          <div class="product-icon">🚜</div>
          <div class="product-info">
            <h2>农机融资租赁</h2>
            <p>以租代购，轻松获取先进农业机械</p>
          </div>
        </div>
        <div class="product-features">
          <h3>产品特点</h3>
          <div class="features-grid">
            <div class="feature-item">
              <div class="feature-icon">🔧</div>
              <div class="feature-text">覆盖各类农业机械</div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">💲</div>
              <div class="feature-text">首付低至10%</div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">📅</div>
              <div class="feature-text">租期最长5年</div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">✅</div>
              <div class="feature-text">期满所有权转移</div>
            </div>
          </div>
        </div>
        <div class="product-details">
          <h3>产品详情</h3>
          <div class="details-grid">
            <div class="detail-item">
              <span class="detail-label">适用场景</span>
              <span class="detail-value">拖拉机、收割机、播种机等</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">租赁期限</span>
              <span class="detail-value">2-5年</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">还款方式</span>
              <span class="detail-value">等额本息</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">担保方式</span>
              <span class="detail-value">设备抵押</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">申请条件</span>
              <span class="detail-value">信用评分≥550，有经营场地</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">审批时间</span>
              <span class="detail-value">3-5个工作日</span>
            </div>
          </div>
        </div>
        <div class="product-documents">
          <h3>所需材料</h3>
          <ul>
            <li>营业执照及法定代表人身份证明</li>
            <li>农机采购合同</li>
            <li>经营场地证明</li>
            <li>近2年财务报表</li>
            <li>信用承诺书</li>
          </ul>
        </div>
        <div class="product-apply">
          <div class="apply-form">
            <h3>立即申请</h3>
            <el-form :model="applyForm" label-width="100px">
              <el-form-item label="农机名称">
                <el-input v-model="applyForm.machineName" placeholder="请输入农机名称"></el-input>
              </el-form-item>
              <el-form-item label="设备价值">
                <el-input v-model="applyForm.machineValue" placeholder="请输入设备价值（万元）"></el-input>
              </el-form-item>
              <el-form-item label="租赁期限">
                <el-select v-model="applyForm.term" placeholder="请选择期限">
                  <el-option label="2年" value="24"></el-option>
                  <el-option label="3年" value="36"></el-option>
                  <el-option label="4年" value="48"></el-option>
                  <el-option label="5年" value="60"></el-option>
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
  machineName: '',
  machineValue: '',
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
  background: linear-gradient(135deg, #f59e0b, #d97706);
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
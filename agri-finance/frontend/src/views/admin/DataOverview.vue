<template>
  <div class="data-overview-container">
    <header class="header">
      <div class="logo-area">
        <div class="logo-icon">🛡️</div>
        <div class="logo-text">农链金服 - 运营风控</div>
      </div>
      <nav class="nav">
        <router-link to="/admin/workbench" class="nav-item">工作台</router-link>
        <router-link to="/admin/data-overview" class="nav-item active">数据总览</router-link>
        <router-link to="/admin/approval" class="nav-item">审批管理</router-link>
        <router-link to="/admin/credit-management" class="nav-item">信用管理</router-link>
        <router-link to="/admin/post-loan" class="nav-item">贷后监控</router-link>
        <router-link to="/admin/blacklist" class="nav-item">黑名单管理</router-link>
      </nav>
    </header>
    <main class="main-content">
      <div class="page-header">
        <h1>数据总览</h1>
        <p>平台核心业务数据统计分析</p>
        <div class="date-selector">
          <el-select v-model="dateRange" placeholder="选择时间范围">
            <el-option label="今日" value="today" />
            <el-option label="本周" value="week" />
            <el-option label="本月" value="month" />
            <el-option label="本季度" value="quarter" />
            <el-option label="本年度" value="year" />
          </el-select>
        </div>
      </div>
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">累计放款</span>
            <span class="stat-trend up">↑ 12.5%</span>
          </div>
          <div class="stat-value">¥5,000,000</div>
        </div>
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">活跃用户</span>
            <span class="stat-trend up">↑ 8.3%</span>
          </div>
          <div class="stat-value">1,200户</div>
        </div>
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">借款笔数</span>
            <span class="stat-trend up">↑ 15.2%</span>
          </div>
          <div class="stat-value">1,500笔</div>
        </div>
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">逾期率</span>
            <span class="stat-trend down">↓ 2.1%</span>
          </div>
          <div class="stat-value">1.2%</div>
        </div>
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">不良率</span>
            <span class="stat-trend down">↓ 0.5%</span>
          </div>
          <div class="stat-value">0.8%</div>
        </div>
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">平均利率</span>
            <span class="stat-trend down">↓ 0.3%</span>
          </div>
          <div class="stat-value">7.2%</div>
        </div>
      </div>
      <div class="chart-grid">
        <div class="chart-card">
          <h3>月度放款趋势</h3>
          <div class="line-chart">
            <svg viewBox="0 0 600 200" class="chart-svg">
              <defs>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style="stop-color:#10b981;stop-opacity:0.3" />
                  <stop offset="100%" style="stop-color:#10b981;stop-opacity:0" />
                </linearGradient>
              </defs>
              <path d="M 50 150 Q 100 120 150 130 T 250 100 T 350 110 T 450 80 T 550 90" fill="none" stroke="#10b981" stroke-width="3" />
              <path d="M 50 150 Q 100 120 150 130 T 250 100 T 350 110 T 450 80 T 550 90 L 550 180 L 50 180 Z" fill="url(#lineGradient)" />
              <circle cx="50" cy="150" r="5" fill="#10b981" />
              <circle cx="150" cy="130" r="5" fill="#10b981" />
              <circle cx="250" cy="100" r="5" fill="#10b981" />
              <circle cx="350" cy="110" r="5" fill="#10b981" />
              <circle cx="450" cy="80" r="5" fill="#10b981" />
              <circle cx="550" cy="90" r="5" fill="#10b981" />
              <text x="50" y="195" text-anchor="middle" fill="#666" font-size="12">7月</text>
              <text x="150" y="195" text-anchor="middle" fill="#666" font-size="12">8月</text>
              <text x="250" y="195" text-anchor="middle" fill="#666" font-size="12">9月</text>
              <text x="350" y="195" text-anchor="middle" fill="#666" font-size="12">10月</text>
              <text x="450" y="195" text-anchor="middle" fill="#666" font-size="12">11月</text>
              <text x="550" y="195" text-anchor="middle" fill="#666" font-size="12">12月</text>
            </svg>
          </div>
        </div>
        <div class="chart-card">
          <h3>产品类型分布</h3>
          <div class="pie-chart-container">
            <div class="pie-chart">
              <div class="pie-slice" style="--percent: 45; --color: #10b981;">
                <span class="slice-label">订单贷</span>
                <span class="slice-value">45%</span>
              </div>
              <div class="pie-slice" style="--percent: 30; --color: #3b82f6;">
                <span class="slice-label">信用贷</span>
                <span class="slice-value">30%</span>
              </div>
              <div class="pie-slice" style="--percent: 15; --color: #f59e0b;">
                <span class="slice-label">质押贷</span>
                <span class="slice-value">15%</span>
              </div>
              <div class="pie-slice" style="--percent: 10; --color: #8b5cf6;">
                <span class="slice-label">设备贷</span>
                <span class="slice-value">10%</span>
              </div>
            </div>
          </div>
        </div>
        <div class="chart-card full">
          <h3>地域分布统计</h3>
          <div class="map-container">
            <div class="map-grid">
              <div class="map-item" v-for="item in regionData" :key="item.name">
                <div class="map-header">
                  <span class="map-name">{{ item.name }}</span>
                  <span class="map-amount">¥{{ item.amount }}</span>
                </div>
                <div class="map-bar">
                  <div class="map-fill" :style="{ width: item.percent + '%' }"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'

const dateRange = ref('month')

const regionData = reactive([
  { name: '华北地区', amount: '1,200,000', percent: 100 },
  { name: '华东地区', amount: '960,000', percent: 80 },
  { name: '华南地区', amount: '840,000', percent: 70 },
  { name: '华中地区', amount: '600,000', percent: 50 },
  { name: '西南地区', amount: '480,000', percent: 40 },
  { name: '西北地区', amount: '360,000', percent: 30 },
  { name: '东北地区', amount: '420,000', percent: 35 },
  { name: '其他地区', amount: '140,000', percent: 12 }
])
</script>

<style scoped>
.data-overview-container {
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
  gap: 20px;
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
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h1 {
  font-size: 24px;
  color: #333;
}

.page-header p {
  font-size: 14px;
  color: #666;
  margin-top: 5px;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 20px;
  margin-bottom: 20px;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.stat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.stat-title {
  font-size: 13px;
  color: #666;
}

.stat-trend {
  font-size: 12px;
  font-weight: bold;
}

.stat-trend.up {
  color: #10b981;
}

.stat-trend.down {
  color: #ef4444;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #333;
}

.chart-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.chart-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.chart-card.full {
  grid-column: span 2;
}

.chart-card h3 {
  font-size: 16px;
  color: #333;
  margin-bottom: 20px;
}

.line-chart {
  height: 200px;
}

.chart-svg {
  width: 100%;
  height: 100%;
}

.pie-chart-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.pie-chart {
  width: 150px;
  height: 150px;
  border-radius: 50%;
  background: conic-gradient(
    #10b981 0% 45%,
    #3b82f6 45% 75%,
    #f59e0b 75% 90%,
    #8b5cf6 90% 100%
  );
  position: relative;
}

.pie-chart::before {
  content: '';
  position: absolute;
  top: 25%;
  left: 25%;
  width: 50%;
  height: 50%;
  background: white;
  border-radius: 50%;
}

.map-container {
  height: 200px;
}

.map-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.map-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.map-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.map-name {
  font-size: 13px;
  color: #666;
}

.map-amount {
  font-size: 13px;
  font-weight: bold;
  color: #333;
}

.map-bar {
  height: 8px;
  background: #f3f4f6;
  border-radius: 4px;
  overflow: hidden;
}

.map-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981, #34d399);
  border-radius: 4px;
}
</style>
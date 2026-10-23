<template>
  <div class="warrant-management-container">
    <header class="header">
      <div class="logo-area">
        <div class="logo-icon">🔒</div>
        <div class="logo-text">农链金服 - 运营风控端</div>
      </div>
      <nav class="nav">
        <router-link to="/admin/workbench" class="nav-item">工作台</router-link>
        <router-link to="/admin/approval" class="nav-item">审批管理</router-link>
        <router-link to="/admin/pledge" class="nav-item">质押物管理</router-link>
        <router-link to="/admin/warrant" class="nav-item active">仓单管理</router-link>
      </nav>
    </header>
    <main class="main-content">
      <div class="page-header">
        <h1>仓单管理</h1>
        <p>管理和监控仓单信息</p>
      </div>
      <div class="stats-section">
        <div class="stat-card">
          <div class="stat-icon">📄</div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.totalWarrant }}</div>
            <div class="stat-label">仓单总数</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">💰</div>
          <div class="stat-content">
            <div class="stat-value">¥{{ stats.totalValue }}</div>
            <div class="stat-label">仓单总金额</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">✅</div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.validCount }}</div>
            <div class="stat-label">有效仓单</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">❌</div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.invalidCount }}</div>
            <div class="stat-label">无效仓单</div>
          </div>
        </div>
      </div>
      <div class="filter-section">
        <el-select v-model="filterStatus" placeholder="状态" class="filter-select">
          <el-option label="全部" value="all"></el-option>
          <el-option label="有效" value="valid"></el-option>
          <el-option label="已质押" value="pledged"></el-option>
          <el-option label="已注销" value="cancelled"></el-option>
        </el-select>
        <el-input v-model="searchKeyword" placeholder="搜索仓单编号" class="filter-input"></el-input>
        <el-button type="primary" @click="searchWarrant">搜索</el-button>
        <el-button @click="createWarrant">创建仓单</el-button>
      </div>
      <div class="warrant-list">
        <div class="warrant-card" v-for="item in warrants" :key="item.id">
          <div class="warrant-header">
            <div class="warrant-info">
              <h3>{{ item.warrantNo }}</h3>
              <p>{{ item.companyName }}</p>
            </div>
            <div class="warrant-status" :class="item.status">
              {{ item.statusText }}
            </div>
          </div>
          <div class="warrant-details">
            <div class="detail-item">
              <span class="detail-label">货物名称</span>
              <span class="detail-value">{{ item.goodsName }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">规格型号</span>
              <span class="detail-value">{{ item.specification }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">数量</span>
              <span class="detail-value">{{ item.quantity }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">单价</span>
              <span class="detail-value">¥{{ item.unitPrice }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">总金额</span>
              <span class="detail-value">¥{{ item.totalAmount }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">仓储单位</span>
              <span class="detail-value">{{ item.warehouse }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">入库日期</span>
              <span class="detail-value">{{ item.warehouseDate }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">有效期至</span>
              <span class="detail-value">{{ item.expireDate }}</span>
            </div>
          </div>
          <div class="warrant-actions">
            <el-button size="small" @click="viewDetail(item)">查看详情</el-button>
            <el-button size="small" type="primary" @click="pledge(item)" v-if="item.status === 'valid'">质押</el-button>
            <el-button size="small" @click="cancel(item)" v-if="item.status === 'valid'">注销</el-button>
          </div>
        </div>
      </div>
      <div class="pagination">
        <el-pagination
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
          :current-page="currentPage"
          :page-sizes="[10, 20, 50]"
          :page-size="pageSize"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper">
        </el-pagination>
      </div>
    </main>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'

const stats = reactive({
  totalWarrant: 120,
  totalValue: '50,000,000',
  validCount: 85,
  invalidCount: 35
})

const filterStatus = ref('all')
const searchKeyword = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(120)

const warrants = [
  { id: 1, warrantNo: 'WD202401150001', companyName: '黑龙江丰收农业', goodsName: '玉米', specification: '一等品', quantity: '500吨', unitPrice: '2,150', totalAmount: '1,075,000', warehouse: '哈尔滨粮库', warehouseDate: '2024-01-15', expireDate: '2024-07-15', status: 'valid', statusText: '有效' },
  { id: 2, warrantNo: 'WD202401100002', companyName: '河南金麦农业', goodsName: '小麦', specification: '一等品', quantity: '300吨', unitPrice: '2,350', totalAmount: '705,000', warehouse: '郑州粮库', warehouseDate: '2024-01-10', expireDate: '2024-07-10', status: 'pledged', statusText: '已质押' },
  { id: 3, warrantNo: 'WD202401080003', companyName: '山东绿源科技', goodsName: '蔬菜', specification: '有机蔬菜', quantity: '50吨', unitPrice: '3,800', totalAmount: '190,000', warehouse: '寿光冷库', warehouseDate: '2024-01-08', expireDate: '2024-02-08', status: 'valid', statusText: '有效' },
  { id: 4, warrantNo: 'WD202401050004', companyName: '四川牧丰养殖', goodsName: '生猪', specification: '三元猪', quantity: '50头', unitPrice: '3,500', totalAmount: '175,000', warehouse: '成都养殖场', warehouseDate: '2024-01-05', expireDate: '2024-01-20', status: 'cancelled', statusText: '已注销' },
  { id: 5, warrantNo: 'WD202401120005', companyName: '黑龙江省农垦集团', goodsName: '大豆', specification: '一等品', quantity: '800吨', unitPrice: '3,100', totalAmount: '2,480,000', warehouse: '佳木斯粮库', warehouseDate: '2024-01-12', expireDate: '2024-07-12', status: 'pledged', statusText: '已质押' }
]

const searchWarrant = () => {
  alert('搜索功能即将开放')
}

const createWarrant = () => {
  alert('创建仓单功能即将开放')
}

const viewDetail = (item) => {
  alert(`查看详情: ${item.warrantNo}`)
}

const pledge = (item) => {
  alert(`质押仓单: ${item.warrantNo}`)
}

const cancel = (item) => {
  alert(`注销仓单: ${item.warrantNo}`)
}

const handleSizeChange = () => {}
const handleCurrentChange = () => {}
</script>

<style scoped>
.warrant-management-container {
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

.stats-section {
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

.filter-section {
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

.warrant-list {
  display: grid;
  gap: 20px;
}

.warrant-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  padding: 25px;
}

.warrant-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.warrant-info h3 {
  font-size: 16px;
  color: #333;
  margin-bottom: 5px;
}

.warrant-info p {
  font-size: 13px;
  color: #666;
}

.warrant-status {
  padding: 5px 15px;
  border-radius: 20px;
  font-size: 12px;
}

.warrant-status.valid {
  background: #d1fae5;
  color: #065f46;
}

.warrant-status.pledged {
  background: #dbeafe;
  color: #1e40af;
}

.warrant-status.cancelled {
  background: #f3f4f6;
  color: #6b7280;
}

.warrant-details {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 15px;
  margin-bottom: 15px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
}

.detail-label {
  font-size: 13px;
  color: #666;
  margin-bottom: 5px;
}

.detail-value {
  font-size: 14px;
  font-weight: bold;
  color: #333;
}

.warrant-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 30px;
}
</style>
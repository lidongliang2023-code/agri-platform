<template>
  <div class="admin-approval-container">
    <header class="header">
      <div class="logo-area">
        <div class="logo-icon">🛡️</div>
        <div class="logo-text">农链金服 - 运营风控</div>
      </div>
      <nav class="nav">
        <router-link to="/admin/workbench" class="nav-item">工作台</router-link>
        <router-link to="/admin/data-overview" class="nav-item">数据总览</router-link>
        <router-link to="/admin/approval" class="nav-item active">审批管理</router-link>
        <router-link to="/admin/credit-management" class="nav-item">信用管理</router-link>
        <router-link to="/admin/post-loan" class="nav-item">贷后监控</router-link>
        <router-link to="/admin/blacklist" class="nav-item">黑名单管理</router-link>
      </nav>
    </header>
    <main class="main-content">
      <div class="page-header">
        <h1>审批管理</h1>
        <p>融资申请审批与审核流程管理</p>
      </div>
      <div class="tabs">
        <el-tabs v-model="activeTab" @tab-change="handleTabChange">
          <el-tab-pane label="待审核" name="pending" />
          <el-tab-pane label="已通过" name="approved" />
          <el-tab-pane label="已拒绝" name="rejected" />
        </el-tabs>
      </div>
      <div class="filter-bar">
        <el-select v-model="filterProduct" placeholder="产品类型" class="filter-select">
          <el-option label="全部" value="" />
          <el-option label="农业订单贷" value="order_loan" />
          <el-option label="信用贷" value="credit_loan" />
          <el-option label="质押贷" value="pledge_loan" />
          <el-option label="设备贷" value="equipment_loan" />
        </el-select>
        <el-select v-model="filterLevel" placeholder="信用等级" class="filter-select">
          <el-option label="全部" value="" />
          <el-option label="AAA" value="AAA" />
          <el-option label="AA" value="AA" />
          <el-option label="A" value="A" />
        </el-select>
        <el-button type="primary" @click="searchApprovals">查询</el-button>
      </div>
      <div class="table-card">
        <el-table :data="approvalList" border style="width: 100%">
          <el-table-column prop="applyNo" label="申请编号" />
          <el-table-column prop="productType" label="产品类型" />
          <el-table-column prop="borrower" label="融资方" />
          <el-table-column prop="amount" label="申请金额" />
          <el-table-column prop="rate" label="利率" />
          <el-table-column prop="term" label="期限" />
          <el-table-column prop="creditScore" label="信用评分" />
          <el-table-column prop="creditLevel" label="信用等级" />
          <el-table-column prop="status" label="状态">
            <template #default="scope">
              <el-tag :type="getStatusType(scope.row.status)">{{ scope.row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="applyTime" label="申请时间" />
          <el-table-column prop="actions" label="操作" width="200">
            <template #default="scope">
              <el-button size="small" @click="viewDetail(scope.row)">详情</el-button>
              <el-button v-if="scope.row.status === '待审核'" size="small" type="primary" @click="approve(scope.row)">通过</el-button>
              <el-button v-if="scope.row.status === '待审核'" size="small" @click="reject(scope.row)">拒绝</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="pagination">
          <el-pagination
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
            :current-page="currentPage"
            :page-sizes="[10, 20, 50]"
            :page-size="pageSize"
            :total="total"
            layout="total, sizes, prev, pager, next, jumper"
          />
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'

const activeTab = ref('pending')
const filterProduct = ref('')
const filterLevel = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(58)

const approvalList = reactive([
  { applyNo: 'AP20240115001', productType: '农业订单贷', borrower: '张三农专业合作社', amount: '100,000', rate: '6.5%', term: '6个月', creditScore: '820', creditLevel: 'AA', status: '待审核', applyTime: '2024-01-15 14:30' },
  { applyNo: 'AP20240115002', productType: '质押贷', borrower: '李家庄农场', amount: '150,000', rate: '7.0%', term: '3个月', creditScore: '900', creditLevel: 'AAA', status: '待审核', applyTime: '2024-01-15 11:20' },
  { applyNo: 'AP20240114003', productType: '信用贷', borrower: '王村农业公司', amount: '80,000', rate: '8.0%', term: '12个月', creditScore: '750', creditLevel: 'A', status: '待审核', applyTime: '2024-01-14 16:45' },
  { applyNo: 'AP20240113004', productType: '设备贷', borrower: '赵家庄农机合作社', amount: '120,000', rate: '6.8%', term: '24个月', creditScore: '850', creditLevel: 'AA', status: '已通过', applyTime: '2024-01-13 10:00' },
  { applyNo: 'AP20240112005', productType: '农业订单贷', borrower: '孙家湾蔬菜基地', amount: '60,000', rate: '6.6%', term: '6个月', creditScore: '720', creditLevel: 'A', status: '已拒绝', applyTime: '2024-01-12 09:30' }
])

const getStatusType = (status) => {
  const types = { '待审核': 'warning', '已通过': 'success', '已拒绝': 'danger' }
  return types[status] || ''
}

const handleTabChange = (tab) => {
  console.log('切换标签:', tab)
}

const searchApprovals = () => {
  console.log('搜索条件:', filterProduct.value, filterLevel.value)
}

const viewDetail = (row) => {
  console.log('查看详情:', row)
}

const approve = (row) => {
  ElMessage.success(`已通过: ${row.applyNo}`)
}

const reject = (row) => {
  ElMessage.info(`已拒绝: ${row.applyNo}`)
}

const handleSizeChange = (size) => {
  pageSize.value = size
}

const handleCurrentChange = (page) => {
  currentPage.value = page
}
</script>

<style scoped>
.admin-approval-container {
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
  margin-bottom: 20px;
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

.tabs {
  margin-bottom: 20px;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
}

.filter-select {
  width: 180px;
}

.table-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.pagination {
  display: flex;
  justify-content: flex-end;
  padding-top: 20px;
}
</style>
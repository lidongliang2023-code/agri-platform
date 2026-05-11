<template>
  <div class="chain-page">
    <div class="page-header">
      <div class="header-info">
        <h2>区块链存证</h2>
        <p>农产品溯源数据上链存证</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="refreshData">
          <el-icon name="refresh"></el-icon>
          刷新数据
        </el-button>
      </div>
    </div>

    <div class="stats-cards">
      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon purple">
            <el-icon name="link"></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ todayRecords }}</div>
            <div class="stat-label">今日上链记录</div>
          </div>
        </div>
      </el-card>
      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon blue">
            <el-icon name="database"></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ totalRecords }}</div>
            <div class="stat-label">链上总记录</div>
          </div>
        </div>
      </el-card>
      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon green">
            <el-icon name="check-circle"></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ verifiedCount }}</div>
            <div class="stat-label">已验证记录</div>
          </div>
        </div>
      </el-card>
      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon orange">
            <el-icon name="clock"></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ avgTime }}ms</div>
            <div class="stat-label">平均上链时间</div>
          </div>
        </div>
      </el-card>
    </div>

    <div class="search-bar">
      <el-input v-model="searchHash" placeholder="搜索区块哈希" class="search-input" />
      <el-select v-model="typeFilter" placeholder="存证类型">
        <el-option label="全部" value="" />
        <el-option label="采收记录" value="harvest" />
        <el-option label="投入品使用" value="input" />
        <el-option label="质检报告" value="quality" />
        <el-option label="溯源信息" value="trace" />
      </el-select>
      <el-button type="primary" @click="search">搜索</el-button>
    </div>

    <el-table :data="chainRecords" border>
      <el-table-column prop="blockHash" label="区块哈希" width="200">
        <template #default="scope">
          <span class="hash-text">{{ scope.row.blockHash }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="recordType" label="存证类型">
        <template #default="scope">
          <el-tag :type="getTypeTag(scope.row.recordType)">{{ getTypeText(scope.row.recordType) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="farmName" label="所属农场" />
      <el-table-column prop="productName" label="产品名称" />
      <el-table-column prop="recordTime" label="上链时间" />
      <el-table-column prop="status" label="状态">
        <template #default="scope">
          <el-tag :type="scope.row.status === 'verified' ? 'success' : 'warning'">
            {{ scope.row.status === 'verified' ? '已验证' : '待验证' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作">
        <template #default="scope">
          <el-button size="small" @click="viewDetail(scope.row)">查看详情</el-button>
          <el-button size="small" type="primary" @click="verifyRecord(scope.row)" v-if="scope.row.status !== 'verified'">验证</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      :total="total"
      :page-size="10"
      :current-page="page"
      @current-change="handlePageChange"
      layout="total, prev, pager, next, jumper"
      class="pagination"
    />

    <el-dialog title="记录详情" :visible.sync="showDetail" width="600px">
      <div v-if="selectedRecord" class="detail-content">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="区块哈希">{{ selectedRecord.blockHash }}</el-descriptions-item>
          <el-descriptions-item label="存证类型">{{ getTypeText(selectedRecord.recordType) }}</el-descriptions-item>
          <el-descriptions-item label="所属农场">{{ selectedRecord.farmName }}</el-descriptions-item>
          <el-descriptions-item label="产品名称">{{ selectedRecord.productName }}</el-descriptions-item>
          <el-descriptions-item label="上链时间">{{ selectedRecord.recordTime }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="selectedRecord.status === 'verified' ? 'success' : 'warning'">
              {{ selectedRecord.status === 'verified' ? '已验证' : '待验证' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="交易ID">{{ selectedRecord.transactionId }}</el-descriptions-item>
          <el-descriptions-item label="数据摘要">{{ selectedRecord.dataHash }}</el-descriptions-item>
        </el-descriptions>
      </div>
      <template #footer>
        <el-button @click="showDetail = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const searchHash = ref('')
const typeFilter = ref('')
const page = ref(1)
const total = ref(1234)
const showDetail = ref(false)
const selectedRecord = ref(null)

const todayRecords = ref(12)
const totalRecords = ref(1234)
const verifiedCount = ref(1180)
const avgTime = ref(156)

const chainRecords = ref([
  { id: 1, blockHash: '0x7a2f...3b8c', recordType: 'harvest', farmName: '示范农场', productName: '有机西红柿', recordTime: '2024-07-20 15:30:00', status: 'verified', transactionId: 'TX-2024-001', dataHash: '0xabc...def' },
  { id: 2, blockHash: '0x8b3g...4c9d', recordType: 'input', farmName: '绿色生态园', productName: '复合肥', recordTime: '2024-07-20 14:20:00', status: 'verified', transactionId: 'TX-2024-002', dataHash: '0x123...456' },
  { id: 3, blockHash: '0x9c4h...5d0e', recordType: 'quality', farmName: '示范农场', productName: '番茄质检报告', recordTime: '2024-07-20 13:10:00', status: 'verified', transactionId: 'TX-2024-003', dataHash: '0x789...0ab' },
  { id: 4, blockHash: '0xad5i...6e1f', recordType: 'trace', farmName: '绿色生态园', productName: '黄瓜溯源码', recordTime: '2024-07-20 12:00:00', status: 'pending', transactionId: 'TX-2024-004', dataHash: '0xcde...fgh' },
  { id: 5, blockHash: '0xbe6j...7f2g', recordType: 'harvest', farmName: '示范农场', productName: '绿色黄瓜', recordTime: '2024-07-20 11:30:00', status: 'verified', transactionId: 'TX-2024-005', dataHash: '0xijk...lmn' },
  { id: 6, blockHash: '0xcf7k...8g3h', recordType: 'input', farmName: '示范农场', productName: '杀虫剂', recordTime: '2024-07-20 10:15:00', status: 'verified', transactionId: 'TX-2024-006', dataHash: '0xopq...rst' }
])

const getTypeTag = (type) => {
  const types = { harvest: 'success', input: 'primary', quality: 'warning', trace: 'info' }
  return types[type] || 'default'
}

const getTypeText = (type) => {
  const texts = { harvest: '采收记录', input: '投入品使用', quality: '质检报告', trace: '溯源信息' }
  return texts[type] || type
}

const search = () => {
  console.log('搜索:', searchHash.value, typeFilter.value)
}

const handlePageChange = (newPage) => {
  page.value = newPage
}

const refreshData = () => {
  console.log('刷新数据')
}

const viewDetail = (row) => {
  selectedRecord.value = row
  showDetail.value = true
}

const verifyRecord = (row) => {
  console.log('验证记录:', row)
}
</script>

<style scoped>
.chain-page { padding: 20px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.header-info p { color: #718096; margin: 4px 0 0; }
.header-actions { display: flex; gap: 12px; }
.stats-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
.stat-card { padding: 20px; }
.stat-content { display: flex; align-items: center; gap: 16px; }
.stat-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; color: white; }
.stat-icon.purple { background: linear-gradient(135deg, #9f7aea 0%, #805ad5 100%); }
.stat-icon.blue { background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%); }
.stat-icon.green { background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); }
.stat-icon.orange { background: linear-gradient(135deg, #ed8936 0%, #dd6b20 100%); }
.stat-value { font-size: 28px; font-weight: 600; color: #1a365d; }
.stat-label { font-size: 14px; color: #718096; }
.search-bar { display: flex; gap: 12px; margin-bottom: 20px; }
.search-input { width: 250px; }
.pagination { margin-top: 20px; text-align: right; }
.hash-text { font-family: monospace; font-size: 12px; color: #4299e1; }
.detail-content { padding: 10px; }
</style>

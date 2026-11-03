<template>
  <div class="commissions-page">
    <div class="page-head">
      <div>
        <h2>佣金中心</h2>
        <p>佣金 = 渠道订单商品分佣；订单确认收货后结算，批次结算与提现打款流水在资金页可回查。</p>
      </div>
      <div class="head-actions">
        <el-button @click="$router.push('/reconcile')">分润对账</el-button>
        <el-button type="primary" @click="$router.push('/wallet')">去提现</el-button>
      </div>
    </div>

    <div class="summary-card">
      <div class="summary-item">
        <p class="summary-value">¥{{ money(summary.settledTotal) }}</p>
        <p class="summary-label">累计已结算</p>
      </div>
      <div class="summary-item">
        <p class="summary-value">¥{{ money(summary.pendingTotal) }}</p>
        <p class="summary-label">待结算佣金</p>
      </div>
      <div class="summary-item">
        <p class="summary-value">¥{{ money(summary.available) }}</p>
        <p class="summary-label">可提现余额</p>
      </div>
      <div class="summary-item">
        <p class="summary-value">¥{{ money(summary.frozenTotal) }}</p>
        <p class="summary-label">提现中</p>
      </div>
    </div>

    <div class="search-bar">
      <el-select v-model="status" placeholder="状态" style="width: 150px" @change="loadCommissions">
        <el-option label="全部" value="" />
        <el-option label="待结算" value="PENDING" />
        <el-option label="已结算" value="SETTLED" />
      </el-select>
    </div>
    <el-table :data="commissions" border>
      <el-table-column prop="orderNo" label="订单号" min-width="180" />
      <el-table-column label="佣金金额" width="120">
        <template #default="{ row }">¥{{ money(row.amount) }}</template>
      </el-table-column>
      <el-table-column prop="rate" label="佣金比例" width="110">
        <template #default="{ row }">{{ Number(row.rate) }}%</template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="settleBatchNo" label="结算批次" width="190" show-overflow-tooltip />
      <el-table-column prop="remark" label="说明" min-width="120" show-overflow-tooltip />
      <el-table-column prop="settleTime" label="结算时间" width="180" />
      <el-table-column prop="createTime" label="产生时间" width="180" />
      <el-table-column label="操作" width="90" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.orderId" link type="primary" @click="$router.push(`/orders/${row.orderId}`)">订单</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!commissions.length" description="当前筛选条件下没有佣金记录" />
    <el-pagination
      @current-change="handlePageChange"
      :current-page="page"
      :page-size="size"
      :total="total"
      layout="prev, pager, next, jumper"
    />

    <div class="card">
      <div class="card-head">
        <h3>结算批次</h3>
        <span class="muted">运营端按渠道/账期批量结算后生成</span>
      </div>
      <el-table :data="settlements" size="small" border>
        <el-table-column prop="batchNo" label="批次号" width="200" />
        <el-table-column prop="commissionCount" label="笔数" width="80" />
        <el-table-column label="金额(元)" width="120">
          <template #default="{ row }">¥{{ money(row.amount) }}</template>
        </el-table-column>
        <el-table-column prop="operator" label="操作人" width="120" />
        <el-table-column prop="createdAt" label="结算时间" />
      </el-table>
      <el-empty v-if="!settlements.length" description="还没有结算批次" :image-size="60" />
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { channelApi } from '../api'
import { currentChannelId } from '../api/channelSession'

const status = ref('')
const commissions = ref([])
const page = ref(1)
const size = ref(10)
const total = ref(0)
const settlements = ref([])
const summary = ref({})

onMounted(() => {
  loadData()
})

const loadData = async () => {
  const channelId = await currentChannelId()
  if (!channelId) {
    commissions.value = []
    total.value = 0
    return
  }
  try {
    const [commRes, summaryRes, batches] = await Promise.all([
      channelApi.getCommissions({
        channelId,
        page: page.value,
        size: size.value,
        status: status.value,
      }),
      channelApi.getCommissionSummary(),
      channelApi.getSettlements(),
    ])
    commissions.value = commRes.records || []
    total.value = commRes.total || 0
    summary.value = summaryRes || {}
    settlements.value = batches || []
  } catch (e) {
    ElMessage.error(e?.message || '佣金数据读取失败')
  }
}

const loadCommissions = () => {
  page.value = 1
  loadData()
}

const handlePageChange = (currentPage) => {
  page.value = currentPage
  loadData()
}

const money = (value) => Number(value || 0).toFixed(2)
const getStatusType = (value) => ({ PENDING: 'warning', SETTLED: 'success' }[value] || 'info')
const getStatusText = (value) => ({ PENDING: '待结算', SETTLED: '已结算' }[value] || value)
</script>

<style scoped>
.commissions-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 760px; }
.head-actions { display: flex; gap: 8px; }
.summary-card { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.summary-item { padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.summary-value { margin: 0 0 6px; color: #173e2a; font-size: 22px; font-weight: 700; }
.summary-label { margin: 0; color: #84938a; font-size: 12px; }
.search-bar { display: flex; gap: 10px; }
.card { padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.card-head h3 { margin: 0; font-size: 15px; }
.muted { color: #84938a; font-size: 12px; }
@media (max-width: 1000px) { .summary-card { grid-template-columns: repeat(2, 1fr); } }
</style>

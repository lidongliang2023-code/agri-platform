<template>
  <div class="commissions-page">
    <div class="page-head">
      <div>
        <h2>佣金中心</h2>
        <p>佣金 = 渠道订单商品分佣；订单确认收货后结算，批次结算与提现打款流水在资金页可回查。</p>
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

    <AgriElementListTable
      :columns="commissionColumns"
      :data="commissions"
      :row-key="(row) => String(row.id ?? `${row.orderNo}-${row.createTime}`)"
      :loading="loading"
      :page="page"
      :page-size="size"
      :total="total"
      column-settings-storage-key="agri-s2b2c-channel:commissions"
      empty-text="当前筛选条件下没有佣金记录"
      @page-change="handlePageChange"
      @refresh="loadData"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="1" :loading="loading" @search="loadCommissions" @reset="reset">
          <div class="agri-vue-filter-field">
            <label>结算状态</label>
            <el-select v-model="status" placeholder="全部">
              <el-option label="全部" value="" />
              <el-option label="待结算" value="PENDING" />
              <el-option label="已结算" value="SETTLED" />
            </el-select>
          </div>
        </AgriVueFilterBar>
      </template>

      <template #toolbar-left>
        <el-button type="primary" @click="$router.push('/wallet')">去提现</el-button>
        <el-button @click="$router.push('/reconcile')">分润对账</el-button>
      </template>

      <template #cell-amount="{ row }">¥{{ money(row.amount) }}</template>
      <template #cell-rate="{ row }">{{ Number(row.rate) }}%</template>
      <template #cell-status="{ row }">
        <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
      </template>
      <template #cell-actions="{ row }">
        <AgriVueRowActions
          v-if="row.orderId"
          :actions="[{ key: 'order', label: '订单', onClick: () => $router.push(`/orders/${row.orderId}`) }]"
        />
      </template>
    </AgriElementListTable>

    <AgriElementListTable
      :columns="settlementColumns"
      :data="settlements"
      :row-key="(row) => String(row.id ?? row.batchNo)"
      :loading="loading"
      client-pagination
      :page-size="10"
      column-settings-storage-key="agri-s2b2c-channel:commission-settlements"
      empty-text="还没有结算批次"
      @refresh="loadData"
    >
      <template #toolbar-left>
        <div class="section-title">
          <h3>结算批次</h3>
          <span class="muted">运营端按渠道/账期批量结算后生成</span>
        </div>
      </template>
      <template #cell-amount="{ row }">¥{{ money(row.amount) }}</template>
    </AgriElementListTable>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { AgriElementListTable, AgriVueFilterBar, AgriVueRowActions } from '@agri/shared/vue/element'
import { channelApi } from '../api'
import { currentChannelId } from '../api/channelSession'

const status = ref('')
const commissions = ref([])
const loading = ref(false)
const page = ref(1)
const size = ref(20)
const total = ref(0)
const settlements = ref([])
const summary = ref({})

const commissionColumns = [
  { key: 'orderNo', prop: 'orderNo', label: '订单号', minWidth: 180 },
  { key: 'amount', prop: 'amount', label: '佣金金额', width: 120 },
  { key: 'rate', prop: 'rate', label: '佣金比例', width: 110 },
  { key: 'status', prop: 'status', label: '状态', width: 110 },
  { key: 'settleBatchNo', prop: 'settleBatchNo', label: '结算批次', width: 190 },
  { key: 'remark', prop: 'remark', label: '说明', minWidth: 120 },
  { key: 'settleTime', prop: 'settleTime', label: '结算时间', width: 180 },
  { key: 'createTime', prop: 'createTime', label: '产生时间', width: 180 },
  { key: 'actions', label: '操作', width: 95 },
]

const settlementColumns = [
  { key: 'batchNo', prop: 'batchNo', label: '批次号', width: 200 },
  { key: 'commissionCount', prop: 'commissionCount', label: '笔数', width: 85 },
  { key: 'amount', prop: 'amount', label: '金额(元)', width: 120 },
  { key: 'operator', prop: 'operator', label: '操作人', width: 120 },
  { key: 'createdAt', prop: 'createdAt', label: '结算时间', minWidth: 170 },
]

onMounted(() => loadData())

const loadData = async () => {
  loading.value = true
  try {
    const channelId = await currentChannelId()
    if (!channelId) {
      commissions.value = []
      total.value = 0
      return
    }
    const [commRes, summaryRes, batches] = await Promise.all([
      channelApi.getCommissions({
        channelId,
        page: page.value,
        size: size.value,
        status: status.value || undefined,
      }),
      channelApi.getCommissionSummary(),
      channelApi.getSettlements(),
    ])
    commissions.value = commRes.records || []
    total.value = Number(commRes.total || 0)
    summary.value = summaryRes || {}
    settlements.value = batches || []
  } catch (e) {
    ElMessage.error(e?.message || '佣金数据读取失败')
  } finally {
    loading.value = false
  }
}

const loadCommissions = () => {
  page.value = 1
  loadData()
}

const reset = () => {
  status.value = ''
  page.value = 1
  loadData()
}

const handlePageChange = (nextPage, nextSize) => {
  page.value = nextPage
  size.value = nextSize
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
.summary-card { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.summary-item { padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.summary-value { margin: 0 0 6px; color: #173e2a; font-size: 22px; font-weight: 600; }
.summary-label { margin: 0; color: #84938a; font-size: 12px; }
.section-title { display: flex; align-items: baseline; gap: 10px; }
.section-title h3 { margin: 0; font-size: 15px; color: #173e2a; }
.muted { color: #84938a; font-size: 12px; }
@media (max-width: 1000px) { .summary-card { grid-template-columns: repeat(2, 1fr); } }
</style>

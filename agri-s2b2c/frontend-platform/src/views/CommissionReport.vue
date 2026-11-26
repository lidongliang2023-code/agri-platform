<template>
  <div class="report-page">
    <div class="page-head">
      <div>
        <h2>佣金明细报表</h2>
        <p>渠道佣金逐笔明细，可按渠道与结算状态筛选；批次号与结算时间用于财务核对。</p>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat-card"><span>已结算</span><b>¥{{ money(summary.settled) }}</b><small>已结算金额合计</small></div>
      <div class="stat-card"><span>待结算</span><b>¥{{ money(summary.pending) }}</b><small>待结算金额合计</small></div>
      <div class="stat-card"><span>佣金笔数</span><b>{{ summary.total || 0 }}</b><small>当前筛选口径</small></div>
    </div>

    <AgriElementListTable
      :columns="columns"
      :data="rows"
      :row-key="(row) => String(row.id ?? `${row.orderNo}-${row.createTime}`)"
      :loading="loading"
      :page="page"
      :page-size="size"
      :total="total"
      column-settings-storage-key="agri-s2b2c-platform:commission-report"
      empty-text="当前筛选下没有佣金记录"
      @page-change="handlePageChange"
      @refresh="load"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="2" :loading="loading" @search="search" @reset="reset">
          <div class="agri-vue-filter-field">
            <label>渠道 ID</label>
            <el-input v-model="channelId" placeholder="请输入渠道 ID" clearable @keyup.enter="search" />
          </div>
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

      <template #cell-amount="{ row }">¥{{ money(row.amount) }}</template>
      <template #cell-rate="{ row }">{{ Number(row.rate) }}%</template>
      <template #cell-status="{ row }">
        <el-tag :type="row.status === 'SETTLED' ? 'success' : 'warning'">
          {{ row.status === 'SETTLED' ? '已结算' : '待结算' }}
        </el-tag>
      </template>
    </AgriElementListTable>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { AgriElementListTable, AgriVueFilterBar } from '@agri/shared/vue/element'
import { platformApi } from '../api'

const channelId = ref('')
const status = ref('')
const rows = ref([])
const summary = ref({})
const loading = ref(false)
const page = ref(1)
const size = ref(20)
const total = ref(0)

const columns = [
  { key: 'orderNo', prop: 'orderNo', label: '订单号', minWidth: 190 },
  { key: 'channelName', prop: 'channelName', label: '渠道', minWidth: 150 },
  { key: 'amount', prop: 'amount', label: '佣金', width: 110 },
  { key: 'rate', prop: 'rate', label: '比例', width: 90 },
  { key: 'status', prop: 'status', label: '状态', width: 100 },
  { key: 'settleBatchNo', prop: 'settleBatchNo', label: '结算批次', width: 190 },
  { key: 'remark', prop: 'remark', label: '说明', minWidth: 120 },
  { key: 'settleTime', prop: 'settleTime', label: '结算时间', width: 180 },
  { key: 'createTime', prop: 'createTime', label: '产生时间', width: 180 },
]

onMounted(load)

async function load() {
  loading.value = true
  try {
    const data = (await platformApi.getCommissions({
      page: page.value,
      size: size.value,
      channelId: channelId.value.trim() || undefined,
      status: status.value || undefined,
    })) || {}
    rows.value = data.records || []
    total.value = Number(data.total || 0)
    summary.value = data.summary || {}
  } catch (e) {
    rows.value = []
    total.value = 0
    ElMessage.error(e?.message || '佣金报表读取失败')
  } finally {
    loading.value = false
  }
}

function search() {
  page.value = 1
  load()
}

function reset() {
  channelId.value = ''
  status.value = ''
  page.value = 1
  load()
}

function handlePageChange(nextPage, nextSize) {
  page.value = nextPage
  size.value = nextSize
  load()
}

const money = (value) => Number(value || 0).toFixed(2)
</script>

<style scoped>
.report-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 780px; }
.stat-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; max-width: 820px; }
.stat-card { display: flex; flex-direction: column; gap: 6px; padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.stat-card span { color: #84938a; font-size: 12px; }
.stat-card b { color: #173e2a; font-size: 22px; }
.stat-card small { color: #94a198; font-size: 12px; }
</style>

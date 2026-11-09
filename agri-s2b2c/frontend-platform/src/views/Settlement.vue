<template>
  <div class="settlement-page">
    <div class="page-head">
      <div>
        <h2>分润结算</h2>
        <p>只结算渠道佣金（PENDING → SETTLED，按渠道/账期生成批次）；供应商货款与区域分润分别归交易撮合/城市合伙人。</p>
        <p class="rule">
          佣金在<b>下单时</b>就按订单金额生成，但<b>不是当时就能结</b>：只有订单「已完成」（买家已确认收货）
          且没有进行中的售后，才会进入结算。未付款 / 已取消 / 退款中的单子一律不结，下面会逐条写明原因。
        </p>
      </div>
      <el-button @click="load">刷新</el-button>
    </div>

    <div class="stat-row">
      <div class="stat-card"><span>结算批次</span><b>{{ rows.length }}</b><small>全部历史批次</small></div>
      <div class="stat-card"><span>批次总额</span><b>¥{{ money(totalAmount) }}</b><small>按批次金额累加</small></div>
      <div class="stat-card"><span>最近结算</span><b>{{ rows[0]?.createdAt || '—' }}</b><small>{{ rows[0]?.batchNo || '暂无' }}</small></div>
    </div>

    <div class="card">
      <div class="card-head"><h3>发起批次结算</h3></div>
      <div class="filter-bar">
        <el-input v-model="channelId" placeholder="渠道 ID（留空=全部渠道）" style="width: 240px" />
        <el-date-picker v-model="periodStart" type="date" value-format="YYYY-MM-DD" placeholder="账期开始" style="width: 160px" />
        <el-date-picker v-model="periodEnd" type="date" value-format="YYYY-MM-DD" placeholder="账期结束" style="width: 160px" />
        <el-button type="primary" :loading="settling" @click="settle">批量结算待结算佣金</el-button>
      </div>
      <p class="note">不传账期表示结算全部待结算佣金；没有可结算佣金时不会生成空批次。</p>
    </div>

    <!-- 结算结果常驻：只弹一条 toast 的话，操作员三秒后就不知道"这次为什么没结" -->
    <div v-if="lastResult" class="card result-card">
      <div class="card-head">
        <h3>本次结算结果</h3>
        <span class="muted">{{ lastResult.batchNo ? `批次 ${lastResult.batchNo}` : '未生成批次' }}</span>
      </div>
      <p class="result-line">
        已结算 <b>{{ lastResult.count }}</b> 笔（¥{{ money(lastResult.amount) }}）；
        未结算 <b>{{ lastResult.blockedCount }}</b> 笔（¥{{ money(lastResult.blockedAmount) }}）
      </p>
      <el-table v-if="lastResult.blocked?.length" :data="lastResult.blocked" border max-height="260">
        <el-table-column prop="commissionId" label="佣金 ID" width="120" />
        <el-table-column prop="orderId" label="订单" width="180" />
        <el-table-column label="订单状态" width="120">
          <template #default="{ row }">{{ row.orderStatus || '—' }}</template>
        </el-table-column>
        <el-table-column label="金额" width="110">
          <template #default="{ row }">¥{{ money(row.amount) }}</template>
        </el-table-column>
        <el-table-column prop="reason" label="为什么还没结算" />
      </el-table>
      <el-empty v-else description="本轮没有待结算佣金" :image-size="60" />
    </div>

    <div class="card">
      <div class="card-head"><h3>结算批次</h3><span class="muted">批次号不可重复，商家端可查看与自己相关的批次</span></div>
      <el-table :data="rows" border>
        <el-table-column prop="batchNo" label="批次号" width="210" />
        <el-table-column prop="channelId" label="渠道" width="180" show-overflow-tooltip />
        <el-table-column prop="commissionCount" label="笔数" width="90" />
        <el-table-column label="金额" width="120">
          <template #default="{ row }">¥{{ money(row.amount) }}</template>
        </el-table-column>
        <el-table-column prop="operator" label="操作人" width="120" />
        <el-table-column prop="createdAt" label="结算时间" />
      </el-table>
      <el-empty v-if="!rows.length" description="还没有结算批次" :image-size="70" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { platformApi } from '../api'

const rows = ref([])
const channelId = ref('')
const periodStart = ref('')
const periodEnd = ref('')
const settling = ref(false)
const lastResult = ref(null)

const totalAmount = computed(() => rows.value.reduce((sum, row) => sum + Number(row.amount || 0), 0))

onMounted(load)

async function load() {
  try {
    rows.value = (await platformApi.getSettlements()) || []
  } catch (e) {
    rows.value = []
    ElMessage.error(e?.message || '结算批次读取失败')
  }
}

async function settle() {
  settling.value = true
  try {
    const payload = {}
    if (channelId.value.trim()) payload.channelId = channelId.value.trim()
    if (periodStart.value) payload.periodStart = periodStart.value
    if (periodEnd.value) payload.periodEnd = periodEnd.value
    const res = await platformApi.settleCommissions(payload)
    lastResult.value = {
      batchNo: res?.batchNo || '',
      count: Number(res?.count || 0),
      amount: Number(res?.amount || 0),
      blockedCount: Number(res?.blockedCount || 0),
      blockedAmount: Number(res?.blockedAmount || 0),
      blocked: res?.blocked || [],
    }
    if (res?.success === false) {
      ElMessage.warning(res.message || '没有可结算佣金')
      return
    }
    ElMessage.success(res?.message || '结算完成')
    await load()
  } catch (e) {
    ElMessage.error(e?.message || '结算失败')
  } finally {
    settling.value = false
  }
}

const money = (value) => Number(value || 0).toFixed(2)
</script>

<style scoped>
.settlement-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 780px; }
.stat-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; max-width: 820px; }
.stat-card { display: flex; flex-direction: column; gap: 6px; padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.stat-card span { color: #84938a; font-size: 12px; }
.stat-card b { color: #173e2a; font-size: 22px; }
.stat-card small { color: #94a198; font-size: 12px; }
.card { padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; display: flex; flex-direction: column; gap: 10px; }
.card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.card-head h3 { margin: 0; font-size: 15px; }
.muted { color: #84938a; font-size: 12px; }
.filter-bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.note { margin: 0; color: #84938a; font-size: 12px; }
.rule { margin: 6px 0 0; color: #173e2a; font-size: 12px; line-height: 1.7; max-width: 780px; background: #f2f8f4; border-left: 3px solid #2f9e63; padding: 6px 10px; border-radius: 6px; }
.result-card { border-color: #cfe3d6; }
.result-line { margin: 0; font-size: 13px; color: #35513f; }
</style>

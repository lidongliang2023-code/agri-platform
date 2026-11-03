<template>
  <div class="reconcile-page">
    <div class="page-head">
      <div>
        <h2>分润与对账单</h2>
        <p>按账期汇总本渠道的成交、佣金与提现流水；区域独家代理分润归城市合伙人，不在本页结算。</p>
      </div>
      <el-date-picker v-model="month" type="month" value-format="YYYY-MM" placeholder="选择账期" @change="load" />
    </div>

    <div class="stat-row">
      <div class="stat-card"><span>消费者实付（GMV）</span><b>¥{{ money(summary.gmv) }}</b><small>{{ summary.orderCount || 0 }} 笔非取消订单</small></div>
      <div class="stat-card"><span>已结算佣金</span><b>¥{{ money(summary.commissionSettled) }}</b><small>批次结算入账</small></div>
      <div class="stat-card"><span>待结算佣金</span><b>¥{{ money(summary.commissionPending) }}</b><small>订单未确认 / 未结算</small></div>
      <div class="stat-card"><span>已打款提现</span><b>¥{{ money(summary.withdrawalPaid) }}</b><small>处理中 ¥{{ money(summary.withdrawalProcessing) }}</small></div>
      <div class="stat-card"><span>净收益（已结佣 - 已打款）</span><b>¥{{ money(summary.netIncome) }}</b><small>账期 {{ data.month || month }}</small></div>
    </div>

    <div class="card">
      <h3>账期流水</h3>
      <el-table :data="data.ledger || []" border size="small">
        <el-table-column prop="t" label="时间" width="180" />
        <el-table-column label="类型" width="110">
          <template #default="{ row }">{{ row.type === 'COMMISSION' ? '佣金' : '提现' }}</template>
        </el-table-column>
        <el-table-column prop="ref_no" label="关联订单" min-width="180" />
        <el-table-column prop="summary" label="摘要" min-width="160" />
        <el-table-column label="金额" width="120">
          <template #default="{ row }">
            <span :class="{ minus: Number(row.amount) < 0 }">{{ Number(row.amount) < 0 ? '-' : '+' }}¥{{ money(Math.abs(Number(row.amount))) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">{{ ledgerStatus(row.status) }}</template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!(data.ledger || []).length" description="该账期暂无流水" :image-size="70" />
    </div>

    <div class="card">
      <h3>结算批次</h3>
      <el-table :data="data.settlements || []" border size="small">
        <el-table-column prop="batch_no" label="批次号" width="200" />
        <el-table-column prop="commission_count" label="笔数" width="90" />
        <el-table-column label="金额" width="120">
          <template #default="{ row }">¥{{ money(row.amount) }}</template>
        </el-table-column>
        <el-table-column prop="operator" label="操作人" width="120" />
        <el-table-column prop="created_at" label="结算时间" />
      </el-table>
      <el-empty v-if="!(data.settlements || []).length" description="该账期没有批次结算" :image-size="70" />
      <p class="note">对账口径：GMV 取渠道订单实付；佣金按订单归属渠道统计；提现按申请时间归入账期。若需逐笔核对订单号、支付单号与售后单，请在订单详情中查看。</p>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { channelApi } from '../api'

const now = new Date()
const month = ref(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
const data = ref({})
const summary = ref({})

onMounted(load)

async function load() {
  try {
    data.value = (await channelApi.getReconcile(month.value)) || {}
    summary.value = data.value.summary || {}
  } catch (e) {
    ElMessage.error(e?.message || '对账单读取失败')
  }
}

const money = (value) => Number(value || 0).toFixed(2)
const ledgerStatus = (value) => ({
  PENDING: '待处理', SETTLED: '已结算', APPROVED: '已通过', PAID: '已打款', REJECTED: '已驳回',
}[value] || value)
</script>

<style scoped>
.reconcile-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 760px; }
.stat-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; }
.stat-card { display: flex; flex-direction: column; gap: 6px; padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.stat-card span { color: #84938a; font-size: 12px; }
.stat-card b { color: #173e2a; font-size: 22px; }
.stat-card small { color: #94a198; font-size: 12px; }
.card { padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.card h3 { margin: 0 0 12px; font-size: 15px; }
.minus { color: #c54b4b; }
.note { margin: 12px 0 0; color: #84938a; font-size: 12px; line-height: 1.7; }
@media (max-width: 1200px) { .stat-row { grid-template-columns: repeat(2, 1fr); } }
</style>

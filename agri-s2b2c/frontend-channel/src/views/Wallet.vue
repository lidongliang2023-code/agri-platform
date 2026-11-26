<template>
  <div class="wallet-page">
    <div class="page-head">
      <div>
        <h2>账户与提现</h2>
        <p>可提现余额 = 已结算佣金 −（申请中 + 已打款）。提现由平台运营审核并登记打款流水号，线下打款。</p>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat-card highlight"><span>可提现余额</span><b>¥{{ money(summary.available) }}</b><small>已结算且未申请部分</small></div>
      <div class="stat-card"><span>累计已结算</span><b>¥{{ money(summary.settledTotal) }}</b><small>批次结算入账</small></div>
      <div class="stat-card"><span>待结算佣金</span><b>¥{{ money(summary.pendingTotal) }}</b><small>订单确认收货后结算</small></div>
      <div class="stat-card"><span>提现中</span><b>¥{{ money(summary.frozenTotal) }}</b><small>待审核 / 待打款</small></div>
    </div>

    <AgriElementListTable
      :columns="columns"
      :data="filteredWithdrawals"
      row-key="id"
      :loading="loading"
      client-pagination
      column-settings-storage-key="agri-s2b2c-channel:wallet-withdrawals"
      empty-text="还没有提现记录"
      @refresh="load"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="2" :loading="loading" @search="applyFilter" @reset="resetFilter">
          <div class="agri-vue-filter-field">
            <label>提现单号 / 流水号</label>
            <el-input v-model="draft.keyword" placeholder="搜索提现单号或打款流水号" clearable @keyup.enter="applyFilter" />
          </div>
          <div class="agri-vue-filter-field">
            <label>状态</label>
            <el-select v-model="draft.status" placeholder="全部">
              <el-option label="全部" value="" />
              <el-option label="待审核" value="PENDING" />
              <el-option label="已通过待打款" value="APPROVED" />
              <el-option label="已驳回" value="REJECTED" />
              <el-option label="已打款" value="PAID" />
            </el-select>
          </div>
        </AgriVueFilterBar>
      </template>

      <template #toolbar-left>
        <el-button type="primary" @click="applyWithdraw">申请提现</el-button>
      </template>

      <template #cell-amount="{ row }">¥{{ money(row.amount) }}</template>
      <template #cell-status="{ row }">
        <el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag>
      </template>
    </AgriElementListTable>

    <div class="card">
      <h3>规则说明</h3>
      <ul class="rules">
        <li>同一渠道同时只能有一笔待审核提现；审核通过后由平台登记打款流水号。</li>
        <li>可提现余额不足或金额 ≤ 0 时提交会被拒绝。</li>
        <li>批次结算、打款流水均可在「分润与对账单」逐笔回查。</li>
        <li>线上支付/网银打款通道未接入，本系统只记录审核与打款凭证。</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { AgriElementListTable, AgriVueFilterBar } from '@agri/shared/vue/element'
import { channelApi } from '../api'

const summary = ref({})
const withdrawals = ref([])
const loading = ref(false)
const draft = reactive({ keyword: '', status: '' })
const activeFilter = reactive({ keyword: '', status: '' })

const columns = [
  { key: 'id', prop: 'id', label: '提现单号', width: 190 },
  { key: 'amount', prop: 'amount', label: '金额', width: 120 },
  { key: 'status', prop: 'status', label: '状态', width: 130 },
  { key: 'applyTime', prop: 'applyTime', label: '申请时间', width: 180 },
  { key: 'reviewer', prop: 'reviewer', label: '处理人', width: 110 },
  { key: 'payoutNo', prop: 'payoutNo', label: '打款流水号', minWidth: 170 },
  { key: 'remark', prop: 'remark', label: '审核意见', minWidth: 140 },
]

const filteredWithdrawals = computed(() => {
  const kw = activeFilter.keyword.trim().toLowerCase()
  return withdrawals.value.filter((row) => {
    if (activeFilter.status && row.status !== activeFilter.status) return false
    if (kw && !`${row.id || ''} ${row.payoutNo || ''}`.toLowerCase().includes(kw)) return false
    return true
  })
})

onMounted(load)

async function load() {
  loading.value = true
  try {
    const [sum, records] = await Promise.all([
      channelApi.getCommissionSummary(),
      channelApi.getWithdrawals(),
    ])
    summary.value = sum || {}
    withdrawals.value = records || []
  } catch (e) {
    ElMessage.error(e?.message || '提现数据读取失败')
  } finally {
    loading.value = false
  }
}

function applyFilter() {
  activeFilter.keyword = draft.keyword
  activeFilter.status = draft.status
}

function resetFilter() {
  draft.keyword = ''
  draft.status = ''
  activeFilter.keyword = ''
  activeFilter.status = ''
}

async function applyWithdraw() {
  try {
    const { value } = await ElMessageBox.prompt(
      `当前可提现 ¥${money(summary.value.available)}，请输入提现金额`,
      '申请提现',
      { inputPattern: /^\d+(\.\d{1,2})?$/, inputErrorMessage: '请输入最多两位小数的金额' },
    )
    const res = await channelApi.applyWithdrawal({ amount: Number(value) })
    if (res?.success === false) {
      ElMessage.error(res.message || '申请失败')
      return
    }
    ElMessage.success(res?.message || '提现申请已提交')
    await load()
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error(e?.message || '申请失败')
  }
}

const money = (value) => Number(value || 0).toFixed(2)
const statusText = (value) => ({
  PENDING: '待审核', APPROVED: '已通过待打款', REJECTED: '已驳回', PAID: '已打款',
}[value] || value)
const statusType = (value) => ({
  PENDING: 'warning', APPROVED: 'primary', REJECTED: 'danger', PAID: 'success',
}[value] || 'info')
</script>

<style scoped>
.wallet-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 780px; }
.stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.stat-card { display: flex; flex-direction: column; gap: 6px; padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.stat-card.highlight { background: linear-gradient(135deg, #0f6a43, #159a5e); border-color: transparent; }
.stat-card.highlight span, .stat-card.highlight small { color: rgba(255, 255, 255, 0.72); }
.stat-card.highlight b { color: #fff; }
.stat-card span { color: #84938a; font-size: 12px; }
.stat-card b { color: #173e2a; font-size: 24px; }
.stat-card small { color: #94a198; font-size: 12px; }
.card { padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.card h3 { margin: 0 0 12px; font-size: 15px; }
.rules { margin: 0; padding-left: 18px; color: #52665a; font-size: 13px; line-height: 2; }
@media (max-width: 1000px) { .stat-row { grid-template-columns: repeat(2, 1fr); } }
</style>

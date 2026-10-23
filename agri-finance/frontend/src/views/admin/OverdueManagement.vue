<template>
  <section class="finance-page">
    <header class="finance-page-heading">
      <div><small>OVERDUE MANAGEMENT</small><h1>逾期管理</h1><p>监控逾期阶段、分配催收人员并跟踪还款处置结果。</p></div>
      <div class="finance-page-heading-actions"><el-button class="finance-ghost-button" :loading="loading" @click="load">刷新</el-button></div>
    </header>

    <div class="finance-kpis">
      <article class="finance-kpi"><span>逾期笔数</span><strong>{{ records.length }}<em> 笔</em></strong><small>{{ unresolved.length }} 笔待处理</small></article>
      <article class="finance-kpi"><span>逾期总额</span><strong>{{ compactMoney(totalOverdue) }}</strong><small>本金与利息合计</small></article>
      <article class="finance-kpi"><span>中期及以上</span><strong>{{ serious.length }}<em> 笔</em></strong><small>需重点催收</small></article>
      <article class="finance-kpi"><span>平均逾期</span><strong>{{ averageDays }}<em> 天</em></strong><small>当前记录平均值</small></article>
    </div>

    <section class="finance-card">
      <div class="finance-card-head"><strong>逾期记录</strong><div class="finance-tabs"><button v-for="item in filters" :key="item.key" type="button" :class="{ on: filter === item.key }" @click="filter = item.key">{{ item.label }}</button></div></div>
      <el-table v-if="filtered.length" :data="filtered" style="width: 100%">
        <el-table-column prop="overdueNo" label="逾期编号" min-width="135" />
        <el-table-column label="借款主体" min-width="150"><template #default="{ row }"><div class="overdue-subject"><span>{{ row.userName?.slice(0, 1) }}</span><div><strong>{{ row.userName }}</strong><small>{{ row.loanNo }}</small></div></div></template></el-table-column>
        <el-table-column label="逾期金额" min-width="105" align="right"><template #default="{ row }">{{ money(row.overdueAmount) }}</template></el-table-column>
        <el-table-column label="逾期天数" width="85" align="center"><template #default="{ row }"><b :class="{ danger: row.overdueDays >= 30 }">{{ row.overdueDays }} 天</b></template></el-table-column>
        <el-table-column label="阶段" width="75"><template #default="{ row }"><span :class="['overdue-stage', row.overdueStage]">{{ row.overdueStage }}</span></template></el-table-column>
        <el-table-column prop="collectorName" label="催收负责人" min-width="95" />
        <el-table-column label="状态" width="90"><template #default="{ row }"><FinanceStatus :value="row.status" /></template></el-table-column>
        <el-table-column label="操作" width="150" align="right"><template #default="{ row }"><el-button link class="finance-link-button" @click="openAssign(row)">分配</el-button><el-button link class="finance-link-button" @click="markPaid(row)">结清</el-button></template></el-table-column>
      </el-table>
      <div v-else class="finance-empty"><strong>暂无匹配逾期记录</strong><p>逾期业务会按阶段进入催收和处置流程。</p></div>
    </section>

    <el-dialog v-model="assignOpen" title="分配催收负责人" width="min(480px, 92vw)">
      <div v-if="selected" class="assign-summary"><span>{{ selected.userName }}</span><strong>{{ money(selected.overdueAmount) }}</strong><small>逾期 {{ selected.overdueDays }} 天</small></div>
      <el-form label-position="top">
        <el-form-item label="催收人员"><el-select v-model="collector" style="width: 100%"><el-option label="王催收" value="collector-01" /><el-option label="李资产" value="collector-02" /><el-option label="陈风控" value="collector-03" /></el-select></el-form-item>
      </el-form>
      <template #footer><el-button class="finance-ghost-button" @click="assignOpen = false">取消</el-button><el-button class="finance-action-button" :loading="acting" @click="submitAssign">确认分配</el-button></template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import FinanceStatus from '@/components/FinanceStatus.vue'
import { operationsApi } from '@/api/operations'
import { compactMoney, money } from '@/api/finance'

const loading = ref(true)
const acting = ref(false)
const records = ref([])
const filter = ref('all')
const assignOpen = ref(false)
const selected = ref(null)
const collector = ref('collector-01')
const filters = [{ key: 'all', label: '全部' }, { key: 'open', label: '待处理' }, { key: 'serious', label: '中期及以上' }]
const unresolved = computed(() => records.value.filter((item) => item.status !== '已结清'))
const serious = computed(() => filteredByStage.value.filter((item) => ['中期', '后期'].includes(item.overdueStage)))
const filteredByStage = computed(() => records.value)
const totalOverdue = computed(() => records.value.reduce((total, item) => total + Number(item.overdueAmount || 0), 0))
const averageDays = computed(() => records.value.length ? (records.value.reduce((total, item) => total + Number(item.overdueDays || 0), 0) / records.value.length).toFixed(1) : '0.0')
const filtered = computed(() => {
  if (filter.value === 'open') return records.value.filter((item) => item.status !== '已结清')
  if (filter.value === 'serious') return records.value.filter((item) => ['中期', '后期'].includes(item.overdueStage))
  return records.value
})

function openAssign(row) {
  selected.value = row
  collector.value = row.collectorId || 'collector-01'
  assignOpen.value = true
}

async function submitAssign() {
  if (!selected.value || !collector.value) return
  acting.value = true
  try {
    const name = { 'collector-01': '王催收', 'collector-02': '李资产', 'collector-03': '陈风控' }[collector.value]
    await operationsApi.assignOverdue(selected.value.id, collector.value, name)
    ElMessage.success('催收负责人已分配')
    assignOpen.value = false
    await load()
  } catch (err) { ElMessage.error(err.message || '分配失败') } finally { acting.value = false }
}

async function markPaid(row) {
  await ElMessageBox.confirm(`确认逾期记录 ${row.overdueNo} 已结清？`, '确认结清', { confirmButtonText: '确认结清', cancelButtonText: '取消', type: 'info' })
  try {
    await operationsApi.markOverduePaid(row.id)
    ElMessage.success('逾期记录已结清')
    await load()
  } catch (err) { ElMessage.error(err.message || '结清失败') }
}

async function load() {
  loading.value = true
  try { records.value = (await operationsApi.overdue()) || [] } catch (err) { ElMessage.error(err.message || '逾期数据加载失败') } finally { loading.value = false }
}

onMounted(load)
</script>

<style scoped>
.finance-kpi em { color: #60776a; font-size: 10px; font-style: normal; }
.overdue-subject { display: flex; align-items: center; gap: 8px; }
.overdue-subject > span { display: grid; width: 31px; height: 31px; place-items: center; border-radius: 8px; background: #fcebea; color: #ad5148; font-size: 8px; font-weight: 700; }
.overdue-subject strong, .overdue-subject small { display: block; }
.overdue-subject strong { color: #3f5949; font-size: 9.5px; }
.overdue-subject small { margin-top: 2px; color: #8b9a92; font-family: ui-monospace, Consolas, monospace; font-size: 7px; }
.overdue-stage { padding: 3px 7px; border-radius: 7px; background: #fff2e1; color: #a96812; font-size: 7.5px; font-weight: 700; }
.overdue-stage.中期,
.overdue-stage.后期 { background: #fcebea; color: #b14d45; }
.danger { color: #b34c44; }
.assign-summary { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 9px; background: #f6faf7; }
.assign-summary span { color: #415b4a; font-size: 10px; font-weight: 650; }
.assign-summary strong { margin-left: auto; color: #d0523f; font-size: 12px; }
.assign-summary small { color: #89988f; font-size: 8px; }
</style>

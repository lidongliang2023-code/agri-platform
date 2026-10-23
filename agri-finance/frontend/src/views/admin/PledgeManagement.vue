<template>
  <section class="finance-page">
    <header class="finance-page-heading">
      <div><small>PLEDGE OPERATIONS</small><h1>质押与仓单</h1><p>审核仓单质押、监控质押价值并完成到期释放。</p></div>
      <div class="finance-page-heading-actions"><el-button class="finance-ghost-button" :loading="loading" @click="load">刷新</el-button></div>
    </header>
    <div class="finance-kpis">
      <article class="finance-kpi"><span>质押记录</span><strong>{{ pledges.length }}<em> 笔</em></strong><small>{{ active.length }} 笔已生效</small></article>
      <article class="finance-kpi"><span>质押物价值</span><strong>{{ compactMoney(totalValue) }}</strong><small>仓单申报价值</small></article>
      <article class="finance-kpi"><span>融资额度</span><strong>{{ compactMoney(totalLoan) }}</strong><small>按质押率测算</small></article>
      <article class="finance-kpi"><span>待审核</span><strong>{{ pending.length }}<em> 笔</em></strong><small>需完成仓单核验</small></article>
    </div>
    <section class="finance-card">
      <div class="finance-card-head"><strong>仓单质押列表</strong><div class="finance-tabs"><button v-for="item in filters" :key="item.key" type="button" :class="{ on: filter === item.key }" @click="filter = item.key">{{ item.label }}</button></div></div>
      <el-table :data="filtered" style="width: 100%">
        <el-table-column prop="pledgeNo" label="质押编号" min-width="135" />
        <el-table-column prop="commodityType" label="质押物" min-width="110" />
        <el-table-column label="数量/单价" min-width="115"><template #default="{ row }">{{ row.quantity }} 吨 / {{ compactMoney(row.unitPrice) }}</template></el-table-column>
        <el-table-column label="质押价值" min-width="110" align="right"><template #default="{ row }">{{ compactMoney(row.totalValue) }}</template></el-table-column>
        <el-table-column label="质押率" width="75" align="right"><template #default="{ row }">{{ row.pledgeRate }}%</template></el-table-column>
        <el-table-column label="融资金额" min-width="105" align="right"><template #default="{ row }">{{ compactMoney(row.loanAmount) }}</template></el-table-column>
        <el-table-column prop="warehouseName" label="仓库" min-width="130" />
        <el-table-column label="状态" width="90"><template #default="{ row }"><FinanceStatus :value="row.status" /></template></el-table-column>
        <el-table-column label="操作" width="135" align="right"><template #default="{ row }"><el-button v-if="row.status === '待审核'" link class="finance-link-button" @click="approve(row)">审核通过</el-button><el-button v-if="row.status === '已生效'" link class="finance-link-button" @click="release(row)">释放质押</el-button></template></el-table-column>
      </el-table>
      <div v-if="!filtered.length" class="finance-empty"><strong>暂无匹配质押记录</strong><p>新的仓单质押申请会进入运营审核列表。</p></div>
    </section>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import FinanceStatus from '@/components/FinanceStatus.vue'
import { operationsApi } from '@/api/operations'
import { compactMoney } from '@/api/finance'

const loading = ref(true)
const pledges = ref([])
const filter = ref('all')
const filters = [{ key: 'all', label: '全部' }, { key: 'pending', label: '待审核' }, { key: 'active', label: '已生效' }]
const active = computed(() => pledges.value.filter((item) => item.status === '已生效'))
const pending = computed(() => pledges.value.filter((item) => item.status === '待审核'))
const filtered = computed(() => filter.value === 'pending' ? pending.value : filter.value === 'active' ? active.value : pledges.value)
const totalValue = computed(() => pledges.value.reduce((total, item) => total + Number(item.totalValue || 0), 0))
const totalLoan = computed(() => pledges.value.reduce((total, item) => total + Number(item.loanAmount || 0), 0))

async function approve(row) {
  await ElMessageBox.confirm(`确认仓单 ${row.pledgeNo} 的质押审核通过？`, '仓单质押审核', { confirmButtonText: '审核通过', cancelButtonText: '取消', type: 'info' })
  try { await operationsApi.approvePledge(row.id); ElMessage.success('仓单质押已生效'); await load() } catch (err) { ElMessage.error(err.message || '审核失败') }
}

async function release(row) {
  await ElMessageBox.confirm(`确认释放仓单 ${row.pledgeNo} 的质押物？`, '释放质押', { confirmButtonText: '确认释放', cancelButtonText: '取消', type: 'info' })
  try { await operationsApi.releasePledge(row.id); ElMessage.success('质押物已释放'); await load() } catch (err) { ElMessage.error(err.message || '释放失败') }
}

async function load() {
  loading.value = true
  try { pledges.value = (await operationsApi.pledges()) || [] } catch (err) { ElMessage.error(err.message || '质押记录加载失败') } finally { loading.value = false }
}

onMounted(load)
</script>

<style scoped>
.finance-kpi em { color: #60776a; font-size: 10px; font-style: normal; }
</style>

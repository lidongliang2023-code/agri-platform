<template>
  <section class="finance-page">
    <header class="finance-page-heading">
      <div><small>PRODUCT CONFIGURATION</small><h1>产品配置</h1><p>维护资金方可配置的农业融资产品、利率区间、期限和质押率。</p></div>
      <div class="finance-page-heading-actions"><el-button class="finance-ghost-button" :loading="loading" @click="load">刷新</el-button></div>
    </header>

    <div class="finance-kpis">
      <article class="finance-kpi"><span>产品数量</span><strong>{{ products.length }}<em> 个</em></strong><small>已接入资金方配置</small></article>
      <article class="finance-kpi"><span>启用产品</span><strong>{{ activeCount }}<em> 个</em></strong><small>当前可申请</small></article>
      <article class="finance-kpi"><span>最低参考利率</span><strong>{{ minRate }}%</strong><small>产品配置下限</small></article>
      <article class="finance-kpi"><span>最高额度</span><strong>{{ compactMoney(maxAmount) }}</strong><small>单产品配置上限</small></article>
    </div>

    <section class="finance-card">
      <div class="finance-card-head"><strong>融资产品配置</strong><small>变更后同步融资方产品中心</small></div>
      <el-table :data="products" style="width: 100%">
        <el-table-column label="产品" min-width="180">
          <template #default="{ row }"><div class="product-name-cell"><span>{{ row.productName.slice(0, 1) }}</span><div><strong>{{ row.productName }}</strong><small>{{ row.productCode }}</small></div></div></template>
        </el-table-column>
        <el-table-column label="参考年化" width="100" align="right"><template #default="{ row }"><b class="rate-text">{{ row.rate }}%</b></template></el-table-column>
        <el-table-column label="期限" width="105" align="center"><template #default="{ row }">{{ row.termMin }}-{{ row.termMax }} 月</template></el-table-column>
        <el-table-column label="额度范围" min-width="160"><template #default="{ row }">{{ compactMoney(row.amountMin) }} - {{ compactMoney(row.amountMax) }}</template></el-table-column>
        <el-table-column label="质押率" width="80" align="right"><template #default="{ row }">{{ row.pledgeRate || 0 }}%</template></el-table-column>
        <el-table-column label="状态" width="85"><template #default="{ row }"><FinanceStatus :value="row.status === '启用' ? '正常' : row.status" :label="row.status" /></template></el-table-column>
        <el-table-column label="操作" width="155" align="right">
          <template #default="{ row }"><el-button link class="finance-link-button" @click="openEdit(row)">编辑</el-button><el-button link class="finance-link-button" @click="toggle(row)">{{ row.status === '启用' ? '停用' : '启用' }}</el-button></template>
        </el-table-column>
      </el-table>
    </section>

    <section class="finance-card">
      <div class="finance-card-head"><strong>产品上线提示</strong><small>资金方运营规范</small></div>
      <div class="product-config-notice">
        <div><b>01</b><span>产品利率和期限调整应结合资金成本、风险敞口与市场行情。</span></div>
        <div><b>02</b><span>质押类产品的质押率不超过平台风控上限，调整需经过审批。</span></div>
        <div><b>03</b><span>停用产品不会影响已发生的存量融资和还款计划。</span></div>
      </div>
    </section>

    <el-dialog v-model="editOpen" title="编辑融资产品" width="min(560px, 92vw)">
      <el-form v-if="editing" :model="editing" label-position="top">
        <div class="finance-form-grid">
          <el-form-item label="参考年化利率（%）"><el-input v-model="editing.rate" inputmode="decimal" /></el-form-item>
          <el-form-item label="质押率（%）"><el-input v-model="editing.pledgeRate" inputmode="decimal" /></el-form-item>
          <el-form-item label="最短期限（月）"><el-input-number v-model="editing.termMin" :min="1" :max="60" style="width: 100%" /></el-form-item>
          <el-form-item label="最长期限（月）"><el-input-number v-model="editing.termMax" :min="1" :max="60" style="width: 100%" /></el-form-item>
          <el-form-item label="最低额度（元）"><el-input v-model="editing.amountMin" inputmode="decimal" /></el-form-item>
          <el-form-item label="最高额度（元）"><el-input v-model="editing.amountMax" inputmode="decimal" /></el-form-item>
        </div>
        <el-form-item label="产品说明"><el-input v-model="editing.description" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer><el-button class="finance-ghost-button" @click="editOpen = false">取消</el-button><el-button class="finance-action-button" :loading="saving" @click="save">保存配置</el-button></template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import FinanceStatus from '@/components/FinanceStatus.vue'
import { operationsApi } from '@/api/operations'
import { compactMoney } from '@/api/finance'

const loading = ref(true)
const saving = ref(false)
const products = ref([])
const editOpen = ref(false)
const editing = ref(null)
const activeCount = computed(() => products.value.filter((item) => item.status === '启用').length)
const minRate = computed(() => products.value.length ? Math.min(...products.value.map((item) => Number(item.rate))) : '—')
const maxAmount = computed(() => products.value.length ? Math.max(...products.value.map((item) => Number(item.amountMax))) : 0)

function openEdit(row) {
  editing.value = { ...row, amountMin: String(row.amountMin), amountMax: String(row.amountMax) }
  editOpen.value = true
}

async function save() {
  if (!editing.value) return
  if (Number(editing.value.termMin) > Number(editing.value.termMax)) {
    ElMessage.warning('最短期限不能大于最长期限')
    return
  }
  saving.value = true
  try {
    await operationsApi.updateProductConfig(editing.value.id, {
      rate: Number(editing.value.rate),
      termMin: Number(editing.value.termMin),
      termMax: Number(editing.value.termMax),
      amountMin: Number(editing.value.amountMin),
      amountMax: Number(editing.value.amountMax),
      pledgeRate: Number(editing.value.pledgeRate || 0),
      description: editing.value.description,
      status: editing.value.status,
    })
    ElMessage.success('产品配置已保存')
    editOpen.value = false
    await load()
  } catch (err) {
    ElMessage.error(err.message || '产品配置保存失败')
  } finally {
    saving.value = false
  }
}

async function toggle(row) {
  try {
    await operationsApi.toggleProductConfig(row.id)
    ElMessage.success(`产品已${row.status === '启用' ? '停用' : '启用'}`)
    await load()
  } catch (err) {
    ElMessage.error(err.message || '产品状态更新失败')
  }
}

async function load() {
  loading.value = true
  try { products.value = (await operationsApi.productConfigs()) || [] } catch (err) { ElMessage.error(err.message || '产品配置加载失败') } finally { loading.value = false }
}

onMounted(load)
</script>

<style scoped>
.finance-kpi em { color: #60776a; font-size: 10px; font-style: normal; }
.product-name-cell { display: flex; align-items: center; gap: 9px; }
.product-name-cell > span { display: grid; width: 34px; height: 34px; place-items: center; border-radius: 9px; background: #e8f5ee; color: var(--fin-green-700); font-size: 9px; font-weight: 700; }
.product-name-cell strong, .product-name-cell small { display: block; }
.product-name-cell strong { color: #3b5545; font-size: 10px; }
.product-name-cell small { margin-top: 2px; color: #8b9a92; font-family: ui-monospace, Consolas, monospace; font-size: 7.5px; }
.rate-text { color: #d0523f; font-size: 10px; }
.product-config-notice { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; background: #edf2ee; }
.product-config-notice > div { display: flex; gap: 8px; padding: 13px 15px; background: #fff; }
.product-config-notice b { color: var(--fin-green-700); font-family: ui-monospace, Consolas, monospace; font-size: 8px; }
.product-config-notice span { color: #708479; font-size: 8.5px; line-height: 1.6; }
@media (max-width: 680px) { .product-config-notice { grid-template-columns: 1fr; } }
</style>

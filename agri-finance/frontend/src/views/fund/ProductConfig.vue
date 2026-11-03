<template>
  <section class="finance-page product-config-page">
    <header class="finance-page-heading">
      <div>
        <small>PRODUCT CONFIGURATION</small>
        <h1>产品配置</h1>
        <p>产品配置是官网门户、融资方产品中心和融资申请的唯一数据源，保存后即时联动。</p>
      </div>
      <div class="finance-page-heading-actions">
        <el-button class="finance-ghost-button" :loading="loading" @click="load">刷新</el-button>
        <el-button class="finance-action-button" @click="openCreate">新增产品</el-button>
      </div>
    </header>

    <div class="finance-kpis">
      <article class="finance-kpi"><span>产品总数</span><strong>{{ products.length }}<em> 个</em></strong><small>资金方产品配置</small></article>
      <article class="finance-kpi"><span>启用产品</span><strong>{{ activeCount }}<em> 个</em></strong><small>官网与融资方可见</small></article>
      <article class="finance-kpi"><span>最低参考利率</span><strong>{{ minRate }}%</strong><small>启用产品最低值</small></article>
      <article class="finance-kpi"><span>最高额度</span><strong>{{ compactMoney(maxAmount) }}</strong><small>单产品配置上限</small></article>
    </div>

    <section class="finance-card product-config-card">
      <div class="finance-card-head">
        <div>
          <strong>融资产品目录</strong>
          <small>停用或删除后，官网门户和融资方端不再展示</small>
        </div>
        <div class="product-config-filters">
          <el-input v-model="filters.keyword" clearable placeholder="产品名称 / 编码" style="width: 180px" />
          <el-select v-model="filters.status" style="width: 105px">
            <el-option label="全部状态" value="" />
            <el-option label="启用" value="启用" />
            <el-option label="停用" value="停用" />
          </el-select>
          <el-button @click="resetFilters">重置</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="filteredProducts" style="width: 100%" row-key="id">
        <el-table-column label="产品" min-width="180">
          <template #default="{ row }">
            <div class="product-name-cell">
              <span>{{ row.productName.slice(0, 1) }}</span>
              <div><strong>{{ row.productName }}</strong><small>{{ row.productCode }}</small></div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="参考年化" width="95" align="right">
          <template #default="{ row }"><b class="rate-text">{{ Number(row.rate).toFixed(2) }}%</b></template>
        </el-table-column>
        <el-table-column label="期限" width="105" align="center">
          <template #default="{ row }">{{ row.termMin }}-{{ row.termMax }} 月</template>
        </el-table-column>
        <el-table-column label="额度范围" min-width="170">
          <template #default="{ row }">{{ compactMoney(row.amountMin) }} - {{ compactMoney(row.amountMax) }}</template>
        </el-table-column>
        <el-table-column label="质押率" width="80" align="right">
          <template #default="{ row }">{{ Number(row.pledgeRate || 0).toFixed(0) }}%</template>
        </el-table-column>
        <el-table-column label="更新时间" width="145">
          <template #default="{ row }">{{ shortDate(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <FinanceStatus :value="row.status === '启用' ? '正常' : row.status" :label="row.status" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="190" align="right">
          <template #default="{ row }">
            <el-button link class="finance-link-button" @click="openEdit(row)">编辑</el-button>
            <el-button link class="finance-link-button" @click="toggle(row)">{{ row.status === '启用' ? '停用' : '启用' }}</el-button>
            <el-button link class="finance-link-button danger-link" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="!loading && !filteredProducts.length" class="finance-empty">
        <strong>暂无匹配产品</strong>
        <p>调整筛选条件，或新增一个融资产品。</p>
      </div>
    </section>

    <section class="finance-card">
      <div class="finance-card-head"><strong>配置生效规则</strong><small>统一产品主数据</small></div>
      <div class="product-config-notice">
        <div><b>01</b><span>产品名称、利率、期限和额度保存后，官网门户与融资方产品中心同步更新。</span></div>
        <div><b>02</b><span>启用产品才能发起融资申请，申请金额和期限必须落在配置范围内。</span></div>
        <div><b>03</b><span>停用或删除产品不会修改已提交的融资申请和历史合同。</span></div>
      </div>
    </section>

    <el-dialog
      v-model="dialogOpen"
      :title="editingId ? '编辑融资产品' : '新增融资产品'"
      width="min(680px, 94vw)"
      destroy-on-close
    >
      <el-form :model="form" label-position="top">
        <div class="finance-form-grid">
          <el-form-item label="产品编码" required>
            <el-input v-model="form.productCode" :disabled="Boolean(editingId)" placeholder="如 purchase" maxlength="64" />
          </el-form-item>
          <el-form-item label="产品名称" required>
            <el-input v-model="form.productName" placeholder="如 收购贷" maxlength="128" />
          </el-form-item>
          <el-form-item label="参考年化利率（%）" required>
            <el-input-number v-model="form.rate" :min="0" :max="100" :precision="2" style="width: 100%" />
          </el-form-item>
          <el-form-item label="质押率（%）">
            <el-input-number v-model="form.pledgeRate" :min="0" :max="100" :precision="2" style="width: 100%" />
          </el-form-item>
          <el-form-item label="最短期限（月）" required>
            <el-input-number v-model="form.termMin" :min="1" :max="120" style="width: 100%" />
          </el-form-item>
          <el-form-item label="最长期限（月）" required>
            <el-input-number v-model="form.termMax" :min="1" :max="120" style="width: 100%" />
          </el-form-item>
          <el-form-item label="最低额度（元）" required>
            <el-input-number v-model="form.amountMin" :min="1" :step="10000" style="width: 100%" />
          </el-form-item>
          <el-form-item label="最高额度（元）" required>
            <el-input-number v-model="form.amountMax" :min="1" :step="10000" style="width: 100%" />
          </el-form-item>
          <el-form-item label="产品状态">
            <el-radio-group v-model="form.status">
              <el-radio value="启用">启用</el-radio>
              <el-radio value="停用">停用</el-radio>
            </el-radio-group>
          </el-form-item>
        </div>
        <el-form-item label="产品说明">
          <el-input v-model="form.description" type="textarea" :rows="4" maxlength="1000" show-word-limit placeholder="说明适用场景、贸易背景和增信方式" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button class="finance-ghost-button" @click="dialogOpen = false">取消</el-button>
        <el-button class="finance-action-button" :loading="saving" @click="save">{{ editingId ? '保存修改' : '创建产品' }}</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import FinanceStatus from '@/components/FinanceStatus.vue'
import { operationsApi } from '@/api/operations'
import { compactMoney, shortDate } from '@/api/finance'

const loading = ref(true)
const saving = ref(false)
const products = ref([])
const dialogOpen = ref(false)
const editingId = ref('')
const filters = reactive({ keyword: '', status: '' })

const blankForm = () => ({
  productCode: '',
  productName: '',
  rate: 5.5,
  termMin: 3,
  termMax: 12,
  amountMin: 10000,
  amountMax: 1000000,
  pledgeRate: 0,
  status: '启用',
  description: '',
})
const form = reactive(blankForm())

const activeProducts = computed(() => products.value.filter((item) => item.status === '启用'))
const activeCount = computed(() => activeProducts.value.length)
const minRate = computed(() => activeProducts.value.length
  ? Math.min(...activeProducts.value.map((item) => Number(item.rate))).toFixed(2)
  : '—')
const maxAmount = computed(() => products.value.length
  ? Math.max(...products.value.map((item) => Number(item.amountMax || 0)))
  : 0)
const filteredProducts = computed(() => {
  const keyword = filters.keyword.trim().toLowerCase()
  return products.value.filter((item) => {
    const matchesKeyword = !keyword || [item.productName, item.productCode]
      .some((value) => String(value || '').toLowerCase().includes(keyword))
    return matchesKeyword && (!filters.status || item.status === filters.status)
  })
})

function resetForm() {
  Object.assign(form, blankForm())
}

function openCreate() {
  editingId.value = ''
  resetForm()
  dialogOpen.value = true
}

function openEdit(row) {
  editingId.value = row.id
  Object.assign(form, {
    productCode: row.productCode,
    productName: row.productName,
    rate: Number(row.rate),
    termMin: Number(row.termMin),
    termMax: Number(row.termMax),
    amountMin: Number(row.amountMin),
    amountMax: Number(row.amountMax),
    pledgeRate: Number(row.pledgeRate || 0),
    status: row.status,
    description: row.description || '',
  })
  dialogOpen.value = true
}

function validate() {
  if (!editingId.value && !/^[a-zA-Z0-9_-]{2,64}$/.test(form.productCode.trim())) {
    return '产品编码需为 2-64 位字母、数字、横线或下划线'
  }
  if (!form.productName.trim()) return '请填写产品名称'
  if (form.termMin > form.termMax) return '最短期限不能大于最长期限'
  if (form.amountMin > form.amountMax) return '最低额度不能大于最高额度'
  return ''
}

async function save() {
  const error = validate()
  if (error) {
    ElMessage.warning(error)
    return
  }
  saving.value = true
  try {
    const body = {
      ...form,
      productCode: form.productCode.trim().toLowerCase(),
      productName: form.productName.trim(),
      rate: Number(form.rate),
      termMin: Number(form.termMin),
      termMax: Number(form.termMax),
      amountMin: Number(form.amountMin),
      amountMax: Number(form.amountMax),
      pledgeRate: Number(form.pledgeRate || 0),
    }
    if (editingId.value) await operationsApi.updateProductConfig(editingId.value, body)
    else await operationsApi.createProductConfig(body)
    ElMessage.success(editingId.value ? '产品配置已更新' : '产品已创建')
    dialogOpen.value = false
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

async function remove(row) {
  try {
    await ElMessageBox.confirm(
      `删除「${row.productName}」后，官网和融资方端将不再展示；历史融资申请不受影响。`,
      '删除融资产品',
      { confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'warning' },
    )
    await operationsApi.deleteProductConfig(row.id)
    ElMessage.success('产品已删除')
    await load()
  } catch (err) {
    if (err !== 'cancel' && err !== 'close') ElMessage.error(err.message || '产品删除失败')
  }
}

function resetFilters() {
  filters.keyword = ''
  filters.status = ''
}

async function load() {
  loading.value = true
  try {
    products.value = (await operationsApi.productConfigs()) || []
  } catch (err) {
    ElMessage.error(err.message || '产品配置加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.finance-kpi em { color: #60776a; font-size: var(--fin-fs-xs); font-style: normal; }
.product-config-card { overflow: hidden; }
.product-config-filters { display: flex; align-items: center; gap: 7px; }
.product-name-cell { display: flex; align-items: center; gap: 9px; }
.product-name-cell > span { display: grid; width: 34px; height: 34px; place-items: center; border-radius: 9px; background: #e8f5ee; color: var(--fin-green-700); font-size: var(--fin-fs-xs); font-weight: 700; }
.product-name-cell strong, .product-name-cell small { display: block; }
.product-name-cell strong { color: #3b5545; font-size: var(--fin-fs-xs); }
.product-name-cell small { margin-top: 2px; color: #8b9a92; font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); }
.rate-text { color: #d0523f; font-size: var(--fin-fs-xs); }
.danger-link { color: #c35448; }
.product-config-notice { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; background: #edf2ee; }
.product-config-notice > div { display: flex; gap: 8px; padding: 13px 15px; background: #fff; }
.product-config-notice b { color: var(--fin-green-700); font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); }
.product-config-notice span { color: #708479; font-size: var(--fin-fs-xs); line-height: 1.6; }
@media (max-width: 680px) {
  .product-config-notice { grid-template-columns: 1fr; }
  .product-config-filters { align-items: stretch; flex-direction: column; width: 100%; }
  .product-config-filters :deep(.el-input), .product-config-filters :deep(.el-select) { width: 100% !important; }
}
</style>

<template>
  <section class="finance-page">
    <header class="finance-page-heading">
      <div>
        <small>PLEDGE GOODS DICTIONARY</small>
        <h1>质押物目录</h1>
        <p>仓单的品种、折算率上限与最长期限都由这份字典决定；停用品种后融资方就开不出该品种的仓单。</p>
      </div>
      <div class="finance-page-heading-actions">
        <el-button class="finance-ghost-button" :loading="loading" @click="load">刷新</el-button>
        <el-button class="finance-action-button" @click="openForm()">新增品种</el-button>
      </div>
    </header>

    <div class="finance-kpis">
      <article class="finance-kpi"><span>在册品种</span><strong>{{ rows.length }}<em> 个</em></strong><small>含已停用</small></article>
      <article class="finance-kpi"><span>可开仓单</span><strong>{{ enabled.length }}<em> 个</em></strong><small>状态为启用</small></article>
      <article class="finance-kpi"><span>折算率上限均值</span><strong>{{ avgRate }}<em> %</em></strong><small>启用品种口径</small></article>
      <article class="finance-kpi"><span>高波动品种</span><strong>{{ risky.length }}<em> 个</em></strong><small>价格波动阈值 ≥ 20%</small></article>
    </div>

    <section class="finance-card">
      <div class="finance-card-head">
        <strong>品种与质押参数</strong>
        <div class="finance-tabs">
          <button v-for="item in filters" :key="item.key" type="button" :class="{ on: filter === item.key }" @click="filter = item.key">{{ item.label }}</button>
        </div>
      </div>
      <el-table :data="filtered" style="width: 100%">
        <el-table-column prop="goodsCode" label="品种编码" min-width="120" />
        <el-table-column prop="goodsName" label="品种名称" min-width="110" />
        <el-table-column prop="category" label="类别" min-width="90" />
        <el-table-column label="折算率上限" width="105" align="right"><template #default="{ row }">{{ row.pledgeRateMax }}%</template></el-table-column>
        <el-table-column label="最长期限" width="100" align="right"><template #default="{ row }">{{ row.maxPledgeTerm }} 天</template></el-table-column>
        <el-table-column label="波动阈值" width="100" align="right"><template #default="{ row }">{{ row.priceVolatilityThreshold }}%</template></el-table-column>
        <el-table-column prop="priceSource" label="估值来源" min-width="170" />
        <el-table-column prop="qualityStandard" label="质量标准" min-width="100" />
        <el-table-column label="状态" width="85"><template #default="{ row }"><FinanceStatus :value="row.status" /></template></el-table-column>
        <el-table-column label="操作" width="150" align="right">
          <template #default="{ row }">
            <el-button link class="finance-link-button" @click="openForm(row)">编辑</el-button>
            <el-button v-if="row.status === '启用'" link class="finance-link-button" @click="toggle(row, false)">停用</el-button>
            <el-button v-else link class="finance-link-button" @click="toggle(row, true)">启用</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="!filtered.length" class="finance-empty"><strong>目录是空的</strong><p>没有字典就没有可用的折算率上限，融资方开不出仓单。先新增品种。</p></div>
    </section>

    <el-dialog v-model="formOpen" :title="form.id ? `编辑品种 · ${form.goodsName}` : '新增质押物品种'" width="min(600px, 92vw)">
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <div class="finance-form-grid">
          <el-form-item label="品种名称" prop="goodsName">
            <el-input v-model="form.goodsName" placeholder="例如：优质稻谷" />
          </el-form-item>
          <el-form-item label="类别">
            <el-input v-model="form.category" placeholder="例如：粮食类" />
          </el-form-item>
        </div>
        <div class="finance-form-grid">
          <el-form-item label="折算率上限（%）" prop="pledgeRateMax">
            <el-input-number v-model="form.pledgeRateMax" :min="10" :max="90" :step="5" style="width: 100%" />
          </el-form-item>
          <el-form-item label="最长质押期限（天）" prop="maxPledgeTerm">
            <el-input-number v-model="form.maxPledgeTerm" :min="7" :max="720" :step="30" style="width: 100%" />
          </el-form-item>
        </div>
        <div class="finance-form-grid">
          <el-form-item label="价格波动阈值（%）">
            <el-input-number v-model="form.priceVolatilityThreshold" :min="1" :max="60" :step="1" style="width: 100%" />
          </el-form-item>
          <el-form-item label="质量标准">
            <el-input v-model="form.qualityStandard" placeholder="例如：一等 / GB 20799" />
          </el-form-item>
        </div>
        <el-form-item label="估值来源">
          <el-input v-model="form.priceSource" placeholder="例如：全国农产品批发市场均价" />
        </el-form-item>
      </el-form>
      <p class="dict-note">编码由系统生成（PG+时间戳），仓单按编码引用；<b>折算率上限是风控口径</b>，融资方填写的折算率不能超过它。</p>
      <template #footer>
        <el-button class="finance-ghost-button" @click="formOpen = false">取消</el-button>
        <el-button class="finance-action-button" :loading="submitting" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import FinanceStatus from '@/components/FinanceStatus.vue'
import { operationsApi } from '@/api/operations'

const loading = ref(true)
const submitting = ref(false)
const formOpen = ref(false)
const formRef = ref()
const rows = ref([])
const filter = ref('all')
const filters = [{ key: 'all', label: '全部' }, { key: '启用', label: '启用' }, { key: '禁用', label: '已停用' }]
const form = reactive({
  id: '', goodsName: '', category: '', pledgeRateMax: 60, maxPledgeTerm: 90,
  priceVolatilityThreshold: 10, qualityStandard: '', priceSource: '',
})
const rules = {
  goodsName: [{ required: true, message: '请填写品种名称', trigger: 'blur' }],
  pledgeRateMax: [{ required: true, message: '请填写折算率上限', trigger: 'blur' }],
  maxPledgeTerm: [{ required: true, message: '请填写最长期限', trigger: 'blur' }],
}

const enabled = computed(() => rows.value.filter((item) => item.status === '启用'))
const risky = computed(() => enabled.value.filter((item) => Number(item.priceVolatilityThreshold) >= 20))
const avgRate = computed(() => {
  if (!enabled.value.length) return '—'
  const total = enabled.value.reduce((sum, item) => sum + Number(item.pledgeRateMax || 0), 0)
  return (total / enabled.value.length).toFixed(1)
})
const filtered = computed(() => (filter.value === 'all' ? rows.value : rows.value.filter((item) => item.status === filter.value)))

function openForm(row) {
  Object.assign(form, row
    ? {
      id: row.id, goodsName: row.goodsName, category: row.category,
      pledgeRateMax: Number(row.pledgeRateMax), maxPledgeTerm: Number(row.maxPledgeTerm),
      priceVolatilityThreshold: Number(row.priceVolatilityThreshold),
      qualityStandard: row.qualityStandard, priceSource: row.priceSource,
    }
    : {
      id: '', goodsName: '', category: '', pledgeRateMax: 60, maxPledgeTerm: 90,
      priceVolatilityThreshold: 10, qualityStandard: '', priceSource: '',
    })
  formOpen.value = true
}

async function submit() {
  await formRef.value.validate()
  submitting.value = true
  try {
    const payload = { ...form }
    const saved = form.id
      ? await operationsApi.updatePledgeGoods(payload)
      : await operationsApi.addPledgeGoods(payload)
    ElMessage.success(`品种「${saved.goodsName}」已保存，折算率上限 ${saved.pledgeRateMax}%`)
    formOpen.value = false
    await load()
  } catch (err) {
    ElMessage.error(err.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

async function toggle(row, nextEnabled) {
  const action = nextEnabled ? '启用' : '停用'
  const hint = nextEnabled
    ? `启用后融资方可以按「${row.goodsName}」开仓单。`
    : `停用后 ${row.goodsName} 不能再开新仓单；已开出的仓单与在押质押不受影响。`
  await ElMessageBox.confirm(`${hint}确认${action}？`, `质押物目录${action}`, {
    confirmButtonText: `确认${action}`, cancelButtonText: '取消', type: nextEnabled ? 'info' : 'warning',
  })
  try {
    await operationsApi.togglePledgeGoods(row.id, nextEnabled)
    ElMessage.success(`已${action}`)
    await load()
  } catch (err) {
    ElMessage.error(err.message || `${action}失败`)
  }
}

async function load() {
  loading.value = true
  try {
    rows.value = (await operationsApi.pledgeGoods()) || []
  } catch (err) {
    ElMessage.error(err.message || '质押物目录加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.finance-kpi em { color: #60776a; font-size: var(--fin-fs-xs); font-style: normal; }
.dict-note { margin: 6px 0 0; color: #8b9a91; font-size: var(--fin-fs-xs); line-height: 1.6; }
.dict-note b { color: var(--fin-green-800); }
</style>

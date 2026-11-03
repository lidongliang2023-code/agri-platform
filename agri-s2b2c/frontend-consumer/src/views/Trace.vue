<template>
  <div class="m-container" v-loading="loading">
    <!-- 顶部 -->
    <div class="m-page-hd lead">
      <h1>溯源查询</h1>
      <span class="sub">一物一码 · 批次、产地、质检报告可查</span>
      <div class="hd-actions">
        <a class="m-btn sm" :href="crossModule.production" target="_blank" rel="noopener">完整溯源链 ›</a>
      </div>
    </div>

    <!-- 查询卡 -->
    <div class="m-card m-card-pad query">
      <div class="m-row-wrap">
        <el-input
          v-model="code"
          class="code-input"
          placeholder="请输入商品包装上的溯源码（批次号）"
          clearable
          @keyup.enter="searchByCode"
        />
        <button type="button" class="m-btn primary" @click="searchByCode">查询</button>
        <span class="m-spacer" />
        <span class="muted small">溯源码印在商品包装上，由生产管理模块在采收/加工环节生成</span>
      </div>

      <div class="m-row-wrap sub-line">
        <span class="muted small">或按商品查溯源</span>
        <el-select
          v-model="productId"
          class="product-select"
          filterable
          clearable
          placeholder="选择商品查已登记批次"
          :loading="optionsLoading"
          @change="searchByProduct"
        >
          <el-option
            v-for="item in productOptions"
            :key="item.id"
            :label="item.name"
            :value="String(item.id)"
          />
        </el-select>
        <span v-if="optionsError" class="muted small">商品列表加载失败，可改用溯源码查询。</span>
        <span v-else-if="!optionsLoading && !productOptions.length" class="muted small">
          暂无可选商品（当前没有在架商品）。
        </span>
      </div>
    </div>

    <!-- 查询结果 -->
    <template v-if="searched">
      <div class="result-hd m-row-wrap">
        <h2>{{ productName || '溯源批次' }}</h2>
        <span class="m-tag">{{ rows.length }} 个批次</span>
        <span class="m-spacer" />
        <span class="muted small">{{ queryLabel }}</span>
        <button
          v-if="traceProductId"
          type="button"
          class="m-btn sm ghost"
          @click="router.push(`/product/${traceProductId}`)"
        >
          前往商品详情 ›
        </button>
      </div>

      <div v-if="rows.length" class="m-stack">
        <article v-for="row in rows" :key="row.id" class="m-card batch">
          <div class="batch-hd">
            <b>批次 {{ row.batchCode || '—' }}</b>
            <span class="m-tag">产地 {{ row.origin || '—' }}</span>
            <span class="m-spacer" />
            <a class="m-btn sm" :href="crossModule.production" target="_blank" rel="noopener">完整溯源链 ›</a>
          </div>
          <dl class="batch-grid">
            <div><dt>种植日期</dt><dd>{{ dateOnly(row.plantingDate) }}</dd></div>
            <div><dt>采收日期</dt><dd>{{ dateOnly(row.harvestDate) }}</dd></div>
            <div><dt>加工信息</dt><dd>{{ row.processingInfo || '—' }}</dd></div>
            <div><dt>储运信息</dt><dd>{{ row.storageInfo || '—' }}</dd></div>
            <div class="full"><dt>质检报告</dt><dd>{{ row.qualityReport || '—' }}</dd></div>
          </dl>
        </article>
      </div>

      <EmptyBlock v-else-if="!loading" icon="🔍" :title="emptyTitle" :desc="emptyDesc">
        <template #actions>
          <div class="m-row-wrap">
            <button type="button" class="m-btn ghost" @click="resetQuery">重新查询</button>
            <button type="button" class="m-btn" @click="router.push('/products')">去逛逛商品</button>
          </div>
        </template>
      </EmptyBlock>
    </template>

    <!-- 未查询引导 -->
    <EmptyBlock
      v-else
      icon="🌾"
      title="输入溯源码开始查询"
      desc="溯源码印在商品包装上，由生产管理模块在采收/加工环节生成，商城只做展示与查询。也可以在查询卡里选择商品，查看该商品已登记的批次。"
    >
      <template #actions>
        <button type="button" class="m-btn ghost" @click="router.push('/products')">按商品浏览</button>
      </template>
    </EmptyBlock>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { consumerApi } from '../api'
import { crossModule } from '../config/cross-module'
import { dateOnly } from '../utils/format'
import EmptyBlock from '../components/EmptyBlock.vue'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const optionsLoading = ref(false)
const optionsError = ref(false)

const code = ref('')
const productId = ref('')
const productOptions = ref([])

const searched = ref(false)
const queryMode = ref('code')
const queryLabel = ref('')
const productName = ref('')
const traceProductId = ref('')
const rows = ref([])

const emptyTitle = computed(() =>
  queryMode.value === 'code' ? '未查到该溯源码' : '该商品暂无溯源批次',
)

const emptyDesc = computed(() =>
  queryMode.value === 'code'
    ? '溯源码由生产管理模块在采收/加工环节生成，刚上市的商品可能尚未同步到商城。请核对包装上的编码是否完整，或改用商品查询已登记批次。'
    : '该商品尚未在溯源批次表中登记。批次由生产管理模块在采收/加工时写入，未登记前无法展示，商城也不会补造批次信息。',
)

async function loadOptions() {
  optionsLoading.value = true
  optionsError.value = false
  try {
    const page = await consumerApi.getProducts({ page: 1, size: 50 })
    productOptions.value = page?.records || []
  } catch {
    productOptions.value = []
    optionsError.value = true
  } finally {
    optionsLoading.value = false
  }
}

function resetQuery() {
  searched.value = false
  rows.value = []
  productName.value = ''
  traceProductId.value = ''
  queryLabel.value = ''
}

async function searchByCode() {
  const value = code.value.trim()
  if (!value) {
    ElMessage.warning('请输入溯源码')
    return
  }
  searched.value = true
  queryMode.value = 'code'
  queryLabel.value = `溯源码：${value}`
  rows.value = []
  productName.value = ''
  traceProductId.value = ''
  loading.value = true
  try {
    const list = await consumerApi.getTraceByCode(value)
    rows.value = Array.isArray(list) ? list : []
    if (rows.value.length) {
      productName.value = rows.value[0].productName || ''
      traceProductId.value = rows.value[0].productId || ''
    }
  } catch (err) {
    rows.value = []
    // 404 是「查不到该码」的正常业务结果，其余错误才提示网络异常
    if (err?.response?.status !== 404) {
      ElMessage.error(err.friendlyMessage || '溯源查询失败')
    }
  } finally {
    loading.value = false
  }
}

async function searchByProduct(value) {
  const pid = String(value ?? productId.value ?? '').trim()
  if (!pid) {
    resetQuery()
    return
  }
  searched.value = true
  queryMode.value = 'product'
  queryLabel.value = '按商品查询'
  rows.value = []
  productName.value = ''
  traceProductId.value = pid
  loading.value = true
  try {
    const list = await consumerApi.getTrace(pid)
    rows.value = Array.isArray(list) ? list : []
    const hit = productOptions.value.find((item) => String(item.id) === pid)
    if (hit) {
      productName.value = hit.name
    } else {
      // 从 /trace?productId= 直接进来时下拉里可能没有该商品，用详情接口补名称
      const detail = await consumerApi.getProductDetail(pid).catch(() => null)
      productName.value = detail?.name || ''
    }
  } catch (err) {
    rows.value = []
    ElMessage.error(err.friendlyMessage || '溯源查询失败')
  } finally {
    loading.value = false
  }
}

watch(
  () => route.query.productId,
  (next) => {
    if (!next) return
    productId.value = String(next)
    searchByProduct(next)
  },
)

onMounted(async () => {
  await loadOptions()
  const fromQuery = route.query.productId
  if (fromQuery) {
    productId.value = String(fromQuery)
    await searchByProduct(fromQuery)
  }
})
</script>

<style scoped>
.m-container {
  width: min(1280px, calc(100% - 48px));
  margin: 0 auto;
}

.lead {
  margin-top: 18px;
}

.query {
  display: grid;
  gap: 14px;
}

.code-input {
  width: 360px;
}

.sub-line {
  padding-top: 12px;
  border-top: 1px dashed #eef3ef;
}

.product-select {
  width: 320px;
}

.result-hd {
  margin: 22px 0 12px;
}

.result-hd h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
}

.batch {
  padding: 16px 20px;
}

.batch-hd {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 12px;
  border-bottom: 1px dashed #eef3ef;
}

.batch-hd b {
  font-size: 14px;
}

.batch-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 24px;
  margin: 12px 0 0;
  font-size: 12.5px;
}

.batch-grid > div {
  display: flex;
  gap: 10px;
}

.batch-grid .full {
  grid-column: 1 / -1;
}

.batch-grid dt {
  flex: 0 0 68px;
  color: #6b7c72;
}

.batch-grid dd {
  margin: 0;
  color: #33453b;
  word-break: break-all;
}

@media (max-width: 960px) {
  .code-input,
  .product-select { width: 100%; }
  .batch-grid { grid-template-columns: minmax(0, 1fr); }
}
</style>

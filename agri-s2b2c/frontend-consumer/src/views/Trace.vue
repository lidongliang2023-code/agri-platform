<template>
  <div class="m-container" v-loading="loading">
    <!-- 顶部 -->
    <div class="m-page-hd lead">
      <h1>溯源查询</h1>
      <span class="sub">一物一码 · 种植、采收、加工与质检链路可查</span>
      <div class="hd-actions">
        <span class="muted small">数据来源：生产管理模块</span>
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
        <h2>{{ productName || '溯源链路' }}</h2>
        <span class="m-tag">{{ trace.matched ? `${trace.nodeCount ?? 0} 个节点` : '无数据' }}</span>
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

      <div class="m-card">
        <TraceTimeline :trace="trace" :product-name="productName" :empty-title="emptyTitle">
          <template #actions>
            <div class="m-row-wrap">
              <button type="button" class="m-btn ghost" @click="resetQuery">重新查询</button>
              <button type="button" class="m-btn" @click="router.push('/products')">去逛逛商品</button>
            </div>
          </template>
        </TraceTimeline>
      </div>
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
import EmptyBlock from '../components/EmptyBlock.vue'
import TraceTimeline from '../components/TraceTimeline.vue'

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
const trace = ref({ bound: false, matched: false, nodes: [], codes: [] })

/**
 * 空态标题按查询方式给，不能一句话 cover 两种：
 * 扫码的人手上就捏着一支码，页面却说"该商品尚未绑定生产批次"——
 * 那是供应商侧的整改动作，不是他这次查询的结论，等于把"码不对"说成"没来历"。
 */
const emptyTitle = computed(() => (queryMode.value === 'code'
  ? '没有查到这支溯源码'
  : '该商品尚未绑定生产批次'))

/** 出参形状由后端统一（商品详情与本页共用 TraceTimeline 渲染），这里不再各拼一套字段。 */
function applyResult(payload, err) {
  if (err) {
    const status = err?.response?.status
    const body = err?.response?.data
    const notFound = status === 404 || body?.matched === false
    trace.value = {
      bound: !notFound && body?.bound === true,
      matched: false,
      nodes: [],
      codes: [],
      unavailable: status === 503 || body?.unavailable === true,
      reason: body?.message || (notFound && queryMode.value === 'code'
        ? '生产管理模块查无此溯源码（可能已作废或不是本平台生成的码）' : ''),
      message: notFound ? '' : (body?.message || `溯源查询失败（HTTP ${status ?? '无响应'}）`),
    }
    return
  }
  trace.value = { ...(payload || {}), nodes: payload?.nodes ?? [], codes: payload?.codes ?? [] }
}

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
  trace.value = { bound: false, matched: false, nodes: [], codes: [] }
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
  trace.value = { bound: false, matched: false, nodes: [], codes: [] }
  productName.value = ''
  traceProductId.value = ''
  loading.value = true
  try {
    const result = await consumerApi.getTraceByCode(value)
    applyResult(result, null)
    productName.value = result?.productName || result?.cropName || ''
  } catch (err) {
    // 404 是「查不到该码」的正常业务结果；503 是链路故障 —— 两者文案必须不同
    applyResult(null, err)
    if (err?.response?.status !== 404 && err?.response?.status !== 503) {
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
  trace.value = { bound: false, matched: false, nodes: [], codes: [] }
  productName.value = ''
  traceProductId.value = pid
  loading.value = true
  try {
    const result = await consumerApi.getTrace(pid)
    applyResult(result, null)
    const hit = productOptions.value.find((item) => String(item.id) === pid)
    if (hit) {
      productName.value = hit.name
    } else {
      // 从 /trace?productId= 直接进来时下拉里可能没有该商品，用详情接口补名称
      const detail = await consumerApi.getProductDetail(pid).catch(() => null)
      productName.value = detail?.name || result?.productName || ''
    }
  } catch (err) {
    applyResult(null, err)
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

watch(
  () => route.query.code,
  (next) => {
    if (!next) return
    code.value = String(next)
    searchByCode()
  },
)

onMounted(async () => {
  await loadOptions()
  const fromQuery = route.query.productId
  if (fromQuery) {
    productId.value = String(fromQuery)
    await searchByProduct(fromQuery)
    return
  }
  /*
   * 包装上印的码扫出来就是一串 `?code=AG…`：访客不会、也不该再点一次"查询"。
   * 这一条是"一物一码"能不能真正被消费者用到的分界——深链不自动查，
   * 页面就停在"输入溯源码开始查询"的空态上，等于把核验动作退回给手工输入。
   */
  const fromCode = route.query.code
  if (fromCode) {
    code.value = String(fromCode)
    await searchByCode()
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

@media (max-width: 960px) {
  .code-input,
  .product-select { width: 100%; }
}
</style>

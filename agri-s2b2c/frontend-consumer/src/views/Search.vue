<template>
  <div class="m-container" v-loading="loading">
    <!-- 搜索框 -->
    <div class="m-page-hd lead">
      <h1>商品搜索</h1>
      <span class="sub">按商品名称与关键词检索在架商品</span>
      <div class="hd-actions">
        <button type="button" class="m-btn sm" @click="router.push('/category')">去分类逛逛 ›</button>
      </div>
    </div>

    <div class="m-card m-card-pad search-card">
      <div class="m-row-wrap">
        <el-input
          v-model="keyword"
          class="search-input"
          placeholder="输入商品名称，如「赣南脐橙」"
          clearable
          @keyup.enter="submit(keyword)"
        />
        <button type="button" class="m-btn primary" @click="submit(keyword)">搜索</button>
      </div>

      <!-- 搜索历史：只存在本机浏览器 -->
      <div class="m-row-wrap block">
        <span class="muted small">搜索历史</span>
        <template v-if="history.length">
          <button
            v-for="word in history"
            :key="`h-${word}`"
            type="button"
            class="m-tag plain chip"
            @click="submit(word)"
          >
            {{ word }}
          </button>
          <button type="button" class="m-btn text" @click="clearHistory">清空</button>
        </template>
        <span v-else class="muted small">暂无搜索记录</span>
        <span class="m-spacer" />
        <span class="muted small">历史仅保存在本机浏览器（localStorage），换设备不会同步</span>
      </div>

      <!-- 推荐词：取真实分类名 -->
      <div v-if="hotWords.length" class="m-row-wrap block">
        <span class="muted small">热门分类</span>
        <button
          v-for="word in hotWords"
          :key="`w-${word}`"
          type="button"
          class="m-tag chip"
          @click="submit(word)"
        >
          {{ word }}
        </button>
      </div>
    </div>

    <!-- 搜索结果 -->
    <template v-if="searched">
      <div class="result-hd m-row">
        <h2 class="result-title">
          关键词「{{ activeKeyword }}」<span class="muted small">共 {{ total }} 件</span>
        </h2>
        <span class="m-spacer" />
        <span class="muted small">第 {{ page }} 页</span>
      </div>

      <div v-if="products.length" class="m-grid m-grid-4">
        <ProductCard
          v-for="p in products"
          :key="p.id"
          :product="p"
          :favorited="favorites.has(p.id)"
          @favorite="favorites.toggle(p.id)"
          @add="addToCart(p)"
        />
      </div>

      <EmptyBlock
        v-else-if="!loading"
        icon="🔍"
        title="没有找到相关商品"
        desc="换个词试试，或去分类里浏览。检索范围只包含供应商已上架、平台审核通过的在架商品，下架商品不会出现在结果里。"
      >
        <template #actions>
          <div class="m-row-wrap">
            <button type="button" class="m-btn primary" @click="router.push('/category')">去分类逛逛</button>
            <button type="button" class="m-btn" @click="submit('')">清空关键词</button>
          </div>
        </template>
      </EmptyBlock>

      <el-pagination
        v-if="total > size"
        class="pager"
        background
        layout="prev, pager, next, jumper, total"
        :total="total"
        :page-size="size"
        :current-page="page"
        @current-change="changePage"
      />
    </template>

    <!-- 未搜索时的引导态 -->
    <EmptyBlock
      v-else
      icon="🔍"
      title="输入关键词开始搜索"
      desc="搜索只检索平台在架商品；也可以从上方热门分类直接进入，或到分类页按一级/二级分类浏览。"
    >
      <template #actions>
        <button type="button" class="m-btn ghost" @click="router.push('/category')">按分类浏览</button>
      </template>
    </EmptyBlock>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { consumerApi } from '../api'
import { useUserStore } from '../stores/user'
import { useFavorites } from '../composables/useFavorites'
import ProductCard from '../components/ProductCard.vue'
import EmptyBlock from '../components/EmptyBlock.vue'

const HISTORY_KEY = 'mall_search_history'
const HISTORY_MAX = 8

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const favorites = useFavorites()

const size = 12
const loading = ref(false)
const keyword = ref('')
const activeKeyword = ref('')
const history = ref([])
const products = ref([])
const total = ref(0)
const page = ref(1)
const searched = ref(false)

/** 推荐词只用真实一级分类名，不编造热词。 */
const hotWords = computed(() =>
  (userStore.categories || []).slice(0, 8).map((cat) => cat.name).filter(Boolean),
)

function readHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const list = raw ? JSON.parse(raw) : []
    history.value = Array.isArray(list) ? list.filter((item) => typeof item === 'string').slice(0, HISTORY_MAX) : []
  } catch {
    history.value = []
  }
}

function pushHistory(word) {
  const text = String(word || '').trim()
  if (!text) return
  const next = [text, ...history.value.filter((item) => item !== text)].slice(0, HISTORY_MAX)
  history.value = next
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  } catch {
    // 隐私模式下写不进去，界面仍按内存里的记录展示
  }
}

function clearHistory() {
  history.value = []
  try {
    localStorage.removeItem(HISTORY_KEY)
  } catch {
    // 忽略：清不掉也不影响本次会话
  }
  ElMessage.success('已清空本机搜索历史')
}

async function load() {
  const q = String(route.query.q || '').trim()
  activeKeyword.value = q
  // 地址栏是唯一来源：前进/后退时同步回输入框
  if (keyword.value.trim() !== q) keyword.value = q
  page.value = Math.max(1, Number(route.query.page) || 1)
  if (!q) {
    searched.value = false
    products.value = []
    total.value = 0
    return
  }
  searched.value = true
  loading.value = true
  try {
    const res = await consumerApi.getProducts({ keyword: q, page: page.value, size })
    products.value = res?.records || []
    total.value = Number(res?.total || 0)
    pushHistory(q)
  } catch (err) {
    products.value = []
    total.value = 0
    ElMessage.error(err.friendlyMessage || '搜索失败')
  } finally {
    loading.value = false
  }
}

/** 更新地址栏 query，实际取数交给 route 监听，避免一次操作发两次请求。 */
function submit(word) {
  const q = String(word ?? keyword.value).trim()
  keyword.value = q
  if (!q) {
    router.push({ path: '/search' })
    return
  }
  if (q === activeKeyword.value && page.value === 1) {
    load()
    return
  }
  router.push({ path: '/search', query: { q } })
}

function changePage(next) {
  router.push({ path: '/search', query: { ...route.query, q: activeKeyword.value, page: String(next) } })
}

async function addToCart(product) {
  if (!userStore.consumerId) {
    ElMessage.warning('请先完成登录')
    return
  }
  try {
    const res = await consumerApi.addCart({
      consumerId: userStore.consumerId,
      productId: product.id,
      quantity: 1,
    })
    if (res?.success === false) {
      ElMessage.warning(res.message || '加入购物车失败')
      return
    }
    await userStore.refreshCart()
    ElMessage.success('已加入购物车')
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '加入购物车失败')
  }
}

watch(() => route.fullPath, load)

onMounted(async () => {
  readHistory()
  keyword.value = String(route.query.q || '')
  await userStore.loadCategories()
  await favorites.load()
  load()
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

.search-card {
  display: grid;
  gap: 14px;
}

.search-input {
  width: 420px;
}

.block {
  padding-top: 12px;
  border-top: 1px dashed #eef3ef;
}

.chip {
  height: 26px;
  padding: 0 10px;
  cursor: pointer;
}

.result-hd {
  margin: 22px 0 12px;
}

.result-title {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
}

.result-title .small {
  margin-left: 8px;
  font-weight: 500;
}

.pager {
  margin-top: 18px;
}

@media (max-width: 960px) {
  .search-input { width: 100%; }
}
</style>

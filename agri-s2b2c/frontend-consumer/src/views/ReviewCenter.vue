<template>
  <div class="m-container" v-loading="loading">
    <!-- 页头 -->
    <div class="m-page-hd">
      <h1>评价中心</h1>
      <span class="sub">只有「已完成」订单里的商品可以评价，同一订单同一商品只能评价一次（后端唯一键约束）</span>
      <div class="hd-actions">
        <button type="button" class="m-btn sm" @click="load">刷新</button>
      </div>
    </div>

    <!-- 未登录 -->
    <EmptyBlock
      v-if="userStore.booted && !consumerId"
      icon="🔐"
      title="登录后查看评价"
      desc="评价与订单都挂在消费者账号下。当前浏览器没有检测到已登录的统一身份，请从统一门户登录后再进入商城。"
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="router.push('/')">返回首页</button>
      </template>
    </EmptyBlock>

    <template v-else>
      <!-- 统计 + tab -->
      <div class="m-card tabs">
        <button
          v-for="tab in TABS"
          :key="tab.value"
          type="button"
          class="seg"
          :class="{ on: activeTab === tab.value }"
          @click="activeTab = tab.value"
        >
          {{ tab.label }}
          <span class="seg-num num">{{ tab.value === 'PENDING' ? pendingRows.length : myReviews.length }}</span>
        </button>
        <span class="m-spacer" />
        <span class="muted small stat-line">
          待评价 <b class="num">{{ pendingRows.length }}</b> / 已评价 <b class="num">{{ myReviews.length }}</b>
        </span>
      </div>

      <!-- 待评价 -->
      <template v-if="activeTab === 'PENDING'">
        <div v-if="pendingRows.length" class="m-stack">
          <article v-for="row in pendingRows" :key="row.key" class="m-card pending-card">
            <div class="thumb" @click="openProduct(row.productId)">
              <img
                v-if="row.image && !brokenIds.has(row.key)"
                :src="row.image"
                :alt="row.name"
                loading="lazy"
                @error="markBroken(row.key)"
              />
              <span v-else class="ph">🌿</span>
            </div>

            <div class="p-info">
              <div class="p-name" :title="row.name" @click="openProduct(row.productId)">{{ row.name || '商品已删除' }}</div>
              <div class="muted small">
                <span v-if="row.spec">规格 {{ row.spec }} · </span>
                数量 {{ row.quantity }}
              </div>
              <div class="muted small num">
                订单 {{ row.orderNo || row.orderId }} · 下单 {{ dateTime(row.orderTime) }}
              </div>
            </div>

            <div class="p-act">
              <span class="m-tag amber">待评价</span>
              <button type="button" class="m-btn sm primary" @click="goWrite(row)">开始评价</button>
            </div>
          </article>
        </div>

        <EmptyBlock
          v-else-if="!loading"
          icon="✍️"
          title="没有待评价的商品"
          desc="确认收货后的订单才会出现在待评价；已经评价过的商品会移到「已评价」。当前账号没有待评价内容，去订单里确认收货后再来看。"
        >
          <template #actions>
            <div class="m-row-wrap">
              <button type="button" class="m-btn primary" @click="router.push('/orders')">去我的订单</button>
              <button type="button" class="m-btn" @click="activeTab = 'DONE'">查看已评价</button>
            </div>
          </template>
        </EmptyBlock>
      </template>

      <!-- 已评价 -->
      <template v-else>
        <div v-if="myReviews.length" class="m-stack">
          <article
            v-for="review in myReviews"
            :key="review.id"
            class="m-card done-card"
            @click="router.push(`/review/${review.id}`)"
          >
            <div class="d-hd">
              <b class="d-name">{{ review.productName || '商品已删除' }}</b>
              <el-rate :model-value="Number(review.rating || 0)" disabled size="small" />
              <span v-if="review.anonymous" class="m-tag plain">匿名</span>
              <span class="m-spacer" />
              <span class="muted small num">{{ dateTime(review.createTime) }}</span>
            </div>

            <p class="d-content">{{ review.content || '未填写评价内容' }}</p>

            <div v-if="splitTags(review.tags).length" class="m-row-wrap">
              <span v-for="tag in splitTags(review.tags)" :key="tag" class="m-tag plain">{{ tag }}</span>
            </div>

            <div v-if="review.reply" class="d-reply">商家回复：{{ review.reply }}</div>

            <div class="d-ft">
              <span class="muted small num">订单 {{ review.orderId }}</span>
              <span class="m-spacer" />
              <span class="muted small">查看详情 ›</span>
            </div>
          </article>
        </div>

        <EmptyBlock
          v-else-if="!loading"
          icon="💬"
          title="还没有发表过评价"
          desc="评价由你在订单完成后主动发表，平台不会代写。当前账号还没有评价记录，去「待评价」里挑一件商品写第一条吧。"
        >
          <template #actions>
            <button type="button" class="m-btn primary" @click="activeTab = 'PENDING'">去写评价</button>
          </template>
        </EmptyBlock>
      </template>

      <p class="note muted small">
        待评价基于最近 {{ PAGE_SIZE }} 笔已完成订单计算（订单接口按时间倒序返回）；后端未返回订单完成时间，这里显示下单时间。
      </p>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { consumerApi } from '../api'
import { useUserStore } from '../stores/user'
import { dateTime } from '../utils/format'
import EmptyBlock from '../components/EmptyBlock.vue'

const router = useRouter()
const userStore = useUserStore()

const TABS = [
  { label: '待评价', value: 'PENDING' },
  { label: '已评价', value: 'DONE' },
]

/** 待评价只看最近 50 笔已完成订单，够覆盖日常补评价的场景。 */
const PAGE_SIZE = 50

const loading = ref(false)
const activeTab = ref('PENDING')
const orders = ref([])
const myReviews = ref([])
const brokenIds = ref(new Set())

const consumerId = computed(() => userStore.consumerId)

/** 已评价组合键：orderId + productId，与后端 uk_review 唯一键一致。 */
const reviewedKeys = computed(
  () => new Set(myReviews.value.map((row) => `${row.orderId}-${row.productId}`)),
)

/** 待评价 = 已完成订单的商品行 − 已有评价的组合。 */
const pendingRows = computed(() => {
  const rows = []
  // 同一订单同一商品只允许评价一次（后端 uk_review），重复明细只保留第一行
  const seen = new Set()
  for (const order of orders.value) {
    for (const item of order.items || []) {
      if (!item.productId) continue
      const key = `${order.id}-${item.productId}`
      if (reviewedKeys.value.has(key) || seen.has(key)) continue
      seen.add(key)
      rows.push({
        // 同一订单里可能有多行商品明细（不同规格），用 orderItemId 保证 key 唯一
        key: `${order.id}-${item.id || item.productId}`,
        orderId: order.id,
        orderNo: order.orderNo,
        orderTime: order.createTime,
        orderItemId: item.id,
        productId: item.productId,
        name: item.name,
        image: item.image,
        spec: item.spec,
        quantity: item.quantity,
      })
    }
  }
  return rows
})

function splitTags(tags) {
  if (!tags) return []
  if (Array.isArray(tags)) return tags.filter(Boolean)
  return String(tags)
    .split(/[,，、]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function markBroken(key) {
  brokenIds.value = new Set([...brokenIds.value, key])
}

function openProduct(productId) {
  if (!productId) return
  router.push(`/product/${productId}`)
}

function goWrite(row) {
  router.push({
    path: '/review/write',
    query: {
      orderId: row.orderId,
      productId: row.productId,
      orderItemId: row.orderItemId || '',
    },
  })
}

async function load() {
  if (!consumerId.value) {
    orders.value = []
    myReviews.value = []
    return
  }
  loading.value = true
  try {
    const [orderPage, reviews] = await Promise.all([
      consumerApi.getOrders({ consumerId: consumerId.value, status: 'COMPLETED', page: 1, size: PAGE_SIZE }),
      consumerApi.getMyReviews(consumerId.value).catch(() => []),
    ])
    orders.value = orderPage?.records || []
    myReviews.value = reviews || []
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '评价数据加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)

// 统一身份异步换回消费者 ID：拿到后再查订单与评价
watch(
  () => consumerId.value,
  (id) => {
    if (id) load()
  },
)
</script>

<style scoped>
.m-container {
  width: min(1280px, calc(100% - 48px));
  margin: 18px auto 0;
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 16px;
  padding: 8px 12px 8px 8px;
}

.seg {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 16px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #4b5d53;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background .15s, color .15s, box-shadow .15s;
}

.seg:hover {
  background: #f1fbf5;
  color: #12764a;
}

.seg.on {
  background: linear-gradient(135deg, #12764a, #159a5e);
  color: #fff;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(18, 118, 74, .18);
}

.seg-num {
  padding: 0 6px;
  border-radius: 8px;
  background: rgba(11, 26, 18, .06);
  font-size: var(--agri-font-size-micro);
  font-weight: 700;
}

.seg.on .seg-num {
  background: rgba(255, 255, 255, .24);
}

.stat-line b {
  color: #0b1a12;
}

.pending-card {
  display: grid;
  grid-template-columns: 68px minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
}

.thumb {
  display: grid;
  place-items: center;
  overflow: hidden;
  width: 68px;
  height: 68px;
  border-radius: 8px;
  background: linear-gradient(135deg, #eef7f1, #e2f0e7);
  cursor: pointer;
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb .ph {
  color: rgba(18, 118, 74, .3);
  font-size: 22px;
}

.p-info {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.p-name {
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
  cursor: pointer;
}

.p-name:hover {
  color: #12764a;
}

.p-act {
  display: flex;
  align-items: center;
  gap: 10px;
}

.done-card {
  display: grid;
  gap: 8px;
  padding: 14px 18px;
  cursor: pointer;
  transition: border-color .15s, box-shadow .15s;
}

.done-card:hover {
  border-color: #d4e7db;
  box-shadow: 0 8px 22px rgba(4, 31, 20, .05);
}

.d-hd {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.d-name {
  font-size: 14px;
  font-weight: 700;
}

.d-content {
  margin: 0;
  color: #33453b;
  font-size: 13px;
  line-height: 1.8;
}

.d-reply {
  padding: 8px 12px;
  border-radius: 8px;
  background: #f8fbf9;
  color: #6b7c72;
  font-size: 12.5px;
}

.d-ft {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px dashed #eef3ef;
}

.note {
  margin: 16px 0 0;
  line-height: 1.8;
}
</style>

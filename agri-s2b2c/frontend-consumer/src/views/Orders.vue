<template>
  <div class="m-container" style="margin-top: 18px" v-loading="loading">
    <!-- 页头 -->
    <div class="m-page-hd">
      <h1>我的订单</h1>
      <span class="sub">下单后按供应商拆单发货，物流与售后都可以从这里进入</span>
      <div class="hd-actions">
        <button type="button" class="m-btn sm" @click="load()">刷新</button>
      </div>
    </div>

    <!-- 未登录 -->
    <EmptyBlock
      v-if="userStore.booted && !userStore.consumerId"
      icon="🔐"
      title="登录后查看订单"
      desc="订单按消费者账号存储。当前浏览器没有检测到已登录的统一身份，请从统一门户登录后再进入商城。"
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="router.push('/')">返回首页</button>
      </template>
    </EmptyBlock>

    <template v-else>
      <!-- 状态筛选 -->
      <div class="m-card tabs">
        <button
          v-for="tab in TABS"
          :key="tab.value || 'all'"
          type="button"
          class="seg"
          :class="{ on: status === tab.value }"
          @click="switchTab(tab.value)"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- 订单列表 -->
      <div v-if="orders.length" class="m-stack">
        <article v-for="order in orders" :key="order.id" class="m-card order-card">
          <header class="oc-hd">
            <span class="muted small">订单号</span>
            <b class="num order-no">{{ order.orderNo || '—' }}</b>
            <span class="muted small">{{ dateTime(order.createTime) }}</span>
            <span class="m-spacer" />
            <span v-if="order.groupBuyId" class="m-tag amber">拼团</span>
            <span class="m-tag" :class="statusClass(order.status)">{{ statusText(order) }}</span>
          </header>

          <div class="oc-items">
            <div v-for="item in order.items || []" :key="item.id" class="oc-item">
              <div class="thumb" @click="goDetail(order.id)">
                <img
                  v-if="usableImage(item.image) && !isBroken(item)"
                  :src="usableImage(item.image)"
                  :alt="item.name"
                  @error="markBroken(item)"
                />
                <span v-else class="ph">🌿</span>
              </div>
              <div class="oc-info">
                <div class="oc-name" :title="item.name" @click="goDetail(order.id)">{{ item.name }}</div>
                <span class="muted small">{{ item.spec || '规格以商品详情为准' }}</span>
              </div>
              <span class="muted small num oc-unit">¥{{ money(item.price) }} × {{ item.quantity }}</span>
              <span class="oc-sub num">¥{{ money(item.totalAmount) }}</span>
            </div>
            <p v-if="!(order.items || []).length" class="muted small">该订单没有返回商品明细。</p>
          </div>

          <footer class="oc-ft">
            <span class="muted small">共 <b class="num">{{ totalQuantity(order) }}</b> 件</span>
            <span class="m-spacer" />
            <span class="muted small">实付</span>
            <span class="price"><span class="cur">¥</span>{{ money(order.payAmount) }}</span>
            <div class="oc-acts">
              <template v-if="order.status === 'PENDING_PAY'">
                <button type="button" class="m-btn sm" :disabled="busyId === order.id" @click="cancel(order)">
                  取消订单
                </button>
                <button type="button" class="m-btn sm primary" :disabled="busyId === order.id" @click="goPay(order)">
                  立即付款
                </button>
              </template>

              <template v-else-if="order.status === 'PENDING_SHIP'">
                <button type="button" class="m-btn sm" @click="goDetail(order.id)">查看详情</button>
                <button type="button" class="m-btn sm ghost" @click="serviceVisible = true">联系客服</button>
              </template>

              <template v-else-if="isShipped(order)">
                <button type="button" class="m-btn sm" @click="router.push(`/logistics/${order.id}`)">查看物流</button>
                <button type="button" class="m-btn sm primary" :disabled="busyId === order.id" @click="receive(order)">
                  确认收货
                </button>
              </template>

              <template v-else-if="order.status === 'COMPLETED'">
                <button type="button" class="m-btn sm" @click="router.push('/reviews')">去评价</button>
                <button type="button" class="m-btn sm primary" :disabled="busyId === order.id" @click="buyAgain(order)">
                  再次购买
                </button>
              </template>

              <template v-else-if="order.status === 'CANCELLED'">
                <button type="button" class="m-btn sm primary" :disabled="busyId === order.id" @click="buyAgain(order)">
                  重新购买
                </button>
              </template>

              <button v-else type="button" class="m-btn sm" @click="goDetail(order.id)">查看详情</button>
            </div>
          </footer>
        </article>
      </div>

      <!-- 空态 -->
      <EmptyBlock v-else-if="userStore.booted && !loading" icon="🧾" :title="emptyTitle" :desc="emptyDesc">
        <template #actions>
          <button type="button" class="m-btn primary" @click="router.push('/products')">去逛逛</button>
          <button v-if="status" type="button" class="m-btn" @click="switchTab('')">查看全部订单</button>
        </template>
      </EmptyBlock>

      <el-pagination
        v-if="total > size"
        v-model:current-page="page"
        :page-size="size"
        :total="total"
        layout="prev, pager, next, total"
        @current-change="load"
      />
    </template>

    <!-- 客服说明（催发货/配送问题后端暂无接口，只给可落地的联系方式） -->
    <el-dialog v-model="serviceVisible" title="联系客服" width="440px">
      <p class="svc-line">配送、催发货等问题可直接联系平台客服：</p>
      <p class="svc-phone num">400-800-0000</p>
      <p class="muted small">
        客服工作时间 9:00–18:00。联系时报上订单号，客服可以更快定位到供应商与发货批次。
      </p>
      <template #footer>
        <button type="button" class="m-btn" @click="serviceVisible = false">知道了</button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { consumerApi } from '../api'
import { useUserStore } from '../stores/user'
import { dateTime, money, orderStatusText, usableImage } from '../utils/format'
import EmptyBlock from '../components/EmptyBlock.vue'

const router = useRouter()
const userStore = useUserStore()

const TABS = [
  { label: '全部', value: '' },
  { label: '待付款', value: 'PENDING_PAY' },
  { label: '待发货', value: 'PENDING_SHIP' },
  { label: '已发货', value: 'SHIPPED' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '已取消', value: 'CANCELLED' },
]

const size = 5
const loading = ref(false)
const orders = ref([])
const total = ref(0)
const page = ref(1)
const status = ref('')
const busyId = ref(null)
const serviceVisible = ref(false)
const brokenIds = ref(new Set())

const emptyTitle = computed(() => {
  const tab = TABS.find((item) => item.value === status.value)
  return status.value ? `暂无${tab?.label || ''}订单` : '还没有订单'
})

const emptyDesc = computed(() =>
  status.value
    ? '当前筛选状态下没有订单。订单由结算下单后生成，切换状态或去商品列表挑选产地直供好货后再回来看看。'
    : '订单在结算下单后生成，按供应商拆单存储。当前账号还没有订单记录，去挑几件产地直供好货吧。',
)

/** 状态标签配色：待付款=琥珀、待发货=品牌绿、已发货=蓝、已取消=灰、退款中=红。 */
function statusClass(value) {
  if (value === 'PENDING_PAY') return 'amber'
  if (value === 'SHIPPED' || value === 'PENDING_RECEIVE') return 'blue'
  if (value === 'CANCELLED') return 'plain'
  if (value === 'REFUNDING' || value === 'REFUNDED') return 'red'
  return ''
}

function statusText(order) {
  return orderStatusText(order.status, order.statusText)
}

function isShipped(order) {
  return order.status === 'SHIPPED' || order.status === 'PENDING_RECEIVE'
}

function totalQuantity(order) {
  return (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)
}

function isBroken(item) {
  return brokenIds.value.has(String(item.id))
}

function markBroken(item) {
  brokenIds.value = new Set([...brokenIds.value, String(item.id)])
}

/** 订单列表：写操作后统一回到这里复核，避免"点了没反应"的假成功。 */
async function load() {
  if (!userStore.consumerId) {
    orders.value = []
    total.value = 0
    return
  }
  loading.value = true
  try {
    const res = await consumerApi.getOrders({
      consumerId: userStore.consumerId,
      page: page.value,
      size,
      status: status.value || undefined,
    })
    orders.value = res?.records || []
    total.value = Number(res?.total || 0)
    // 取消/确认收货后当前页可能被清空，回退到第一页再取一次
    if (!orders.value.length && page.value > 1) {
      page.value = 1
      loading.value = false
      await load()
    }
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '订单加载失败')
  } finally {
    loading.value = false
  }
}

function switchTab(value) {
  status.value = value
  page.value = 1
  load()
}

function goDetail(id) {
  router.push(`/order/${id}`)
}

function goPay(order) {
  router.push(`/pay/${order.id}`)
}

/** 列表刷新后订单可能已离开当前筛选页，取不到时回读一次详情，避免误判「未生效」。 */
async function freshStatus(orderId) {
  const row = orders.value.find((item) => String(item.id) === String(orderId))
  if (row) return row.status
  const detail = await consumerApi.getOrderDetail(orderId).catch(() => null)
  return detail?.status || ''
}

async function cancel(order) {
  try {
    await ElMessageBox.confirm(
      `确认取消订单「${order.orderNo || order.id}」？取消后订单不可恢复，需要重新下单。`,
      '取消订单',
      { confirmButtonText: '确认取消', cancelButtonText: '再想想', type: 'warning' },
    )
  } catch {
    return
  }
  busyId.value = order.id
  try {
    const res = await consumerApi.cancelOrder(order.id)
    if (res?.success === false) {
      ElMessage.error(res.message || '取消失败')
      await load()
      return
    }
    await load()
    if ((await freshStatus(order.id)) === 'CANCELLED') {
      ElMessage.success('订单已取消')
    } else {
      ElMessage.error('取消状态未生效，请刷新后重试')
    }
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '取消订单失败')
    await load()
  } finally {
    busyId.value = null
  }
}

async function receive(order) {
  try {
    await ElMessageBox.confirm(
      `确认已收到订单「${order.orderNo || order.id}」的商品？确认后订单将变为已完成，可对商品发表评价。`,
      '确认收货',
      { confirmButtonText: '确认收货', cancelButtonText: '再等等', type: 'warning' },
    )
  } catch {
    return
  }
  busyId.value = order.id
  try {
    const res = await consumerApi.receiveOrder(order.id)
    if (res?.success === false) {
      ElMessage.error(res.message || '确认收货失败')
      await load()
      return
    }
    await load()
    if ((await freshStatus(order.id)) === 'COMPLETED') {
      ElMessage.success('已确认收货')
    } else {
      ElMessage.error('收货状态未更新，请刷新后重试')
    }
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '确认收货失败')
    await load()
  } finally {
    busyId.value = null
  }
}

/** 再次购买：逐条加回购物车，回读购物车确认后跳转，不直接下单。 */
async function buyAgain(order) {
  const items = order.items || []
  if (!items.length) {
    ElMessage.warning('该订单没有可购买的商品明细')
    return
  }
  busyId.value = order.id
  try {
    const failed = []
    for (const item of items) {
      const res = await consumerApi
        .addCart({
          consumerId: userStore.consumerId,
          productId: item.productId,
          quantity: Number(item.quantity || 1),
        })
        .catch(() => null)
      if (!res || res.success === false) failed.push(item.name)
    }

    const lines = await consumerApi.getCart(userStore.consumerId).catch(() => null)
    await userStore.refreshCart()
    if (!lines) {
      ElMessage.error('购物车回读失败，请稍后在购物车确认')
      return
    }
    if (failed.length === items.length) {
      ElMessage.error('商品已下架或库存不足，未能加入购物车')
      return
    }
    if (failed.length) {
      ElMessage.warning(`${failed.length} 件商品未能加入购物车（可能已下架），其余已加入`)
    } else {
      ElMessage.success('已加入购物车')
    }
    router.push('/cart')
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '加入购物车失败')
  } finally {
    busyId.value = null
  }
}

// consumerId 由统一身份异步换回：拿到消费者 ID 后再查订单，避免直接进入本页时误判「未登录」
watch(
  () => userStore.consumerId,
  (id) => {
    if (id) load()
  },
  { immediate: true },
)
</script>

<style scoped>
.m-container {
  width: min(1280px, calc(100% - 48px));
  margin-left: auto;
  margin-right: auto;
}

/* 状态筛选：卡片内自绘 pill，避免 el-tabs 的默认大改样式 */
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
  padding: 8px;
}

.seg {
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

.order-card {
  overflow: hidden;
  transition: border-color .15s, box-shadow .15s;
}

.order-card:hover {
  border-color: #d4e7db;
  box-shadow: 0 8px 24px rgba(4, 31, 20, .05);
}

.oc-hd {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  border-bottom: 1px solid #eef3ef;
  background: #fbfdfc;
}

.order-no {
  color: #0b1a12;
  font-size: 13px;
  font-weight: 600;
}

.oc-items {
  padding: 6px 18px;
}

.oc-item {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) 150px 100px;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px dashed #eef3ef;
}

.oc-item:last-child {
  border-bottom: 0;
}

.thumb {
  display: grid;
  place-items: center;
  overflow: hidden;
  width: 64px;
  height: 64px;
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

.oc-info {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.oc-name {
  overflow: hidden;
  font-size: 13.5px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
  cursor: pointer;
}

.oc-name:hover {
  color: #12764a;
}

.oc-unit {
  text-align: right;
}

.oc-sub {
  color: #0b1a12;
  font-size: 13.5px;
  font-weight: 600;
  text-align: right;
}

.oc-ft {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  border-top: 1px solid #eef3ef;
  background: #fbfdfc;
}

.oc-acts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-left: 8px;
}

.svc-line {
  margin: 0 0 6px;
  font-size: 13.5px;
}

.svc-phone {
  margin: 0 0 12px;
  color: #12764a;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: 1px;
}

@media (max-width: 960px) {
  .oc-item { grid-template-columns: 56px minmax(0, 1fr) 90px; }
  .oc-unit { display: none; }
}
</style>

<template>
  <div class="m-container" style="margin-top: 18px" v-loading="loading">
    <template v-if="order">
      <!-- 页头 -->
      <div class="m-page-hd">
        <h1>订单详情</h1>
        <span class="sub num">订单号 {{ order.orderNo || '—' }}</span>
        <div class="hd-actions">
          <button type="button" class="m-btn sm" @click="router.push('/orders')">返回订单列表</button>
        </div>
      </div>

      <!-- 状态与流程 -->
      <section class="m-card status-card">
        <div class="sc-flow">
          <p v-if="flowAlert" class="sc-alert">{{ flowAlert }}</p>
          <el-steps :active="activeStep" finish-status="success" align-center>
            <el-step title="提交订单" :description="dateTime(order.createTime)" />
            <el-step title="付款" :description="order.payTime ? dateTime(order.payTime) : '未付款'" />
            <el-step title="发货" :description="shippedYet ? '已发货' : '待发货'" />
            <el-step title="收货" :description="order.status === 'COMPLETED' ? '已收货' : isShipped ? '待收货' : '—'" />
            <el-step title="完成" :description="order.status === 'COMPLETED' ? '已完成' : '—'" />
          </el-steps>
        </div>

        <aside class="sc-side">
          <span v-if="order.groupBuyId" class="m-tag amber">拼团订单</span>
          <span class="m-tag" :class="statusClass(order.status)">{{ statusText }}</span>
          <p class="sc-hint">{{ statusHint }}</p>
          <div class="m-row-wrap sc-acts">
            <template v-if="order.status === 'PENDING_PAY'">
              <button type="button" class="m-btn sm" :disabled="busy" @click="cancel">取消订单</button>
              <button type="button" class="m-btn sm primary" :disabled="busy" @click="router.push(`/pay/${order.id}`)">
                立即付款
              </button>
            </template>
            <template v-else-if="order.status === 'PENDING_SHIP'">
              <button type="button" class="m-btn sm ghost" @click="serviceVisible = true">联系客服</button>
            </template>
            <template v-else-if="isShipped">
              <button type="button" class="m-btn sm" @click="router.push(`/logistics/${order.id}`)">查看物流</button>
              <button type="button" class="m-btn sm primary" :disabled="busy" @click="receive">确认收货</button>
            </template>
            <template v-else-if="order.status === 'COMPLETED'">
              <button type="button" class="m-btn sm" @click="router.push('/reviews')">去评价</button>
              <button type="button" class="m-btn sm primary" :disabled="busy" @click="buyAgain">再次购买</button>
            </template>
            <template v-else-if="order.status === 'CANCELLED'">
              <button type="button" class="m-btn sm primary" :disabled="busy" @click="buyAgain">重新购买</button>
            </template>
          </div>
        </aside>
      </section>

      <div class="m-split detail-body">
        <div class="m-stack">
          <!-- 收货信息 -->
          <section class="m-card">
            <div class="m-card-hd"><h3>收货信息</h3></div>
            <div class="m-card-pad">
              <template v-if="order.address">
                <div class="m-row-wrap">
                  <b class="addr-name">{{ order.address.name || '—' }}</b>
                  <span class="muted num">{{ order.address.phone || '—' }}</span>
                </div>
                <p class="addr-detail">{{ addressText }}</p>
              </template>
              <template v-else>
                <p class="muted">—</p>
                <p class="muted small">
                  该订单没有返回收货地址信息。地址可能在收货后被删除，订单里只保留了地址 ID；如需补寄请联系客服核对。
                </p>
              </template>
            </div>
          </section>

          <!-- 商品清单 -->
          <section class="m-card">
            <div class="m-card-hd">
              <h3>商品清单</h3>
              <span class="muted small">共 {{ totalQuantity }} 件</span>
            </div>
            <div class="m-card-pad items">
              <div v-for="item in order.items || []" :key="item.id" class="item-row">
                <div class="thumb" @click="router.push(`/product/${item.productId}`)">
                  <img
                    v-if="usableImage(item.image) && !isBroken(item)"
                    :src="usableImage(item.image)"
                    :alt="item.name"
                    @error="markBroken(item)"
                  />
                  <span v-else class="ph">🌿</span>
                </div>
                <div class="item-info">
                  <div class="item-name" @click="router.push(`/product/${item.productId}`)">{{ item.name }}</div>
                  <span class="muted small">{{ item.spec || '规格以商品详情为准' }}</span>
                </div>
                <span class="muted small num">¥{{ money(item.price) }} × {{ item.quantity }}</span>
                <span class="item-sub num">¥{{ money(item.totalAmount) }}</span>
              </div>
              <p v-if="!(order.items || []).length" class="muted small">该订单没有返回商品明细。</p>
            </div>
          </section>

          <!-- 售后 -->
          <section class="m-card">
            <div class="m-card-hd">
              <h3>售后记录</h3>
              <span class="muted small">{{ myAfterSales.length ? `${myAfterSales.length} 条` : '' }}</span>
              <div class="hd-actions">
                <button
                  type="button"
                  class="m-btn sm ghost"
                  :disabled="!canApply"
                  :title="canApply ? '' : '仅已付款订单可申请售后'"
                  @click="goApply"
                >
                  申请售后
                </button>
              </div>
            </div>
            <div class="m-card-pad">
              <template v-if="myAfterSales.length">
                <button
                  v-for="record in myAfterSales"
                  :key="record.id"
                  type="button"
                  class="as-row"
                  @click="router.push(`/aftersale/${record.id}`)"
                >
                  <span class="m-tag" :class="afterSaleClass(record.status)">{{ afterSaleStatusText(record.status) }}</span>
                  <b>{{ afterSaleTypeText(record.type) }}</b>
                  <span class="muted small num">¥{{ money(record.amount) }}</span>
                  <span class="muted small as-opinion">{{ record.handleOpinion || '平台尚未处理' }}</span>
                  <span class="muted small num as-time">{{ dateTime(record.createTime) }}</span>
                  <span class="as-link">详情 ›</span>
                </button>
              </template>
              <template v-else>
                <p class="muted small as-empty">
                  该订单还没有售后申请。签收后如遇到破损、少件或变质，可在这里发起售后，由平台运营审核处理。
                </p>
              </template>
            </div>
          </section>
        </div>

        <aside class="m-stack">
          <!-- 金额明细 -->
          <section class="m-card m-card-pad">
            <h3 class="aside-title">金额明细</h3>
            <dl class="kv">
              <div><dt>商品合计</dt><dd class="num">¥{{ money(order.totalAmount) }}</dd></div>
              <div v-if="Number(order.discountAmount || 0) > 0">
                <dt>优惠</dt><dd class="num">-¥{{ money(order.discountAmount) }}</dd>
              </div>
              <div><dt>运费</dt><dd class="num">¥{{ money(order.freightAmount || 0) }}</dd></div>
              <div class="total"><dt>实付款</dt><dd class="num">¥{{ money(order.payAmount) }}</dd></div>
            </dl>
          </section>

          <!-- 订单信息 -->
          <section class="m-card m-card-pad">
            <h3 class="aside-title">订单信息</h3>
            <dl class="kv">
              <div>
                <dt>订单号</dt>
                <dd class="m-row-wrap">
                  <span class="num">{{ order.orderNo || '—' }}</span>
                  <button type="button" class="m-btn text" @click="copyText(order.orderNo, '订单号')">复制</button>
                </dd>
              </div>
              <div><dt>下单时间</dt><dd class="num">{{ dateTime(order.createTime) }}</dd></div>
              <div><dt>付款时间</dt><dd class="num">{{ order.payTime ? dateTime(order.payTime) : '未付款' }}</dd></div>
              <div><dt>配送方式</dt><dd>{{ deliveryText }}</dd></div>
              <div><dt>备注</dt><dd>{{ order.remark || '—' }}</dd></div>
              <div><dt>物流公司</dt><dd>{{ order.logisticsCompany || '—' }}</dd></div>
              <div>
                <dt>运单号</dt>
                <dd class="m-row-wrap">
                  <span class="num">{{ order.logisticsNo || '—' }}</span>
                  <button
                    v-if="order.logisticsNo"
                    type="button"
                    class="m-btn text"
                    @click="router.push(`/logistics/${order.id}`)"
                  >
                    查看物流
                  </button>
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>

      <!-- 底部操作 -->
      <section class="m-card m-card-pad foot">
        <button type="button" class="m-btn" @click="router.push('/orders')">返回列表</button>
        <span class="m-spacer" />
        <el-tooltip v-if="!canApply" content="仅已付款订单可申请售后，待付款或已取消订单无需申请" placement="top">
          <span class="tip-wrap">
            <button type="button" class="m-btn" disabled>申请售后</button>
          </span>
        </el-tooltip>
        <button v-else type="button" class="m-btn" @click="goApply">申请售后</button>
        <button type="button" class="m-btn ghost" @click="invoiceVisible = true">申请发票</button>
      </section>
    </template>

    <!-- 加载完成但订单不存在 / 未登录 -->
    <EmptyBlock
      v-else-if="userStore.booted && !loading"
      icon="🧾"
      :title="notLoggedIn ? '登录后查看订单详情' : '订单不存在或无权查看'"
      :desc="
        notLoggedIn
          ? '订单详情需要消费者身份。当前浏览器未检测到已登录的统一身份，请从统一门户登录后再进入商城。'
          : '该订单可能已被删除，或不属于当前登录的消费者账号。可到订单列表确认其他订单。'
      "
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="router.push('/orders')">返回订单列表</button>
      </template>
    </EmptyBlock>

    <!-- 客服 -->
    <el-dialog v-model="serviceVisible" title="联系客服" width="440px">
      <p class="dlg-line">配送、催发货等问题可直接联系平台客服：</p>
      <p class="dlg-phone num">400-800-0000</p>
      <p class="muted small">客服工作时间 9:00–18:00。报上订单号可更快定位供应商与发货批次。</p>
      <template #footer>
        <button type="button" class="m-btn" @click="serviceVisible = false">知道了</button>
        <button type="button" class="m-btn primary" @click="copyText(order?.orderNo, '订单号')">复制订单号</button>
      </template>
    </el-dialog>

    <!-- 发票说明：后端没有自助开票接口，这里只做说明与信息复制，不提交任何数据 -->
    <el-dialog v-model="invoiceVisible" title="申请发票" width="480px">
      <p class="dlg-line">发票由平台财务开具，当前后端未提供自助开票接口，本页无法直接提交开票申请。</p>
      <p class="muted small">如需开票，请复制订单号后联系客服 400-800-0000，并提供：</p>
      <ul class="dlg-list">
        <li>发票抬头（个人姓名或单位名称）</li>
        <li>单位开票需提供纳税人识别号</li>
        <li>接收发票的邮箱</li>
      </ul>
      <p class="muted small">本弹窗不会向服务端发送请求，也不会改变订单状态。</p>
      <template #footer>
        <button type="button" class="m-btn" @click="invoiceVisible = false">关闭</button>
        <button type="button" class="m-btn primary" @click="copyText(order?.orderNo, '订单号')">复制订单号</button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { consumerApi } from '../api'
import { useUserStore } from '../stores/user'
import {
  AFTER_SALE_STATUS,
  AFTER_SALE_TYPES,
  dateTime,
  money,
  orderStatusText,
  usableImage,
} from '../utils/format'
import EmptyBlock from '../components/EmptyBlock.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const busy = ref(false)
const order = ref(null)
const afterSales = ref([])
const serviceVisible = ref(false)
const invoiceVisible = ref(false)
const brokenIds = ref(new Set())

const notLoggedIn = computed(() => userStore.booted && !userStore.consumerId)
const statusText = computed(() => orderStatusText(order.value?.status, order.value?.statusText))
const isShipped = computed(() => ['SHIPPED', 'PENDING_RECEIVE'].includes(order.value?.status))
const shippedYet = computed(() =>
  ['SHIPPED', 'PENDING_RECEIVE', 'COMPLETED'].includes(order.value?.status),
)

const items = computed(() => order.value?.items || [])
const totalQuantity = computed(() => items.value.reduce((sum, item) => sum + Number(item.quantity || 0), 0))

const addressText = computed(() => {
  const addr = order.value?.address
  if (!addr) return '—'
  return [addr.province, addr.city, addr.district, addr.address].filter(Boolean).join('') || '—'
})

const deliveryText = computed(() => {
  const value = order.value?.deliveryType
  if (!value) return '—'
  if (value === 'EXPRESS') return '快递配送'
  if (value === 'SELF_PICKUP' || value === 'PICKUP') return '到店自提'
  return value
})

/** el-steps 的 active 是「已完成的步骤数」，取消/退款中的订单只走到流程中断处。 */
const activeStep = computed(() => {
  const map = {
    PENDING_PAY: 1,
    PENDING_SHIP: 2,
    SHIPPED: 3,
    PENDING_RECEIVE: 3,
    COMPLETED: 5,
    REFUNDING: 2,
    REFUNDED: 5,
    CANCELLED: 1,
  }
  return map[order.value?.status] ?? 1
})

const flowAlert = computed(() => {
  if (order.value?.status === 'CANCELLED') return '订单已取消，流程终止于付款前；如需购买可点击「重新购买」重新下单。'
  if (order.value?.status === 'REFUNDING') return '订单正在退款处理中，流程暂停，进度可在下方售后记录查看。'
  if (order.value?.status === 'REFUNDED') return '订单已完成退款，库存与活动成本已由系统回补。'
  return ''
})

const statusHint = computed(() => {
  const map = {
    PENDING_PAY: '订单已提交，付款后供应商开始备货。当前为演示支付通道，不做真实扣款。',
    PENDING_SHIP: '供应商备货中，发货后可在这里进入物流追踪。',
    SHIPPED: '包裹已发出，可查看物流轨迹，收到货后请确认收货。',
    PENDING_RECEIVE: '包裹已发出，可查看物流轨迹，收到货后请确认收货。',
    COMPLETED: '订单已完成，可对购买的商品发表评价。',
    CANCELLED: '订单已取消，未发生支付。',
    REFUNDING: '售后处理中，退款结果以平台审核为准。',
    REFUNDED: '订单已退款，流程结束。',
  }
  return map[order.value?.status] || '订单状态以平台服务端为准。'
})

/** 只有已付款的订单才允许发起售后，避免对未支付/已取消订单产生无效申请。 */
const canApply = computed(() =>
  ['PENDING_SHIP', 'SHIPPED', 'PENDING_RECEIVE', 'COMPLETED'].includes(order.value?.status),
)

const myAfterSales = computed(() =>
  afterSales.value.filter((record) => String(record.orderId) === String(order.value?.id)),
)

function statusClass(value) {
  if (value === 'PENDING_PAY') return 'amber'
  if (value === 'SHIPPED' || value === 'PENDING_RECEIVE') return 'blue'
  if (value === 'CANCELLED') return 'plain'
  if (value === 'REFUNDING') return 'red'
  return ''
}

function afterSaleClass(value) {
  if (value === 'PENDING') return 'amber'
  if (value === 'REJECTED') return 'red'
  if (value === 'RETURNING') return 'blue'
  if (value === 'CANCELLED') return 'plain'
  return ''
}

function afterSaleStatusText(value) {
  return AFTER_SALE_STATUS[value]?.text || value || '—'
}

function afterSaleTypeText(value) {
  return AFTER_SALE_TYPES[value] || value || '—'
}

function isBroken(item) {
  return brokenIds.value.has(String(item.id))
}

function markBroken(item) {
  brokenIds.value = new Set([...brokenIds.value, String(item.id)])
}

async function copyText(text, label) {
  if (!text) {
    ElMessage.warning(`没有可复制的${label}`)
    return
  }
  try {
    await navigator.clipboard.writeText(String(text))
    ElMessage.success(`${label}已复制`)
  } catch {
    ElMessage.warning('浏览器不允许自动复制，请手动选中文本复制')
  }
}

async function load(silent = false) {
  if (!userStore.consumerId) return
  if (!silent) loading.value = true
  try {
    order.value = await consumerApi.getOrderDetail(route.params.id)
    afterSales.value = (await consumerApi.getAfterSales(userStore.consumerId).catch(() => [])) || []
  } catch (err) {
    order.value = null
    if (!silent) ElMessage.error(err.friendlyMessage || '订单加载失败')
  } finally {
    if (!silent) loading.value = false
  }
}

function goApply() {
  router.push({ path: '/aftersale/apply', query: { orderId: order.value?.id } })
}

async function cancel() {
  if (!order.value) return
  try {
    await ElMessageBox.confirm(
      `确认取消订单「${order.value.orderNo || order.value.id}」？取消后订单不可恢复，需要重新下单。`,
      '取消订单',
      { confirmButtonText: '确认取消', cancelButtonText: '再想想', type: 'warning' },
    )
  } catch {
    return
  }
  busy.value = true
  try {
    const res = await consumerApi.cancelOrder(order.value.id)
    if (res?.success === false) {
      ElMessage.error(res.message || '取消失败')
      await load(true)
      return
    }
    await load(true)
    if (order.value?.status === 'CANCELLED') {
      ElMessage.success('订单已取消')
    } else {
      ElMessage.error('取消状态未生效，请刷新后重试')
    }
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '取消订单失败')
    await load(true)
  } finally {
    busy.value = false
  }
}

async function receive() {
  if (!order.value) return
  try {
    await ElMessageBox.confirm(
      `确认已收到订单「${order.value.orderNo || order.value.id}」的商品？确认后订单将变为已完成。`,
      '确认收货',
      { confirmButtonText: '确认收货', cancelButtonText: '再等等', type: 'warning' },
    )
  } catch {
    return
  }
  busy.value = true
  try {
    const res = await consumerApi.receiveOrder(order.value.id)
    if (res?.success === false) {
      ElMessage.error(res.message || '确认收货失败')
      await load(true)
      return
    }
    await load(true)
    if (order.value?.status === 'COMPLETED') {
      ElMessage.success('已确认收货')
    } else {
      ElMessage.error('收货状态未更新，请刷新后重试')
    }
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '确认收货失败')
    await load(true)
  } finally {
    busy.value = false
  }
}

/** 再次购买：逐条加回购物车并回读，确认后跳购物车，不直接生成订单。 */
async function buyAgain() {
  const rows = items.value
  if (!rows.length) {
    ElMessage.warning('该订单没有可购买的商品明细')
    return
  }
  busy.value = true
  try {
    const failed = []
    for (const item of rows) {
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
    if (failed.length === rows.length) {
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
    busy.value = false
  }
}

// consumerId 异步换回后再查订单；订单号变化（同组件复用）时重新加载
watch(
  () => [userStore.consumerId, route.params.id],
  ([id]) => {
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

.status-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 18px;
  padding: 20px 22px;
}

.sc-flow {
  display: grid;
  gap: 6px;
}

.sc-alert {
  margin: 0;
  padding: 6px 12px;
  border-radius: 8px;
  background: #fdf3e3;
  color: #a86412;
  font-size: 12.5px;
}

.sc-side {
  display: grid;
  gap: 8px;
  align-content: center;
  padding-left: 18px;
  border-left: 1px dashed #e6ede8;
}

.sc-side .m-tag {
  justify-self: start;
  height: 22px;
  padding: 0 10px;
  font-size: 12px;
}

.sc-hint {
  margin: 0;
  color: #6b7c72;
  font-size: 12.5px;
  line-height: 1.7;
}

.detail-body {
  margin-top: 16px;
}

.addr-name {
  font-size: 14px;
  font-weight: 700;
}

.addr-detail {
  margin: 6px 0 0;
  color: #33453b;
  font-size: 13px;
  line-height: 1.7;
}

.items {
  display: grid;
  gap: 12px;
}

.item-row {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) 150px 100px;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px dashed #eef3ef;
}

.item-row:last-child {
  padding-bottom: 0;
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

.item-info {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.item-name {
  overflow: hidden;
  font-size: 13.5px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
  cursor: pointer;
}

.item-name:hover {
  color: #12764a;
}

.item-row .num {
  text-align: right;
}

.item-sub {
  color: #0b1a12;
  font-size: 13.5px;
  font-weight: 600;
  text-align: right;
}

.as-row {
  display: grid;
  grid-template-columns: 76px 88px 90px minmax(0, 1fr) 120px 56px;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 0;
  border: 0;
  border-bottom: 1px dashed #eef3ef;
  background: none;
  text-align: left;
  cursor: pointer;
}

.as-row:last-child {
  border-bottom: 0;
}

.as-row:hover b {
  color: #12764a;
}

.as-row b {
  font-size: 13px;
  font-weight: 600;
}

.as-opinion {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.as-link {
  color: #12764a;
  font-size: 12.5px;
  text-align: right;
}

.as-empty {
  margin: 0;
  line-height: 1.8;
}

.aside-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 700;
}

.kv {
  display: grid;
  gap: 9px;
  margin: 0;
}

.kv > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
}

.kv dt {
  flex: 0 0 64px;
  color: #6b7c72;
}

.kv dd {
  margin: 0;
  min-width: 0;
  font-weight: 500;
  text-align: right;
  overflow-wrap: anywhere;
}

.kv .total {
  margin-top: 4px;
  padding-top: 9px;
  border-top: 1px dashed #eef3ef;
}

.kv .total dd {
  color: #d45b32;
  font-size: 16px;
  font-weight: 800;
}

.foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
}

.tip-wrap {
  display: inline-flex;
}

.dlg-line {
  margin: 0 0 8px;
  font-size: 13.5px;
  line-height: 1.7;
}

.dlg-phone {
  margin: 0 0 12px;
  color: #12764a;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: 1px;
}

.dlg-list {
  margin: 6px 0 12px;
  padding-left: 18px;
  color: #4b5d53;
  font-size: 12.5px;
  line-height: 1.9;
}

@media (max-width: 1080px) {
  .status-card { grid-template-columns: minmax(0, 1fr); }
  .sc-side { padding-left: 0; padding-top: 14px; border-left: 0; border-top: 1px dashed #e6ede8; }
  .as-row { grid-template-columns: 76px 80px 80px minmax(0, 1fr); }
  .as-time,
  .as-link { display: none; }
}
</style>

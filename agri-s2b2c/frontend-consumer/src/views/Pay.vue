<template>
  <div class="m-container" v-loading="loading">
    <!-- 顶部 -->
    <div class="m-page-hd lead">
      <h1>订单支付</h1>
      <span class="sub">演示支付通道 · 不接真实支付网关</span>
      <div class="hd-actions">
        <button type="button" class="m-btn sm" @click="router.push('/orders')">我的订单 ›</button>
      </div>
    </div>

    <!-- 不可支付 -->
    <div v-if="order && !payable" class="m-card m-card-pad notice">
      <h2 class="notice-title">该订单当前不可支付</h2>
      <p class="muted">
        订单当前状态为「{{ statusText }}」。只有「待付款」订单可以发起支付，已付款或已取消的订单请到订单详情查看。
      </p>
      <div class="m-row">
        <button type="button" class="m-btn primary" @click="router.push(`/order/${order.id}`)">查看订单</button>
        <button type="button" class="m-btn" @click="router.push('/orders')">订单列表</button>
      </div>
    </div>

    <template v-else-if="order">
      <!-- 应付金额 -->
      <div class="m-card m-card-pad pay-hd">
        <div class="amount">
          <span class="muted small">应付金额</span>
          <span class="price lg big-amount"><span class="cur">¥</span>{{ money(order.payAmount) }}</span>
        </div>
        <div class="meta m-row-wrap">
          <span>订单号 <b class="num">{{ order.orderNo || '—' }}</b></span>
          <span>状态 <b>{{ statusText }}</b></span>
          <span>创建时间 <b>{{ dateTime(order.createTime) }}</b></span>
        </div>
        <div class="m-row countdown">
          <span class="muted small">支付倒计时（仅展示，不阻断支付）</span>
          <Countdown :end-time="deadline" end-text="已超过建议支付时间" />
        </div>
      </div>

      <div class="m-split">
        <div class="m-stack">
          <!-- 收货信息 -->
          <div class="m-card">
            <div class="m-card-hd"><h3>收货信息</h3></div>
            <div class="m-card-pad">
              <template v-if="order.address">
                <div class="m-row-wrap">
                  <b class="addr-name">{{ order.address.name || '—' }}</b>
                  <span class="muted num">{{ order.address.phone || '—' }}</span>
                </div>
                <p class="addr-detail">
                  {{ addressText }}
                </p>
              </template>
              <p v-else class="muted small">该订单没有关联收货地址信息。</p>
            </div>
          </div>

          <!-- 订单概览 -->
          <div class="m-card">
            <div class="m-card-hd">
              <h3>订单概览</h3>
              <span class="muted small">共 {{ items.length }} 行商品</span>
            </div>
            <div class="m-card-pad">
              <dl class="kv">
                <div><dt>商品合计</dt><dd class="num">¥{{ money(order.totalAmount) }}</dd></div>
                <div><dt>优惠</dt><dd class="num">-¥{{ money(order.discountAmount || 0) }}</dd></div>
                <div><dt>运费</dt><dd class="num">¥{{ money(order.freightAmount || 0) }}</dd></div>
                <div><dt>应付金额</dt><dd class="num strong">¥{{ money(order.payAmount) }}</dd></div>
              </dl>
              <div v-if="items.length" class="item-list">
                <div v-for="item in items" :key="item.id" class="item-row">
                  <span class="item-name">{{ item.name }}</span>
                  <span class="muted small">{{ item.spec || '—' }}</span>
                  <span class="muted num small">×{{ item.quantity }}</span>
                  <span class="num small">¥{{ money(item.totalAmount) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 支付方式 -->
        <aside class="m-card m-card-pad pay-side">
          <h3 class="side-title">支付方式</h3>
          <el-radio-group v-model="method" class="methods">
            <el-radio value="WECHAT">微信支付</el-radio>
            <el-radio value="ALIPAY">支付宝</el-radio>
            <el-radio value="BALANCE">余额支付</el-radio>
          </el-radio-group>

          <p class="muted small note">
            当前为演示支付通道：确认后直接调用平台支付接口把订单置为待发货，不接真实支付网关、不做扣款。
          </p>
          <p class="muted small note">
            支付接口不接收支付方式参数，所选方式仅用于演示，订单不会记录支付渠道。
          </p>

          <button
            type="button"
            class="m-btn primary block pay-btn"
            :disabled="paying"
            @click="confirmPay"
          >
            {{ paying ? '支付处理中…' : `确认支付 ¥${money(order.payAmount)}` }}
          </button>
          <button type="button" class="m-btn block cancel-btn" @click="router.push(`/order/${order.id}`)">
            取消支付，返回订单
          </button>
        </aside>
      </div>
    </template>

    <EmptyBlock
      v-else-if="!loading && userStore.booted"
      icon="🧾"
      :title="notLoggedIn ? '请先登录后支付' : '订单不存在或无权查看'"
      :desc="
        notLoggedIn
          ? '订单支付需要消费者身份。当前浏览器未检测到已登录的统一身份，请从统一门户登录后再进入商城。'
          : '该订单可能已被删除，或不属于当前登录的消费者账号。可到订单列表确认。'
      "
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="router.push('/orders')">去我的订单</button>
      </template>
    </EmptyBlock>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { consumerApi } from '../api'
import { useUserStore } from '../stores/user'
import { dateTime, money, orderStatusText } from '../utils/format'
import Countdown from '../components/Countdown.vue'
import EmptyBlock from '../components/EmptyBlock.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const paying = ref(false)
const order = ref(null)
const method = ref('WECHAT')

const notLoggedIn = computed(() => userStore.booted && !userStore.consumerId)

const items = computed(() => order.value?.items || [])
const statusText = computed(() => orderStatusText(order.value?.status, order.value?.statusText))
const payable = computed(() => String(order.value?.status || '') === 'PENDING_PAY')

const addressText = computed(() => {
  const addr = order.value?.address
  if (!addr) return '—'
  return [addr.province, addr.city, addr.district, addr.address].filter(Boolean).join('') || '—'
})

/** 建议支付时限：下单时间 + 30 分钟，只做提示，后端未强制。 */
const deadline = computed(() => {
  const raw = order.value?.createTime
  const base = raw ? new Date(String(raw).replace(' ', 'T')).getTime() : Date.now()
  const start = Number.isNaN(base) ? Date.now() : base
  const target = new Date(start + 30 * 60 * 1000)
  const pad = (num) => String(num).padStart(2, '0')
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())} `
    + `${pad(target.getHours())}:${pad(target.getMinutes())}:${pad(target.getSeconds())}`
})

async function load() {
  if (!userStore.consumerId) return
  loading.value = true
  try {
    order.value = await consumerApi.getOrderDetail(route.params.id)
  } catch (err) {
    order.value = null
    ElMessage.error(err.friendlyMessage || '订单加载失败')
  } finally {
    loading.value = false
  }
}

async function confirmPay() {
  if (!order.value) return
  paying.value = true
  try {
    const res = await consumerApi.payOrder(order.value.id)
    if (res?.success === false) {
      ElMessage.error(res.message || '支付失败')
      return
    }
    // 写操作必须回读复核：只有状态真的变成待发货才算支付成功
    const fresh = await consumerApi.getOrderDetail(order.value.id)
    order.value = fresh
    if (String(fresh?.status || '') !== 'PENDING_SHIP') {
      ElMessage.error(`支付状态未更新（当前：${orderStatusText(fresh?.status, fresh?.statusText)}），请稍后重试`)
      return
    }
    ElMessage.success('支付成功')
    router.replace(`/pay/result?orderId=${order.value.id}`)
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '支付失败')
  } finally {
    paying.value = false
  }
}

// consumerId 由统一身份异步换回：拿到身份后再查订单，避免直接进入本页时误判「未登录」
watch(
  () => userStore.consumerId,
  (id) => {
    if (id && !order.value) load()
  },
  { immediate: true },
)
</script>

<style scoped>
.m-container {
  width: min(1280px, calc(100% - 48px));
  margin: 0 auto;
}

.lead {
  margin-top: 18px;
}

.notice {
  display: grid;
  gap: 10px;
  margin-top: 4px;
}

.notice-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}

.pay-hd {
  display: grid;
  gap: 10px;
  margin-bottom: 16px;
}

.amount {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.price.big-amount {
  font-size: 32px;
}

.meta {
  gap: 18px;
  color: #6b7c72;
  font-size: 12.5px;
}

.meta b {
  color: #0b1a12;
  font-weight: 600;
}

.countdown {
  padding-top: 8px;
  border-top: 1px dashed #eef3ef;
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

.kv {
  display: grid;
  gap: 8px;
  margin: 0;
}

.kv > div {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.kv dt {
  color: #6b7c72;
}

.kv dd {
  margin: 0;
  font-weight: 600;
}

.kv .strong {
  color: #d45b32;
  font-size: 15px;
}

.item-list {
  display: grid;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #eef3ef;
}

.item-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 140px 60px 90px;
  align-items: center;
  gap: 10px;
}

.item-name {
  overflow: hidden;
  font-size: 13px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.item-row .num {
  text-align: right;
}

.pay-side {
  position: sticky;
  top: 88px;
  display: grid;
  gap: 12px;
  align-content: start;
}

.side-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
}

.methods {
  display: grid;
  gap: 4px;
}

.note {
  margin: 0;
  line-height: 1.7;
}

.pay-btn {
  height: 42px;
}

.cancel-btn {
  color: #6b7c72;
}

@media (max-width: 1080px) {
  .pay-side { position: static; }
  .item-row { grid-template-columns: minmax(0, 1fr) 100px 50px 80px; }
}
</style>

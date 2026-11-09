<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { serviceApi, statusMeta, type Order, type Provider } from '../../api'

interface PoolDemand {
  id: number
  demandNo: string
  serviceName: string
  category: string
  description: string
  location: string
  area: string
  preferredDate: string
  budgetMin: number
  budgetMax: number
  quotedPrice: number
  quotedUnit: string
  contactName: string
  contactPhone: string
}

const provider = ref<Provider | null>(null)
const demands = ref<PoolDemand[]>([])
const orders = ref<Order[]>([])
const counters = ref({ myOrders: 0, completedOrders: 0, openComplaints: 0 })
const loading = ref(false)
const loadError = ref('')

onShow(load)

async function load() {
  loading.value = true
  try {
    const data = await serviceApi.workbench()
    provider.value = data.provider
    demands.value = data.availableDemands
    orders.value = data.todayOrders
    counters.value = {
      myOrders: Number(data.myOrders ?? 0),
      completedOrders: Number(data.completedOrders ?? 0),
      openComplaints: Number(data.openComplaints ?? 0),
    }
    loadError.value = ''
  } catch (error) {
    // 未绑定平台主体 / 不是服务商时后端会给可操作的原因，页面要留住它而不是闪一条 toast
    loadError.value = error instanceof Error ? error.message : '加载失败'
    provider.value = null
  } finally {
    loading.value = false
  }
}

async function accept(demand: PoolDemand) {
  const result = await new Promise<{ confirm: boolean }>((resolve) =>
    uni.showModal({
      title: '确认抢单',
      content: `${demand.serviceName}\n${demand.location} · ${demand.area}\n按我方报价 ¥${demand.quotedPrice}/${demand.quotedUnit}`,
      success: (res) => resolve({ confirm: Boolean(res.confirm) }),
      fail: () => resolve({ confirm: false }),
    }))
  if (!result.confirm) return
  try {
    await serviceApi.acceptDemand(demand.id)
    uni.showToast({ title: '抢单成功，工单已生成', icon: 'success' })
    load()
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '抢单失败', icon: 'none' })
  }
}

async function progress(order: Order) {
  const next = Math.min(100, order.progress + 20)
  try {
    await serviceApi.reportProgress(order.id, next, `移动工作台上报：进度 ${next}%`)
    uni.showToast({ title: '进度已上报', icon: 'success' })
    load()
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '上报失败', icon: 'none' })
  }
}
</script>

<template>
  <view class="page page-pad workbench-page">
    <view v-if="loading && !provider" class="loading">正在加载接单台…</view>
    <view v-else-if="!provider" class="card denied">
      <text class="denied-title">接单台暂不可用</text>
      <text class="muted">{{ loadError || '未取到服务商身份' }}</text>
      <button class="btn btn-sm btn-ghost btn-block" @click="load">重新加载</button>
    </view>
    <template v-else>
      <view class="workbench-head">
        <text class="head-icon">{{ provider.categoryIcon }}</text>
        <view>
          <text class="tiny">当前服务身份（由登录令牌解析）</text>
          <text class="head-title">{{ provider.name }}</text>
          <text class="head-sub">{{ provider.category }} · 平均响应 {{ provider.responseMinutes }} 分钟</text>
        </view>
        <text class="state" :class="provider.status === 'available' ? 'ok' : 'warn'">
          {{ provider.status === 'available' ? '接单中' : '暂停接单' }}
        </text>
      </view>

      <view class="stat-row">
        <view class="stat"><text>累计工单</text><b>{{ counters.myOrders }}</b></view>
        <view class="stat"><text>已完成</text><b>{{ counters.completedOrders }}</b></view>
        <view class="stat"><text>未结投诉</text><b>{{ counters.openComplaints }}</b></view>
      </view>

      <view class="card">
        <view class="card-head">
          <text class="card-title">附近可抢需求</text>
          <text class="card-sub">{{ demands.length }} 条</text>
        </view>
        <view class="grab-card" v-for="demand in demands" :key="demand.id">
          <view class="between">
            <text class="tag green">{{ demand.category }}</text>
            <text class="tiny">{{ demand.preferredDate }}</text>
          </view>
          <text class="grab-title">{{ demand.serviceName }}</text>
          <text class="muted">{{ demand.description }}</text>
          <text class="tiny">📍 {{ demand.location }} · {{ demand.area }}</text>
          <text class="tiny">需求方 {{ demand.contactName }} · {{ demand.contactPhone }}（接单后可见完整号码）</text>
          <view class="between grab-foot">
            <text class="price">预算 ¥{{ demand.budgetMin }}-{{ demand.budgetMax }} · 我方报价 ¥{{ demand.quotedPrice }}/{{ demand.quotedUnit }}</text>
            <button class="btn btn-sm btn-primary" @click="accept(demand)">抢单</button>
          </view>
        </view>
        <view v-if="demands.length === 0" class="empty">✅ 同品类可抢需求已处理完</view>
      </view>

      <view class="card">
        <view class="card-head">
          <text class="card-title">进行中工单</text>
          <text class="card-sub">{{ orders.length }} 单</text>
        </view>
        <view class="work-order" v-for="order in orders" :key="order.id">
          <view class="between">
            <text class="strong">{{ order.serviceName }}</text>
            <text class="tag" :class="statusMeta(order.status).tone">{{ statusMeta(order.status).label }}</text>
          </view>
          <text class="muted">{{ order.location }} · {{ order.appointmentDate }}</text>
          <text class="tiny">{{ order.orderNo }} · {{ order.quantity }}{{ order.unit }} · ¥{{ order.totalAmount }}</text>
          <view class="progress"><view :style="{ width: `${order.progress}%` }" /></view>
          <button class="btn btn-sm btn-ghost btn-block" @click="progress(order)">上报服务进度</button>
        </view>
        <view v-if="orders.length === 0" class="empty">当前没有进行中的工单</view>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.workbench-page { padding: 24rpx; }
.workbench-head { display: flex; align-items: center; gap: 16rpx; margin-bottom: 20rpx; padding: 24rpx; border-radius: 24rpx; background: radial-gradient(circle at 90% 0, rgba(83,213,138,.2), transparent 300rpx), linear-gradient(135deg,#073721,#0d5b3b); color: #fff; }
.head-icon { display: flex; width: 82rpx; height: 82rpx; align-items: center; justify-content: center; border-radius: 20rpx; background: rgba(255,255,255,.11); font-size: 39rpx; }
.workbench-head > view { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 4rpx; }
.workbench-head .tiny { color: #8ad8aa; }
.head-title { font-size: 29rpx; font-weight: 700; }
.head-sub { color: rgba(255,255,255,.47); font-size: 24rpx; }
.state { align-self: flex-start; padding: 6rpx 14rpx; border-radius: 999rpx; font-size: 24rpx; }
.state.ok { background: rgba(83,213,138,.22); color: #a8ecc4; }
.state.warn { background: rgba(255,195,86,.22); color: #ffdf9f; }
.stat-row { display: flex; gap: 14rpx; margin-bottom: 20rpx; }
.stat { flex: 1; padding: 18rpx; border: 1rpx solid #e1eae4; border-radius: 16rpx; background: #fff; display: flex; flex-direction: column; gap: 6rpx; }
.stat text { color: #7b8a80; font-size: 24rpx; }
.stat b { font-size: 30rpx; color: #0e5233; }
.grab-card { margin-bottom: 14rpx; padding: 18rpx; border: 1rpx solid #e1eae4; border-radius: 16rpx; }
.grab-card > text { display: block; margin-top: 6rpx; }
.grab-title { font-size: 24rpx; font-weight: 650; }
.grab-foot { margin-top: 14rpx; gap: 12rpx; }
.price { color: #0e5233; font-size: 24rpx; max-width: 420rpx; }
.work-order { margin-bottom: 14rpx; padding: 16rpx; border: 1rpx solid #e1e9e3; border-radius: 16rpx; }
.work-order > text { display: block; margin: 7rpx 0; }
.work-order .btn { margin-top: 14rpx; }
.denied { display: flex; flex-direction: column; gap: 14rpx; }
.denied-title { font-size: 26rpx; font-weight: 650; }
</style>

<template>
  <view class="page home-page">
    <view class="hero">
      <text class="hero-kicker">SUPPLIER WORKBENCH</text>
      <text class="hero-title">{{ supplier?.shopName || '供应商工作台' }}</text>
      <text class="hero-desc">{{ supplier?.companyName || '产地供应链协同管理' }}</text>
      <view class="hero-status">
        <text class="online-dot" />
        <text>{{ auditText }}</text>
        <text class="hero-platform">{{ platformLabel }}</text>
      </view>
    </view>

    <view class="metric-grid">
      <view class="metric-card">
        <view class="metric-icon">售</view>
        <text class="metric-value">{{ money(salesTotal) }}</text>
        <text class="metric-label">本月销售额</text>
      </view>
      <view class="metric-card">
        <view class="metric-icon">单</view>
        <text class="metric-value">{{ monthOrders }}</text>
        <text class="metric-label">本月订单</text>
      </view>
      <view class="metric-card">
        <view class="metric-icon">品</view>
        <text class="metric-value">{{ activeProductCount }}</text>
        <text class="metric-label">在售商品</text>
      </view>
      <view class="metric-card pending">
        <view class="metric-icon">发</view>
        <text class="metric-value">{{ pendingShipCount }}</text>
        <text class="metric-label">待发货订单</text>
      </view>
    </view>

    <view class="section-head"><view><text class="kicker">QUICK ACTION</text><text class="title">快捷经营</text></view></view>
    <view class="quick-grid">
      <view class="quick-card" @tap="goProducts"><view class="quick-icon">品</view><text>商品管理</text><small class="small-copy">上下架与库存</small></view>
      <view class="quick-card" @tap="goNewProduct"><view class="quick-icon">发</view><text>发布商品</text><small class="small-copy">提交平台审核</small></view>
      <view class="quick-card" @tap="goOrders"><view class="quick-icon">单</view><text>订单履约</text><small class="small-copy">发货与查看</small></view>
      <view class="quick-card" @tap="goAudit"><view class="quick-icon">审</view><text>审核进度</text><small class="small-copy">入驻与商品</small></view>
    </view>

    <view class="section-head">
      <view><text class="kicker">RECENT ORDERS</text><text class="title">最近订单</text></view>
      <text class="sub" @tap="goOrders">全部订单 →</text>
    </view>
    <view class="card order-card">
      <view v-for="order in orders.slice(0, 5)" :key="order.id" class="order-row" @tap="openOrder(order.id)">
        <view class="order-icon">单</view>
        <view class="order-copy">
          <text>{{ order.orderNo }}</text>
          <small class="small-copy">{{ order.createTime?.replace('T', ' ') }}</small>
        </view>
        <view class="order-right">
          <text class="price">{{ money(order.payAmount) }}</text>
          <text class="tag" :class="`tag-${statusMeta(order.status).tone}`">{{ statusMeta(order.status).label }}</text>
        </view>
      </view>
      <view v-if="!orders.length" class="empty-mini">暂无订单</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { supplierApi, type Dashboard, type Order, type Product, type Supplier } from '../../api'
import { requireSupplierLogin, supplierSession } from '../../session'
import { money, statusMeta, toast } from '../../utils'

const supplier = ref<Supplier | null>(null)
const dashboard = ref<Dashboard>({})
const orders = ref<Order[]>([])
const products = ref<Product[]>([])
const loading = ref(false)

const platformLabel = computed(() => {
  const platform = uni.getSystemInfoSync().uniPlatform
  return platform === 'mp-weixin' ? '微信小程序' : platform === 'app' ? 'APP' : 'H5'
})
const auditText = computed(() => {
  if (supplier.value?.auditStatus === 'APPROVED') return '入驻资质已通过'
  if (supplier.value?.auditStatus === 'REJECTED') return '入驻审核未通过'
  return '入驻资质审核中'
})
const pendingShipCount = computed(() => orders.value.filter((item) => item.status === 'PENDING_SHIP').length)
const activeProductCount = computed(() => products.value.filter((item) => item.status === 'APPROVED').length)
const currentMonth = new Date().toISOString().slice(0, 7)
const monthOrdersList = computed(() => orders.value.filter((item) => String(item.createTime || '').startsWith(currentMonth)))
const monthOrders = computed(() => monthOrdersList.value.length || dashboard.value.orderCount || 0)
const salesTotal = computed(() => monthOrdersList.value.reduce((sum, item) => sum + Number(item.payAmount || 0), 0))

onShow(load)
onPullDownRefresh(load)

async function load() {
  if (!requireSupplierLogin()) return
  loading.value = true
  try {
    const [supplierData, dashboardData, orderData, productData] = await Promise.all([
      supplierApi.getSupplier(supplierSession.account?.id || 1),
      supplierApi.getDashboard(),
      supplierApi.getOrders({ page: 1, size: 20 }),
      supplierApi.getProducts({ supplierId: supplierSession.account?.id || 1, page: 1, size: 30 }),
    ])
    supplier.value = supplierData
    dashboard.value = dashboardData
    orders.value = orderData.records || []
    products.value = productData.records || []
    if (supplierData?.shopName) {
      supplierSession.account = {
        ...(supplierSession.account as any),
        shopName: supplierData.shopName,
      }
    }
  } catch (error) {
    toast((error as Error).message)
  } finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function goProducts() { uni.switchTab({ url: '/pages/products/index' }) }
function goNewProduct() { uni.navigateTo({ url: '/pages/products/edit' }) }
function goOrders() { uni.switchTab({ url: '/pages/orders/index' }) }
function goAudit() { uni.navigateTo({ url: '/pages/audit/index' }) }
function openOrder(id: number) { uni.navigateTo({ url: `/pages/orders/detail?id=${id}` }) }
</script>

<style scoped lang="scss">
.hero {
  margin: 18rpx 22rpx 0;
}

.hero-status {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 22rpx;
  color: rgba(255,255,255,.72);
  font-size: 18rpx;
}

.online-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #6ee7a2;
  box-shadow: 0 0 0 6rpx rgba(110,231,162,.12);
}

.hero-platform {
  margin-left: auto;
  padding: 5rpx 12rpx;
  border: 1rpx solid rgba(255,255,255,.16);
  border-radius: 999rpx;
  color: rgba(255,255,255,.6);
}

.metric-card.pending .metric-icon {
  background: #fff3dd;
  color: #a96a08;
}

.quick-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  padding: 0 22rpx;
}

.quick-card {
  width: calc((100% - 12rpx) / 2);
  padding: 20rpx;
  border: 1rpx solid #e3eae5;
  border-radius: 20rpx;
  background: #fff;
}

.quick-icon {
  display: grid;
  width: 46rpx;
  height: 46rpx;
  place-items: center;
  border-radius: 13rpx;
  background: #eaf7ef;
  color: #12764a;
  font-size: 19rpx;
  font-weight: 800;
}

.quick-card text,
.quick-card .small-copy {
  display: block;
}

.quick-card text {
  margin-top: 12rpx;
  color: #0b1a12;
  font-size: 22rpx;
  font-weight: 700;
}

.quick-card .small-copy {
  margin-top: 4rpx;
  color: #93a29a;
  font-size: 17rpx;
}

.order-row {
  display: flex;
  align-items: center;
  gap: 13rpx;
  padding: 15rpx 0;
  border-top: 1rpx solid #edf2ee;
}

.order-row:first-child {
  border-top: 0;
}

.order-icon {
  display: grid;
  width: 50rpx;
  height: 50rpx;
  flex: 0 0 50rpx;
  place-items: center;
  border-radius: 14rpx;
  background: #eaf7ef;
  color: #12764a;
  font-size: 18rpx;
  font-weight: 800;
}

.order-copy {
  min-width: 0;
  flex: 1;
}

.order-copy text,
.order-copy .small-copy {
  display: block;
}

.order-copy text {
  color: #0b1a12;
  font-size: 20rpx;
  font-weight: 650;
}

.order-copy .small-copy {
  margin-top: 4rpx;
  color: #93a29a;
  font-size: 16rpx;
}

.order-right {
  display: flex;
  align-items: flex-end;
  flex-direction: column;
  gap: 6rpx;
}

.order-right .price {
  font-size: 23rpx;
}

.empty-mini {
  padding: 42rpx 0;
  color: #94a198;
  font-size: 21rpx;
  text-align: center;
}
</style>

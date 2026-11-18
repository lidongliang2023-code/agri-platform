<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { buyerMenu, sellerMenu, asRows, type Row } from '../../business'
import { request } from '../../api'
import { requireTradeLogin, getTradeRole } from '../../auth'

const role = ref(getTradeRole())
const merchants = ref<Row[]>([])
const selected = ref('')
const error = ref('')
const loading = ref(true)
const merchantName = computed(() => loading.value ? '正在加载经营主体…' : error.value ? '经营主体加载失败' : merchants.value.find(m => String(m.merchantId) === selected.value)?.merchantName || '尚未绑定经营主体')
const menu = computed(() => role.value === 'buyer' ? buyerMenu : sellerMenu)
const featured = computed(() => menu.value.slice(0, 4))
const tones = ['', 'amber', 'blue', 'violet', 'red']
const icons: Record<string, string> = {
  overview: '览', agent: '智', 'demand-list': '求', inquiry: '询', chat: '聊', purchase: '购', after: '售', rate: '评',
  contract: '约', fund: '账', favorite: '藏', goods: '货', p2t: '接', trade: '报', sales: '销', ship: '运', customer: '客', iot: '产',
}
const sectionName: Record<string, string> = {
  agent: '交易准备', 'demand-list': '交易准备', inquiry: '交易准备', goods: '交易准备', p2t: '交易准备', trade: '交易准备',
  purchase: '订单与履约', sales: '订单与履约', after: '订单与履约', contract: '订单与履约', ship: '订单与履约', rate: '订单与履约',
  fund: '资金与账户', favorite: '资金与账户', chat: '沟通协作', customer: '经营分析', iot: '生产协同',
}
const sections = computed(() => {
  const grouped: { title: string; items: string[][] }[] = []
  for (const item of menu.value.slice(4)) {
    const title = sectionName[item[0]] || '更多业务'
    let group = grouped.find(value => value.title === title)
    if (!group) { group = { title, items: [] }; grouped.push(group) }
    group.items.push(item)
  }
  return grouped
})

onLoad(() => setRole(getTradeRole()))
onShow(() => { setRole(getTradeRole()); void loadMerchants() })

async function loadMerchants() {
  if (!requireTradeLogin()) return
  loading.value = true; error.value = ''
  try {
    merchants.value = asRows(await request('/identity/my-merchants'))
    const saved = String(uni.getStorageSync('trade_merchant') || '')
    selected.value = merchants.value.some(m => String(m.merchantId) === saved) ? saved : String(merchants.value[0]?.merchantId || '')
    uni.setStorageSync('trade_merchant', selected.value)
  } catch (e) { error.value = e instanceof Error ? e.message : '主体加载失败' } finally { loading.value = false }
}
function choose(e: any) {
  const row = merchants.value[Number(e.detail.value)]
  if (!row) return
  selected.value = String(row.merchantId)
  uni.setStorageSync('trade_merchant', selected.value)
}
function setRole(value: 'buyer' | 'seller') {
  role.value = value
  uni.setNavigationBarTitle({ title: value === 'buyer' ? '买家中心' : '卖家中心' })
}
function changeCenter() { uni.switchTab({ url: '/pages/profile/index' }) }
function routeFor(key: string) {
  const routes: Record<string, string> = { overview: role.value === 'buyer' ? '/pages/buyer/overview' : '/pages/seller/overview', 'demand-list': '/pages/buyer/demand', inquiry: '/pages/buyer/inquiry', after: '/pages/buyer/after', fund: role.value === 'buyer' ? '/pages/buyer/fund' : '/pages/seller/fund', goods: '/pages/seller/goods', trade: '/pages/seller/quote', p2t: '/pages/seller/p2t', customer: '/pages/seller/customer', chat: '/pages/collaboration/chat', agent: '/pages/collaboration/agent', price: '/pages/collaboration/price', identity: '/pages/identity/index' }
  return routes[key] || '/pages/business/index?key=' + key + '&role=' + role.value
}
function open(key: string) { uni.navigateTo({ url: routeFor(key) }) }
</script>

<template>
  <view class="page">
    <view class="page-head">
      <view><text class="page-title">{{ role === 'buyer' ? '买家中心' : '卖家中心' }}</text><text class="page-sub">按业务阶段快速办理</text></view>
      <text class="tiny">{{ menu.length }} 项业务</text>
    </view>

    <view class="notice">当前仅展示{{ role === 'buyer' ? '采购' : '供货' }}业务。<text class="link" @tap="changeCenter">切换中心 ›</text></view>

    <view class="merchant-card">
      <text class="ws-kicker">当前经营主体</text>
      <text class="ws-title">{{ role === 'buyer' ? '采购工作台' : '供货工作台' }}</text>
      <picker :disabled="loading || !!error || merchants.length < 2" :range="merchants" range-key="merchantName" @change="choose">
        <view class="merchant"><text class="ellipsis grow">{{ merchantName }}</text><text v-if="merchants.length > 1" class="switch">切换主体 ›</text></view>
      </picker>
    </view>
    <view v-if="error" class="load-error"><text>{{ error }}</text><button class="btn btn-ghost" @tap="loadMerchants">重新加载主体</button></view>
    <view v-else-if="!loading && !merchants.length" class="notice">当前账号尚未绑定经营主体，部分业务需要先完成主体绑定。<text class="link" @tap="open('identity')">去绑定 ›</text></view>

    <view class="card quick-card">
      <view class="card-head"><text class="card-title">常用业务</text><text class="tiny">优先处理</text></view>
      <view class="quick-grid">
        <view v-for="(item, index) in featured" :key="item[0]" class="quick-item tap-row" @tap="open(item[0])">
          <view class="entry-icon" :class="tones[index % tones.length]">{{ icons[item[0]] || item[1].slice(0, 1) }}</view>
          <text class="quick-label ellipsis">{{ item[1] }}</text><text class="arrow">›</text>
        </view>
      </view>
    </view>

    <view v-for="section in sections" :key="section.title" class="business-section">
      <text class="section-label">{{ section.title }}</text>
      <view class="menu-list">
        <view v-for="(item, index) in section.items" :key="item[0]" class="menu-row tap-row" @tap="open(item[0])">
          <view class="entry-icon" :class="tones[(index + 1) % tones.length]">{{ icons[item[0]] || item[1].slice(0, 1) }}</view>
          <text class="menu-text">{{ item[1] }}</text><text class="arrow">›</text>
        </view>
      </view>
    </view>

    <view class="business-section">
      <text class="section-label">账户设置</text>
      <view class="menu-list"><view class="menu-row tap-row" @tap="open('identity')"><view class="entry-icon">证</view><text class="menu-text">经营主体与资质</text><text class="arrow">›</text></view></view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.role-switch { margin-bottom: 20rpx; }
.merchant-card { margin-bottom: 20rpx; padding: 30rpx; border-radius: 28rpx; background: linear-gradient(135deg, #073821, #12764a); color: #fff; box-shadow: 0 12rpx 28rpx rgba(7, 56, 33, .16); }
.ws-kicker { display: block; color: rgba(255, 255, 255, .62); font-size: 24rpx; }
.ws-title { display: block; margin-top: 8rpx; font-size: 38rpx; font-weight: 700; }
.merchant { display: flex; align-items: center; gap: 16rpx; min-height: 72rpx; margin-top: 18rpx; padding: 0 20rpx; border-radius: 16rpx; background: rgba(255, 255, 255, .12); color: rgba(255, 255, 255, .9); font-size: 26rpx; }
.switch { flex-shrink: 0; color: #b5edc9; font-size: 24rpx; }
.quick-card { padding: 24rpx; }
.business-section { margin-top: 4rpx; }
.link { margin-left: 8rpx; color: var(--c-primary); font-weight: 600; }
</style>

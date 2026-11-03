<template>
  <view class="page channel-page">
    <view v-if="loading" class="empty">正在加载店铺…</view>
    <view v-else-if="!shop" class="empty">
      <view class="empty-icon">丰</view>
      <text>店铺不存在或尚未开通</text>
    </view>
    <template v-else>
      <view class="shop-hero">
        <image v-if="shop.shopLogo" class="shop-logo" :src="shop.shopLogo" mode="aspectFill" />
        <view v-else class="shop-logo shop-logo-fallback">店</view>
        <view class="shop-copy">
          <text class="shop-name">{{ shop.shopName }}</text>
          <text class="shop-desc">{{ shop.shopDesc || '渠道精选 · 产地直供' }}</text>
          <view class="shop-tags">
            <text v-if="shop.grade" class="tag tag-green">{{ gradeText }}</text>
            <text class="tag tag-gray">渠道专属</text>
          </view>
        </view>
      </view>

      <view class="section-head">
        <view>
          <text class="section-kicker">CHANNEL SELECTION</text>
          <text class="section-title">本店好物</text>
        </view>
        <text class="section-link">{{ products.length }} 件</text>
      </view>

      <view v-if="products.length" class="product-list">
        <view v-for="item in products" :key="item.id" class="product-row">
          <image v-if="item.image" class="product-thumb" :src="item.image" mode="aspectFill" />
          <view v-else class="product-thumb product-thumb-fallback">丰</view>
          <view class="product-main">
            <text class="product-name">{{ item.name }}</text>
            <text class="muted">库存 {{ item.stock }}{{ item.unit || '' }}</text>
            <view class="product-bottom">
              <text class="price">{{ money(item.price) }}</text>
              <view class="btn btn-primary btn-sm" @tap="addToCart(item)">加入购物车</view>
            </view>
          </view>
        </view>
      </view>
      <view v-else class="empty">
        <view class="empty-icon">丰</view>
        <text>该店铺暂未上架商品</text>
      </view>

      <view class="channel-note">
        <text class="tiny">通过本店下单，订单归属该渠道商；售后与结算按渠道订单处理。</text>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { mallApi } from '../../api'
import type { ChannelShop, ChannelShopProduct } from '../../api'
import { ensureLogin, session } from '../../session'
import { money, toast } from '../../utils'

const loading = ref(true)
const shop = ref<ChannelShop | null>(null)
const products = ref<ChannelShopProduct[]>([])
const channelId = ref('')

const gradeText = computed(() => {
  const grade = shop.value?.grade || ''
  const names: Record<string, string> = { LEVEL_1: '金牌渠道', LEVEL_2: '银牌渠道', LEVEL_3: '铜牌渠道' }
  return names[grade] || grade
})

onLoad((query) => {
  const id = String(query?.channelId || '')
  if (!id) {
    loading.value = false
    return
  }
  channelId.value = id
  load(id)
})

async function load(id: string) {
  loading.value = true
  try {
    const detail = await mallApi.getChannelShop(id)
    shop.value = detail.channel || null
    products.value = detail.products || []
  } catch (error) {
    toast((error as Error).message)
  } finally {
    loading.value = false
  }
}

async function addToCart(item: ChannelShopProduct) {
  if (!ensureLogin() || !session.user) return
  try {
    const result = await mallApi.addCart(session.user.id, item.id, 1, channelId.value)
    if (!result.success) throw new Error(result.message || '加入购物车失败')
    toast(result.message || '已加入购物车', 'success')
  } catch (error) {
    toast((error as Error).message)
  }
}

onShareAppMessage(() => ({
  title: shop.value?.shopName || '丰链云渠道好物',
  path: `/pages/channel/index?channelId=${channelId.value}`,
}))
</script>

<style lang="scss" scoped>
.channel-page {
  padding: 24rpx 0 40rpx;
}

.shop-hero {
  display: flex;
  align-items: center;
  gap: 22rpx;
  margin: 0 24rpx;
  padding: 28rpx;
  border-radius: 28rpx;
  background: radial-gradient(circle at 90% 0, rgba(104, 222, 150, 0.32), transparent 34%),
    linear-gradient(135deg, #073821, #12764a);
  color: #ffffff;
}

.shop-logo {
  width: 108rpx;
  height: 108rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.18);
  flex-shrink: 0;
}

.shop-logo-fallback {
  display: grid;
  place-items: center;
  color: #ffffff;
  font-size: 44rpx;
  font-weight: 800;
}

.shop-copy {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.shop-name {
  font-size: 34rpx;
  font-weight: 800;
}

.shop-desc {
  color: rgba(255, 255, 255, 0.68);
  font-size: 22rpx;
}

.shop-tags {
  display: flex;
  gap: 12rpx;
  margin-top: 4rpx;
}

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 30rpx 28rpx 14rpx;
}

.section-kicker {
  display: block;
  color: #94a198;
  font-size: 18rpx;
  letter-spacing: 2rpx;
}

.section-title {
  display: block;
  margin-top: 6rpx;
  color: #0b1a12;
  font-size: 32rpx;
  font-weight: 800;
}

.section-link {
  color: #718277;
  font-size: 22rpx;
}

.product-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin: 0 24rpx;
}

.product-row {
  display: flex;
  gap: 20rpx;
  padding: 22rpx;
  border: 1rpx solid #e3eae5;
  border-radius: 24rpx;
  background: #ffffff;
}

.product-thumb {
  width: 164rpx;
  height: 164rpx;
  border-radius: 18rpx;
  background: #edf4ef;
  flex-shrink: 0;
}

.product-thumb-fallback {
  display: grid;
  place-items: center;
  color: #12764a;
  font-size: 44rpx;
  font-weight: 800;
}

.product-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
}

.product-name {
  color: #0b1a12;
  font-size: 28rpx;
  font-weight: 700;
  line-height: 1.4;
}

.product-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
}

.channel-note {
  margin: 26rpx 28rpx 0;
}
</style>

<template>
  <view class="page addresses-page">
    <view class="list-head">
      <view><text class="head-kicker">DELIVERY ADDRESS</text><text class="head-title">{{ selectMode ? '选择收货地址' : '收货地址' }}</text></view>
      <text class="head-count">{{ addresses.length }} 个地址</text>
    </view>

    <view v-if="addresses.length" class="address-list">
      <view v-for="address in addresses" :key="address.id" class="address-card" @tap="choose(address)">
        <view class="address-main">
          <view class="address-top">
            <text class="address-name">{{ address.name }}</text>
            <text class="address-phone">{{ address.phone }}</text>
            <text v-if="address.isDefault" class="tag tag-green">默认</text>
          </view>
          <text class="address-detail">{{ fullAddress(address) }}</text>
        </view>
        <view class="address-actions">
          <text @tap.stop="edit(address.id)">编辑</text>
          <text class="delete" @tap.stop="remove(address.id)">删除</text>
        </view>
      </view>
    </view>
    <view v-else class="empty">
      <view class="empty-icon">址</view>
      <text>还没有收货地址</text>
      <text class="tiny">添加后即可快速下单</text>
    </view>

    <view class="fixed-bottom add-bar">
      <button class="btn btn-primary btn-block" @tap="add">添加收货地址</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { mallApi, type Address } from '../../api'
import { session } from '../../session'
import { toast } from '../../utils'

const addresses = ref<Address[]>([])
const selectMode = ref(false)

onLoad((options) => {
  selectMode.value = String(options?.select || '') === '1'
})

onShow(loadAddresses)

async function loadAddresses() {
  if (!session.user) {
    uni.redirectTo({ url: '/pages/login/index?redirect=%2Fpages%2Faddresses%2Findex' })
    return
  }
  try {
    addresses.value = await mallApi.getAddresses(session.user.id)
  } catch (error) {
    toast((error as Error).message)
  }
}

function fullAddress(address: Address) {
  return `${address.province}${address.city}${address.district}${address.address}`
}

function choose(address: Address) {
  if (!selectMode.value) return
  uni.setStorageSync('s2b2c_selected_address_id', address.id)
  uni.navigateBack()
}

function add() {
  uni.navigateTo({ url: '/pages/addresses/edit' })
}

function edit(id: string | number) {
  uni.navigateTo({ url: `/pages/addresses/edit?id=${id}` })
}

function remove(id: string | number) {
  uni.showModal({
    title: '删除地址',
    content: '确定删除这个收货地址吗？',
    success: async (result) => {
      if (!result.confirm) return
      try {
        const response = await mallApi.deleteAddress(id)
        if (response.success) {
          toast('地址已删除', 'success')
          loadAddresses()
        }
      } catch (error) {
        toast((error as Error).message)
      }
    },
  })
}

defineExpose({ loadAddresses })
</script>

<style scoped lang="scss">
.addresses-page {
  padding-bottom: calc(130rpx + env(safe-area-inset-bottom));
}

.list-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 24rpx;
}

.head-kicker,
.head-title {
  display: block;
}

.head-kicker {
  color: #12764a;
  font-size: 24rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}

.head-title {
  margin-top: 5rpx;
  color: #0b1a12;
  font-size: 32rpx;
  font-weight: 800;
}

.head-count {
  color: #93a29a;
  font-size: 24rpx;
}

.address-list {
  padding: 0 22rpx;
}

.address-card {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  margin-bottom: 14rpx;
  padding: 24rpx;
  border: 1rpx solid #e3eae5;
  border-radius: 21rpx;
  background: #fff;
}

.address-main {
  min-width: 0;
  flex: 1;
}

.address-top {
  display: flex;
  align-items: center;
  gap: 11rpx;
}

.address-name {
  color: #0b1a12;
  font-size: 25rpx;
  font-weight: 700;
}

.address-phone {
  color: #718277;
  font-size: 24rpx;
}

.address-detail {
  display: block;
  margin-top: 12rpx;
  color: #52665a;
  font-size: 24rpx;
  line-height: 1.55;
}

.address-actions {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  color: #12764a;
  font-size: 24rpx;
}

.address-actions .delete {
  color: #c54b4b;
}

.add-bar {
  padding-top: 14rpx;
}
</style>

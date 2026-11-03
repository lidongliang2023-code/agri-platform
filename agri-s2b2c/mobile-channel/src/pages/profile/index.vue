<template>
  <view class="page profile-page">
    <view class="shop-hero"><view class="shop-mark">渠</view><view class="shop-copy"><text class="shop-name">{{ channel?.shopName || '渠道商店铺' }}</text><text class="shop-company">{{ channel?.companyName || '丰链云渠道合作伙伴' }}</text><text class="shop-account">{{ maskedPhone }}</text></view><text class="tag tag-green">{{ channel?.grade || '渠道商' }}</text></view>
    <view class="card menu-card">
      <view class="compact-row" @tap="goCommissions"><view class="compact-icon">佣</view><view class="compact-copy"><text>佣金管理</text><small class="small-copy">查看分润与结算进度</small></view><text class="arrow">›</text></view>
      <view class="compact-row" @tap="goOrders"><view class="compact-icon">单</view><view class="compact-copy"><text>订单管理</text><small class="small-copy">查看渠道成交订单</small></view><text class="arrow">›</text></view>
      <view class="compact-row" @tap="goPool"><view class="compact-icon">选</view><view class="compact-copy"><text>选品中心</text><small class="small-copy">发现平台热销好货</small></view><text class="arrow">›</text></view>
      <view class="compact-row" @tap="goGrowth"><view class="compact-icon">营</view><view class="compact-copy"><text>营销与售后</text><small class="small-copy">活动素材和售后协同</small></view><text class="arrow">›</text></view>
    </view>
    <view class="section-head"><view><text class="kicker">SHOP PROFILE</text><text class="title">店铺资料</text></view></view>
    <view class="card form-card">
      <view class="form-item"><text class="form-label">店铺名称</text><input v-model="form.shopName" class="input" /></view>
      <view class="form-item"><text class="form-label">注册类型</text><picker :range="registerTypes" range-key="label" @change="selectRegisterType"><view class="input">{{ registerTypeLabel }}</view></picker></view>
      <view class="form-item"><text class="form-label">公司名称</text><input v-model="form.companyName" class="input" /></view>
      <view class="form-item"><text class="form-label">联系人</text><input v-model="form.contactName" class="input" /></view>
      <view class="form-item"><text class="form-label">联系电话</text><input v-model="form.contactPhone" class="input" type="number" maxlength="11" /></view>
      <view class="form-item"><text class="form-label">详细地址</text><textarea v-model="form.address" class="textarea" /></view>
      <button class="btn btn-primary btn-block" :loading="saving" @tap="save">保存店铺资料</button>
    </view>
    <view class="platform-card"><text>当前运行端</text><b>{{ platformLabel }}</b><small class="small-copy">同一套渠道商业务支持小程序、Android / iOS App 和 H5。</small></view>
    <button class="logout" @tap="logout">退出登录</button>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { channelApi, type ChannelPartner } from '../../api'
import { channelSession, clearChannelSession, requireChannelLogin } from '../../session'
import { toast } from '../../utils'
import { logoutUnifiedAccount } from '../../../../frontend-shared/mobile-unified-auth'

const registerTypes = [{ label: '个人', value: 'PERSONAL' }, { label: '企业', value: 'ENTERPRISE' }]
const channel = ref<ChannelPartner | null>(null)
const saving = ref(false)
const form = reactive<ChannelPartner>({
  id: channelSession.account?.id || 1,
  shopName: '',
  shopDesc: '',
  registerType: 'PERSONAL',
  companyName: '',
  creditCode: '',
  contactName: '',
  contactPhone: '',
  province: '',
  city: '',
  district: '',
  address: '',
})
const maskedPhone = computed(
  () => channelSession.account?.nickname || channelSession.account?.username || channelSession.account?.phone || '',
)
const registerTypeLabel = computed(() => form.registerType === 'ENTERPRISE' ? '企业' : '个人')
const platformLabel = computed(() => {
  const platform = uni.getSystemInfoSync().uniPlatform
  return platform === 'mp-weixin' ? '微信小程序' : platform === 'app' ? 'APP' : 'H5'
})

onShow(load)

async function load() {
  if (!requireChannelLogin()) return
  try {
    channel.value = await channelApi.getChannel(channelSession.account?.id || 1)
    Object.assign(form, channel.value)
  } catch (error) {
    toast((error as Error).message)
  }
}

function selectRegisterType(event: any) {
  form.registerType = registerTypes[Number(event.detail.value)]?.value || 'PERSONAL'
}

async function save() {
  if (!form.shopName.trim()) return toast('请输入店铺名称')
  if (!form.contactName.trim()) return toast('请输入联系人')
  if (!/^1\d{10}$/.test(form.contactPhone)) return toast('请输入正确的联系电话')
  saving.value = true
  try {
    const result = await channelApi.updateChannel(form)
    if (!result.success) throw new Error(result.message || '保存失败')
    toast('店铺资料已保存', 'success')
  } catch (error) {
    toast((error as Error).message)
  } finally {
    saving.value = false
  }
}

function goCommissions() { uni.switchTab({ url: '/pages/commissions/index' }) }
function goPool() { uni.switchTab({ url: '/pages/pool/index' }) }
function goOrders() { uni.navigateTo({ url: '/pages/orders/index' }) }
function goGrowth() { uni.navigateTo({ url: '/pages/growth/index' }) }
function logout() {
  uni.showModal({
    title: '退出登录',
    content: '确定退出渠道商移动工作台吗？',
    async success(result) {
      if (!result.confirm) return
      await logoutUnifiedAccount()
      clearChannelSession()
      uni.reLaunch({ url: '/pages/login/index' })
    },
  })
}
</script>

<style scoped lang="scss">
.profile-page{padding-bottom:36rpx}.shop-hero{display:flex;align-items:center;gap:16rpx;margin:18rpx 22rpx 0;padding:26rpx;border-radius:24rpx;background:radial-gradient(circle at 88% 0,rgba(110,231,162,.18),transparent 42%),linear-gradient(135deg,#073821,#12764a);color:#fff}.shop-mark{display:grid;width:74rpx;height:74rpx;flex:0 0 74rpx;place-items:center;border:1rpx solid rgba(255,255,255,.24);border-radius:20rpx;background:rgba(255,255,255,.1);color:#c9f2d7;font-size:30rpx;font-weight:800}.shop-copy{min-width:0;flex:1}.shop-name,.shop-company,.shop-account{display:block}.shop-name{font-size:27rpx;font-weight:800}.shop-company{margin-top:5rpx;color:rgba(255,255,255,.64);font-size:18rpx}.shop-account{margin-top:5rpx;color:rgba(255,255,255,.42);font-size:16rpx}.menu-card{padding-top:8rpx;padding-bottom:8rpx}.arrow{color:#a1ada6;font-size:36rpx}.form-card{margin-top:0}.platform-card{margin:0 22rpx;padding:22rpx;border:1rpx solid #dcebe2;border-radius:20rpx;background:#f5fbf7}.platform-card text,.platform-card b,.platform-card .small-copy{display:block}.platform-card text{color:#718277;font-size:17rpx}.platform-card b{margin-top:4rpx;color:#0e5233;font-size:24rpx}.platform-card .small-copy{margin-top:7rpx;color:#718277;font-size:17rpx;line-height:1.55}.logout{height:74rpx;margin:20rpx 22rpx 0;border:1rpx solid #efcccc;border-radius:16rpx;background:#fff;color:#c54b4b;font-size:22rpx;line-height:72rpx}
</style>

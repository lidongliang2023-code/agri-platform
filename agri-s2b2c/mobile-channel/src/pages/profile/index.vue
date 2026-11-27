<template>
  <view class="page profile-page">
    <view v-if="loading" class="empty"><text>正在加载店铺资料…</text></view>
    <template v-else>
      <view class="shop-hero">
        <view class="shop-mark">渠</view>
        <view class="shop-copy"><text class="shop-name">{{ channel?.shopName || '商家店铺' }}</text><text class="shop-company">{{ channel?.companyName || '丰链云渠道合作伙伴' }}</text><text class="shop-account">{{ accountText }}</text></view>
        <text class="tag tag-green">{{ channelGradeLabel(channel?.grade, '商家') }}</text>
      </view>

      <view class="card menu-card">
        <view v-for="item in menu" :key="item.label" class="compact-row" @tap="open(item.url)">
          <view class="compact-icon">{{ item.icon }}</view>
          <view class="compact-copy"><text>{{ item.label }}</text><text class="small-copy">{{ item.desc }}</text></view>
          <text class="arrow">›</text>
        </view>
      </view>

      <view class="platform-card"><text>当前运行端</text><text class="strong-copy">{{ platformLabel }}</text><text class="small-copy">同一套商家业务支持微信小程序、Android / iOS App 和 H5。</text></view>
      <button class="logout" @tap="logout">退出登录</button>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { channelApi, type ChannelPartner } from '../../api'
import { channelSession, clearChannelSession, currentChannelId, openPage } from '../../session'
import { channelGradeLabel, toast } from '../../utils'
import { logoutUnifiedAccount } from '../../../../frontend-shared/mobile-unified-auth'

const channel = ref<ChannelPartner | null>(null)
const loading = ref(true)
const platform = uni.getSystemInfoSync().uniPlatform
const platformLabel = computed(() => platform === 'mp-weixin' ? '微信小程序' : platform === 'app' ? 'APP' : 'H5')
const accountText = computed(() => channelSession.account?.nickname || channelSession.account?.username || channelSession.account?.phone || '统一账号商家')
const menu = [
  { icon: '客', label: '客户与运营', desc: '客户分层与画像', url: '/pages/customers/index' },
  { icon: '库', label: '库存与动销', desc: '库存与可售天数', url: '/pages/inventory/index' },
  { icon: '评', label: '评价管理', desc: '查看评价并回复', url: '/pages/reviews/index' },
  { icon: '经', label: '经营分析', desc: '订单金额与销售趋势', url: '/pages/analytics/index' },
  { icon: '月', label: '月度对账', desc: '佣金与提现流水', url: '/pages/reconcile/index' },
  { icon: '结', label: '结算批次', desc: '佣金批次记录', url: '/pages/settlements/index' },
  { icon: '集', label: '集采报名', desc: '报名平台集采', url: '/pages/procurement/index' },
  { icon: '通', label: '通知中心', desc: '业务通知与偏好', url: '/pages/notices/index' },
  { icon: '商', label: '商家成长', desc: '等级规则与变更记录', url: '/pages/growth/index' },

  { icon: '佣', label: '佣金与提现', desc: '查看分润、结算和提现进度', url: '/pages/commissions/index' },
  { icon: '选', label: '选品中心', desc: '发现平台好货并加入货架', url: '/pages/pool/index' },
  { icon: '营', label: '营销素材', desc: '平台活动与分享文案', url: '/pages/marketing/index' },
  { icon: '店', label: '店铺资料', desc: '维护店铺、联系人和地址', url: '/pages/shop/edit' },
]

onShow(load)
onPullDownRefresh(async () => { try { await load() } finally { uni.stopPullDownRefresh() } })

async function load() {
  if (!currentChannelId()) return
  loading.value = true
  try {
    channel.value = await channelApi.getProfile() as ChannelPartner
  } catch (error) {
    toast((error as Error).message)
  } finally {
    loading.value = false
  }
}

function open(url: string) { openPage(url) }

function logout() {
  uni.showModal({
    title: '退出登录',
    content: '确定退出商家移动工作台吗？',
    async success(result) {
      if (!result.confirm) return
      if (!await logoutUnifiedAccount()) return
      clearChannelSession()
      toast('已退出登录', 'success')
      uni.reLaunch({ url: '/pages/login/index' })
    },
  })
}
</script>

<style scoped lang="scss">
.profile-page { padding-bottom: 36rpx; }
.shop-hero { display: flex; align-items: center; gap: 16rpx; margin: 18rpx 22rpx 0; padding: 26rpx; border-radius: 24rpx; background: radial-gradient(circle at 88% 0, rgba(110,231,162,.18), transparent 42%), linear-gradient(135deg,#073821,#12764a); color: #fff; }
.shop-mark { display: grid; width: 74rpx; height: 74rpx; flex: 0 0 74rpx; place-items: center; border: 1rpx solid rgba(255,255,255,.24); border-radius: 20rpx; background: rgba(255,255,255,.1); color: #c9f2d7; font-size: 30rpx; font-weight: 800; }
.shop-copy { min-width: 0; flex: 1; }
.shop-name, .shop-company, .shop-account { display: block; }
.shop-name { font-size: 29rpx; font-weight: 800; }
.shop-company { margin-top: 5rpx; color: rgba(255,255,255,.64); font-size: 24rpx; }
.shop-account { margin-top: 5rpx; color: rgba(255,255,255,.46); font-size: 24rpx; }
.menu-card { padding-top: 8rpx; padding-bottom: 8rpx; }
.compact-row { display: flex; align-items: center; gap: 16rpx; min-height: 100rpx; border-top: 1rpx solid #edf2ee; }
.compact-row:first-child { border-top: 0; }
.compact-icon { display: grid; width: 58rpx; height: 58rpx; flex: 0 0 58rpx; place-items: center; border-radius: 16rpx; background: #eaf7ef; color: #12764a; font-size: 26rpx; font-weight: 800; }
.compact-copy { min-width: 0; flex: 1; }
.compact-copy text, .compact-copy .small-copy { display: block; }
.compact-copy text { color: #0b1a12; font-size: 27rpx; font-weight: 650; }
.compact-copy .small-copy { margin-top: 5rpx; color: #666666; font-size: 24rpx; }
.arrow { color: #a1ada6; font-size: 38rpx; }
.platform-card { margin: 0 22rpx; padding: 22rpx; border: 1rpx solid #dcebe2; border-radius: 20rpx; background: #f5fbf7; }
.platform-card text, .platform-card .strong-copy, .platform-card .small-copy { display: block; }
.platform-card text { color: #666666; font-size: 24rpx; }
.platform-card .strong-copy { margin-top: 4rpx; color: #0e5233; font-size: 25rpx; }
.platform-card .small-copy { margin-top: 7rpx; color: #666666; font-size: 24rpx; line-height: 1.55; }
.logout { height: 78rpx; margin: 20rpx 22rpx 0; border: 1rpx solid #efcccc; border-radius: 16rpx; background: #fff; color: #b71c1c; font-size: 26rpx; line-height: 76rpx; }
</style>

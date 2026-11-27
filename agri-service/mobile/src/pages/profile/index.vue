<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getServiceUser, logoutUnifiedService } from '../../auth'
import { serviceApi, type Order } from '../../api'

const statusBarHeight = ref(Number(uni.getSystemInfoSync().statusBarHeight || 0))
const account = getServiceUser()
const displayName = account?.nickname || account?.username || '平台用户'
const orders = ref<Order[]>([])
const subject = ref('')
const providerName = ref('')
const expertName = ref('')
const unread = ref(0)
const policyPending = ref(0)
const certificates = ref<Array<{ certNo: string; title: string; teacher: string; completedAt: string }>>([])
const certificatesOpen = ref(false)
const denied = ref('')

const counts = computed(() => ({
  confirmed: orders.value.filter((item) => item.status === 'confirmed').length,
  inProgress: orders.value.filter((item) => item.status === 'in_progress').length,
  toReview: orders.value.filter((item) => item.status === 'completed' && !item.rating).length,
  total: orders.value.length,
}))

onShow(load)

/**
 * 服务商账号通常只有 service:provider，消费侧接口会 403。
 * 这里用 allSettled：拿不到的分区留空并说明原因，不能因为一个 403 就连身份都不显示。
 */
async function load() {
  const [orderRes, identityRes, messageRes, applicationRes, certRes] = await Promise.allSettled([
    serviceApi.orders(),
    serviceApi.identity(),
    serviceApi.messages(),
    serviceApi.policyApplications(),
    serviceApi.certificates(),
  ])
  denied.value = ''
  expertName.value = ''
  if (orderRes.status === 'fulfilled') {
    orders.value = orderRes.value
  } else {
    orders.value = []
    denied.value = orderRes.reason instanceof Error ? orderRes.reason.message : '消费侧数据不可见'
  }
  if (identityRes.status === 'fulfilled') {
    subject.value = identityRes.value.merchantName ?? ''
    providerName.value = identityRes.value.providerName ?? ''
    expertName.value = identityRes.value.expertName ?? ''
  }
  if (messageRes.status === 'fulfilled') {
    unread.value = messageRes.value.filter((item) => !item.read).length
  }
  if (applicationRes.status === 'fulfilled') {
    policyPending.value = applicationRes.value.filter((item) => !['paid', 'rejected'].includes(item.status)).length
  }
  if (certRes.status === 'fulfilled') {
    certificates.value = certRes.value
  }
}

function nav(url: string) {
  uni.navigateTo({ url })
}

function tab(url: string, filter = 'all') {
  uni.setStorageSync('service_order_filter', filter)
  uni.switchTab({ url })
}

function showCertificates() {
  if (certificates.value.length === 0) {
    uni.showToast({ title: '完成培训课程后由平台签发证书', icon: 'none' })
    return
  }
  certificatesOpen.value = true
}

function logout() {
  uni.showModal({
    title: '退出登录',
    content: '确定退出综合服务吗？',
    success(result) {
      if (result.confirm) void logoutUnifiedService()
    },
  })
}
</script>

<template>
  <view class="page profile-page">
    <view class="profile-hero" :style="{ paddingTop: `${statusBarHeight + 20}px` }">
      <view class="profile-top"><text class="profile-title">我的</text><text class="ui-measured-touch bell" @click="nav('/pages/messages/index')">🔔 {{ unread }}</text></view>
      <view class="avatar">{{ displayName.slice(0, 1) }}</view>
      <text class="name">{{ displayName }}</text>
      <text class="farm">{{ subject || '未绑定经营主体，订单将无法归属' }}</text>
      <text class="verified">✓ {{ expertName ? `专家身份：${expertName}` : providerName ? `服务商身份：${providerName}` : '消费者身份' }}</text>
    </view>
    <view class="page-pad">
      <view v-if="!denied" class="stats">
        <view class="ui-measured-touch" @click="tab('/pages/orders/index', 'confirmed')"><text>{{ counts.confirmed }}</text><text>待服务</text></view>
        <view class="ui-measured-touch" @click="tab('/pages/orders/index', 'in_progress')"><text>{{ counts.inProgress }}</text><text>服务中</text></view>
        <view class="ui-measured-touch" @click="tab('/pages/orders/index', 'completed')"><text>{{ counts.toReview }}</text><text>待评价</text></view>
        <view class="ui-measured-touch" @click="tab('/pages/orders/index')"><text>{{ counts.total }}</text><text>全部订单</text></view>
      </view>
      <view v-if="denied" class="card denied"><text class="strong">本账号没有消费侧权限</text><text class="muted">{{ denied }}</text></view>
      <view v-if="!denied" class="menu">
        <view class="ui-measured-touch" @click="nav('/pages/demand/index')"><text class="menu-icon">📋</text><text class="menu-label">我的需求</text><text class="tiny">匹配与接单进度</text><text class="chev">›</text></view>
        <view class="ui-measured-touch" @click="nav('/pages/feedback/index')"><text class="menu-icon">📝</text><text class="menu-label">投诉与反馈</text><text class="tiny">提交问题 / 查看处理</text><text class="chev">›</text></view>
        <view class="ui-measured-touch" @click="nav('/pages/insurance/index')"><text class="menu-icon">🛡️</text><text class="menu-label">我的保单</text><text class="tiny">本主体名下</text><text class="chev">›</text></view>
        <view class="ui-measured-touch" @click="nav('/pages/policies/index')"><text class="menu-icon">📜</text><text class="menu-label">政策申报</text><text class="tiny">{{ policyPending }} 项审核中</text><text class="chev">›</text></view>
        <view class="ui-measured-touch" @click="showCertificates"><text class="menu-icon">🎓</text><text class="menu-label">我的证书</text><text class="tiny">{{ certificates.length }} 份培训证书</text><text class="chev">›</text></view>

      </view>
      <view class="menu">
        <view class="ui-measured-touch" @click="nav('/pages/expert/index')"><text class="menu-icon">🩺</text><text class="menu-label">专家工作台</text><text class="tiny">{{ expertName || '需绑定专家账号' }}</text><text class="chev">›</text></view>
        <view class="ui-measured-touch" v-if="providerName" @click="nav('/pages/workbench/index')"><text class="menu-icon">🧑‍🔧</text><text class="menu-label">服务商接单台</text><text class="tiny">{{ providerName }}</text><text class="chev">›</text></view>
        <view class="ui-measured-touch" @click="nav('/pages/messages/index')"><text class="menu-icon">💬</text><text class="menu-label">平台消息</text><text class="tiny">{{ unread }} 条未读</text><text class="chev">›</text></view>
        <view class="ui-measured-touch" @click="logout"><text class="menu-icon">↪</text><text class="menu-label">退出统一登录</text><text class="chev">›</text></view>
      </view>
    </view>
    <view v-if="certificatesOpen" class="ui-measured-touch overlay" @click.self="certificatesOpen = false">
      <view class="sheet">
        <view class="between"><text class="card-title">我的培训证书</text><text class="ui-measured-touch sheet-close" @click="certificatesOpen = false">×</text></view>
        <view class="cert" v-for="cert in certificates" :key="cert.certNo">
          <text class="strong">{{ cert.title }}</text>
          <text class="tiny">证书号 {{ cert.certNo }} · {{ cert.teacher }}</text>
          <text class="tiny">签发时间 {{ cert.completedAt }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.profile-hero { display: flex; align-items: center; flex-direction: column; padding: 0 28rpx 44rpx; border-radius: 0 0 40rpx 40rpx; background: radial-gradient(circle at 85% 0, rgba(82,204,134,.23), transparent 400rpx), linear-gradient(145deg,#073821,#0d5a3a); color: #fff; }
.profile-top { display: flex; width: 100%; align-items: center; justify-content: space-between; margin-bottom: 20rpx; }
.profile-title { font-size: 32rpx; font-weight: 700; }
.bell { padding: 9rpx 14rpx; border: 1rpx solid rgba(255,255,255,.14); border-radius: 15rpx; background: rgba(255,255,255,.08); font-size: 13px; }
.avatar { display: flex; width: 126rpx; height: 126rpx; align-items: center; justify-content: center; border: 6rpx solid rgba(255,255,255,.16); border-radius: 50%; background: linear-gradient(135deg,#26a96a,#12764a); font-size: 45rpx; font-weight: 700; }
.name { margin-top: 15rpx; font-size: 36rpx; font-weight: 700; }
.farm { margin-top: 6rpx; color: rgba(255,255,255,.82); font-size: 13px; }
.verified { margin-top: 14rpx; padding: 7rpx 16rpx; border-radius: 22rpx; background: rgba(255,255,255,.1); color: #a9e7c1; font-size: 13px; }
.stats { display: grid; grid-template-columns: repeat(4, 1fr); margin-top: -18rpx; padding: 22rpx; border: 1rpx solid #e1e9e3; border-radius: 22rpx; background: #fff; box-shadow: 0 10rpx 30rpx rgba(16,57,37,.05); }
.stats view { display: flex; align-items: center; flex-direction: column; gap: 4rpx; border-right: 1rpx solid #edf2ee; }
.stats view:last-child { border-right: 0; }
.stats text:first-child { color: #0e5233; font-family: monospace; font-size: 33rpx; font-weight: 700; }
.stats text:last-child { color: #52665a; font-size: 13px; }
.menu { margin-top: 18rpx; overflow: hidden; border: 1rpx solid #e1e9e3; border-radius: 22rpx; background: #fff; }
.menu > view { display: flex; min-height: 92rpx; align-items: center; gap: 16rpx; padding: 12rpx 22rpx; border-bottom: 1rpx solid #edf2ee; }
.menu > view:last-child { border-bottom: 0; }
.menu-icon { display: flex; width: 58rpx; height: 58rpx; align-items: center; justify-content: center; border-radius: 15rpx; background: #f2fbf5; font-size: 15px; }
.menu-label { flex: 1; font-size: 13px; }
.chev { color: #52665a; font-size: 36rpx; }
.overlay { position: fixed; inset: 0; z-index: 20; display: flex; align-items: flex-end; background: rgba(5,25,15,.45); }
.sheet { width: 100%; max-height: 70vh; overflow-y: auto; padding: 28rpx 28rpx calc(28rpx + env(safe-area-inset-bottom)); border-radius: 30rpx 30rpx 0 0; background: #fff; }
.sheet-close { color: #52665a; font-size: 44rpx; }
.cert { display: flex; flex-direction: column; gap: 5rpx; margin-bottom: 14rpx; padding: 18rpx; border: 1rpx solid #e1e9e3; border-radius: 16rpx; }

.bell { display: inline-flex; min-width: 44px; min-height: 44px; align-items: center; justify-content: center; }
.menu > view, .stats view { min-height: 44px; }
.menu-label { min-width: 0; }
.menu .tiny { max-width: 40%; text-align: right; }
.menu-icon, .chev { flex-shrink: 0; }


/* 2026-11-20：逐页实测控件的48px触控区。 */
.ui-measured-touch { min-width:48px !important; min-height:48px !important; box-sizing:border-box; }
text.ui-measured-touch { display:inline-flex; align-items:center; justify-content:center; }

/* 收尾复验发现的布局与详情控件修正。 */
.menu > .ui-measured-touch { min-height:48px; }
</style>

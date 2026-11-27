<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import WorkspaceSwitch from '../../components/WorkspaceSwitch.vue'
import OpsTabBar from '../../components/OpsTabBar.vue'
import { currentWorkspace, identitySessionReady, accountSummary, activateSubject, ensureIotSession, logoutIotSession, type Row } from '../../api/iot'
import { showError, confirmAction } from '../../utils/ui'
import manifest from '../../manifest.json'

const workspace = ref(currentWorkspace())
const summary = ref<Row | null>(null)
const busy = ref(false)
const error = ref('')
const user = ref<Row>({})
const displayName = computed(() => String(user.value.nickname || user.value.username || '统一账号'))
const avatarText = computed(() => Array.from(displayName.value)[0] || '我')
const activeSubject = computed(() => summary.value?.merchants?.find((item: Row) => String(item.merchantId) === String(summary.value?.activeMerchantId)))
const shortcuts = [
  { title: '消息通知', description: '查看系统通知与设备消息', mark: '信', path: '/pages/messages/index' },
  { title: '运维与 OTA', description: '工单进度、固件与升级任务', mark: '维', path: '/pages/maintenance/index' },
  { title: '设备报修', description: '提交设备故障与维修需求', mark: '修', path: '/pages/maintenance/create' },
]
onShow(load)
async function load() {
  if (busy.value || !ensureIotSession()) return
  busy.value = true
  user.value = uni.getStorageSync('user') || {}
  summary.value = null
  error.value = ''
  try { await identitySessionReady(); workspace.value = currentWorkspace(); if(workspace.value==='ops')uni.hideTabBar();else uni.showTabBar(); if(workspace.value==='user') summary.value = await accountSummary() }
  catch (cause) { error.value = cause instanceof Error ? cause.message : '账号加载失败，请重试' }
  finally { busy.value = false }
}
async function change(id: string) {
  if (busy.value || String(summary.value?.activeMerchantId) === id) return
  busy.value = true
  try {
    if (!(await confirmAction('切换经营主体', '切换后返回工作台，未保存内容不会保留。'))) return
    await activateSubject(id)
  } catch (cause) { showError(cause) }
  finally { busy.value = false }
}
async function logout() {
  if (busy.value) return
  busy.value = true
  try {
    if (!(await confirmAction('退出登录', '将退出当前统一账号，并结束平台登录会话。确定退出？'))) return
    await logoutIotSession()
  } catch (cause) { showError(cause) }
  finally { busy.value = false }
}
function open(path: string) {
  if (!busy.value && ensureIotSession()) uni.navigateTo({ url: path })
}
function about() {
  uni.showModal({ title: '关于丰链云物联网', content: `版本 ${manifest.versionName}\n设备监测、告警处理与农场运维\n使用丰链云统一账号，业务数据按经营主体管理。`, showCancel: false, confirmText: '知道了' })
}
</script>

<template>
  <view class="page profile-page">
    <view class="profile-header">
      <view class="identity">
        <view class="avatar" aria-hidden="true">{{ avatarText }}</view>
        <view class="identity-copy">
          <text class="profile-name">{{ displayName }}</text>
          <text class="profile-account">账号：{{ user.username || '统一账号' }}</text>
          <text class="identity-badge">丰链云统一身份</text>
        </view>
      </view>
      <view v-if="workspace === 'user'" class="current-subject">
        <text class="subject-caption">当前经营主体</text>
        <text class="subject-name">{{ activeSubject?.merchantName || (busy ? '正在加载…' : error ? '暂时无法获取' : '尚未选择主体') }}</text>
      </view>
    </view>

    <view class="profile-content">
      <WorkspaceSwitch />
      <view v-if="workspace === 'ops' && error" class="error" role="alert">{{error}}<button role="button" class="btn" :disabled="busy" @tap="load">重新加载</button></view>
      <view v-if="workspace === 'user'" class="card subject-card">
        <view class="card-head">
          <text class="card-title">经营主体</text>
          <button class="btn btn-sm" :disabled="busy" :loading="busy" @tap="load">刷新</button>
        </view>
        <text class="section-note">切换主体后，设备、告警和工单随之切换</text>
        <view v-if="error" class="error" role="alert">{{ error }}<text class="block">请点击刷新重试</text></view>
        <view v-else-if="busy && !summary" class="loading">正在加载账号信息…</view>
        <template v-else-if="summary">
          <view v-for="item in summary.merchants" :key="item.merchantId" class="subject-row">
            <text class="merchant-name">{{ item.merchantName }}</text>
            <text v-if="String(summary.activeMerchantId) === String(item.merchantId)" class="active-label">当前主体</text>
            <button v-else class="btn btn-sm" :disabled="busy" :aria-label="'切换到' + item.merchantName" @tap="change(String(item.merchantId))">切换</button>
          </view>
          <text v-if="!summary.merchants.length" class="empty-subject">暂无可用经营主体，请在统一账号中心关联经营主体后刷新。</text>
          <text v-else-if="!activeSubject" class="empty-subject">请选择一个经营主体，开始查看物联网业务。</text>
        </template>
      </view>

      <view v-if="workspace === 'user'" class="card service-card">
        <text class="card-title service-title">我的服务</text>
        <button v-for="item in shortcuts" :key="item.path" class="service-row" :disabled="busy" @tap="open(item.path)">
          <text class="service-mark" aria-hidden="true">{{ item.mark }}</text>
          <view class="service-copy"><text class="service-name">{{ item.title }}</text><text class="section-note">{{ item.description }}</text></view>
          <text class="chevron" aria-hidden="true">›</text>
        </button>
      </view>

      <button class="card about-row" @tap="about"><text>关于丰链云物联网</text><view class="version"><text>v{{ manifest.versionName }}</text><text class="chevron" aria-hidden="true">›</text></view></button>
      <button class="btn btn-danger logout-button" :disabled="busy" @tap="logout">退出登录</button>
      <text class="footer-note">{{ workspace === 'ops' ? '运营工作台 · 全平台运营范围' : '账号与 PC 端通用 · 数据按经营主体隔离' }}</text>
      <OpsTabBar v-if="workspace === 'ops'" active="account" />
    </view>
  </view>
</template>

<style scoped lang="scss">
.profile-header{padding:28rpx 30rpx 32rpx;background:linear-gradient(180deg,#073821,#0d5d3b);color:#fff}
.identity{display:flex;align-items:center;gap:24rpx}.avatar{display:flex;flex-shrink:0;align-items:center;justify-content:center;width:104rpx;height:104rpx;border:2rpx solid #7ea88c;border-radius:32rpx;background:#dcebdd;color:#124e36;font-size:46rpx;font-weight:700}
.identity-copy{flex:1;min-width:0}.profile-name{display:block;font-size:38rpx;font-weight:700;overflow-wrap:anywhere;line-height:1.4}.profile-account{display:block;margin-top:6rpx;color:#c3d8cb;font-size:24rpx;overflow-wrap:anywhere}.identity-badge{display:inline-block;margin-top:14rpx;padding:5rpx 12rpx;border:1rpx solid #547b65;border-radius:8rpx;color:#deeee2;font-size:24rpx}
.current-subject{margin-top:30rpx;padding-top:24rpx;border-top:1rpx solid #3c7254}.subject-caption{display:block;color:#b8d0c0;font-size:24rpx}.subject-name{display:block;margin-top:8rpx;font-size:28rpx;font-weight:600;overflow-wrap:anywhere;line-height:1.5}
.profile-content{padding:24rpx}.section-note{display:block;color:#666666;font-size:24rpx;line-height:1.6}.subject-card .section-note{margin-bottom:12rpx}.subject-row{display:flex;align-items:center;justify-content:space-between;gap:20rpx;padding:22rpx 0;border-bottom:1rpx solid #edf2ee}.subject-row:last-child{border-bottom:0;padding-bottom:0}.merchant-name{flex:1;min-width:0;line-height:1.5;overflow-wrap:anywhere}.subject-row .btn{flex-shrink:0;min-height:72rpx}.active-label{flex-shrink:0;padding:8rpx 12rpx;border-radius:8rpx;background:#e5f5eb;color:#12764a;font-size:24rpx}.empty-subject{display:block;padding:20rpx 0;color:#666666;font-size:25rpx;line-height:1.7}
.service-card{padding:0 24rpx}.service-title{display:block;padding-top:24rpx;padding-bottom:8rpx}.service-row{display:flex;align-items:center;gap:18rpx;width:100%;padding:24rpx 0;border-bottom:1rpx solid #edf2ee;text-align:left;border-radius:0}.service-row:last-child{border-bottom:0}.service-mark{display:flex;align-items:center;justify-content:center;flex-shrink:0;width:64rpx;height:64rpx;border-radius:16rpx;background:#edf5ef;color:#286044;font-size:28rpx;font-weight:600}.service-copy{flex:1;min-width:0}.service-name{display:block;margin-bottom:4rpx;font-size:28rpx;font-weight:600}.chevron{font-size:36rpx;color:#93a398;line-height:1}.about-row{display:flex;align-items:center;justify-content:space-between;gap:16rpx;width:100%;min-height:100rpx;text-align:left;font-size:27rpx}.version{display:flex;align-items:center;gap:20rpx;color:#666666;font-size:24rpx;flex-shrink:0}.logout-button{width:100%;min-height:88rpx;margin-top:28rpx}.footer-note{display:block;margin:24rpx 0 8rpx;text-align:center;font-size:24rpx;color:#666666;line-height:1.6}.service-row[disabled]{opacity:.5}
</style>

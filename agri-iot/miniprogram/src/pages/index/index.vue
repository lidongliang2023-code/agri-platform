<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api, ensureIotSession, hasIotSession, logoutIotSession, statusMeta } from '../../api/iot'

const data=ref<Awaited<ReturnType<typeof api.overview>>|null>(null)
const statusBarHeight=ref(Number(uni.getSystemInfoSync().statusBarHeight||0))
const syncing=ref(false)
const user=ref<{nickname?:string;username?:string}|null>(uni.getStorageSync('user')||null)
onShow(load)
async function load(){if(!ensureIotSession())return;try{data.value=await api.overview()}catch(e){uni.showToast({title:e instanceof Error?e.message:'加载失败',icon:'none'})}}
function device(id:number){uni.navigateTo({url:`/pages/device/detail?id=${id}`})}
function alert(){uni.switchTab({url:'/pages/alert/list'})}
function devices(status=''){uni.setStorageSync('iot_status',status);uni.switchTab({url:'/pages/device/list'})}
function plot(){uni.switchTab({url:'/pages/plot/list'})}
function scene(){uni.navigateTo({url:'/pages/scene/index'})}
function automation(){uni.navigateTo({url:'/pages/automation/index'})}
function messages(){uni.navigateTo({url:'/pages/messages/index'})}
function account(){if(!hasIotSession()){uni.reLaunch({url:'/pages/login/index'});return}uni.showModal({title:'统一账号',content:`${user.value?.nickname||user.value?.username||'当前用户'}\n与平台其他系统共用同一用户账号`,confirmText:'退出登录',success(r){if(r.confirm)logoutIotSession()}})}
async function sync(){syncing.value=true;try{const r=await api.sync();uni.showToast({title:`待办工单 ${r.pendingWorkOrders} · 告警 ${r.pendingAlerts}`,icon:'none'});await load()}catch(e){uni.showToast({title:e instanceof Error?e.message:'同步失败',icon:'none'})}finally{syncing.value=false}}
</script>
<template>
  <view class="page home-page">
    <view class="hero" :style="{paddingTop:`${statusBarHeight+16}px`}">
      <view class="between"><view><text class="hello">{{user?.nickname||user?.username||'统一用户'}}的智慧农场</text><text class="tiny">统一账号 · 物联网移动工作台</text></view><view class="header-actions"><text @click="messages">🔔</text><text @click="account">●</text><text @click="load">↻</text></view></view>
      <text class="hero-title">设备与作物，此刻都在掌握</text>
      <view class="farm-meta"><text>在线率 {{ data && data.stats.devices ? Math.round(data.stats.online/data.stats.devices*100) : '--' }}%</text><text>今日数据 {{ data?.stats.dataToday.toLocaleString()||'--' }} 点</text></view>
    </view>
    <view v-if="!data" class="loading">正在加载设备与环境数据…</view>
    <view v-else class="pad body">
      <view class="card stats"><view @click="devices()"><b>{{data.stats.devices}}</b><text>设备总数</text></view><view @click="devices('online')"><b class="green">{{data.stats.online}}</b><text>在线</text></view><view @click="devices('offline')"><b>{{data.stats.offline}}</b><text>离线</text></view><view @click="alert"><b class="red">{{data.stats.alerts}}</b><text>告警</text></view></view>
      <view class="card"><view class="card-head"><text class="card-title">🌡️ 实时环境</text><text class="card-sub">{{data.environment[0]?.key}}</text></view><view class="env-grid"><view v-for="item in data.environment.slice(0,4)" :key="item.key"><text>{{ item.name }}</text><b>{{item.value}}<text>{{item.unit}}</text></b><em :class="item.status">{{item.change>0?'+':''}}{{item.change}}</em></view></view></view>
      <view class="card"><view class="card-head"><text class="card-title">⚡ 快捷控制</text><text class="card-sub" @click="scene">场景模式 ›</text></view><view class="quick-grid"><view @click="devices()"><text class="qi blue">📋</text><text>设备列表</text></view><view @click="scene"><text class="qi purple">🌬️</text><text>一键场景</text></view><view @click="automation"><text class="qi orange">🔀</text><text>自动化</text></view><view @click="alert"><text class="qi red">🚨</text><text>告警中心</text></view><view @click="plot"><text class="qi green">🌾</text><text>地块监测</text></view></view></view>
      <view class="section-head"><text>🚨 实时告警</text><text class="card-sub" @click="alert">全部 ›</text></view>
      <scroll-view scroll-x class="alert-scroll" :show-scrollbar="false"><view class="alert-card" v-for="item in data.alerts.slice(0,3)" :key="item.id" @click="alert"><view class="between"><text class="tag" :class="statusMeta(item.level).tone">{{statusMeta(item.level).label}}</text><text class="tiny">{{item.createdAt}}</text></view><text class="alert-title">{{item.title}}</text><text class="muted">{{item.deviceName}} · {{item.content}}</text></view></scroll-view>
      <view class="section-head"><text>📋 最近设备</text><text class="card-sub" @click="devices()">全部 ›</text></view>
      <view class="device-list"><view class="device-row" v-for="item in data.devices.slice(0,5)" :key="item.id" @click="device(item.id)"><span>{{item.typeName.includes('温湿度')?'🌡️':item.typeName.includes('土壤')?'🌱':item.typeName.includes('阀')?'💧':'📱'}}</span><view><text class="strong">{{item.deviceName}}</text><text class="tiny">{{item.deviceCode}} · {{item.protocol}} · {{item.lastReport}}</text></view><text class="tag" :class="statusMeta(item.onlineStatus).tone">{{statusMeta(item.onlineStatus).label}}</text></view></view>
      <view class="sync-card"><view><text class="strong">📴 离线数据同步</text><text class="tiny">弱网环境可继续查看缓存数据</text></view><button class="btn btn-sm btn-ghost" :loading="syncing" @click="sync">立即同步</button></view>
    </view>
  </view>
</template>
<style lang="scss" scoped>
.hello{display:block;font-size:28rpx;font-weight:650}.header-actions{display:flex;gap:14rpx;font-size:29rpx}.farm-meta{display:flex;gap:18rpx;margin-top:14rpx;color:rgba(255,255,255,.58);font-size:20rpx}.body{margin-top:-28rpx;position:relative;z-index:2}.stats{display:grid;grid-template-columns:repeat(4,1fr);padding:22rpx 8rpx}.stats>view{display:flex;align-items:center;flex-direction:column;gap:4rpx;border-right:1rpx solid #edf2ee}.stats>view:last-child{border-right:0}.stats b{font-family:monospace;font-size:32rpx}.stats text{color:#718277;font-size:18rpx}.green{color:#12764a}.red{color:#c54b4b}.env-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12rpx}.env-grid>view{position:relative;display:flex;flex-direction:column;gap:4rpx;padding:16rpx;border:1rpx solid #edf2ee;border-radius:15rpx;background:#fbfdfc}.env-grid>view>text:first-child{color:#718277;font-size:19rpx}.env-grid b{font-size:30rpx}.env-grid b text{color:#94a198;font-size:17rpx}.env-grid em{position:absolute;right:12rpx;top:12rpx;color:#12764a;font-size:17rpx;font-style:normal}.env-grid em.warning{color:#c84b4b}.env-grid em.critical{color:#c02b2b;font-weight:700}.quick-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:2rpx}.quick-grid>view{display:flex;align-items:center;flex-direction:column;gap:8rpx;font-size:18rpx;text-align:center}.qi{display:flex;width:72rpx;height:72rpx;align-items:center;justify-content:center;border-radius:20rpx;font-size:30rpx}.qi.blue{background:#e7f3fa}.qi.purple{background:#f2eafa}.qi.orange{background:#fff3dd}.qi.red{background:#feebeb}.qi.green{background:#e5f5eb}.section-head{display:flex;justify-content:space-between;margin:26rpx 2rpx 12rpx;font-size:28rpx;font-weight:700}.alert-scroll{white-space:nowrap}.alert-card{display:inline-flex;width:440rpx;box-sizing:border-box;flex-direction:column;gap:8rpx;margin-right:14rpx;padding:20rpx;border:1rpx solid #e1e9e3;border-radius:20rpx;background:#fff;vertical-align:top;white-space:normal}.alert-title{font-size:24rpx;font-weight:650}.device-list{overflow:hidden;border:1rpx solid #e1e9e3;border-radius:20rpx;background:#fff}.device-row{display:grid;grid-template-columns:46rpx 1fr auto;align-items:center;gap:12rpx;padding:16rpx 20rpx;border-bottom:1rpx solid #edf2ee}.device-row:last-child{border-bottom:0}.device-row>span{font-size:27rpx}.device-row>view{display:flex;flex-direction:column;gap:4rpx}.sync-card{display:flex;align-items:center;justify-content:space-between;margin-top:18rpx;padding:18rpx;border-radius:18rpx;background:#fff3dd}.sync-card>view{display:flex;flex-direction:column;gap:4rpx}.sync-card strong{color:#8f661b;font-size:22rpx}.sync-card .tiny{color:#9b7d45}
</style>

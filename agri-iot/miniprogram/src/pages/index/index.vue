<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import WorkspaceSwitch from '../../components/WorkspaceSwitch.vue'
import { api, ensureIotSession, statusMeta, identitySessionReady, currentWorkspace, workspaceHome } from '../../api/iot'

const data=ref<Awaited<ReturnType<typeof api.overview>>|null>(null)
const syncing=ref(false),error=ref('')
/** 全部业务入口：与 PC 端菜单一一对应，图标统一用单字色块（与“我的”页一致）。 */
const entries=[
  {mark:'监',label:'实时监测',tone:'green',path:'/pages/monitor/index'},
  {mark:'设',label:'设备管理',tone:'blue',path:'/pages/device/list',tab:true},
  {mark:'网',label:'边缘网关',tone:'blue',path:'/pages/gateway/list'},
  {mark:'地',label:'地块监测',tone:'green',path:'/pages/plot/list',tab:true},
  {mark:'景',label:'场景控制',tone:'purple',path:'/pages/scene/index'},
  {mark:'自',label:'自动化规则',tone:'purple',path:'/pages/automation/index'},
  {mark:'警',label:'告警中心',tone:'red',path:'/pages/alert/list',tab:true},
  {mark:'阈',label:'告警阈值',tone:'orange',path:'/pages/threshold/index'},
  {mark:'析',label:'数据分析',tone:'blue',path:'/pages/analytics/index'},
  {mark:'维',label:'运维与 OTA',tone:'orange',path:'/pages/maintenance/index'},
  {mark:'信',label:'消息通知',tone:'green',path:'/pages/messages/index'},
  {mark:'修',label:'设备报修',tone:'red',path:'/pages/maintenance/create'},
]
const user=ref<{nickname?:string;username?:string}|null>(uni.getStorageSync('user')||null)
onShow(load)
async function load(){if(!ensureIotSession())return;user.value=uni.getStorageSync('user')||null;try{await identitySessionReady();if(currentWorkspace()==='ops'){data.value=null;uni.reLaunch({url:workspaceHome()});return}uni.showTabBar();data.value=await api.overview();error.value=''}catch(e){data.value=null;error.value=e instanceof Error?e.message:'加载失败'}}
function open(entry:{path:string;tab?:boolean}){if(entry.tab)uni.switchTab({url:entry.path});else uni.navigateTo({url:entry.path})}
function account(){uni.switchTab({url:'/pages/account/index'})}
function device(id:number){uni.navigateTo({url:`/pages/device/detail?id=${id}`})}
function alert(){uni.switchTab({url:'/pages/alert/list'})}
function devices(status=''){uni.setStorageSync('iot_status',status);uni.switchTab({url:'/pages/device/list'})}
function messages(){uni.navigateTo({url:'/pages/messages/index'})}
function deviceMark(typeName=''){return typeName.includes('温湿度')?'温':typeName.includes('土壤')?'土':typeName.includes('阀')?'阀':typeName.includes('摄像')?'像':typeName.includes('气象')?'气':'设'}
async function sync(){syncing.value=true;try{const r=await api.sync();uni.showToast({title:`待办工单 ${r.pendingWorkOrders} · 告警 ${r.pendingAlerts}`,icon:'none'});await load()}catch(e){uni.showToast({title:e instanceof Error?e.message:'同步失败',icon:'none'})}finally{syncing.value=false}}
</script>
<template>
  <view class="page home-page">
    <view class="hero">
      <view class="hero-top">
        <view class="hero-copy"><text class="hello">{{user?.nickname||user?.username||'统一用户'}}，你好</text><text class="hero-tip">统一账号 · 物联网移动工作台</text></view>
        <view class="hero-actions"><button class="hero-btn" aria-label="消息通知" @tap="messages">消息</button><button class="hero-btn" aria-label="刷新数据" @tap="load">刷新</button></view>
      </view>
      <view class="hero-meta">
        <view><text class="meta-value">{{ data && data.stats.devices ? Math.round(data.stats.online/data.stats.devices*100) : '--' }}<text class="meta-unit">%</text></text><text class="meta-label">设备在线率</text></view>
        <view><text class="meta-value">{{ data?.stats.dataToday.toLocaleString()||'--' }}</text><text class="meta-label">今日采集数据点</text></view>
      </view>
    </view>
    <view class="pad body">
      <WorkspaceSwitch />
      <view v-if="error" class="card"><view class="error" @tap="load">{{error}}<text class="retry">点击重试</text></view><button class="btn btn-block" @tap="account">查看账号与经营主体</button></view>
      <view v-else-if="!data" class="card loading">正在加载设备与环境数据…</view>
      <template v-else>
        <view class="card stats">
          <view @tap="devices()"><text class="stat-value">{{data.stats.devices}}</text><text class="stat-label">设备总数</text></view>
          <view @tap="devices('online')"><text class="stat-value green">{{data.stats.online}}</text><text class="stat-label">在线</text></view>
          <view @tap="devices('offline')"><text class="stat-value">{{data.stats.offline}}</text><text class="stat-label">离线</text></view>
          <view @tap="alert"><text class="stat-value red">{{data.stats.alerts}}</text><text class="stat-label">告警</text></view>
        </view>
      </template>
      <view class="card">
        <view class="card-head"><text class="card-title">全部功能</text></view>
        <view class="entry-grid"><view v-for="entry in entries" :key="entry.path" class="grid-entry" @tap="open(entry)"><text class="item-icon" :class="entry.tone">{{entry.mark}}</text><text class="entry-label">{{entry.label}}</text></view></view>
      </view>
      <template v-if="data">
        <view class="section-title"><text>实时环境</text><text class="link" @tap="open({path:'/pages/monitor/index'})">实时监测 ›</text></view>
        <view class="env-grid"><view v-for="item in data.environment.slice(0,4)" :key="item.key" class="env-item"><text class="env-name">{{ item.name }}</text><text class="env-value">{{item.value}}<text class="env-unit">{{item.unit}}</text></text><text class="env-change" :class="item.status">{{item.change>0?'+':''}}{{item.change}}</text></view></view>
        <view class="section-title"><text>实时告警</text><text class="link" @tap="alert">全部 ›</text></view>
        <view class="list">
          <view v-for="item in data.alerts.slice(0,3)" :key="item.id" class="list-item column" @tap="alert">
            <view class="item-head"><text class="item-title">{{item.title}}</text><text class="tag" :class="statusMeta(item.level).tone">{{statusMeta(item.level).label}}</text></view>
            <text class="item-meta">{{item.deviceName}} · {{item.content}}</text><text class="tiny">{{item.createdAt}}</text>
          </view>
          <view v-if="!data.alerts.length" class="list-item"><text class="muted">暂无告警，设备运行正常</text></view>
        </view>
        <view class="section-title"><text>最近设备</text><text class="link" @tap="devices()">全部 ›</text></view>
        <view class="list">
          <view v-for="item in data.devices.slice(0,5)" :key="item.id" class="list-item" @tap="device(item.id)">
            <text class="item-icon">{{deviceMark(item.typeName)}}</text>
            <view class="list-body"><view class="item-head"><text class="item-title">{{item.deviceName}}</text><text class="tag" :class="statusMeta(item.onlineStatus).tone">{{statusMeta(item.onlineStatus).label}}</text></view><text class="item-meta">{{item.deviceCode}} · {{item.protocol}} · {{item.lastReport}}</text></view>
          </view>
        </view>
        <view class="sync-card"><view class="sync-copy"><text class="sync-title">待办状态刷新</text><text class="sync-tip">按当前经营主体重新统计工单、告警与消息</text></view><button class="btn btn-sm btn-ghost" :loading="syncing" @tap="sync">刷新待办</button></view>
      </template>
    </view>
  </view>
</template>
<style lang="scss" scoped>
.hero{padding:28rpx 28rpx 76rpx;border-radius:0;background:linear-gradient(180deg,#073821,#0d5d3b)}
.hero-top{display:flex;align-items:flex-start;justify-content:space-between;gap:20rpx}.hero-copy{flex:1;min-width:0}.hello{display:block;font-size:34rpx;font-weight:700;line-height:1.4;overflow-wrap:anywhere}.hero-tip{display:block;margin-top:6rpx;color:rgba(255,255,255,.62);font-size:24rpx}
.hero-actions{display:flex;flex-shrink:0;gap:12rpx}.hero-btn{display:flex;min-height:66rpx;align-items:center;padding:0 22rpx;border:1rpx solid rgba(255,255,255,.28);border-radius:30rpx;background:rgba(255,255,255,.1);color:#fff;font-size:24rpx}
.hero-meta{display:flex;gap:48rpx;margin-top:30rpx}.hero-meta>view{display:flex;flex-direction:column;gap:4rpx}.meta-value{font-size:44rpx;font-weight:700;line-height:1.2}.meta-unit{margin-left:4rpx;font-size:26rpx}.meta-label{color:rgba(255,255,255,.62);font-size:24rpx}
.body{position:relative;z-index:2;margin-top:-52rpx}
.stats{display:grid;grid-template-columns:repeat(4,1fr);padding:24rpx 8rpx}.stats>view{display:flex;align-items:center;flex-direction:column;gap:6rpx;border-right:1rpx solid #edf2ee}.stats>view:last-child{border-right:0}.stat-value{font-size:38rpx;font-weight:700}.stat-label{color:#718277;font-size:24rpx}.green{color:#12764a}.red{color:#c54b4b}
.entry-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));row-gap:28rpx;column-gap:8rpx}.grid-entry{display:flex;align-items:center;flex-direction:column;gap:12rpx;padding:4rpx 0}.grid-entry .item-icon{width:84rpx;height:84rpx;border-radius:24rpx;font-size:32rpx}.entry-label{color:#34473b;font-size:24rpx;text-align:center;line-height:1.3}
.env-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16rpx}.env-item{position:relative;display:flex;flex-direction:column;gap:6rpx;padding:24rpx;border:1rpx solid #e1e9e3;border-radius:20rpx;background:#fff}.env-name{color:#718277;font-size:24rpx}.env-value{font-size:36rpx;font-weight:700}.env-unit{margin-left:4rpx;color:#94a198;font-size:24rpx;font-weight:400}.env-change{position:absolute;top:22rpx;right:20rpx;color:#12764a;font-size:24rpx}.env-change.warning{color:#c84b4b}.env-change.critical{color:#c02b2b;font-weight:700}
.sync-card{display:flex;align-items:center;justify-content:space-between;gap:20rpx;margin-top:24rpx;padding:24rpx;border-radius:20rpx;background:#fff3dd}.sync-copy{flex:1;min-width:0}.sync-title{display:block;color:#8f661b;font-size:28rpx;font-weight:650}.sync-tip{display:block;margin-top:4rpx;color:#9b7d45;font-size:24rpx;line-height:1.5}
</style>

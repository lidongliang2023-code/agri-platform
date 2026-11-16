<script setup lang="ts">
import {ref,onUnmounted} from 'vue'
import {onShow,onHide} from '@dcloudio/uni-app'
import {api,type Row} from '../../api/iot'
const data=ref<Row|null>(null),error=ref(''),busy=ref(false),updated=ref('')
let timer:ReturnType<typeof setInterval>|undefined
async function load(){if(busy.value)return;busy.value=true;try{data.value=await api.monitor();updated.value=new Date().toLocaleTimeString();error.value=''}catch(e){data.value=null;error.value=e instanceof Error?e.message:'监测读取失败'}finally{busy.value=false}}
onShow(()=>{void load();clearInterval(timer);timer=setInterval(()=>void load(),10000)});onHide(()=>clearInterval(timer));onUnmounted(()=>clearInterval(timer))
</script>
<template>
  <view class="page pad">
    <view class="toolbar">
      <view class="toolbar-main"><text class="toolbar-title">每 10 秒自动刷新</text><text class="toolbar-sub">更新于 {{updated||'—'}}</text></view>
      <view class="toolbar-actions"><button class="btn btn-sm" :disabled="busy" @tap="load">刷新</button></view>
    </view>
    <view v-if="error" class="error" @tap="load">{{error}}<text class="retry">点击重试</text></view>
    <view v-if="!data&&!error" class="loading">正在读取监测数据…</view>
    <template v-if="data">
      <view class="card"><view class="metric-grid"><view v-for="(label,key) in {devices:'设备总数',online:'在线设备',offline:'离线设备',alerts:'待处理告警'}" :key="key"><text class="muted">{{label}}</text><text class="value">{{data.stats[key]}}</text></view></view></view>
      <view class="card"><view class="card-head"><text class="card-title">环境指标</text></view><view class="metric-grid"><view v-for="e in data.environment" :key="e.key"><text class="muted">{{e.name}}</text><text class="value">{{e.value}} {{e.unit}}</text><text class="tiny">{{({normal:'正常',warning:'偏离',critical:'严重偏离'} as Record<string,string>)[e.status]||e.status}}</text></view></view></view>
      <view class="card"><view class="card-head"><text class="card-title">环境趋势</text><text class="card-sub">左右滑动查看</text></view><scroll-view scroll-x :show-scrollbar="false"><view class="trend"><view v-for="(point,index) in data.series" :key="index" class="trend-item"><text class="tiny">{{point.time}}</text><text>温度 {{point.temperature??'—'}}℃</text><text>湿度 {{point.humidity??'—'}}%</text><text>土壤 {{point.soilMoisture??'—'}}%</text></view></view></scroll-view><text v-if="!data.series?.length" class="muted">暂无趋势数据</text></view>
      <view class="card"><view class="card-head"><text class="card-title">近期告警</text></view><view v-for="a in data.alerts" :key="a.id" class="field"><text class="field-main">{{a.title}}</text><text class="muted">{{a.deviceName}}</text></view><text v-if="!data.alerts?.length" class="muted">暂无告警</text></view>
      <view class="card"><view class="card-head"><text class="card-title">近期控制</text></view><view v-for="c in data.recentControls" :key="c.id" class="field"><text class="field-main">{{c.deviceName}} · {{c.action}}</text><text class="muted">{{c.result}}</text></view><text v-if="!data.recentControls?.length" class="muted">暂无控制记录</text></view>
    </template>
  </view>
</template>
<style scoped>.trend{display:flex;gap:16rpx}.trend-item{display:flex;flex-shrink:0;flex-direction:column;gap:10rpx;min-width:200rpx;padding:20rpx;border-radius:14rpx;background:#f7faf8;font-size:26rpx}.field{gap:16rpx}.field-main{flex:1;min-width:0;font-size:26rpx}</style>

<script setup lang="ts">
import {ref,computed} from 'vue'
import {onLoad} from '@dcloudio/uni-app'
import {api,statusMeta,type Row} from '../../api/iot'
import {go} from '../../utils/ui'
const id=ref(0),data=ref<Row|null>(null),error=ref('')
const located=computed(()=>data.value?.plot?.latitude!=null&&data.value?.plot?.longitude!=null)
const markers=computed(()=>located.value?[{id:id.value,latitude:Number(data.value!.plot.latitude),longitude:Number(data.value!.plot.longitude),title:data.value!.plot.plotName}]:[])
onLoad(o=>{id.value=Number(o?.id);void load()})
async function load(){try{data.value=await api.plotMonitoring(id.value);error.value=''}catch(e){error.value=e instanceof Error?e.message:'地块读取失败'}}
function devices(){uni.setStorageSync('iot_plot',id.value);uni.switchTab({url:'/pages/device/list'})}
</script>
<template>
  <view class="page pad">
    <view v-if="error" class="error" @tap="load">{{error}}<text class="retry">点击重试</text></view>
    <view v-if="!data&&!error" class="loading">正在加载地块…</view>
    <template v-if="data">
      <view class="card">
        <text class="detail-title">{{data.plot.plotName}}</text>
        <text class="item-meta">{{data.plot.farmName}} · {{data.plot.area}} 亩 · {{data.plot.cropName||'未种植'}}{{data.plot.cropStage?' · '+data.plot.cropStage:''}}</text>
        <view class="kv-grid head-kv"><view><text>设备</text><text class="kv-value">{{data.summary.deviceCount}}</text></view><view><text>在线</text><text class="kv-value">{{data.summary.onlineCount}}</text></view><view><text>告警</text><text class="kv-value">{{data.summary.alertCount}}</text></view></view>
        <view class="field"><text class="field-label">地块编码</text><text class="field-value">{{data.plot.plotCode}}</text></view>
        <view class="field"><text class="field-label">品种</text><text class="field-value">{{data.plot.cropVariety||'—'}}</text></view>
        <view class="field"><text class="field-label">种植 / 预计采收</text><text class="field-value">{{data.plot.plantingDate||'—'}} / {{data.plot.expectedHarvestDate||'—'}}</text></view>
        <view class="field"><text class="field-label">档案来源</text><text class="field-value">生产管理 · {{data.plot.sourceUpdatedAt||'—'}}</text></view>
        <view class="action-row"><button class="btn btn-sm btn-ghost" @tap="devices">管理地块设备</button></view>
      </view>
      <view class="card">
        <view class="card-head"><text class="card-title">地块位置</text></view>
        <map v-if="located" class="plot-map" :latitude="Number(data.plot.latitude)" :longitude="Number(data.plot.longitude)" :markers="markers" :scale="16"/>
        <text v-else class="muted">生产地块尚未提供定位坐标</text>
      </view>
      <view class="card">
        <view class="card-head"><text class="card-title">设备与最新读数</text><text class="card-sub">{{data.devices?.length||0}} 台</text></view>
        <view v-for="d in data.devices" :key="d.id" class="field" @tap="go('/pages/device/detail?id='+d.id)"><text>{{d.deviceName}}</text><text class="tag" :class="statusMeta(d.onlineStatus).tone">{{statusMeta(d.onlineStatus).label}} ›</text></view>
        <view v-if="data.telemetry?.length" class="metric-grid telemetry"><view v-for="(t,index) in data.telemetry" :key="index"><text class="muted">{{t.name}}</text><text class="value">{{t.value}} {{t.unit}}</text><text class="tiny">{{t.recordedAt}}</text></view></view>
        <text v-if="!data.devices?.length" class="muted block">该地块暂未绑定设备</text>
      </view>
      <view class="card">
        <view class="card-head"><text class="card-title">地块告警</text></view>
        <view v-for="a in data.alerts" :key="a.id" class="alert-row"><text class="strong">{{a.title}}</text><text class="item-meta">{{a.content}}</text></view>
        <text v-if="!data.alerts.length" class="muted block">暂无告警</text>
      </view>
    </template>
  </view>
</template>
<style scoped>.detail-title{display:block;margin-bottom:6rpx;font-size:34rpx;font-weight:700}.head-kv{margin:18rpx 0 8rpx}.plot-map{width:100%;height:400rpx;border-radius:14rpx;overflow:hidden}.telemetry{margin-top:18rpx}.alert-row{display:flex;flex-direction:column;gap:4rpx;padding:16rpx 0;border-bottom:1rpx solid #edf2ee}.alert-row:last-child{border-bottom:0}</style>

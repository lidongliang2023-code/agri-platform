<script setup lang="ts">
import { ref,computed } from 'vue'
import { onShow,onPullDownRefresh } from '@dcloudio/uni-app'
import SegTabs from '../../components/SegTabs.vue'
import { api,type Plot } from '../../api/iot'
const items=ref<Plot[]>([]),keyword=ref(''),error=ref(''),loading=ref(false)
const farm=ref('all'),state=ref('all'),mode=ref('list')
const farms=computed(()=>[{id:'all',name:'全部农场'},...Array.from(new Map(items.value.filter(i=>i.farmId!=null).map(i=>[String(i.farmId),{id:String(i.farmId),name:i.farmName||'农场 '+i.farmId}])).values())])
const visible=computed(()=>items.value.filter(i=>`${i.plotName} ${i.plotCode} ${i.farmName||''} ${i.cropName||''}`.includes(keyword.value.trim())&&(farm.value==='all'||String(i.farmId)===farm.value)&&(state.value==='all'||i.status===state.value)))
const markers=computed(()=>visible.value.filter(i=>i.latitude!=null&&i.longitude!=null&&Number.isFinite(Number(i.latitude))&&Number.isFinite(Number(i.longitude))&&Math.abs(Number(i.latitude))<=90&&Math.abs(Number(i.longitude))<=180).map(i=>({id:Number(i.id),latitude:Number(i.latitude),longitude:Number(i.longitude),title:i.plotName,callout:{content:i.plotName,display:'ALWAYS',padding:6,borderRadius:6}})))
function selectFarm(e:any){farm.value=farms.value[Number(e.detail.value)]?.id||'all'}
function markerTap(e:any){const item=visible.value.find(i=>Number(i.id)===Number(e.detail.markerId));if(item)detail(item)}
function detail(plot:Plot){uni.navigateTo({url:'/pages/plot/detail?id='+plot.id})}
onShow(load)
onPullDownRefresh(load)
async function load(){loading.value=true;try{items.value=await api.plots();error.value=''}catch(e){items.value=[];error.value=e instanceof Error?e.message:'加载失败'}finally{loading.value=false;uni.stopPullDownRefresh()}}
</script>
<template>
  <view class="page pad">
    <view class="toolbar">
      <view class="toolbar-main"><text class="toolbar-title">共 {{items.length}} 个地块</text><text class="toolbar-sub">生产管理地块档案 · {{items.reduce((sum,i)=>sum+i.onlineCount,0)}} 台设备在线</text></view>
    </view>
    <view class="sticky-head"><view class="search-bar"><text>⌕</text><input v-model="keyword" placeholder="搜索地块 / 农场 / 作物" confirm-type="search"/></view><view class="filter-row"><picker :range="farms" range-key="name" @change="selectFarm"><view class="chip">{{farms.find(f=>f.id===farm)?.name||'全部农场'}} ▾</view></picker><button class="chip" @tap="mode=mode==='map'?'list':'map'">{{mode==='map'?'列表视图':'地图视图'}}</button></view><SegTabs v-model="state" :options="[['all','全部状态'],['normal','正常'],['warning','已停用']]"/></view>
    <view v-if="mode==='map'" class="card"><map v-if="markers.length" :latitude="markers[0].latitude" :longitude="markers[0].longitude" :markers="markers" :include-points="markers" @markertap="markerTap" @callouttap="markerTap"/><text v-else class="muted">当前筛选没有可定位的地块</text><text class="tiny block">{{visible.length}} 个地块，{{markers.length}} 个具有有效坐标；点击地图标记查看详情。</text></view>
    <view v-if="error" class="error" @tap="load">{{error}}<text class="retry">点击重试</text></view>
    <view v-if="loading&&!items.length" class="loading">正在加载地块…</view>
    <view v-else class="list">
      <view v-for="(item,index) in visible" :key="item.plotId || item.id" class="list-item" @tap="detail(item)">
        <view class="plot-map" :class="`tone-${index%4}`"><text class="plot-mark">地</text><text class="plot-count">{{item.onlineCount}}/{{item.deviceCount}}</text></view>
        <view class="list-body">
          <view class="item-head"><text class="item-title">{{item.plotName}}</text><text class="tag" :class="item.status==='warning'?'orange':'green'">{{item.status==='warning'?'已停用':'正常'}}</text></view>
          <text class="item-meta">{{item.plotCode}} · {{item.area}} 亩 · {{item.farmName||'生产地块'}}</text>
          <text class="item-meta">{{item.cropName||'未种植'}}{{item.cropStage?' · '+item.cropStage:''}}</text>
          <view class="progress"><view :style="{width:`${item.deviceCount?item.onlineCount/item.deviceCount*100:0}%`}"/></view>
        </view>
        <text class="chev">›</text>
      </view>
      <view v-if="!visible.length&&!error" class="empty">暂无匹配地块</view>
    </view>
  </view>
</template>
<style lang="scss" scoped>
.plot-map{position:relative;display:flex;flex-shrink:0;width:112rpx;height:112rpx;align-items:center;justify-content:center;border-radius:18rpx;background:#dff4e7}.plot-map.tone-1{background:#e4f2fb}.plot-map.tone-2{background:#fff3dd}.plot-map.tone-3{background:#f2eafa}
.plot-mark{color:#286044;font-size:36rpx;font-weight:700}.plot-count{position:absolute;right:6rpx;bottom:6rpx;padding:2rpx 8rpx;border-radius:8rpx;background:rgba(255,255,255,.9);color:#0e5233;font-size:24rpx}.progress{margin-top:8rpx}
</style>

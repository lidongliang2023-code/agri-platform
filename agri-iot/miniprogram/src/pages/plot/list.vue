<script setup lang="ts">
import { ref,computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api,type Plot } from '../../api/iot'
const items=ref<Plot[]>([]),keyword=ref(''),error=ref(''),loading=ref(false)
const visible=computed(()=>items.value.filter(i=>`${i.plotName} ${i.plotCode} ${i.farmName||''} ${i.cropName||''}`.includes(keyword.value)))
function detail(plot:Plot){uni.navigateTo({url:'/pages/plot/detail?id='+plot.id})}
onShow(load)
async function load(){loading.value=true;try{items.value=await api.plots();error.value=''}catch(e){items.value=[];error.value=e instanceof Error?e.message:'加载失败'}finally{loading.value=false}}
</script>
<template>
  <view class="page pad">
    <view class="toolbar">
      <view class="toolbar-main"><text class="toolbar-title">共 {{items.length}} 个地块</text><text class="toolbar-sub">生产管理地块档案 · {{items.reduce((sum,i)=>sum+i.onlineCount,0)}} 台设备在线</text></view>
    </view>
    <view class="sticky-head"><view class="search-bar"><text>⌕</text><input v-model="keyword" placeholder="搜索地块 / 农场 / 作物" confirm-type="search"/></view></view>
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

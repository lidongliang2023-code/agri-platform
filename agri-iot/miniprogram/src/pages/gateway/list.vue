<script setup lang="ts">
import {ref,computed} from 'vue'
import {onShow} from '@dcloudio/uni-app'
import {api,statusMeta,type Row} from '../../api/iot'
import {go} from '../../utils/ui'
import SegTabs from '../../components/SegTabs.vue'
const rows=ref<Row[]>([]),keyword=ref(''),status=ref(''),error=ref(''),busy=ref(false)
const visible=computed(()=>rows.value.filter(r=>(!keyword.value||`${r.gatewayName} ${r.gatewayCode} ${r.farmName}`.includes(keyword.value))&&(!status.value||r.onlineStatus===status.value)))
onShow(load)
async function load(){if(busy.value)return;busy.value=true;try{rows.value=await api.gateways();error.value=''}catch(e){rows.value=[];error.value=e instanceof Error?e.message:'网关加载失败'}finally{busy.value=false}}
</script>
<template>
  <view class="page pad">
    <view class="toolbar">
      <view class="toolbar-main"><text class="toolbar-title">共 {{rows.length}} 台网关</text><text class="toolbar-sub">在线 {{rows.filter(r=>r.onlineStatus==='online').length}} · 离线 {{rows.filter(r=>r.onlineStatus==='offline').length}}</text></view>
      <view class="toolbar-actions"><button class="btn btn-sm btn-primary" @tap="go('/pages/gateway/edit')">新增网关</button></view>
    </view>
    <view class="sticky-head">
      <view class="search-bar"><text>⌕</text><input v-model="keyword" placeholder="搜索名称 / 编码 / 农场" confirm-type="search"/></view>
      <SegTabs v-model="status" :options="[['','全部'],['online','在线'],['offline','离线']]"/>
    </view>
    <view v-if="error" class="error" @tap="load">{{error}}<text class="retry">点击重试</text></view>
    <view v-if="busy&&!rows.length" class="loading">正在加载网关…</view>
    <view class="list">
      <view v-for="row in visible" :key="row.id" class="list-item" @tap="go('/pages/gateway/detail?id='+row.id)">
        <text class="item-icon" :class="statusMeta(row.onlineStatus).tone">网</text>
        <view class="list-body">
          <view class="item-head"><text class="item-title">{{row.gatewayName}}</text><text class="tag" :class="statusMeta(row.onlineStatus).tone">{{statusMeta(row.onlineStatus).label}}</text></view>
          <text class="item-meta">{{row.gatewayCode}} · {{row.model}} · {{row.protocol}}</text>
          <text class="item-meta">{{row.farmName}} · 设备 {{row.onlineCount}}/{{row.totalCount}} · CPU {{row.cpuRate}}% · 内存 {{row.memoryRate}}%</text>
          <text class="tiny">最近在线 {{row.lastOnline||'—'}}</text>
        </view>
        <text class="chev">›</text>
      </view>
      <view v-if="!visible.length&&!busy&&!error" class="empty">暂无匹配网关</view>
    </view>
  </view>
</template>

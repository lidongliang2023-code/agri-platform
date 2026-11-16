<script setup lang="ts">
import {ref} from 'vue'
import {onShow} from '@dcloudio/uni-app'
import {api,statusMeta,type Row} from '../../api/iot'
import {go} from '../../utils/ui'
import SegTabs from '../../components/SegTabs.vue'
const orders=ref<Row[]>([]),firmware=ref<Row[]>([]),ota=ref<Row[]>([]),tab=ref('orders'),error=ref(''),busy=ref(false)
onShow(load)
async function load(){if(busy.value)return;busy.value=true;try{[orders.value,firmware.value,ota.value]=await Promise.all([api.workOrders(),api.firmware(),api.ota()]);error.value=''}catch(e){orders.value=[];firmware.value=[];ota.value=[];error.value=e instanceof Error?e.message:'运维读取失败'}finally{busy.value=false}}
</script>
<template>
  <view class="page pad">
    <view class="toolbar">
      <view class="toolbar-main"><text class="toolbar-title">{{orders.filter(o=>o.status!=='resolved'&&o.status!=='done'&&o.status!=='closed').length}} 个工单待完成</text><text class="toolbar-sub">工单进度、固件版本与升级任务</text></view>
      <view class="toolbar-actions"><button class="btn btn-sm btn-primary" @tap="go('/pages/maintenance/create')">设备报修</button></view>
    </view>
    <view class="sticky-head"><SegTabs v-model="tab" :options="[['orders',`运维工单 ${orders.length}`],['firmware','固件版本'],['ota','升级任务']]"/></view>
    <view v-if="error" class="error" @tap="load">{{error}}<text class="retry">点击重试</text></view>
    <view v-if="busy&&!orders.length&&!firmware.length&&!ota.length" class="loading">正在加载…</view>
    <view v-if="tab==='orders'" class="list">
      <view v-for="o in orders" :key="o.id" class="list-item column">
        <view class="item-head"><text class="item-title">{{o.deviceName}}</text><text class="tag" :class="statusMeta(o.status).tone">{{statusMeta(o.status).label}}</text></view>
        <text class="item-meta">{{o.orderNo}} · {{o.type}} · {{statusMeta(o.priority).label}}</text>
        <text class="item-text">{{o.description||'未填写故障描述'}}</text>
        <text class="tiny">{{o.technician||'待派单'}} · {{o.createdAt}}</text>
      </view>
      <view v-if="!orders.length&&!busy&&!error" class="empty">暂无报修工单</view>
    </view>
    <view v-if="tab==='firmware'" class="list">
      <text class="item-meta tab-note">固件由运营端统一发布，这里查看版本。</text>
      <view v-for="f in firmware" :key="f.id" class="list-item column">
        <view class="item-head"><text class="item-title">{{f.productName}}</text><text class="tag blue">{{f.version}}</text></view>
        <text class="item-meta">{{f.fileSize}} · {{f.status}} · {{f.releaseAt}}</text>
        <text class="tiny hash">SHA256 {{f.sha256}}</text>
      </view>
      <view v-if="!firmware.length&&!busy&&!error" class="empty">暂无固件版本</view>
    </view>
    <view v-if="tab==='ota'" class="list">
      <text class="item-meta tab-note">升级由运营端发起，结果以网关接入端回执为准。</text>
      <view v-for="o in ota" :key="o.id" class="list-item column">
        <view class="item-head"><text class="item-title">{{o.taskNo}}</text><text class="tag gray">{{o.status}}</text></view>
        <text class="item-meta">{{o.firmwareVersion}} · {{o.targetScope}} · {{o.executeWindow}}</text>
        <view class="kv-grid"><view><text>目标</text><text class="kv-value">{{o.targetCount}}</text></view><view><text>成功</text><text class="kv-value">{{o.successCount}}</text></view><view><text>失败</text><text class="kv-value">{{o.failedCount}}</text></view></view>
        <text class="tiny">{{o.createdAt}}</text>
      </view>
      <view v-if="!ota.length&&!busy&&!error" class="empty">暂无升级任务</view>
      <button class="btn btn-block" @tap="go('/pages/gateway/list')">查看网关 OTA 回执</button>
    </view>
  </view>
</template>
<style scoped>.tab-note{padding:0 4rpx}.hash{word-break:break-all}</style>

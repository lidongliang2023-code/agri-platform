<script setup lang="ts">
import {ref} from 'vue'
import {onLoad,onShow} from '@dcloudio/uni-app'
import {api,statusMeta,type Row} from '../../api/iot'
import {showError,confirmAction,go} from '../../utils/ui'
import CommandReceipts from '../../components/CommandReceipts.vue'
import SegTabs from '../../components/SegTabs.vue'
const id=ref(0),row=ref<Row|null>(null),tab=ref('commands'),busy=ref(false),error=ref('')
onLoad(o=>{id.value=Number(o?.id);if(!Number.isSafeInteger(id.value)||id.value<=0){error.value='缺少网关编号，请从网关列表进入';return}void load()});onShow(()=>{if(Number.isSafeInteger(id.value)&&id.value>0)void load()})
async function load(){try{row.value=await api.gateway(id.value);error.value=''}catch(e){error.value=e instanceof Error?e.message:'网关读取失败'}}
async function action(kind:string){if(busy.value||!row.value||!(await confirmAction(kind==='restart'?'重启网关':'删除网关',`${row.value.gatewayName}：${kind==='restart'?'重启申请将发送至接入端，结果以回执为准':'仅无挂载设备的网关可删除'}。`)))return;busy.value=true;try{if(kind==='restart'){await api.restartGateway(id.value);uni.showToast({title:'重启申请已登记',icon:'none'});tab.value='commands';void load()}else{await api.deleteGateway(id.value);uni.navigateBack()}}catch(e){showError(e)}finally{busy.value=false}}
</script>
<template>
  <view class="page pad">
    <view v-if="error" class="error" @tap="load">{{error}}<text class="retry">点击重试</text></view>
    <view v-if="!row&&!error" class="loading">正在加载网关…</view>
    <template v-if="row">
      <view class="card">
        <view class="item-head"><text class="item-title detail-title">{{row.gatewayName}}</text><text class="tag" :class="statusMeta(row.onlineStatus).tone">{{statusMeta(row.onlineStatus).label}}</text></view>
        <view v-for="key in ['gatewayCode','farmName','model','protocol','firmwareVersion','ipAddress','lastOnline']" :key="key" class="field"><text class="field-label">{{({gatewayCode:'网关编码',farmName:'所属农场',model:'型号',protocol:'协议',firmwareVersion:'固件版本',ipAddress:'IP 地址',lastOnline:'最近在线'} as any)[key]}}</text><text class="field-value">{{row[key]||'—'}}</text></view>
        <view class="action-row"><button class="btn btn-sm" @tap="go('/pages/gateway/edit?id='+id)">编辑</button><button class="btn btn-sm" :disabled="busy||row.onlineStatus!=='online'" @tap="action('restart')">重启</button><button class="btn btn-sm btn-danger" :disabled="busy||row.totalCount>0" @tap="action('delete')">删除</button></view>
        <text v-if="row.totalCount>0" class="tiny block">仍有挂载设备时不能删除网关</text>
      </view>
      <view class="card">
        <view class="card-head"><text class="card-title">挂载设备</text><text class="card-sub">{{row.devices?.length||0}} 台</text></view>
        <view v-for="device in row.devices" :key="device.id" class="field" @tap="go('/pages/device/detail?id='+device.id)"><text>{{device.deviceName}}</text><text class="tag" :class="statusMeta(device.onlineStatus).tone">{{statusMeta(device.onlineStatus).label}} ›</text></view>
        <text v-if="!row.devices?.length" class="muted block">暂无挂载设备</text>
      </view>
      <view class="seg-wrap"><SegTabs v-model="tab" :options="[['commands','重启回执'],['ota','OTA 回执']]"/></view>
      <CommandReceipts :key="tab" :id="id" :load="tab==='commands'?api.gatewayCommands:api.gatewayOta"/>
    </template>
  </view>
</template>
<style scoped>.detail-title{font-size:34rpx;white-space:normal}.seg-wrap{margin-bottom:16rpx}
/* 2026-11-20：逐页实测控件的48px触控区。 */
.error { min-height:48px; }
</style>

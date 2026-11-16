<script setup lang="ts">
import {ref,onUnmounted} from 'vue'
import {onLoad,onShow,onHide} from '@dcloudio/uni-app'
import {api,statusMeta,type Device} from '../../api/iot'
import {showError,confirmAction,go} from '../../utils/ui'
import CommandReceipts from '../../components/CommandReceipts.vue'
const item=ref<Device|null>(null),id=ref(0),busy=ref(false),error=ref(''),pending=ref<{action:string;requestNo:string}|null>(null)
let timer:ReturnType<typeof setInterval>|undefined,loading=false
onLoad(o=>{id.value=Number(o?.id);if(!Number.isSafeInteger(id.value)||id.value<1){error.value='设备编号无效';return}void load()})
onShow(()=>{clearInterval(timer);if(id.value)void load();timer=setInterval(()=>void load(),10000)})
function stop(){clearInterval(timer)}onHide(stop);onUnmounted(stop)
async function load(){if(loading||!id.value)return;loading=true;try{item.value=await api.device(id.value);error.value=''}catch(e){error.value=e instanceof Error?e.message:'设备读取失败'}finally{loading=false}}
async function control(action:string){if(busy.value||!item.value)return;if(pending.value){uni.showToast({title:'请先核对上次指令回执',icon:'none'});return}if(!(await confirmAction('确认远程控制',`对 ${item.value.deviceName} 申请${action}？执行结果以接入端回执为准。`)))return;pending.value={action,requestNo:`M${Date.now()}-${Math.random().toString(36).slice(2,14)}`};await submit()}
async function submit(){if(busy.value||!pending.value)return;busy.value=true;try{await api.control(id.value,pending.value.action,pending.value.requestNo);pending.value=null;uni.showToast({title:'申请已登记，请查看回执',icon:'none'});void load()}catch(e){showError(e)}finally{busy.value=false}}
async function reconcile(){if(!pending.value||busy.value)return;busy.value=true;try{const rows=await api.commandReceipts(id.value);if(rows.some(r=>r.commandNo===pending.value?.requestNo)){pending.value=null;uni.showToast({title:'已找到该指令，请查看回执',icon:'none'})}else uni.showToast({title:'尚未查到，请使用原编号重试',icon:'none'})}catch(e){showError(e)}finally{busy.value=false}}
</script>
<template>
  <view class="page pad">
    <view v-if="error" class="error" @tap="load">{{error}}<text class="retry">点击重试</text></view>
    <template v-if="item">
      <view class="card">
        <view class="item-head"><text class="item-title detail-title">{{item.deviceName}}</text><text class="tag" :class="statusMeta(item.onlineStatus).tone">{{statusMeta(item.onlineStatus).label}}</text></view>
        <text class="item-meta">{{item.deviceCode}} · {{item.typeName}} · {{item.protocol}}</text>
        <view class="kv-grid head-kv"><view><text>最近上报</text><text class="kv-value">{{item.lastReport||'—'}}</text></view><view><text>信号</text><text class="kv-value">{{item.rssi??'—'}} dBm</text></view><view><text>电量</text><text class="kv-value">{{item.battery}}%</text></view></view>
        <view class="action-row"><button class="btn btn-sm" @tap="go('/pages/device/edit?id='+id)">编辑 / 绑定</button><button class="btn btn-sm" @tap="go('/pages/device/sampling?id='+id)">采样配置</button><button class="btn btn-sm" @tap="go('/pages/maintenance/create?deviceId='+id)">报修</button></view>
      </view>
      <view class="card">
        <view class="card-head"><text class="card-title">实时遥测</text><text class="card-sub">每 10 秒刷新</text></view>
        <view class="metric-grid"><view v-for="t in item.telemetry" :key="t.key"><text class="muted">{{t.name}}</text><text class="value">{{t.value}} {{t.unit}}</text><text class="tiny">{{t.recordedAt}}</text></view></view>
        <text v-if="!item.telemetry?.length" class="muted">暂无上报数据</text>
      </view>
      <view v-if="item.controlCapable" class="card">
        <view class="card-head"><text class="card-title">远程控制</text><text class="card-sub">以接入端回执为准</text></view>
        <view class="action-row first"><button v-for="action in ['开启设备','关闭设备','重启设备']" :key="action" class="btn btn-sm" :class="{'btn-ghost':action==='开启设备'}" :disabled="busy||!!pending" @tap="control(action)">{{action}}</button></view>
        <view v-if="pending" class="notice"><text>提交结果尚未确认，保留原编号：{{pending.requestNo}}</text><view class="action-row"><button class="btn btn-sm" :disabled="busy" @tap="reconcile">核对回执</button><button class="btn btn-sm btn-primary" :disabled="busy" @tap="submit">原编号重试</button></view></view>
      </view>
      <CommandReceipts :id="id" :load="api.commandReceipts"/>
    </template>
    <view v-else-if="!error" class="loading">正在加载设备…</view>
  </view>
</template>
<style scoped>
.detail-title{font-size:34rpx;white-space:normal}.head-kv{margin-top:18rpx}.action-row.first{margin-top:0}
</style>

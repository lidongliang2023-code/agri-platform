<script setup lang="ts">
import {ref,computed,onUnmounted} from 'vue'
import {onLoad,onShow,onHide} from '@dcloudio/uni-app'
import {api,statusMeta,canWrite,type Device,type Row} from '../../api/iot'
import {showError,confirmAction,go} from '../../utils/ui'
import CommandReceipts from '../../components/CommandReceipts.vue'
const item=ref<Device|null>(null),id=ref(0),busy=ref(false),error=ref(''),pending=ref<{action:string;requestNo:string;registered?:boolean}|null>(null)
const receiptsReady=ref(false),receiptRows=ref<Row[]>([]),receiptError=ref(''),revision=ref(0)
const activeCommand=computed(()=>receiptRows.value.find(r=>['PENDING','SENT','RUNNING'].includes(r.status)))
const writable=computed(()=>!!item.value&&canWrite()&&item.value.status!=='disabled')
let pendingKey=''
function storePending(){if(!pendingKey)return;if(pending.value)uni.setStorageSync(pendingKey,pending.value);else uni.removeStorageSync(pendingKey)}
function setPending(value:typeof pending.value){pending.value=value;storePending()}
async function refreshCommands(){try{const rows=await api.commandReceipts(id.value);receiptRows.value=rows;receiptsReady.value=true;receiptError.value='';if(pending.value){const found=rows.find(r=>r.commandNo===pending.value!.requestNo);if(found){if(['SUCCEEDED','FAILED','EXPIRED','LEGACY'].includes(found.status))setPending(null);else setPending({...pending.value,registered:true})}}}catch(e){receiptsReady.value=false;receiptError.value=e instanceof Error?e.message:'回执加载失败'}}
let timer:ReturnType<typeof setInterval>|undefined,loading=false
onLoad(o=>{id.value=Number(o?.id);if(!Number.isSafeInteger(id.value)||id.value<1){error.value='设备编号无效';return}const user=uni.getStorageSync('user')||{};const subject=uni.getStorageSync('iot_subject')||{};pendingKey=`iot_control_pending_${user.id||user.userId||user.username||'current'}_${subject.merchantId||subject.id||'current'}_${id.value}`;const saved=uni.getStorageSync(pendingKey);if(saved&&typeof saved.requestNo==='string'&&['开启设备','关闭设备','重启设备'].includes(saved.action))pending.value=saved;void load()})
onShow(()=>{clearInterval(timer);if(id.value)void load();timer=setInterval(()=>void load(),10000)})
function stop(){clearInterval(timer)}onHide(stop);onUnmounted(stop)
async function load(){if(loading||!id.value)return;loading=true;try{item.value=await api.device(id.value);await refreshCommands();error.value=''}catch(e){error.value=e instanceof Error?e.message:'设备读取失败'}finally{loading=false}}
async function control(action:string){if(busy.value||!item.value||!writable.value||!receiptsReady.value||activeCommand.value||pending.value)return;busy.value=true;try{if(!(await confirmAction('确认远程控制',`对 ${item.value.deviceName} 申请${action}？执行结果以接入端回执为准。`)))return;setPending({action,requestNo:`M${Date.now()}-${Math.random().toString(36).slice(2,14)}`})}finally{busy.value=false}if(pending.value)await submit(false)}
async function submit(retry=true){if(busy.value||!pending.value||pending.value.registered||!writable.value)return;busy.value=true;try{if(retry&&!await confirmAction('复用原申请编号',`将核对并复用 ${pending.value.requestNo}，已登记时返回原申请。`))return;await api.control(id.value,pending.value.action,pending.value.requestNo);setPending({...pending.value,registered:true});revision.value++;uni.showToast({title:'申请已登记，请查看回执',icon:'none'});await refreshCommands()}catch(e){showError(e)}finally{busy.value=false}}
async function reconcile(){if(busy.value)return;busy.value=true;try{await refreshCommands();revision.value++;if(receiptError.value)throw new Error(receiptError.value);uni.showToast({title:pending.value?.registered?'已登记，请核对执行回执':pending.value?'未查到，可用原编号重试':'回执已更新',icon:'none'})}catch(e){showError(e)}finally{busy.value=false}}

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
        <view class="action-row first"><button v-for="action in ['开启设备','关闭设备','重启设备']" :key="action" class="btn btn-sm" :class="{'btn-ghost':action==='开启设备'}" :disabled="busy||!!pending||!writable||!receiptsReady||!!activeCommand" @tap="control(action)">{{action}}</button></view>
        <text v-if="!writable" class="notice block">设备已停用或当前账号无写入权限。</text><text v-if="receiptError" class="error block">{{receiptError}}</text><text v-if="activeCommand" class="notice block">设备存在未完成指令，暂不能提交新申请。</text><view v-if="pending" class="notice"><text>{{pending.registered?'申请已登记，请等待或核实执行回执：':'提交结果尚未确认，保留原编号：'}}{{pending.requestNo}}</text><view class="action-row"><button class="btn btn-sm" :disabled="busy" @tap="reconcile">核对回执</button><button v-if="!pending.registered" class="btn btn-sm btn-primary" :disabled="busy||!writable" @tap="submit()">原编号重试</button></view></view>
      </view>
      <CommandReceipts :key="revision" :id="id" :load="api.commandReceipts"/>
    </template>
    <view v-else-if="!error" class="loading">正在加载设备…</view>
  </view>
</template>
<style scoped>
.detail-title{font-size:34rpx;white-space:normal}.head-kv{margin-top:18rpx}.action-row.first{margin-top:0}

/* 2026-11-20：逐页实测控件的48px触控区。 */
.error { min-height:48px; }
</style>

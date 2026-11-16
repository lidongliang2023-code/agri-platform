<script setup lang="ts">
import { computed,ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api,statusMeta,type Device } from '../../api/iot'
import SegTabs from '../../components/SegTabs.vue'
const items=ref<Device[]>([]),tab=ref('all'),keyword=ref(''),loading=ref(false),plotId=ref<number|undefined>(),groupId=ref<number|undefined>(),groups=ref<any[]>([]),error=ref('')
const visible=computed(()=>items.value.filter(i=>(!keyword.value||i.deviceName.includes(keyword.value)||i.deviceCode.includes(keyword.value))&&(tab.value==='all'||i.onlineStatus===tab.value)))
const count=(status:string)=>items.value.filter(i=>i.onlineStatus===status).length
const tabs=computed<Array<[string,string]>>(()=>[['all',`全部 ${items.value.length}`],['online',`在线 ${count('online')}`],['offline',`离线 ${count('offline')}`],['alert',`告警 ${count('alert')}`]])
const groupOptions=computed(()=>[{id:undefined,name:'全部分组'},...groups.value])
onShow(()=>{const saved=uni.getStorageSync('iot_status')||'all';tab.value=saved;uni.removeStorageSync('iot_status');const selected=uni.getStorageSync('iot_plot');if(selected){plotId.value=Number(selected);uni.removeStorageSync('iot_plot')}load()})
async function load(){loading.value=true;try{items.value=await api.devices({plotId:plotId.value,groupId:groupId.value});groups.value=await api.groups();error.value=''}catch(e){items.value=[];error.value=e instanceof Error?e.message:'加载失败'}finally{loading.value=false}}
function open(id:number){uni.navigateTo({url:`/pages/device/detail?id=${id}`})}
function register(){uni.navigateTo({url:'/pages/device/edit'})}
function clearPlot(){plotId.value=undefined;load()}
function selectGroup(event:any){const index=Number(event?.detail?.value||0);groupId.value=index?groups.value[index-1]?.id:undefined;load()}
function deviceMark(typeName=''){return typeName.includes('温湿度')?'温':typeName.includes('土壤')?'土':typeName.includes('阀')?'阀':typeName.includes('摄像')?'像':typeName.includes('气象')?'气':'设'}
</script>
<template>
  <view class="page pad">
    <view class="toolbar">
      <view class="toolbar-main"><text class="toolbar-title">共 {{items.length}} 台设备</text><text class="toolbar-sub">在线 {{count('online')}} · 离线 {{count('offline')}} · 告警 {{count('alert')}}</text></view>
      <view class="toolbar-actions"><button class="btn btn-sm btn-primary" @tap="register">注册设备</button></view>
    </view>
    <view class="sticky-head">
      <view class="search-bar"><text>⌕</text><input v-model="keyword" placeholder="搜索设备名称 / 编码" confirm-type="search"/></view>
      <SegTabs v-model="tab" :options="tabs"/>
      <view class="filter-row">
        <picker :range="groupOptions" range-key="name" @change="selectGroup($event)"><view class="chip" :class="{active:groupId}">{{groups.find(g=>g.id===groupId)?.name||'全部分组'}} ▾</view></picker>
        <view v-if="plotId" class="chip active" @tap="clearPlot">已按地块筛选 ✕</view>
      </view>
    </view>
    <view v-if="error" class="error" @tap="load">{{error}}<text class="retry">点击重试</text></view>
    <view v-if="loading&&!items.length" class="loading">正在加载设备…</view>
    <view v-else class="list">
      <view v-for="item in visible" :key="item.id" class="list-item" @tap="open(item.id)">
        <text class="item-icon" :class="statusMeta(item.onlineStatus).tone">{{deviceMark(item.typeName)}}</text>
        <view class="list-body">
          <view class="item-head"><text class="item-title">{{item.deviceName}}</text><text class="tag" :class="statusMeta(item.onlineStatus).tone">{{statusMeta(item.onlineStatus).label}}</text></view>
          <text class="item-meta">{{item.deviceCode}} · {{item.typeName}}</text>
          <text class="item-meta">{{item.protocol}} · 信号 {{item.rssi||'—'}} dBm · 电量 {{item.battery}}%</text>
        </view>
        <text class="chev">›</text>
      </view>
      <view v-if="!visible.length&&!error" class="empty">暂无匹配设备</view>
    </view>
  </view>
</template>

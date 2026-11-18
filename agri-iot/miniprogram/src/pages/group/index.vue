<script setup lang="ts">
import {computed,ref} from 'vue'
import {onShow,onPullDownRefresh} from '@dcloudio/uni-app'
import {api,type Row} from '../../api/iot'
const rows=ref<Row[]>([]),keyword=ref(''),busy=ref(false),error=ref('')
const visible=computed(()=>rows.value.filter(r=>String(r.name||'').includes(keyword.value.trim())))
onShow(load)
onPullDownRefresh(load)
async function load(){if(busy.value){uni.stopPullDownRefresh();return}busy.value=true;error.value='';try{rows.value=await api.groups()}catch(e){rows.value=[];error.value=e instanceof Error?e.message:'分组加载失败'}finally{busy.value=false;uni.stopPullDownRefresh()}}
function open(id:number){uni.setStorageSync('iot_group',id);uni.removeStorageSync('iot_plot');uni.removeStorageSync('iot_status');uni.switchTab({url:'/pages/device/list'})}
</script>
<template><view class="page pad"><view class="toolbar"><view class="toolbar-main"><text class="toolbar-title">设备分组</text><text class="toolbar-sub">当前经营主体共 {{rows.length}} 个分组</text></view><button class="btn btn-sm" :disabled="busy" @tap="load">刷新</button></view><view class="search-bar"><input v-model="keyword" placeholder="搜索分组名称" confirm-type="search"/></view><view v-if="error" class="error" @tap="load">{{error}} · 点击重试</view><view v-else-if="busy" class="loading">正在读取设备分组…</view><view v-else class="list"><view v-for="row in visible" :key="row.id" class="list-item" @tap="open(Number(row.id))"><view class="item-icon">组</view><view class="list-body"><view class="item-head"><text class="item-title">{{row.name}}</text><text v-if="row.isDefault" class="tag green">默认分组</text></view><text class="item-meta">目录登记 {{row.deviceCount??0}} 台 · 查看当前可访问设备</text></view><text class="chev">›</text></view><view v-if="!visible.length" class="empty">{{keyword?'没有匹配的分组':'当前主体暂无设备分组'}}</view></view></view></template>

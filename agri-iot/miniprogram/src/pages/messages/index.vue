<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api } from '../../api/iot'
const items=ref<Array<{id:number;type:string;title:string;content:string;read:boolean;createdAt:string}>>([]),loading=ref(false)
onShow(load)
async function load(){loading.value=true;try{items.value=await api.messages()}catch(e){uni.showToast({title:e instanceof Error?e.message:'加载失败',icon:'none'})}finally{loading.value=false}}
async function readAll(){try{await api.readAllMessages();await load();uni.showToast({title:'已全部标为已读',icon:'success'})}catch(e){uni.showToast({title:e instanceof Error?e.message:'操作失败',icon:'none'})}}
async function read(item:{id:number;read:boolean}){try{if(!item.read){await api.readMessage(item.id);await load()}}catch(e){uni.showToast({title:e instanceof Error?e.message:'操作失败',icon:'none'})}}

</script>
<template>
  <view class="page pad">
    <view class="toolbar">
      <view class="toolbar-main"><text class="toolbar-title">{{items.filter(i=>!i.read).length}} 条未读</text><text class="toolbar-sub">告警、设备与场景通知</text></view>
      <view class="toolbar-actions"><button class="btn btn-sm" :disabled="!items.some(i=>!i.read)" @tap="readAll">全部已读</button></view>
    </view>
    <view v-if="loading&&!items.length" class="loading">正在加载消息…</view>
    <view class="list">
      <view v-for="item in items" :key="item.id" class="list-item message" :class="{read:item.read}" @tap="read(item)">
        <text class="item-icon" :class="item.type==='alert'?'red':item.type==='device'?'blue':item.type==='scene'?'purple':'orange'">{{item.type==='alert'?'警':item.type==='device'?'设':item.type==='scene'?'景':'信'}}</text>
        <view class="list-body"><view class="item-head"><text class="item-title">{{item.title}}</text><text v-if="!item.read" class="dot"/></view><text class="item-text">{{item.content}}</text><text class="tiny">{{item.createdAt}}</text></view>
      </view>
      <view v-if="!items.length&&!loading" class="empty">暂无消息</view>
    </view>
  </view>
</template>
<style lang="scss" scoped>.message{align-items:flex-start}.message.read{opacity:.62}.dot{flex-shrink:0;width:14rpx;height:14rpx;border-radius:50%;background:#df4c4c}</style>

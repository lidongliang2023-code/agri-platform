<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api, type Message } from '../../api'
const items=ref<Message[]>([])
onShow(load)
async function load(){try{items.value=await api.messages()}catch(e){uni.showToast({title:e instanceof Error?e.message:'加载失败',icon:'none'})}}
async function readAll(){try{await api.readMessages();items.value=items.value.map(i=>({...i,read:true}));uni.showToast({title:'已全部标为已读',icon:'success'})}catch(e){uni.showToast({title:e instanceof Error?e.message:'操作失败',icon:'none'})}}
function open(item:Message){uni.showModal({title:item.title,content:`${item.content}\n\n${item.createdAt}${item.bizNo?`\n关联单号：${item.bizNo}`:''}`,showCancel:false})}
</script>
<template><view class="page pad"><view class="between"><view><text class="page-title">消息通知</text><text class="tiny">收件箱只投递给当前执法人员</text></view><button class="btn btn-sm" @click="readAll">全部已读</button></view><view v-if="!items.length" class="empty"><text class="empty-icon">🔔</text><text>暂无监管消息</text></view><view class="message" v-for="item in items" :key="item.id" :class="{read:item.read}" @click="open(item)"><text class="icon">{{item.type==='task'?'📋':item.type==='case'?'⚖️':'🔔'}}</text><view><view class="between"><text class="strong">{{item.title}}</text><text v-if="!item.read" class="dot"/></view><text class="muted">{{item.content}}</text><text class="tiny">{{item.createdAt}}<text v-if="item.bizNo"> · {{item.bizNo}}</text></text></view></view></view></template>
<style lang="scss" scoped>.page-title{font-size:38rpx;font-weight:750}.message{display:flex;gap:14rpx;margin-top:14rpx;padding:20rpx;border:1rpx solid #e1e9e3;border-radius:20rpx;background:#fff}.message.read{opacity:.62}.icon{display:flex;width:64rpx;height:64rpx;flex:0 0 64rpx;align-items:center;justify-content:center;border-radius:16rpx;background:#e5f5eb;font-size:28rpx}.message>view{display:flex;min-width:0;flex:1;flex-direction:column;gap:5rpx}.dot{width:12rpx;height:12rpx;border-radius:50%;background:#df4c4c}</style>

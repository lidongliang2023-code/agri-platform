<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api } from '../../api/iot'
const items=ref<Array<{id:number;type:string;title:string;content:string;read:boolean;createdAt:string}>>([])
onShow(load)
async function load(){try{items.value=await api.messages()}catch(e){uni.showToast({title:e instanceof Error?e.message:'加载失败',icon:'none'})}}
async function readAll(){try{await api.readAllMessages();await load();uni.showToast({title:'已全部标为已读',icon:'success'})}catch(e){uni.showToast({title:e instanceof Error?e.message:'操作失败',icon:'none'})}}
async function read(item:{id:number;read:boolean}){try{if(!item.read){await api.readMessage(item.id);await load()}}catch(e){uni.showToast({title:e instanceof Error?e.message:'操作失败',icon:'none'})}}

</script>
<template><view class="page pad"><view class="between"><text class="page-title">消息通知</text><button class="btn btn-sm" @click="readAll">全部已读</button></view><view class="message" v-for="item in items" :key="item.id" :class="{read:item.read}" @click="read(item)"><text class="icon">{{item.type==='alert'?'🔔':item.type==='device'?'📱':item.type==='scene'?'🌬️':'📦'}}</text><view><view class="between"><text class="strong">{{item.title}}</text><text v-if="!item.read" class="dot"/></view><text class="muted">{{item.content}}</text><text class="tiny">{{item.createdAt}}</text></view></view></view></template>
<style lang="scss" scoped>.page-title{font-size:38rpx;font-weight:750}.message{display:flex;gap:14rpx;margin-top:14rpx;padding:20rpx;border:1rpx solid #e1e9e3;border-radius:20rpx;background:#fff}.message.read{opacity:.62}.icon{display:flex;width:62rpx;height:62rpx;flex:0 0 62rpx;align-items:center;justify-content:center;border-radius:16rpx;background:#e5f5eb;font-size:28rpx}.message>view{display:flex;min-width:0;flex:1;flex-direction:column;gap:5rpx}.dot{width:12rpx;height:12rpx;border-radius:50%;background:#df4c4c}</style>

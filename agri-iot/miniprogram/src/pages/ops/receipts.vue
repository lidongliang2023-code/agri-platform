<script setup lang="ts">
import { ref } from 'vue'
import { onLoad,onPullDownRefresh } from '@dcloudio/uni-app'
import CommandReceipts from '../../components/CommandReceipts.vue'
import OpsTabBar from '../../components/OpsTabBar.vue'
import { opsApi } from '../../api/ops'
const id=ref(0),kind=ref('device'),revision=ref(0)
onLoad(options=>{const value=Number(options?.id);const type=String(options?.kind||'device');if(Number.isSafeInteger(value)&&value>0&&['device','gateway','ota'].includes(type)){id.value=value;kind.value=type}})
onPullDownRefresh(()=>{revision.value++;uni.stopPullDownRefresh()})
const load=(entityId:number,page:number)=>opsApi.receipts(kind.value,entityId,page)
</script>
<template><view class="page pad"><text class="muted block">全平台运营范围 · 超时结果须人工核实，请勿重复发送指令。</text><CommandReceipts v-if="id" :key="revision" :id="id" :load="load"/><view v-else class="error">回执参数无效，请返回列表重新选择。</view><OpsTabBar active="business" /></view></template>

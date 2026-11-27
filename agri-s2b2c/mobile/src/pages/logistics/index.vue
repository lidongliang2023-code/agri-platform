<template><view class="native-page"><text class="title">物流跟踪</text><view v-if="error" class="panel error"><text>{{error}}</text><button :disabled="loading" @tap="reload">重新加载</button></view><view v-if="loading" class="sub">正在同步…</view><template v-if="!loading"><view class="panel"><text>{{data.logisticsCompany}}</text><text class="sub">{{data.logisticsNo}}</text><button v-if="data.logisticsNo" @tap="copy">复制物流单号</button><text class="sub">{{data.status}} · 更新于 {{data.updateTime}}</text></view><view class="panel"><view v-for="(r,i) in tracks" :key="i" class="line"><text>{{r.context || r.content || r.description || r.status}}</text><text class="sub">{{r.time || r.datetime}}</text></view><text v-if="!tracks.length" class="sub">{{trackingText || '暂未同步物流轨迹，请稍后刷新'}}</text></view></template></view></template>
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { request, mallApi } from '../../api'
import { session, saveSession } from '../../session'
import { useNativePage, go, confirmAction } from '../../useNativePage'
import { money } from '../../utils'
const id=ref(''),data=ref<any>({});onLoad(o=>{id.value=String(o?.id || '')})
const tracks=computed<any[]>(()=>{try{const x=typeof data.value.trackingInfo==='string'?JSON.parse(data.value.trackingInfo):data.value.trackingInfo;return Array.isArray(x)?x:Array.isArray(x?.data)?x.data:[]}catch{return []}})
const trackingText=computed(()=>typeof data.value.trackingInfo==='string'&&!/^[\[{]/.test(data.value.trackingInfo)?data.value.trackingInfo:'')
const {loading,error,busy,reload,act}=useNativePage(async()=>{if(!id.value)throw new Error('缺少订单编号');data.value=await request(`/consumer/logistics/${id.value}`)})
function copy(){uni.setClipboardData({data:String(data.value.logisticsNo)})}
</script><style src="../../native-page.scss" lang="scss"></style>
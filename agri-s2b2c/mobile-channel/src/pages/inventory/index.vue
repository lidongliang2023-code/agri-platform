<template><view class="native-page"><text class="title">库存与动销</text><view v-if="error" class="panel error"><text>{{error}}</text><button :disabled="loading" @tap="reload">重新加载</button></view><view v-if="loading" class="sub">正在同步…</view><template v-if="!loading"><view class="panel"><input v-model="keyword" placeholder="按商品名称筛选"/><text class="sub">共 {{data.records?.length || 0}} 件商品，显示 {{filtered.length}} 件</text></view><view class="panel" v-for="r in filtered" :key="r.productId"><text>{{r.name}}</text><view class="row"><text class="amount">{{r.stock}} {{r.unit}}</text><text>{{statusLabels[r.status] || r.status}}</text></view><text class="sub">近 7 日销量 {{r.sales7}} · 可售 {{r.daysOfSupply ?? '—'}} 天</text></view><text v-if="!filtered.length" class="sub">暂无符合条件的库存商品</text></template></view></template>
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { request, channelApi } from '../../api'
import { channelSession, saveChannelSession } from '../../session'
import { useNativePage, go, confirmAction } from '../../useNativePage'
import { money } from '../../utils'
const data=ref<any>({}),keyword=ref('');const statusLabels:Record<string,string>={OUT:'缺货',LOW:'库存偏低',NORMAL:'正常'}
const filtered=computed<any[]>(()=>(data.value.records||[]).filter((r:any)=>String(r.name).includes(keyword.value.trim())))
const {loading,error,busy,reload,act}=useNativePage(async()=>{data.value=await request('/channel/inventory')})
</script><style src="../../native-page.scss" lang="scss"></style>
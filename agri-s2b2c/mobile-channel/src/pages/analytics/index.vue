<template><view class="native-page"><text class="title">经营分析</text><view v-if="error" class="panel error"><text>{{error}}</text><button :disabled="loading" @tap="reload">重新加载</button></view><view v-if="loading" class="sub">正在同步…</view><template v-if="!loading"><view class="panel"><picker :range="ranges" @change="rangeIndex=Number($event.detail.value);reload()"><view class="picker">最近 {{ranges[rangeIndex]}} 天</view></picker><text class="amount">{{money(data.sales)}}</text><text class="sub">订单 {{data.orders || 0}} 笔 · 客单价 {{money(data.avgOrderAmount)}}</text><text class="sub">已结佣金 {{money(data.commissionSettled)}} · 待结 {{money(data.commissionPending)}}</text><text class="sub">统计按服务端口径，订单金额包含待付款订单。</text></view><view class="panel"><text>每日订单金额</text><view v-for="r in data.trend || []" :key="r.date" class="line"><view class="row"><text>{{r.date}} · {{r.orders}} 笔</text><text>{{money(r.amount)}}</text></view><view class="bar" :style="{width:barWidth(r.amount)}"/></view></view><view class="panel"><text>热销商品</text><view class="line" v-for="p in data.topProducts || []" :key="p.product_id"><text>{{p.name}} × {{p.qty}}</text><text class="sub">{{money(p.amount)}}</text></view><text v-if="!data.topProducts?.length" class="sub">暂无销售数据</text></view></template></view></template>
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { request, channelApi } from '../../api'
import { channelSession, saveChannelSession } from '../../session'
import { useNativePage, go, confirmAction } from '../../useNativePage'
import { money } from '../../utils'
const data=ref<any>({}),rangeIndex=ref(1);const ranges=[7,30,90]
const maxAmount=computed(()=>Math.max(1,...(data.value.trend||[]).map((r:any)=>Number(r.amount)||0)))
function barWidth(amount:any){return `${Math.min(100,Math.max(0,Number(amount)||0)/maxAmount.value*100)}%`}
const {loading,error,busy,reload,act}=useNativePage(async()=>{data.value=await request('/channel/analytics','GET',undefined,{days:ranges[rangeIndex.value]})})
</script><style src="../../native-page.scss" lang="scss"></style>
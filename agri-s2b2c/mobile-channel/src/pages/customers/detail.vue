<template><view class="native-page"><text class="title">客户画像</text><view v-if="error" class="panel error"><text>{{error}}</text><button :disabled="loading" @tap="reload">重新加载</button></view><view v-if="loading" class="sub">正在同步…</view><template v-if="!loading"><view class="panel"><text>{{data.profile?.name || '客户'}}</text><text class="sub">{{data.profile?.phone}} · {{data.profile?.memberLevel}}</text><text class="amount">{{money(data.profile?.totalAmount)}}</text><text class="sub">{{data.profile?.orderCount || 0}} 笔订单 · 客单价 {{money(data.profile?.avgAmount)}}</text></view><view class="panel"><text>常购商品</text><view class="line" v-for="p in data.topProducts || []" :key="p.product_id"><text>{{p.name}} × {{p.qty}}</text><text class="sub">{{money(p.amount)}}</text></view><text v-if="!data.topProducts?.length" class="sub">暂无商品记录</text></view><view class="panel"><text>最近订单</text><view class="line" v-for="o in data.orders || []" :key="o.id" @tap="go('/pages/orders/detail?id='+o.id)"><text>{{o.orderNo}}</text><text class="sub">{{o.status}} · {{money(o.payAmount)}} · {{o.createTime}} ›</text></view></view></template></view></template>
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { request, channelApi } from '../../api'
import { channelSession, saveChannelSession } from '../../session'
import { useNativePage, go, confirmAction } from '../../useNativePage'
import { money } from '../../utils'
const id=ref(''),data=ref<any>({});onLoad(o=>id.value=String(o?.id||''))
const {loading,error,busy,reload,act}=useNativePage(async()=>{if(!id.value)throw new Error('缺少客户编号');data.value=await request(`/channel/customer/${id.value}`)})
</script><style src="../../native-page.scss" lang="scss"></style>
<template><view class="native-page"><text class="title">我的拼团</text><view v-if="error" class="panel error"><text>{{error}}</text><button :disabled="loading" @tap="reload">重新加载</button></view><view v-if="loading" class="sub">正在同步…</view><template v-if="!loading"><view class="panel" v-for="(g,i) in rows" :key="i"><text>{{g.groupBuyName}} · {{g.productName}}</text><text class="sub">{{labels[g.status] || g.status}} · {{g.joinedCount}} / {{g.requiredSize}} 人</text><text class="sub">有效至 {{g.expireTime}}</text><button @tap="go('/pages/orders/detail?id='+g.orderId)">查看订单</button><button @tap="go('/pages/groups/detail?id='+g.groupBuyId)">查看活动</button></view><text v-if="!rows.length" class="sub">尚未参与拼团</text></template></view></template>
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { request, mallApi } from '../../api'
import { session, saveSession } from '../../session'
import { useNativePage, go, confirmAction } from '../../useNativePage'
import { money } from '../../utils'
const rows=ref<any[]>([]),labels:Record<string,string>={PENDING:'拼团中',SUCCESS:'已成团',FAILED:'未成团',CANCELLED:'已取消'}
const {loading,error,busy,reload,act}=useNativePage(async()=>{rows.value=await request<any[]>('/consumer/group-buy/mine','GET',undefined,{consumerId:session.user!.id})})
</script><style src="../../native-page.scss" lang="scss"></style>
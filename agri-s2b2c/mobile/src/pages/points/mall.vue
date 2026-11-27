<template><view class="native-page"><text class="title">积分商城</text><view v-if="error" class="panel error"><text>{{error}}</text><button :disabled="loading" @tap="reload">重新加载</button></view><view v-if="loading" class="sub">正在同步…</view><template v-if="!loading"><view class="panel"><text class="amount">可用 {{session.user?.points || 0}} 积分</text></view><view v-for="g in goods" :key="g.couponId" class="panel"><text>{{g.name}}</text><text class="sub">满 {{g.minAmount}} 元使用 · 有效至 {{g.validEnd}}</text><text class="amount">{{g.pointsCost}} 积分</text><button :disabled="busy || Number(session.user?.points || 0)<g.pointsCost" @tap="exchange(g)">兑换优惠券</button></view><text v-if="!goods.length" class="sub">暂无可兑换商品</text></template></view></template>
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { request, mallApi } from '../../api'
import { session, saveSession } from '../../session'
import { useNativePage, go, confirmAction } from '../../useNativePage'
import { money } from '../../utils'
const goods=ref<any[]>([])
const {loading,error,busy,reload,act}=useNativePage(async()=>{goods.value=await request<any[]>('/consumer/points/goods');saveSession(await mallApi.getProfile())})
async function exchange(g:any){if(await confirmAction(`消耗 ${g.pointsCost} 积分兑换 ${g.name}？`))await act(()=>request('/consumer/points/exchange','POST',undefined,{consumerId:session.user!.id,couponId:g.couponId}))}
</script><style src="../../native-page.scss" lang="scss"></style>
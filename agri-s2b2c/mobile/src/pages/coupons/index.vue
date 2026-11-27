<template><view class="native-page"><text class="title">我的优惠券</text><view v-if="error" class="panel error"><text>{{error}}</text><button :disabled="loading" @tap="reload">重新加载</button></view><view v-if="loading" class="sub">正在同步…</view><template v-if="!loading"><button @tap="go('/pages/services/index')">领取更多优惠券</button><view class="panel" v-for="c in rows" :key="c.id"><text>{{c.name}}</text><text class="sub">{{labels[c.status] || c.status}} · 满 {{c.minAmount || 0}} 元可用</text><text class="amount">{{c.type==='DISCOUNT'?(String(c.discountRate)+' 折'):money(c.amount)}}</text><text class="sub">{{c.validStart}} 至 {{c.validEnd}}</text></view><text v-if="!rows.length" class="sub">还没有优惠券</text></template></view></template>
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { request, mallApi } from '../../api'
import { session, saveSession } from '../../session'
import { useNativePage, go, confirmAction } from '../../useNativePage'
import { money } from '../../utils'
const rows=ref<any[]>([]),labels:Record<string,string>={UNUSED:'未使用',USED:'已使用',EXPIRED:'已过期'}
const {loading,error,busy,reload,act}=useNativePage(async()=>{rows.value=await mallApi.getCoupons(session.user!.id)})
</script><style src="../../native-page.scss" lang="scss"></style>
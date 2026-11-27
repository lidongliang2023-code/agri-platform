<template><view class="native-page"><text class="title">积分明细</text><view v-if="error" class="panel error"><text>{{error}}</text><button :disabled="loading" @tap="reload">重新加载</button></view><view v-if="loading" class="sub">正在同步…</view><template v-if="!loading"><view class="panel"><text class="amount">{{session.user?.points || 0}} 积分</text><button @tap="go('/pages/points/mall')">去兑换优惠券</button></view><view class="panel" v-for="r in rows" :key="r.id"><view class="row"><text>{{r.reason}}</text><text class="amount">{{r.points>0?'+':''}}{{r.points}}</text></view><text class="sub">余额 {{r.balance}} · {{r.createTime}}</text></view><text v-if="!rows.length" class="sub">暂无积分记录</text><view class="row"><button :disabled="pageNo<=1" @tap="change(-1)">上一页</button><text>第 {{pageNo}} 页</text><button :disabled="pageNo*20>=total" @tap="change(1)">下一页</button></view></template></view></template>
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { request, mallApi } from '../../api'
import { session, saveSession } from '../../session'
import { useNativePage, go, confirmAction } from '../../useNativePage'
import { money } from '../../utils'
const rows=ref<any[]>([]),pageNo=ref(1),total=ref(0)
const {loading,error,busy,reload,act}=useNativePage(async()=>{const r=await request<any>('/consumer/points/logs','GET',undefined,{consumerId:session.user!.id,page:pageNo.value,size:20});rows.value=r.records;total.value=r.total;saveSession(await mallApi.getProfile())})
function change(n:number){pageNo.value+=n;reload()}
</script><style src="../../native-page.scss" lang="scss"></style>
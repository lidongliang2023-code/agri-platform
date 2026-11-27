<template><view class="native-page"><text class="title">每日签到</text><view v-if="error" class="panel error"><text>{{error}}</text><button :disabled="loading" @tap="reload">重新加载</button></view><view v-if="loading" class="sub">正在同步…</view><template v-if="!loading"><view class="panel"><text class="amount">{{data.points || 0}} 积分</text><text class="sub">连续签到 {{data.continuousDays || 0}} 天，今日可获 {{data.todayPoints || 0}} 积分</text><button class="primary" :disabled="busy || data.signedToday" @tap="sign">{{data.signedToday?'今日已签到':'签到领取积分'}}</button></view><view class="panel"><text>本月签到</text><view class="line" v-for="d in data.monthDates || []" :key="d">{{d}}</view><text v-if="!data.monthDates?.length" class="sub">本月尚未签到</text></view></template></view></template>
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { request, mallApi } from '../../api'
import { session, saveSession } from '../../session'
import { useNativePage, go, confirmAction } from '../../useNativePage'
import { money } from '../../utils'
const data=ref<any>({})
const {loading,error,busy,reload,act}=useNativePage(async()=>{data.value=await request('/consumer/signin','GET',undefined,{consumerId:session.user!.id});saveSession(await mallApi.getProfile())})
function sign(){return act(()=>request('/consumer/signin','POST',undefined,{consumerId:session.user!.id}))}
</script><style src="../../native-page.scss" lang="scss"></style>
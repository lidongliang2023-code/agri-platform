<template><view class="native-page"><text class="title">商家成长</text><view v-if="error" class="panel error"><text>{{error}}</text><button :disabled="loading" @tap="reload">重新加载</button></view><view v-if="loading" class="sub">正在同步…</view><template v-if="!loading"><view class="panel"><text class="amount">{{channelGradeLabel(data.currentGrade)}}</text><text class="sub">近 {{data.days}} 天有效订单 {{data.orders}} 笔 · 成交 {{money(data.gmv)}}</text></view><view class="panel"><text>等级规则</text><view class="line" v-for="r in data.rules || []" :key="r.id"><text>{{channelGradeLabel(r.grade)}}</text><text class="sub">订单不少于 {{r.minOrders}} 笔，成交不少于 {{money(r.minGmv)}} · {{r.remark}}</text></view></view><view class="panel"><text>等级变更</text><view class="line" v-for="r in data.changes || []" :key="r.id"><text>{{channelGradeLabel(r.fromGrade)}} → {{channelGradeLabel(r.toGrade)}}</text><text class="sub">{{r.createTime}} · {{r.orders}} 笔 · {{money(r.gmv)}}</text></view><text v-if="!data.changes?.length" class="sub">暂无等级变更</text></view></template></view></template>
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { request, channelApi } from '../../api'
import { channelSession, saveChannelSession } from '../../session'
import { useNativePage, go, confirmAction } from '../../useNativePage'
import { channelGradeLabel, money } from '../../utils'
const data=ref<any>({})
const {loading,error,busy,reload,act}=useNativePage(async()=>{data.value=await request('/channel/grade-history','GET',undefined,{days:30})})
</script><style src="../../native-page.scss" lang="scss"></style>
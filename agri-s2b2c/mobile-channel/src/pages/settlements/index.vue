<template><view class="native-page"><text class="title">结算批次</text><view v-if="error" class="panel error"><text>{{error}}</text><button :disabled="loading" @tap="reload">重新加载</button></view><view v-if="loading" class="sub">正在同步…</view><template v-if="!loading && !error"><view class="panel" v-for="r in rows" :key="r.id"><text>{{r.batchNo}}</text><text class="amount">{{money(r.amount)}}</text><text class="sub">{{r.commissionCount}} 笔佣金 · {{r.periodStart || '不限开始日期'}} 至 {{r.periodEnd || '不限结束日期'}}</text><text class="sub">{{r.createdAt}}</text></view><text v-if="!rows.length" class="sub">暂无结算记录</text></template></view></template>
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { request, channelApi } from '../../api'
import { channelSession, saveChannelSession } from '../../session'
import { useNativePage, go, confirmAction } from '../../useNativePage'
import { money } from '../../utils'
const rows=ref<any[]>([])
const {loading,error,busy,reload,act}=useNativePage(async()=>{rows.value=[];rows.value=await request<any[]>('/channel/settlements')})
</script><style src="../../native-page.scss" lang="scss"></style>
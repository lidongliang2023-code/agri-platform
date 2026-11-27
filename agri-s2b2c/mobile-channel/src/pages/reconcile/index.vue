<template><view class="native-page"><text class="title">月度对账</text><view v-if="error" class="panel error"><text>{{error}}</text><button :disabled="loading" @tap="reload">重新加载</button></view><view v-if="loading" class="sub">正在同步…</view><template v-if="!loading && !error"><view class="panel"><picker :disabled="loading" mode="date" fields="month" :value="month" @change="month=String($event.detail.value).slice(0,7);reload()"><view class="picker">账期：{{month || '本月'}}，点击切换</view></picker><text class="amount">已结佣金减已提现 {{money(data.summary?.netIncome)}}</text><text class="sub">订单金额 {{money(data.summary?.gmv)}} · {{data.summary?.orderCount || 0}} 笔</text><text class="sub">已结佣金 {{money(data.summary?.commissionSettled)}} · 待结 {{money(data.summary?.commissionPending)}}</text><text class="sub">已提现 {{money(data.summary?.withdrawalPaid)}} · 处理中 {{money(data.summary?.withdrawalProcessing)}}</text><button @tap="go('/pages/settlements/index')">结算批次</button></view><view class="panel"><text>收支明细</text><view class="line" v-for="(r,i) in data.ledger || []" :key="i"><view class="row"><text>{{r.summary}}</text><text>{{money(r.amount)}}</text></view><text class="sub">{{r.ref_no || r.ref}} · {{r.status}} · {{r.t}}</text></view><text v-if="!data.ledger?.length" class="sub">该账期没有收支记录</text></view></template></view></template>
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { request, channelApi } from '../../api'
import { channelSession, saveChannelSession } from '../../session'
import { useNativePage, go, confirmAction } from '../../useNativePage'
import { money } from '../../utils'
const month=ref(''),data=ref<any>({})
const {loading,error,busy,reload,act}=useNativePage(async()=>{data.value={};data.value=await request('/channel/reconcile','GET',undefined,{month:month.value||undefined});month.value=data.value.month || ''})
</script><style src="../../native-page.scss" lang="scss"></style>
<template><view class="native-page"><text class="title">会员中心</text><view v-if="error" class="panel error"><text>{{error}}</text><button :disabled="loading" @tap="reload">重新加载</button></view><view v-if="loading" class="sub">正在同步…</view><template v-if="!loading"><view class="panel"><text class="amount">{{data.level || session.user?.memberLevel}}</text><text class="sub">累计消费 {{money(data.totalConsume)}} · 成长值 {{data.growth || 0}}</text><text class="sub">下一等级 {{data.nextLevel || '已达最高等级'}} · 门槛 {{data.nextThreshold ?? '—'}}</text></view><view class="links"><button @tap="go('/pages/signin/index')">每日签到</button><button @tap="go('/pages/points/index')">积分明细</button><button @tap="go('/pages/points/mall')">积分商城</button><button @tap="go('/pages/coupons/index')">我的优惠券</button></view><view class="panel"><text>成长记录</text><view v-for="r in data.records || []" :key="r.id" class="line"><text>{{r.description}} · {{r.value}}</text><text class="sub">{{r.createTime}}</text></view><text v-if="!data.records?.length" class="sub">暂无成长记录</text></view></template></view></template>
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { request, mallApi } from '../../api'
import { session, saveSession } from '../../session'
import { useNativePage, go, confirmAction } from '../../useNativePage'
import { money } from '../../utils'
const data=ref<any>({})
const {loading,error,busy,reload,act}=useNativePage(async()=>{const profile=await mallApi.getProfile();saveSession(profile);data.value=await request('/consumer/growth','GET',undefined,{consumerId:profile.id})})
</script><style src="../../native-page.scss" lang="scss"></style>
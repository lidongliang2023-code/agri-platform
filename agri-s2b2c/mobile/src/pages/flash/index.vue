<template><view class="native-page"><text class="title">限时秒杀</text><view v-if="error" class="panel error"><text>{{error}}</text><button :disabled="loading" @tap="reload">重新加载</button></view><view v-if="loading" class="sub">正在同步…</view><template v-if="!loading"><view class="panel" v-for="g in rows" :key="g.id"><text>{{g.productName}}</text><text class="amount">{{money(g.salePrice)}}</text><text class="sub">原价 {{money(g.originalPrice)}} · 剩余 {{g.remainStock}} {{g.unit}}</text><text class="sub">{{g.startTime}} 至 {{g.endTime}}</text><button :disabled="g.remainStock<=0 || !g.productId" @tap="go('/pages/product/detail?id='+g.productId)">查看商品并购买</button></view><text v-if="!rows.length" class="sub">暂无秒杀商品</text></template></view></template>
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { request, mallApi } from '../../api'
import { session, saveSession } from '../../session'
import { useNativePage, go, confirmAction } from '../../useNativePage'
import { money } from '../../utils'
const rows=ref<any[]>([])
const {loading,error,busy,reload,act}=useNativePage(async()=>{const data=await mallApi.getMarketing();rows.value=data.flashSales || []})
</script><style src="../../native-page.scss" lang="scss"></style>
<template><view class="native-page"><text class="title">浏览足迹</text><view v-if="error" class="panel error"><text>{{error}}</text><button :disabled="loading" @tap="reload">重新加载</button></view><view v-if="loading" class="sub">正在同步…</view><template v-if="!loading"><button :disabled="busy || !rows.length" @tap="clear">清空足迹</button><view v-if="!rows.length" class="panel sub">暂无记录，去商品页看看吧。</view><view v-for="item in rows" :key="item.id" class="panel"><view class="row" @tap="go('/pages/product/detail?id='+item.productId)"><image v-if="item.image" class="thumb" :src="item.image" mode="aspectFill"/><view><text>{{item.name || '商品已下架'}}</text><text class="sub">{{item.origin}} · {{item.visitedAt || item.createTime}}</text><text class="amount">{{money(item.price)}}</text></view></view></view></template></view></template>
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { request, mallApi } from '../../api'
import { session, saveSession } from '../../session'
import { useNativePage, go, confirmAction } from '../../useNativePage'
import { money } from '../../utils'
const rows=ref<any[]>([])
const {loading,error,busy,reload,act}=useNativePage(async()=>{rows.value=await request<any[]>('/consumer/footprints','GET',undefined,{consumerId:session.user!.id})})
async function remove(productId:string|number){await act(()=>request('/consumer/favorites','DELETE',undefined,{consumerId:session.user!.id,productId}))}
async function clear(){if(await confirmAction('清空当前账号的浏览足迹？'))await act(()=>request('/consumer/footprints','DELETE',undefined,{consumerId:session.user!.id}))}
</script><style src="../../native-page.scss" lang="scss"></style>
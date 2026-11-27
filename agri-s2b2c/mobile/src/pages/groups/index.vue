<template><view class="native-page"><text class="title">社区拼团</text><view v-if="error" class="panel error"><text>{{error}}</text><button :disabled="loading" @tap="reload">重新加载</button></view><view v-if="loading" class="sub">正在同步…</view><template v-if="!loading"><button @tap="go('/pages/groups/mine')">我的拼团</button><view v-for="g in rows" :key="g.id" class="panel"><text>{{g.name}}</text><text class="sub">{{g.productName}} · {{g.groupSize}} 人团</text><text class="amount">{{money(g.groupPrice)}}</text><text class="sub">{{g.instanceCount}} 个团待加入 · 截止 {{g.endTime}}</text><button class="primary" @tap="go('/pages/groups/detail?id='+g.id)">查看拼团</button></view><text v-if="!rows.length" class="sub">暂无进行中的拼团</text></template></view></template>
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { request, mallApi } from '../../api'
import { session, saveSession } from '../../session'
import { useNativePage, go, confirmAction } from '../../useNativePage'
import { money } from '../../utils'
const rows=ref<any[]>([])
const {loading,error,busy,reload,act}=useNativePage(async()=>{rows.value=await request<any[]>('/consumer/group-buy/open')})
</script><style src="../../native-page.scss" lang="scss"></style>
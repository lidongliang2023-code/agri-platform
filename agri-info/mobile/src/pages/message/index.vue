<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { infoApi, toast, money, toArray, statusLabel, type Report, type Expert, type Attestation, type Knowledge, type QaRecord, type Quote } from '../../api'
import PageState from '../../components/PageState.vue'
import { useNativePage, useFavorite } from '../../useNativePage'

import type { AlertMessage } from '../../api'
const items=ref<AlertMessage[]>([]), unread=ref(0), marking=ref(false)
const {loading,error,load}=useNativePage(async()=>{const data=await infoApi.alertMessages();items.value=data.items;unread.value=data.unread})
onShow(load)
async function mark(){if(marking.value||!unread.value)return;marking.value=true;try{await infoApi.readAllAlerts();await load()}catch(e){toast(e instanceof Error?e.message:'操作失败')}finally{marking.value=false}}

</script>
<template><view class="native-page"><view class="native-heading"><text class="native-title">消息通知</text><text class="native-muted">价格预警 · {{unread}} 条未读</text></view><button class="btn" :disabled="marking||loading||!unread" @tap="mark">全部标为已读</button><PageState :loading="loading" :error="error" @retry="load" /><view v-if="!loading && !error"><view v-for="item in items" :key="item.id" class="native-card"><text class="native-card-title">{{item.read?'':'• '}}{{item.title}}</text><text class="native-body">{{item.content}}</text><text class="native-meta">{{item.quoteName}} · {{item.createdAt}}</text></view><view v-if="!items.length" class="native-state">暂无预警消息</view></view></view></template>

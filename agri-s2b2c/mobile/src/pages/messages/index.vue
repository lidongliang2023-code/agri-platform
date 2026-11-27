<template><view class="native-page"><text class="title">消息中心</text><view v-if="error" class="panel error"><text>{{error}}</text><button :disabled="loading" @tap="reload">重新加载</button></view><view v-if="loading" class="sub">正在同步…</view><template v-if="!loading"><button :disabled="busy || !rows.length" @tap="readAll">全部标为已读</button><view v-if="!rows.length" class="panel sub">暂无消息</view><view v-for="item in rows" :key="item.id" class="panel"><text>{{item.title}}</text><text class="badge">{{item.isRead?' · 已读':' · 未读'}}</text><text class="sub">{{item.content}}</text><text class="sub">{{item.createTime}}</text><button v-if="!item.isRead" :disabled="busy" @tap="read(item.id)">标为已读</button></view></template></view></template>
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { request, mallApi } from '../../api'
import { session, saveSession } from '../../session'
import { useNativePage, go, confirmAction } from '../../useNativePage'
import { money } from '../../utils'
const rows=ref<any[]>([])
const {loading,error,busy,reload,act}=useNativePage(async()=>{rows.value=await request<any[]>('/consumer/messages','GET',undefined,{consumerId:session.user!.id})})
function read(id:string|number){return act(()=>request(`/consumer/messages/${id}/read`,'PUT'))}
function readAll(){return act(()=>request('/consumer/messages/read-all','PUT',undefined,{consumerId:session.user!.id}))}
</script><style src="../../native-page.scss" lang="scss"></style>
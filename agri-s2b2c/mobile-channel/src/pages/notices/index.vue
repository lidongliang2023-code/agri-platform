<template><view class="native-page"><text class="title">通知中心</text><view v-if="error" class="panel error"><text>{{error}}</text><button :disabled="loading" @tap="reload">重新加载</button></view><view v-if="loading" class="sub">正在同步…</view><template v-if="!loading"><view class="panel"><view class="row"><text>仅未读</text><switch :checked="unreadOnly" @change="toggleUnread"/></view><text class="sub">未读 {{unread}} 条</text><button :disabled="busy || !unread" @tap="readAll">全部标为已读</button><button @tap="go('/pages/notices/preferences')">通知偏好</button></view><view class="panel" v-for="r in rows" :key="r.id"><text>{{r.title}}</text><text class="badge">{{r.readFlag?' · 已读':' · 未读'}}</text><text class="sub">{{r.content}}</text><text class="sub">{{r.createTime}}</text><button v-if="!r.readFlag" :disabled="busy" @tap="read(r.id)">标为已读</button><button v-if="r.refType==='ORDER' && r.refId" @tap="go('/pages/orders/detail?id='+r.refId)">查看订单</button></view><text v-if="!rows.length" class="sub">暂无通知</text><view class="row"><button :disabled="pageNo<=1 || busy" @tap="change(-1)">上一页</button><text>第 {{pageNo}} 页 / 共 {{total}} 条</text><button :disabled="pageNo*20>=total || busy" @tap="change(1)">下一页</button></view></template></view></template>
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { request, channelApi } from '../../api'
import { channelSession, saveChannelSession } from '../../session'
import { useNativePage, go, confirmAction } from '../../useNativePage'
import { money } from '../../utils'
const rows=ref<any[]>([]),pageNo=ref(1),total=ref(0),unread=ref(0),unreadOnly=ref(false)
const {loading,error,busy,reload,act}=useNativePage(async()=>{const r=await request<any>('/channel/notices','GET',undefined,{page:pageNo.value,size:20,unreadOnly:unreadOnly.value});rows.value=r.records;total.value=r.total;unread.value=r.unread})
function toggleUnread(event: Event){unreadOnly.value=Boolean((event as unknown as {detail:{value:boolean}}).detail.value);pageNo.value=1;reload()}
function change(n:number){pageNo.value+=n;reload()}function read(id:string|number){return act(()=>request(`/channel/notices/${id}/read`,'PUT'))}function readAll(){return act(()=>request('/channel/notices/read-all','PUT'))}
</script><style src="../../native-page.scss" lang="scss"></style>
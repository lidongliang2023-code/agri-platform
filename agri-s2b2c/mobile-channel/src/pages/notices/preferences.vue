<template><view class="native-page"><text class="title">通知偏好</text><view v-if="error" class="panel error"><text>{{error}}</text><button :disabled="loading" @tap="reload">重新加载</button></view><view v-if="loading" class="sub">正在同步…</view><template v-if="!loading"><view class="panel"><text class="sub">控制商家站内业务通知，不影响订单状态。</text><view v-for="r in rows" :key="r.noticeType" class="row"><text>{{r.title}}</text><switch :checked="!!r.enabled" :disabled="busy" @change="saveEvent(r,$event)"/></view></view></template></view></template>
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { request, channelApi } from '../../api'
import { channelSession, saveChannelSession } from '../../session'
import { useNativePage, go, confirmAction } from '../../useNativePage'
import { money } from '../../utils'
const rows=ref<any[]>([])
const {loading,error,busy,reload,act}=useNativePage(async()=>{rows.value=await request<any[]>('/channel/notice-preferences')})
function saveEvent(r:any,event:Event){return save(r,Boolean((event as unknown as {detail:{value:boolean}}).detail.value))}
async function save(r:any,enabled:boolean){await act(()=>request('/channel/notice-preferences','PUT',{noticeType:r.noticeType,enabled}))}
</script><style src="../../native-page.scss" lang="scss"></style>
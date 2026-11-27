<template><view class="native-page"><text class="title">评价管理</text><view v-if="error" class="panel error"><text>{{error}}</text><button :disabled="loading" @tap="reload">重新加载</button></view><view v-if="loading" class="sub">正在同步…</view><template v-if="!loading"><view class="panel"><picker :range="filters" @change="filterIndex=Number($event.detail.value);search()"><view class="picker">{{filters[filterIndex]}}</view></picker></view><view class="panel" v-for="r in rows" :key="r.id"><text>{{r.productName}} · {{r.rating}} 星</text><text class="sub">{{r.anonymous?'匿名客户':r.nickname || '客户'}} · {{r.createTime}}</text><text>{{r.content || '未填写评价内容'}}</text><text v-if="r.reply" class="sub">已回复：{{r.reply}}</text><template v-else><textarea v-model="drafts[r.id]" maxlength="1000" placeholder="回复这条评价"/><button :disabled="busy || !drafts[r.id]?.trim()" @tap="reply(r.id)">提交回复</button></template></view><text v-if="!rows.length" class="sub">暂无评价</text><view class="row"><button :disabled="pageNo<=1 || busy" @tap="change(-1)">上一页</button><text>第 {{pageNo}} 页 / 共 {{total}} 条</text><button :disabled="pageNo*20>=total || busy" @tap="change(1)">下一页</button></view></template></view></template>
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { request, channelApi } from '../../api'
import { channelSession, saveChannelSession } from '../../session'
import { useNativePage, go, confirmAction } from '../../useNativePage'
import { money } from '../../utils'
const rows=ref<any[]>([]),pageNo=ref(1),total=ref(0),filterIndex=ref(0),drafts=reactive<Record<string,string>>({});const filters=['全部评价','未回复','已回复']
const {loading,error,busy,reload,act}=useNativePage(async()=>{const r=await request<any>('/channel/reviews','GET',undefined,{page:pageNo.value,size:20,replied:filterIndex.value===0?undefined:filterIndex.value===2});rows.value=r.records;total.value=r.total})
function search(){pageNo.value=1;reload()}function change(n:number){pageNo.value+=n;reload()}
async function reply(id:string|number){if(await confirmAction('提交后不能重复回复，确认发布这条回复？')){const ok=await act(()=>request(`/channel/review/${id}/reply`,'PUT',undefined,{reply:drafts[id].trim()}));if(ok)delete drafts[id]}}
</script><style src="../../native-page.scss" lang="scss"></style>
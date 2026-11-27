<template><view class="native-page"><text class="title">评价中心</text><view v-if="error" class="panel error"><text>{{error}}</text><button :disabled="loading" @tap="reload">重新加载</button></view><view v-if="loading" class="sub">正在同步…</view><template v-if="!loading"><view class="panel" v-for="r in rows" :key="r.id"><text>{{r.productName || r.nickname || '匿名用户'}}</text><text class="sub">{{r.rating}} 星 · {{r.createTime}}</text><text>{{r.content || '用户未填写评价内容'}}</text><text v-if="r.reply" class="sub">商家回复：{{r.reply}}</text></view><text v-if="!rows.length" class="sub">暂无评价，订单完成后可从订单详情发表评价。</text><view v-if="productId" class="row"><button :disabled="loading || pageNo<=1" @tap="change(-1)">上一页</button><text>{{pageNo}}</text><button :disabled="loading || pageNo*20>=total" @tap="change(1)">下一页</button></view></template></view></template>
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { request, mallApi } from '../../api'
import { session, saveSession } from '../../session'
import { useNativePage, go, confirmAction } from '../../useNativePage'
import { money } from '../../utils'
const rows=ref<any[]>([]),productId=ref(''),pageNo=ref(1),total=ref(0);onLoad(o=>{productId.value=String(o?.productId || '')})
const {loading,error,busy,reload,act}=useNativePage(async()=>{if(productId.value){const r=await request<any>('/consumer/reviews','GET',undefined,{productId:productId.value,page:pageNo.value,size:20});rows.value=r.records;total.value=r.total}else rows.value=await request<any[]>('/consumer/reviews/mine','GET',undefined,{consumerId:session.user!.id})})
function change(n:number){
  if(loading.value) return
  const next=pageNo.value+n
  if(next<1 || next>Math.max(1,Math.ceil(total.value/20))) return
  pageNo.value=next
  reload()
}
</script><style src="../../native-page.scss" lang="scss"></style>
<template><view class="native-page"><text class="title">支付结果</text><view v-if="error" class="panel error"><text>{{error}}</text><button :disabled="loading" @tap="reload">重新加载</button></view><view v-if="loading" class="sub">正在同步…</view><template v-if="!loading"><view v-if="order" class="panel"><text class="amount">{{paid?'订单已确认支付':order.status==='PENDING_PAY'?'订单仍待支付':'当前订单状态'}}</text><text class="sub">{{order.orderNo}} · {{order.statusText || order.status}}</text><text class="sub">{{money(order.payAmount)}}，结果来自服务端订单状态；联调支付不代表真实扣款。</text><button v-if="order.status==='PENDING_PAY'" @tap="go('/pages/pay/index?id='+id)">返回支付页</button><button @tap="go('/pages/orders/detail?id='+id)">查看订单详情</button></view></template></view></template>
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { request, mallApi } from '../../api'
import { session, saveSession } from '../../session'
import { useNativePage, go, confirmAction } from '../../useNativePage'
import { money } from '../../utils'
const id=ref(''),order=ref<any>(null);onLoad(o=>id.value=String(o?.id||''));const paid=computed(()=>['PENDING_SHIP','SHIPPED','PENDING_RECEIVE','COMPLETED'].includes(order.value?.status))
const {loading,error,busy,reload,act}=useNativePage(async()=>{if(!id.value)throw new Error('缺少订单编号');order.value=await mallApi.getOrder(id.value)})
</script><style src="../../native-page.scss" lang="scss"></style>
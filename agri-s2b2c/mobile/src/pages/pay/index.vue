<template><view class="native-page"><text class="title">订单支付</text><view v-if="error" class="panel error"><text>{{error}}</text><button :disabled="loading" @tap="reload">重新加载</button></view><view v-if="loading" class="sub">正在同步…</view><template v-if="!loading"><view v-if="order" class="panel"><text>{{order.orderNo}}</text><text class="amount">应付 {{money(order.payAmount)}}</text><text class="sub">{{order.statusText || order.status}}</text><text class="sub">当前部署为联调支付：只调用商城订单状态接口，不会拉起微信收银台或产生真实扣款。</text><button v-if="order.status==='PENDING_PAY'" class="primary" :disabled="busy" @tap="pay">确认联调支付</button><button @tap="go('/pages/orders/detail?id='+id)">查看订单</button></view></template></view></template>
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { request, mallApi } from '../../api'
import { session, saveSession } from '../../session'
import { useNativePage, go, confirmAction } from '../../useNativePage'
import { money } from '../../utils'
const id=ref(''),order=ref<any>(null);onLoad(o=>id.value=String(o?.id||''))
const {loading,error,busy,reload,act}=useNativePage(async()=>{if(!id.value)throw new Error('缺少订单编号');order.value=await mallApi.getOrder(id.value)})
async function pay(){if(order.value?.status!=='PENDING_PAY'||busy.value)return;if(!await confirmAction(`将订单 ${order.value.orderNo} 标记为已支付，联调金额 ${money(order.value.payAmount)}。不发生真实扣款。`))return;const ok=await act(()=>mallApi.payOrder(id.value),false);if(ok)uni.redirectTo({url:'/pages/pay/result?id='+id.value})}
</script><style src="../../native-page.scss" lang="scss"></style>
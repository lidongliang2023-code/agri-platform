<template><view class="native-page"><text class="title">售后详情</text><view v-if="error" class="panel error"><text>{{error}}</text><button :disabled="loading" @tap="reload">重新加载</button></view><view v-if="loading" class="sub">正在同步…</view><template v-if="!loading"><view v-if="data" class="panel"><text>{{afterSaleTypeLabel(data.type)}} · {{statusMeta(data.status, data.returnShippedAt).label}}</text><text class="amount">{{money(data.amount)}}</text><text class="sub">申请原因：{{data.reason}}</text><text class="sub">处理意见：{{data.handleOpinion || '等待处理'}}</text><text class="sub">申请时间 {{data.createTime}}</text><button @tap="go('/pages/orders/detail?id='+data.orderId)">查看原订单</button><template v-if="data.status==='RETURNING' && !data.returnShippedAt"><input v-model="company" placeholder="退货物流公司"/><input v-model="logisticsNo" placeholder="退货物流单号"/><button :disabled="busy || !company.trim() || !logisticsNo.trim()" @tap="submit">提交退货物流</button></template><text v-if="data.returnShippedAt" class="sub">退货物流：{{data.returnCompany}} {{data.returnLogisticsNo}} · {{data.returnReceivedAt?'商家已收货':'待商家收货'}}</text></view></template></view></template>
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { request, mallApi } from '../../api'
import { session, saveSession } from '../../session'
import { useNativePage, go, confirmAction } from '../../useNativePage'
import { money } from '../../utils'
import { statusMeta, afterSaleTypeLabel } from '../../utils'
const id=ref(''),data=ref<any>(null),company=ref(''),logisticsNo=ref('');onLoad(o=>id.value=String(o?.id||''))
const {loading,error,busy,reload,act}=useNativePage(async()=>{data.value=(await mallApi.getAfterSales()).find(r=>String(r.id)===id.value);if(!data.value)throw new Error('售后单不存在或不属于当前账号')})
async function submit(){if(await confirmAction('确认提交退货物流？'))await act(()=>mallApi.submitReturn(id.value,company.value.trim(),logisticsNo.value.trim()))}
</script><style src="../../native-page.scss" lang="scss"></style>
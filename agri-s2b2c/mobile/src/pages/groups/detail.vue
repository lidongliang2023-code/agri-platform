<template><view class="native-page"><text class="title">拼团详情</text><view v-if="error" class="panel error"><text>{{error}}</text><button :disabled="loading" @tap="reload">重新加载</button></view><view v-if="loading" class="sub">正在同步…</view><template v-if="!loading"><view class="panel"><text>{{data.activity?.name}}</text><text class="amount">团价 {{money(data.activity?.groupPrice)}}</text><text class="sub">团长价 {{money(data.activity?.leaderPrice || data.activity?.groupPrice)}} · {{data.activity?.groupSize}} 人成团</text><text class="sub">{{data.activity?.startTime}} 至 {{data.activity?.endTime}}</text><text class="sub">本次购买 1 件，提交订单时由服务端校验库存、活动及参团资格。</text><button class="primary" :disabled="busy || data.activity?.status!=='ACTIVE'" @tap="buy()">发起拼团</button><button @tap="go('/pages/product/detail?id='+data.activity.productId)">查看商品</button></view><view class="panel"><text>可加入的团</text><view class="line" v-for="g in data.instances || []" :key="g.instanceId"><text>{{g.leaderName}} · {{g.joinedCount}} / {{g.requiredSize}} 人</text><text class="sub">有效至 {{g.expireTime}}</text><button :disabled="busy" @tap="buy(g.instanceId)">加入这个团</button></view><text v-if="!data.instances?.length" class="sub">暂无可参团记录，可以发起新团。</text></view></template></view></template>
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { request, mallApi } from '../../api'
import { session, saveSession } from '../../session'
import { useNativePage, go, confirmAction } from '../../useNativePage'
import { money } from '../../utils'
const id=ref(''),data=ref<any>({});onLoad(o=>id.value=String(o?.id||''))
const {loading,error,busy,reload,act}=useNativePage(async()=>{if(!id.value)throw new Error('缺少拼团活动编号');data.value=await request(`/consumer/group-buy/${id.value}`)})
async function buy(instanceId?:string|number){
 if(busy.value)return
 if(!await confirmAction('本次结算仅勾选拼团商品，购物车内其他商品将保留。继续？'))return
 busy.value=true;error.value=''
 try{
 const uid=session.user!.id,productId=data.value.activity.productId
 let cart=await mallApi.getCart(uid),row=cart.find(x=>String(x.productId)===String(productId)&&!x.channelId)
 if(!row){const added=await mallApi.addCart(uid,productId,1);if(!added.success)throw new Error(added.message||'加购失败');cart=await mallApi.getCart(uid);row=cart.find(x=>String(x.productId)===String(productId)&&!x.channelId)}
 if(!row)throw new Error('购物车商品未同步，请重试')
 if(row.quantity!==1){const updated=await mallApi.updateCart(row.id,1);if(!updated.success)throw new Error('更新数量失败')}
 const cleared=await mallApi.selectAllCart(uid,false);if(!cleared.success)throw new Error('勾选同步失败')
 const selected=await mallApi.selectCart(row.id,true);if(!selected.success)throw new Error('勾选商品失败')
 uni.setStorageSync('s2b2c_checkout_item_ids',[row.id])
 go(`/pages/checkout/index?groupBuyId=${id.value}${instanceId?'&groupInstanceId='+instanceId:''}`)
 }catch(e){error.value=e instanceof Error?e.message:'准备拼团失败'}finally{busy.value=false}
}
</script><style src="../../native-page.scss" lang="scss"></style>
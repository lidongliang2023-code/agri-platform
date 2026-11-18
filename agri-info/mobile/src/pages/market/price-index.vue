<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { infoApi, toast, money, toArray, statusLabel, type Report, type Expert, type Attestation, type Knowledge, type QaRecord, type Quote } from '../../api'
import PageState from '../../components/PageState.vue'
import { useNativePage, useFavorite } from '../../useNativePage'

import TrendChart from '../../components/TrendChart.vue'
import type {PriceIndex,IndexDetail} from '../../api'
const items=ref<PriceIndex[]>([]),active=ref<IndexDetail|null>(null),activeId=ref(0)
const {loading,error,load}=useNativePage(async()=>{items.value=await infoApi.indices();if(!activeId.value)activeId.value=items.value[0]?.id||0;active.value=activeId.value?await infoApi.indexDetail(activeId.value):null})
onLoad(load)
function select(index:number){if(loading.value)return;activeId.value=items.value[index]?.id||0;load()}
function open(id:number){uni.navigateTo({url:`/pages/market/variety?id=${id}`})}
const points=computed(()=>active.value?.series?.length?active.value.series.map(p=>({label:p.date,value:Number(p.value??p.price??0)})):(active.value?.trend||[]).map((value,i)=>({label:String(i+1),value})))

</script>
<template><view class="native-page"><view class="native-heading"><text class="native-title">价格指数</text><text class="native-muted">按服务端发布口径展示，不混合不同基期指数</text></view><picker :range="items" range-key="name" @change="select(Number($event.detail.value))"><view class="native-filter">{{active?.name||'选择指数'}} ▾</view></picker><PageState :loading="loading" :error="error" @retry="load" /><template v-if="active && !loading && !error"><view class="native-card"><text class="native-card-title">{{active.name}}</text><text class="native-price">{{active.value}}</text><text class="native-meta">涨跌 {{active.changePct}}% · 样本 {{active.sampleCount}}</text><TrendChart :points="points"/><text class="native-body">基期：{{active.basePeriod}}</text><text class="native-body">{{active.method}}</text><text class="native-meta">{{active.publishedAt}}</text></view><view v-for="item in active.components" :key="item.id" class="native-card" @tap="open(item.id)"><text class="native-card-title">{{item.name}} · {{item.origin}}</text><text>{{money(item.price)}} {{item.priceUnit}} · {{item.changePct}}%</text></view></template></view></template>

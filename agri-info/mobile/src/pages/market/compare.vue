<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { infoApi, toast, money, toArray, statusLabel, type Report, type Expert, type Attestation, type Knowledge, type QaRecord, type Quote } from '../../api'
import PageState from '../../components/PageState.vue'
import { useNativePage, useFavorite } from '../../useNativePage'

import TrendChart from '../../components/TrendChart.vue'
const choices=ref<Quote[]>([]), selected=ref<number[]>([]), rows=ref<Quote[]>([]), keyword=ref('')
const comparing=ref(false), compareError=ref('')
let generation=0
const filtered=computed(()=>choices.value.filter(q=>q.name.includes(keyword.value)||q.origin.includes(keyword.value)))
const {loading,error,load}=useNativePage(async()=>{choices.value=(await infoApi.markets()).quotes;await compare()})
onLoad(o=>{const id=Number(o?.id);if(id>0)selected.value=[id];load()})
async function compare(){const stamp=++generation;rows.value=[];compareError.value='';if(!selected.value.length){comparing.value=false;return}comparing.value=true;try{const data=await infoApi.compare(selected.value);if(stamp===generation)rows.value=data}catch(e){if(stamp===generation)compareError.value=e instanceof Error?e.message:'对比失败'}finally{if(stamp===generation)comparing.value=false}}
function select(id:number){if(selected.value.includes(id))selected.value=selected.value.filter(n=>n!==id);else{if(selected.value.length>=4){toast('最多对比4个品种');return}selected.value=[...selected.value,id]}compare()}

</script>
<template><view class="native-page"><view class="native-heading"><text class="native-title">品种行情对比</text><text class="native-muted">最多选择 4 个品种；趋势以首个采样点为 100</text></view><view class="native-search"><input v-model="keyword" placeholder="筛选品种或产地"/></view><PageState :loading="loading" :error="error" @retry="load" /><template v-if="!loading && !error"><scroll-view scroll-y class="native-options"><view v-for="q in filtered" :key="q.id" :class="['native-option',{selected:selected.includes(q.id)}]" @tap="select(q.id)"><text>{{q.name}} · {{q.origin}}</text><text>{{selected.includes(q.id)?'已选':'选择'}}</text></view></scroll-view><PageState :loading="comparing" :error="compareError" @retry="compare"/><view v-if="!selected.length" class="native-state">选择品种开始对比</view><view v-for="q in rows" :key="q.id" class="native-card"><text class="native-card-title">{{q.name}} · {{q.origin}}</text><text class="native-price">{{money(q.price)}} {{q.priceUnit}}</text><text class="native-meta">涨跌 {{q.changePct}}% · {{q.updatedAt}}</text><TrendChart :points="(q.normalized||[]).map((value,i)=>({label:String(i+1),value}))"/><text class="native-meta">{{q.spec}} · {{q.market}}</text></view><text class="native-muted">不同规格和计价单位不直接比较单价；曲线使用服务端归一化结果。</text></template></view></template>

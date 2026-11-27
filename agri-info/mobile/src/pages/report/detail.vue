<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { infoApi, toast, money, toArray, statusLabel, type Report, type Expert, type Attestation, type Knowledge, type QaRecord, type Quote } from '../../api'
import PageState from '../../components/PageState.vue'
import { useNativePage, useFavorite } from '../../useNativePage'

const id=ref(0), item=ref<Report|null>(null), subscribing=ref(false)
const {saved,saving,refresh,toggle}=useFavorite('report',()=>item.value)
const {loading,error,load}=useNativePage(async()=>{item.value=await infoApi.report(id.value);await refresh()})
onLoad(o=>{id.value=Number(o?.id);if(!Number.isSafeInteger(id.value)||id.value<=0){error.value='缺少报告编号，请从列表进入';return}load()})
async function subscribe(){if(!item.value||subscribing.value)return;subscribing.value=true;try{const name=item.value.category;const records=await infoApi.subscriptions();const existing=records.find(r=>r.targetType==='报告'&&r.targetName===name);if(existing){if(!existing.enabled)await infoApi.toggleSubscription(existing.id,true)}else await infoApi.createSubscription({targetType:'报告',targetName:name,channel:'站内消息',frequency:'每月'});toast('已订阅该报告分类')}catch(e){toast(e instanceof Error?e.message:'订阅失败')}finally{subscribing.value=false}}
function open(id:number){uni.navigateTo({url:`/pages/report/detail?id=${id}`})}
function attest(id:number){uni.navigateTo({url:`/pages/attest/detail?id=${id}`})}

</script>
<template><view class="native-page"><PageState :loading="loading" :error="error" @retry="load" /><template v-if="item && !loading && !error"><view class="native-heading"><text class="native-title">{{item.title}}</text><text class="native-muted">{{item.period}} · {{item.category}} · {{item.publishedAt}}</text></view><view class="native-card"><text class="native-card-title">报告摘要</text><text class="native-body">{{item.summary}}</text><text class="native-meta">{{item.reportNo}} · {{item.pageCount}} 页</text></view><view v-for="(section,i) in toArray(item.sections)" :key="i" class="native-card"><text class="native-body">{{section}}</text></view><view class="native-note">当前展示服务提供的报告内容，暂不提供在线购买或文件下载。</view><view class="native-actions"><button class="btn" :disabled="saving" @tap="toggle">{{saved?'取消收藏':'收藏报告'}}</button><button class="btn btn-primary" :disabled="subscribing" @tap="subscribe">订阅此类报告</button></view><view v-if="item.attestation" class="native-card" @tap="attest(item.attestation.id)">查看关联存证 ›</view><view v-for="row in item.related" :key="row.id" class="native-card" @tap="open(row.id)">{{row.title}} ›</view></template></view></template>

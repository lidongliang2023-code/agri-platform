<script setup lang="ts">
import { useGovPage } from '../../useGovPage'
useGovPage()
import AuthorizationNotice from '../../components/AuthorizationNotice.vue'
import { ref } from 'vue'
import { onShow,onPullDownRefresh } from '@dcloudio/uni-app'
import { api,statusMeta,type Case } from '../../api'
const items=ref<Case[]>([]),loading=ref(false),error=ref('')
onShow(load)
onPullDownRefresh(load)
async function load(){if(loading.value){uni.stopPullDownRefresh();return}loading.value=true;error.value='';try{items.value=await api.cases()}catch(e){items.value=[];error.value=e instanceof Error?e.message:'加载失败'}finally{loading.value=false;uni.stopPullDownRefresh()}}
function create(){uni.navigateTo({url:'/pages/cases/create'})}
function detail(item:Case){uni.navigateTo({url:`/pages/cases/detail?id=${item.id}`})}
</script>
<template><view class="page pad"><AuthorizationNotice duty="case" context="cases"/><view class="between"><view><text class="page-title">我的案件</text><text class="tiny">现场登记与进度查询 · 阶段审批由监管运营办理</text></view><button class="btn btn-sm btn-primary" @tap="create">＋立案</button></view><view class="summary"><view><text class="strong">{{items.filter(i=>i.status!=='closed').length}}</text><text>在办案件</text></view><view><text class="strong">{{items.filter(i=>i.status==='evidence').length}}</text><text>取证阶段</text></view><view><text class="strong">{{items.filter(i=>i.status==='closed').length}}</text><text>已结案</text></view></view><view v-if="loading" class="loading">正在加载案件…</view><view v-else-if="error" class="state-panel"><text>{{error}}</text><button class="btn" @tap="load">重新加载</button></view><view v-else-if="!items.length" class="state-panel"><text>暂无本人承办案件，可关联执法任务登记立案。</text></view><view v-else class="case-list"><view class="case" v-for="item in items" :key="item.id" @tap="detail(item)"><view class="between"><view><text class="strong">{{item.subjectName}}</text><text class="tiny">{{item.caseNo}} · {{item.caseType}}</text></view><text class="tag" :class="statusMeta(item.status).tone">{{statusMeta(item.status).label}}</text></view><text class="muted">{{item.summary}}</text><progress class="progress" :percent="Math.min(100,Math.max(0,item.progress||0))" activeColor="#12764a" backgroundColor="#e7eee9" :stroke-width="4" /><view class="between"><text class="tiny">承办：{{item.handler}} · {{item.filedAt}}</text><text class="link">案件详情 ›</text></view></view></view></view></template>
<style lang="scss" scoped>.page-title{display:block;font-size:38rpx;font-weight:750}.summary{display:flex;margin:20rpx 0;padding:20rpx;border-radius:20rpx;background:#fff}.summary view{display:flex;align-items:center;flex-direction:column;gap:4rpx;border-right:1rpx solid #edf2ee}.summary view:last-child{border-right:0}.summary .strong{color:#0e5233;font-family:monospace;font-size:32rpx}.summary text{color:#718277;font-size:24rpx}.case{margin-bottom:14rpx;padding:20rpx;border:1rpx solid #e1e9e3;border-radius:20rpx;background:#fff}.case>view:first-child>view{display:flex;flex-direction:column;gap:4rpx}.case>.muted{display:block;margin:10rpx 0}.case .progress{margin:12rpx 0}.link{color:#12764a;font-size:24rpx}.summary>view{flex:1;min-width:0}
</style>

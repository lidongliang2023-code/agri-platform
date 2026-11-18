<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { infoApi, toast, money, toArray, statusLabel, type Report, type Expert, type Attestation, type Knowledge, type QaRecord, type Quote } from '../../api'
import PageState from '../../components/PageState.vue'
import { useNativePage, useFavorite } from '../../useNativePage'

const items=ref<Report[]>([]), categories=ref<string[]>([]), category=ref(''), tab=ref('library')
const {loading,error,load}=useNativePage(async()=>{if(tab.value==='saved'){const [all,favs]=await Promise.all([infoApi.reports(),infoApi.favorites()]);items.value=all.items.filter(r=>favs.some(f=>f.targetType==='report'&&f.targetId===r.id))}else{const data=await infoApi.reports(category.value||undefined);items.value=data.items;categories.value=data.categories}})
onShow(load)
function switchTab(value:string){if(loading.value)return;tab.value=value;load()}
function open(id:number){uni.navigateTo({url:`/pages/report/detail?id=${id}`})}

</script>
<template><view class="native-page"><view class="native-heading"><text class="native-title">产业报告</text><text class="native-muted">阅读公开内容，收藏后多端同步</text></view><view class="native-actions"><button class="btn" :class="{'btn-primary':tab==='library'}" @tap="switchTab('library')">报告库</button><button class="btn" :class="{'btn-primary':tab==='saved'}" @tap="switchTab('saved')">我的收藏</button></view><picker v-if="tab==='library'" :range="['全部',...categories]" @change="category=Number($event.detail.value)?categories[Number($event.detail.value)-1]:'';load()"><view class="native-filter">{{category||'全部分类'}} ▾</view></picker><PageState :loading="loading" :error="error" @retry="load" /><view v-if="!loading && !error"><view v-for="item in items" :key="item.id" class="native-card" @tap="open(item.id)"><text class="native-card-title">{{item.title}}</text><text class="native-meta">{{item.category}} · {{item.period}}</text><text class="native-body">{{item.summary}}</text><text class="native-meta">{{item.isFree?'免费内容':'内容预览'}} · {{item.publishedAt}}</text></view><view v-if="!items.length" class="native-state">暂无报告</view></view></view></template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { infoApi, toast, money, toArray, statusLabel, type Report, type Expert, type Attestation, type Knowledge, type QaRecord, type Quote } from '../../api'
import PageState from '../../components/PageState.vue'
import { useNativePage, useFavorite } from '../../useNativePage'

const items = ref<Knowledge[]>([])
const keyword = ref('')
const {loading,error,load} = useNativePage(async()=>{ items.value = await infoApi.knowledge({keyword:keyword.value.trim()}) })
onShow(load)
function open(id:number){uni.navigateTo({url:`/pages/knowledge/detail?id=${id}`})}

</script>
<template><view class="native-page"><view class="native-heading"><text class="native-title">农技知识库</text><text class="native-muted">查阅栽培、防治与生产知识</text></view>
<view class="native-search"><input v-model="keyword" placeholder="搜索作物或知识" confirm-type="search" @confirm="load"/><button @tap="load">搜索</button></view><PageState :loading="loading" :error="error" @retry="load" />
<view v-if="!loading && !error"><view v-for="item in items" :key="item.id" class="native-card" @tap="open(item.id)"><text class="native-card-title">{{item.title}}</text><text class="native-meta">{{item.category}} · {{item.crop}}</text><text class="native-body">{{item.summary}}</text><text class="native-meta">{{item.sourceName}} · {{item.updatedAt}}</text></view><view v-if="!items.length" class="native-state">暂无匹配知识，换个关键词试试</view></view></view></template>

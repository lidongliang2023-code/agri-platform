<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { infoApi, toast, money, toArray, statusLabel, type Report, type Expert, type Attestation, type Knowledge, type QaRecord, type Quote } from '../../api'
import PageState from '../../components/PageState.vue'
import { useNativePage, useFavorite } from '../../useNativePage'

const id=ref(0), item=ref<Knowledge|null>(null)
const {saved,saving,refresh,toggle}=useFavorite('knowledge',()=>item.value)
const {loading,error,load}=useNativePage(async()=>{item.value=await infoApi.knowledgeDetail(id.value);await refresh()})
onLoad(o=>{id.value=Number(o?.id);load()})
function open(id:number){uni.navigateTo({url:`/pages/knowledge/detail?id=${id}`})}
function ask(){uni.setStorageSync('info_ai_question',item.value?.title||'');uni.switchTab({url:'/pages/ai/index'})}

</script>
<template><view class="native-page"><PageState :loading="loading" :error="error" @retry="load" /><template v-if="item && !error && !loading"><view class="native-heading"><text class="native-title">{{item.title}}</text><text class="native-muted">{{item.category}} · {{item.crop}}</text></view><view class="native-card"><text class="native-meta">{{item.sourceName}} · {{item.updatedAt}}</text><text class="native-body">{{item.content || item.summary}}</text></view><view class="native-actions"><button class="btn" :disabled="saving" @tap="toggle">{{saved?'取消收藏':'收藏知识'}}</button><button class="btn btn-primary" @tap="ask">继续提问</button></view><view v-for="row in item.related" :key="row.id" class="native-card" @tap="open(row.id)"><text>{{row.title}} ›</text></view></template></view></template>

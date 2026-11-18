<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { infoApi, toast, money, toArray, statusLabel, type Report, type Expert, type Attestation, type Knowledge, type QaRecord, type Quote } from '../../api'
import PageState from '../../components/PageState.vue'
import { useNativePage, useFavorite } from '../../useNativePage'

const id=ref(0), item=ref<QaRecord|null>(null)
const {loading,error,load}=useNativePage(async()=>{item.value=(await infoApi.qaRecords()).find(r=>r.id===id.value)||null;if(!item.value)throw new Error('此记录已不在最近问答列表中')})
onLoad(o=>{id.value=Number(o?.id);load()})
function ask(){uni.setStorageSync('info_ai_question',item.value?.question||'');uni.switchTab({url:'/pages/ai/index'})}

</script>
<template><view class="native-page"><PageState :loading="loading" :error="error" @retry="load" /><template v-if="item && !error && !loading"><view class="native-heading"><text class="native-title">{{item.question}}</text><text class="native-muted">{{item.createdAt}} · {{item.qaNo}}</text></view><view class="native-card"><text class="native-card-title">{{item.expertName || '知识库回答'}}</text><text class="native-body">{{item.answer}}</text><text class="native-meta">{{item.crop}} · {{item.category}}</text></view><view v-if="item.sourceRefs" class="native-card"><text class="native-card-title">参考内容</text><text class="native-body">{{toArray(item.sourceRefs).join('、')}}</text></view><button class="btn btn-primary" @tap="ask">基于此问题重新提问</button></template></view></template>

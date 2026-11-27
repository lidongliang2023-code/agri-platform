<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { infoApi, toast, money, toArray, statusLabel, expertStatusMeta, type Report, type Expert, type Attestation, type Knowledge, type QaRecord, type Quote } from '../../api'
import PageState from '../../components/PageState.vue'
import { useNativePage, useFavorite } from '../../useNativePage'

const id=ref(0), item=ref<Expert|null>(null)
const {saved,saving,refresh,toggle}=useFavorite('expert',()=>item.value?{id:item.value.id,title:item.value.name,summary:item.value.field}:null)
const {loading,error,load}=useNativePage(async()=>{item.value=await infoApi.expert(id.value);await refresh()})
onLoad(o=>{id.value=Number(o?.id);if(!Number.isSafeInteger(id.value)||id.value<=0){error.value='缺少专家编号，请从列表进入';return}load()})

</script>
<template><view class="native-page"><PageState :loading="loading" :error="error" @retry="load" /><template v-if="item && !loading && !error"><view class="native-heading"><text class="native-title">{{item.name}}</text><text class="native-muted">{{item.title}} · {{item.orgName}}</text></view><view class="native-card"><text class="native-card-title">{{item.field}}</text><text class="native-meta">{{item.region}} · <text :class="['tag', expertStatusMeta(item.status).tone]">{{expertStatusMeta(item.status).label}}</text></text><text class="native-body">{{item.intro}}</text><text class="native-meta">认证编号 {{item.certNo || '未提供'}}</text></view><button class="btn btn-primary" :disabled="saving" @tap="toggle">{{saved?'取消收藏专家':'收藏专家'}}</button><view class="native-note">专家资料与公开回答可供查阅，暂不提供付费咨询或预约。</view><view v-for="answer in item.answers" :key="answer.id" class="native-card"><text class="native-card-title">{{answer.question}}</text><text class="native-body">{{answer.answer}}</text><text class="native-meta">{{answer.createdAt}}</text></view></template></view></template>

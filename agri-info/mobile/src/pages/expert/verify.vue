<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { infoApi, toast, money, toArray, statusLabel, expertStatusMeta, type Report, type Expert, type Attestation, type Knowledge, type QaRecord, type Quote } from '../../api'
import PageState from '../../components/PageState.vue'
import { useNativePage, useFavorite } from '../../useNativePage'

const keyword=ref(''), items=ref<Expert[]>([]), searched=ref(false)
const {loading,error,load}=useNativePage(async()=>{if(!keyword.value.trim())throw new Error('请输入完整证书编号或专家姓名');items.value=[];searched.value=true;const key=keyword.value.trim();items.value=(await infoApi.experts()).items.filter(r=>r.certNo===key||r.name===key)})
function open(id:number){uni.navigateTo({url:`/pages/expert/detail?id=${id}`})}

</script>
<template><view class="native-page"><view class="native-heading"><text class="native-title">专家认证查询</text><text class="native-muted">查询平台已审核的专家，不作为链上验证或证书有效期证明</text></view><view class="native-search"><input v-model="keyword" placeholder="完整证书编号或姓名" confirm-type="search" @confirm="load"/><button @tap="load">查询</button></view><PageState :loading="loading" :error="error" @retry="load" /><view v-if="searched && !loading && !error"><view v-for="item in items" :key="item.id" class="native-card" @tap="open(item.id)"><text class="native-card-title">{{item.name}} · <text :class="['tag', expertStatusMeta(item.status).tone]">{{expertStatusMeta(item.status).label}}</text></text><text class="native-body">{{item.certNo}}</text><text class="native-meta">{{item.orgName}} · {{item.field}}</text></view><view v-if="!items.length" class="native-state">未找到完全匹配的已审核专家</view></view></view></template>

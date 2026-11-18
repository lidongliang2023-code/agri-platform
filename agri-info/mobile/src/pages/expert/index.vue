<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { infoApi, toast, money, toArray, statusLabel, type Report, type Expert, type Attestation, type Knowledge, type QaRecord, type Quote } from '../../api'
import PageState from '../../components/PageState.vue'
import { useNativePage, useFavorite } from '../../useNativePage'

const items=ref<Expert[]>([]), fields=ref<string[]>([]), field=ref('')
const {loading,error,load}=useNativePage(async()=>{const data=await infoApi.experts(field.value||undefined);items.value=data.items;fields.value=data.fields})
onShow(load)
function open(id:number){uni.navigateTo({url:`/pages/expert/detail?id=${id}`})}

</script>
<template><view class="native-page"><view class="native-heading"><text class="native-title">农技专家</text><text class="native-muted">查看平台已通过审核的专家资料与回答</text></view><picker :range="['全部领域',...fields]" @change="field=Number($event.detail.value)?fields[Number($event.detail.value)-1]:'';load()"><view class="native-filter">{{field||'全部领域'}} ▾</view></picker><PageState :loading="loading" :error="error" @retry="load" /><view v-if="!loading && !error"><view v-for="item in items" :key="item.id" class="native-card" @tap="open(item.id)"><text class="native-card-title">{{item.name}} · {{item.title}}</text><text class="native-meta">{{item.orgName}} · {{item.region}}</text><text class="native-body">{{item.field}}</text><text class="native-muted">{{item.intro}}</text></view><view v-if="!items.length" class="native-state">暂无该领域专家</view></view></view></template>

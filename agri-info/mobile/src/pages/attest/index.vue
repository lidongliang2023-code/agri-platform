<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { infoApi, toast, money, toArray, statusLabel, type Report, type Expert, type Attestation, type Knowledge, type QaRecord, type Quote } from '../../api'
import PageState from '../../components/PageState.vue'
import { useNativePage, useFavorite } from '../../useNativePage'

const items=ref<Attestation[]>([])
const {loading,error,load}=useNativePage(async()=>{items.value=await infoApi.attestations()})
onShow(load)
function open(id:number){uni.navigateTo({url:`/pages/attest/detail?id=${id}`})}
function verify(){uni.navigateTo({url:'/pages/attest/verify'})}

</script>
<template><view class="native-page"><view class="native-heading"><text class="native-title">内容存证</text><text class="native-muted">查看记录，按存证编号核验服务端状态</text></view><button class="btn btn-primary" @tap="verify">验证存证编号</button><PageState :loading="loading" :error="error" @retry="load" /><view v-if="!loading && !error"><view v-for="item in items" :key="item.id" class="native-card" @tap="open(item.id)"><text class="native-card-title">{{item.title}}</text><text class="native-body">{{item.attestNo}}</text><text class="native-meta">{{statusLabel(item.status)}} · {{item.attestedAt}}</text></view><view v-if="!items.length" class="native-state">暂无存证记录</view></view></view></template>

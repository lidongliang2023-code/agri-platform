<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { infoApi, toast, money, toArray, statusLabel, expertStatusMeta, type Report, type Expert, type Attestation, type Knowledge, type QaRecord, type Quote } from '../../api'
import PageState from '../../components/PageState.vue'
import { useNativePage, useFavorite } from '../../useNativePage'

const items=ref<Expert[]>([])
const {loading,error,load}=useNativePage(async()=>{items.value=await infoApi.myExpert()})
onShow(load)
function apply(){uni.navigateTo({url:'/pages/expert/apply'})}

</script>
<template><view class="native-page"><view class="native-heading"><text class="native-title">我的专家认证</text><text class="native-muted">申请记录和审核结果以平台返回为准</text></view><PageState :loading="loading" :error="error" @retry="load" /><template v-if="!loading && !error"><view v-for="item in items" :key="item.id" class="native-card"><text class="native-card-title">{{item.name}} · <text :class="['tag', expertStatusMeta(item.status).tone]">{{expertStatusMeta(item.status).label}}</text></text><text class="native-meta">{{item.field}} · {{item.level}}</text><text class="native-body">证书编号：{{item.certNo}}</text><text class="native-meta">申请时间：{{item.applyAt}}</text><text v-if="item.auditAt" class="native-meta">审核时间：{{item.auditAt}}</text><text v-if="item.auditNote" class="native-body">审核意见：{{item.auditNote}}</text></view><view v-if="!items.length" class="native-state">暂无认证申请</view><button class="btn btn-primary" @tap="apply">申请专家认证</button></template></view></template>

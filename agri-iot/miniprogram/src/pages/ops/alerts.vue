<script setup lang="ts">
import {ref} from 'vue'
import {onLoad,onShow,onPullDownRefresh,onReachBottom} from '@dcloudio/uni-app'
import OpsBusiness from '../../components/OpsBusiness.vue'
const business=ref<InstanceType<typeof OpsBusiness>|null>(null), filter=ref('all')
const kind='alerts'
onLoad(o=>{filter.value=o?.filter==='todo'?'todo':'all'})
onShow(()=>business.value?.reload())
onPullDownRefresh(()=>{if(business.value)void business.value.reload();else uni.stopPullDownRefresh()})
onReachBottom(()=>business.value?.more())
</script>
<template><OpsBusiness v-if="kind" ref="business" :kind="kind" :initial-filter="filter"/></template>

<script setup lang="ts">
import {onShow} from '@dcloudio/uni-app'
import {requireTradeLogin,requireTradeRole} from '../../auth'
onShow(()=>{if(requireTradeRole('buyer')&&requireTradeLogin())uni.redirectTo({url:'/pages/buyer/demand'})})
</script>
<template><view class="page pad">正在打开采购需求管理…</view></template>

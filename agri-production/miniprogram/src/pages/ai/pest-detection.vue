<template><view class="page"><view class="card"><view class="card-title">完整业务服务</view><text class="muted">进入与电脑端一致的业务流程，数据按当前账号与经营主体保存。</text><button class="btn-primary" @tap="open">进入业务</button></view></view></template>
<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { openWorkspace } from '@/utils/workspace'
function open():void { openWorkspace('/production/ai/pest-detection') }
onLoad(open)
</script>
<style scoped>.btn-primary{margin-top:24rpx}</style>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { canOperate, canUseUser, currentWorkspace, identitySessionReady, switchWorkspace, type Workspace } from '../api/iot'
import { confirmAction, showError } from '../utils/ui'
const mode=ref<Workspace>('user'),user=ref(false),ops=ref(false),busy=ref(false)
onShow(async()=>{try{await identitySessionReady();mode.value=currentWorkspace();user.value=canUseUser();ops.value=canOperate()}catch{user.value=false;ops.value=false}})
async function change(next:Workspace){if(busy.value||mode.value===next)return;busy.value=true;try{if(await confirmAction('切换工作台','将返回所选工作台首页，未保存内容不会保留。'))await switchWorkspace(next)}catch(e){showError(e)}finally{busy.value=false}}
</script>
<template><view class="workspace card"><view class="workspace-head"><text class="strong">{{mode==='ops'?'运营工作台':'用户工作台'}}</text><text class="muted">{{mode==='ops'?'全平台运营范围':'当前经营主体'}}</text></view><view v-if="user&&ops" class="workspace-actions"><button role="button" tabindex="0" aria-label="切换到用户工作台" @keydown.enter="change('user')" class="btn" :class="{'btn-primary':mode==='user'}" :disabled="busy" @tap="change('user')">用户工作台</button><button role="button" tabindex="0" aria-label="切换到运营工作台" @keydown.enter="change('ops')" class="btn" :class="{'btn-primary':mode==='ops'}" :disabled="busy" @tap="change('ops')">运营工作台</button></view></view></template>
<style scoped>.workspace-head{display:flex;align-items:center;justify-content:space-between;gap:16rpx}.workspace-actions{display:flex;gap:16rpx;margin-top:20rpx}.workspace-actions .btn{flex:1;min-height:88rpx;font-size:26rpx}</style>

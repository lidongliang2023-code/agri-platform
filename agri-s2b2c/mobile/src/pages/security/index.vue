<template><view class="native-page"><text class="title">个人资料</text><view v-if="error" class="panel error"><text>{{error}}</text><button :disabled="loading" @tap="reload">重新加载</button></view><view v-if="loading" class="sub">正在同步…</view><template v-if="!loading"><view class="panel"><text>昵称</text><input v-model="nickname" maxlength="30" placeholder="请输入昵称"/><button class="primary" :disabled="busy || !nickname.trim()" @tap="save">保存昵称</button></view><view class="panel"><text>统一账号安全</text><text class="sub">商城沿用统一账号登录。密码和手机号由统一账号中心管理；当前移动端未提供对应变更接口，请联系平台管理员核验处理。</text></view></template></view></template>
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { request, mallApi } from '../../api'
import { session, saveSession } from '../../session'
import { useNativePage, go, confirmAction } from '../../useNativePage'
import { money } from '../../utils'
const nickname=ref('')
const {loading,error,busy,reload,act}=useNativePage(async()=>{const p=await mallApi.getProfile();saveSession(p);nickname.value=p.nickname || ''})
function save(){return act(()=>request('/consumer/update','PUT',{id:session.user!.id,nickname:nickname.value.trim(),phone:session.user!.phone}))}
</script><style src="../../native-page.scss" lang="scss"></style>
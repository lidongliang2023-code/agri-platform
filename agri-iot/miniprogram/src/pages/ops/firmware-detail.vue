<script setup lang="ts">
import {ref} from 'vue'
import {onLoad,onShow} from '@dcloudio/uni-app'
import {opsApi,opsLabel} from '../../api/ops'
import {type Row} from '../../api/iot'
import {showError,confirmAction} from '../../utils/ui'
const id=ref(0),item=ref<Row|null>(null),error=ref(''),busy=ref(false),reason=ref(''),loading=ref(false)
onLoad(o=>{id.value=Number(o?.id)})
onShow(load)
async function load(){if(loading.value)return;loading.value=true;try{if(!Number.isSafeInteger(id.value)||id.value<1)throw new Error('固件编号无效');item.value=await opsApi.firmware(id.value);error.value=''}catch(e){item.value=null;error.value=e instanceof Error?e.message:'固件加载失败'}finally{loading.value=false}}
const fields=[['versionName','版本号'],['firmwareType','类型'],['targetModel','适用型号'],['fileSizeBytes','大小（字节）'],['sha256Text','SHA-256'],['packageUrl','下载地址'],['releaseNotes','发布说明'],['changelogText','变更记录'],['publishedAt','发布时间'],['deprecateReason','废弃原因']]
async function change(publish:boolean){if(busy.value||!item.value)return;busy.value=true;try{
 if(publish&&item.value.status!=='draft')throw new Error('仅草稿固件可以发布');if(!publish&&reason.value.trim().length<4)throw new Error('请填写至少4字的废弃原因')
 if(!await confirmAction(publish?'发布固件':'废弃固件',publish?`发布 ${item.value.firmwareName} ${item.value.versionName} 后可被升级任务选用。`:`废弃后不能重新发布。原因：${reason.value.trim()}`))return
 if(publish)await opsApi.publishFirmware(id.value);else await opsApi.deprecateFirmware(id.value,reason.value.trim())
 uni.showToast({title:publish?'固件已发布':'固件已废弃'});await load()
}catch(e){showError(e)}finally{busy.value=false}}
</script>
<template><view class="page pad"><view v-if="error" class="error" @tap="load">{{error}} · 点击重试</view><view v-if="loading" class="loading">正在读取固件…</view><template v-if="item"><view class="card"><view class="item-head"><text class="card-title">{{item.firmwareName}}</text><text class="tag green">{{opsLabel(item.status)}}</text></view><view v-for="field in fields" :key="field[0]" class="detail-field"><text class="muted">{{field[1]}}</text><text selectable class="block">{{field[0]==='firmwareType'?opsLabel(item[field[0]]):item[field[0]]||'—'}}</text></view></view><view v-if="item.status!=='deprecated'" class="card"><button v-if="item.status==='draft'" class="btn btn-primary" :disabled="busy" :loading="busy" @tap="change(true)">发布为稳定版</button><text class="form-label block">废弃原因</text><textarea v-model="reason" class="textarea" :disabled="busy" maxlength="300" placeholder="请填写实际下线原因，4～300字"/><button class="btn btn-danger block" :disabled="busy" @tap="change(false)">废弃固件</button></view></template></view></template>
<style scoped>.detail-field{padding:20rpx 0;border-bottom:1rpx solid #edf2ee;word-break:break-all}.detail-field:last-child{border:0}</style>

<script setup lang="ts">
import {ref} from 'vue'
import {onLoad} from '@dcloudio/uni-app'
import {opsApi} from '../../api/ops'
import {type Row} from '../../api/iot'
import {showError,confirmAction} from '../../utils/ui'
const id=ref(0),task=ref<Row|null>(null),firmware=ref<Row|null>(null),gateways=ref<Row[]>([]),ids=ref<number[]>([]),error=ref(''),loading=ref(false),saving=ref(false),submitted=ref(false)
onLoad(o=>{id.value=Number(o?.id);void load()})
async function load(){if(loading.value)return;loading.value=true;task.value=null;firmware.value=null;gateways.value=[];ids.value=[];try{
 if(!Number.isSafeInteger(id.value)||id.value<1)throw new Error('升级任务编号无效')
 const tasks=await opsApi.list('/ota');const current=tasks.find(t=>Number(t.id)===id.value);if(!current)throw new Error('升级任务不存在');if(current.status!=='scheduled')throw new Error('该任务已不在待执行状态，请返回列表查看进度')
 const [fw,gs]=await Promise.all([opsApi.firmware(current.firmwareId),opsApi.list('/gateways')]);if(fw.versionName!==current.firmwareVersion||fw.status!=='stable'||fw.firmwareType!=='gateway'||!fw.packageUrl||!fw.fileSizeBytes||!/^[a-fA-F0-9]{64}$/.test(fw.sha256Text))throw new Error('任务固件未发布、不是网关固件或资料不完整')
 task.value=current;firmware.value=fw;gateways.value=gs.filter(g=>(fw.targetModel==='ALL'||fw.targetModel===g.model)&&(!current.tenantId||!g.tenantId||String(current.tenantId)===String(g.tenantId)));error.value=''
 }catch(e){error.value=e instanceof Error?e.message:'升级资料加载失败'}finally{loading.value=false}}
function select(e:any){if(!saving.value)ids.value=e.detail.value.map(Number)}
async function execute(){if(saving.value||submitted.value||!task.value||!firmware.value)return;saving.value=true;try{
 if(!ids.value.length||ids.value.length>200||new Set(ids.value).size!==ids.value.length||ids.value.some(id=>!Number.isSafeInteger(id)||id<1||!gateways.value.some(g=>Number(g.id)===id)))throw new Error('请选择1～200个有效且不重复的目标网关')
 if(!await confirmAction('确认执行升级',`任务 ${task.value.taskNo}，固件 ${firmware.value.versionName}，共 ${ids.value.length} 台网关。确认后即可领取，可能中断连接，结果须查看网关回执。`))return
 await opsApi.executeOta(id.value,ids.value,firmware.value.packageUrl);submitted.value=true;uni.showModal({title:'升级申请已提交',content:'等待网关领取和真实执行回执。可从下方逐台查看，不要重复发起。',showCancel:false})
 }catch(e){showError(e)}finally{saving.value=false}}
function receipts(g:Row){uni.navigateTo({url:`/pages/ops/receipts?id=${g.id}&kind=ota`})}
</script>
<template><view class="page pad has-footer"><view v-if="error" class="error" @tap="load">{{error}} · 点击重试</view><view v-if="loading" class="loading">正在核对任务与固件…</view><template v-if="task&&firmware"><view class="card"><text class="card-title">{{task.taskNo}}</text><text class="block">{{firmware.firmwareName}} · {{firmware.versionName}}</text><text class="muted block">适配型号 {{firmware.targetModel}} · {{task.tenantName||'任务所属主体由服务端核验'}}</text><text class="tiny block hash">SHA-256：{{firmware.sha256Text}}</text><text class="notice block">执行窗口仅供参考，确认后可立即领取。仅选择与任务主体一致的网关，服务端会复核范围和型号。</text></view><view class="card"><text class="card-title">{{submitted?'已提交目标':'选择目标网关'}}</text><checkbox-group @change="select"><label v-for="g in gateways" :key="g.id" class="field"><view><text>{{g.gatewayName}}</text><text class="muted block">{{g.farmName}} · {{g.model}}</text></view><checkbox :value="String(g.id)" :checked="ids.includes(Number(g.id))" :disabled="saving||submitted" color="#12764a"/></label></checkbox-group><text v-if="!gateways.length" class="empty">没有符合型号的网关</text></view><template v-if="submitted"><button v-for="g in gateways.filter(g=>ids.includes(Number(g.id)))" :key="g.id" class="btn block" @tap="receipts(g)">{{g.gatewayName}} · 升级回执</button></template><view v-else class="footer-bar"><button class="btn btn-primary" :disabled="saving||!ids.length" :loading="saving" @tap="execute">提交升级申请（{{ids.length}} 台）</button></view></template></view></template>
<style scoped>.hash{word-break:break-all}</style>

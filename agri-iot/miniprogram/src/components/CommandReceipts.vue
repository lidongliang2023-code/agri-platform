<script setup lang="ts">
import {ref,watch,onUnmounted} from 'vue'
import {onShow,onHide} from '@dcloudio/uni-app'
import type {Row} from '../api/iot'
const props=defineProps<{id:number;load:(id:number,page:number)=>Promise<Row[]>}>()
const rows=ref<Row[]>([]),page=ref(1),busy=ref(false),error=ref('')
const labels:Record<string,string>={PENDING:'待接入端领取',SENT:'已领取待回执',RUNNING:'升级执行中',SUCCEEDED:'接入端报告成功',FAILED:'接入端报告失败',TIMEOUT:'超时结果未知',EXPIRED:'未领取已过期',LEGACY:'历史未采集回执'}
let timer:ReturnType<typeof setInterval>|undefined,revision=0
function tone(status:string){return status==='SUCCEEDED'?'green':status==='FAILED'||status==='TIMEOUT'?'red':status==='EXPIRED'||status==='LEGACY'?'gray':'blue'}
async function refresh(){if(busy.value)return;const op=++revision;busy.value=true;try{const result=await props.load(props.id,page.value);if(op===revision){rows.value=result;error.value=''}}catch(e){if(op===revision)error.value=e instanceof Error?e.message:'回执读取失败'}finally{if(op===revision)busy.value=false}}
function stop(){clearInterval(timer);revision++;busy.value=false}
function start(){stop();void refresh();timer=setInterval(()=>void refresh(),10000)}
watch(()=>[props.id,props.load],()=>{stop();rows.value=[];error.value='';page.value=1;start()},{immediate:true});watch(page,()=>{rows.value=[];void refresh()});onShow(start);onHide(stop);onUnmounted(stop)
</script>
<template><view class="card"><view class="card-head"><text class="card-title">指令与回执</text><button class="btn btn-sm" :disabled="busy" @tap="refresh">刷新</button></view><text class="muted block">申请登记后等待接入端回执；超时须人工核实，不自动重发。</text><view v-if="error" class="error">{{error}}</view><view v-for="(row,index) in rows" :key="row.commandNo||index" class="receipt"><view class="item-head"><text class="strong">{{row.action}}</text><text class="tag" :class="tone(row.status)">{{labels[row.status]||row.status}}</text></view><text class="tiny">{{row.commandNo||'历史记录'}}</text><text class="tiny">{{row.operator}} · {{row.createdAt}}</text><text class="muted">{{row.result||'等待回执'}}</text><text v-if="row.progress!==undefined" class="tiny">{{row.progress}}% · {{row.installedVersion||'未报告安装版本'}}</text><text class="tiny">领取 {{row.sentAt||'—'}} · 回执 {{row.receiptAt||'—'}}</text></view><view v-if="!rows.length&&!busy&&!error" class="empty receipts-empty">暂无指令记录</view><view v-if="page>1||rows.length>=20" class="pager"><button class="btn btn-sm" :disabled="busy||page===1" @tap="page--">上一页</button><text class="muted">第 {{page}} 页</text><button class="btn btn-sm" :disabled="busy||rows.length<20" @tap="page++">下一页</button></view></view></template>
<style scoped>.receipt{display:flex;flex-direction:column;gap:8rpx;padding:22rpx 0;border-bottom:1px solid #edf2ee;overflow-wrap:anywhere}.receipt:last-of-type{border-bottom:0}.receipts-empty{min-height:160rpx}.pager{display:flex;align-items:center;justify-content:space-between;margin-top:16rpx}</style>

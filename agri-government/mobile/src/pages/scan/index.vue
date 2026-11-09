<script setup lang="ts">
import AuthorizationNotice from '../../components/AuthorizationNotice.vue'
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api } from '../../api'
const code=ref(''),result=ref<Awaited<ReturnType<typeof api.scan>>|null>(null),loading=ref(false),statusBarHeight=ref(Number(uni.getSystemInfoSync().statusBarHeight||0))
const history=ref<Array<{code:string;label:string;time:string}>>([])
const HISTORY_KEY='gov-scan-history'
onLoad(()=>{const raw=uni.getStorageSync(HISTORY_KEY);if(Array.isArray(raw))history.value=raw.slice(0,5)})
async function verify(){if(!code.value.trim())return;loading.value=true
  try{
    const value=code.value.trim()
    result.value=await api.scan(value)
    const label=result.value.type==='trace'
      ?String(result.value.productName||'溯源链路')
      :String(result.value.subject?.subjectName||'主体档案')
    remember(value,label)
  }catch(e){uni.showToast({title:e instanceof Error?e.message:'核验失败',icon:'none'})}finally{loading.value=false}}
/** 核验记录存在本机，服务端不保存扫码流水；标清楚来源避免被当成执法留痕。 */
function remember(value:string,label:string){
  const time=new Date().toLocaleString('zh-CN',{hour12:false})
  history.value=[{code:value,label,time},...history.value.filter(h=>h.code!==value)].slice(0,5)
  uni.setStorageSync(HISTORY_KEY,history.value)
}
function use(item:{code:string}){code.value=item.code;verify()}
type ScanEvent=NonNullable<Awaited<ReturnType<typeof api.scan>>['events']>[number]
/** 副信息行：生产域链路节点没有"地点"这一列，空值必须跳过，否则会打出 "undefined · 2026-06-01"。 */
function eventMeta(event:ScanEvent){return [event.location,event.eventTime,event.operatorName].filter(Boolean).join(' · ')}
/** 存证状态：只说事实——有没有存证记录、状态是什么、有没有交易哈希，不含"核验通过"这种结论词。 */
function chainLabel(event:ScanEvent){
  if(!event.attested)return '未上链（生产域没有这条节点的存证记录）'
  if(event.chainStatus==='SUCCESS')return `已上链 ${event.recordNo||''}${event.chainTime?' · '+event.chainTime:''}`
  if(event.chainStatus==='PENDING')return '存证中（尚未出块，暂不能作为链上凭据）'
  return `存证失败${event.failedReason?'：'+event.failedReason:''}`
}
function clearHistory(){history.value=[];uni.removeStorageSync(HISTORY_KEY);uni.showToast({title:'本机核验记录已清空',icon:'success'})}
function scanByCamera(){uni.scanCode({onlyFromCamera:true,success:r=>{code.value=r.result;verify()},fail:()=>uni.showToast({title:'摄像头扫码取消，可手动输入代码',icon:'none'})})}
</script>
<template><view class="page scan-page"><AuthorizationNotice duty="" context="scan"/><view class="custom-nav" :style="{paddingTop:`${statusBarHeight}px`}"><text class="title">扫码核验</text><text class="right">溯源码 / 统一社会信用代码</text></view><view class="scan-hero"><view class="scan-frame" @click="scanByCamera"><text class="scan-icon">⌕</text><text>对准溯源码 / 主体信用代码</text></view><view class="scan-input"><input v-model="code" placeholder="输入溯源码或信用代码"/><button class="btn btn-sm btn-primary" :loading="loading" @click="verify">核验</button></view></view><view class="pad"><view v-if="result" class="card result"><view class="between"><text class="tag" :class="result.verified?'green':'orange'">{{result.verified?'✓ 核验通过':'! 部分节点未存证'}}</text><text class="tiny">{{result.type==='trace'?'溯源链路':'主体档案'}}</text></view><template v-if="result.type==='trace'"><text class="result-title">{{result.productName}}</text><text class="muted">溯源码 {{result.traceCode}} · 码状态 {{result.status||'未知'}} · 已上链节点 {{result.chainedNodes}}</text><text class="tiny">{{result.chainSummary}}</text><view class="event" v-for="(event,index) in (result.events||[])" :key="index"><text class="index" :class="event.onChain?'':'muted-index'">{{event.onChain?'✓':'—'}}</text><view><b>{{event.stageName}} · {{event.eventTitle}}</b><text>{{event.evidence}}</text><small>{{eventMeta(event)}}</small><text class="tiny">{{chainLabel(event)}}</text></view></view></template><template v-else><text class="result-title">{{result.subject?.subjectName}}</text><text class="muted">{{result.subject?.creditCode}}</text><view class="field"><text class="field-label">信用分</text><text class="field-value">{{result.subject?.creditScore}} · {{result.subject?.creditLevel}} 级</text></view><view class="field"><text class="field-label">风险等级</text><text class="field-value">{{result.subject?.riskLevel}}</text></view><view class="field"><text class="field-label">联系电话</text><text class="field-value">{{result.subject?.contactPhone||'未登记'}}</text></view></template></view><view class="recent"><view class="between"><text class="strong">本机核验记录</text><text class="link" @click="clearHistory">清空</text></view><view v-if="!history.length"><text class="tiny">这台设备还没有核验过代码</text></view><view v-for="item in history" :key="item.code" @click="use(item)"><text>{{item.code}}</text><text>{{item.label}} · {{item.time}}</text></view></view></view></view></template>
<style lang="scss" scoped>.scan-page{background:linear-gradient(180deg,#eef8f2 0 560rpx,#f4f7f5 560rpx)}.scan-hero{margin:12rpx 24rpx 24rpx;padding:26rpx;border-radius:24rpx;background:linear-gradient(145deg,#073821,#0d5d3b);color:#fff}.scan-frame{display:flex;height:300rpx;align-items:center;justify-content:center;flex-direction:column;gap:14rpx;border:2rpx dashed rgba(255,255,255,.35);border-radius:20rpx;color:rgba(255,255,255,.7);font-size:24rpx}.scan-icon{font-size:70rpx;font-weight:300}.scan-input{display:flex;gap:10rpx;margin-top:18rpx}.scan-input input{height:70rpx;flex:1;padding:0 18rpx;border:0;border-radius:14rpx;background:rgba(255,255,255,.95);font-size:24rpx}.scan-input .btn{min-height:68rpx}.result{display:flex;flex-direction:column;gap:9rpx}.result-title{font-size:30rpx;font-weight:700}.event{display:flex;gap:12rpx;padding:14rpx 0;border-bottom:1rpx solid #edf2ee}.event>text{display:flex;width:34rpx;height:34rpx;align-items:center;justify-content:center;border-radius:50%;background:#e5f5eb;color:#12764a}.event>.muted-index{background:#eef1ef;color:#94a198}.event>view{display:flex;flex-direction:column;gap:4rpx}.event b{font-size:24rpx}.event text{color:#718277;font-size:24rpx}.event small{color:#94a198;font-size:24rpx}.recent{display:flex;flex-direction:column;gap:10rpx}.recent>view{display:flex;justify-content:space-between;padding:16rpx;border-radius:14rpx;background:#fff;font-size:24rpx}.recent>view text:last-child{color:#718277}.link{color:#12764a;font-size:24rpx}</style>

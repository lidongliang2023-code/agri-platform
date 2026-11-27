<template>
 <view class="page review-page">
  <view class="page-intro">核对处置效果，记录原因与预防措施。复盘不会修改原告警状态。</view>
  <template v-if="!code">
   <view class="summary"><view v-for="s in metrics" :key="s.key" class="metric"><text class="strong">{{ summary[s.key] ?? '—' }}</text><text>{{s.label}}</text></view></view>
   <view class="filters"><button v-for="s in states" :key="s.value" size="mini" :class="{chosen:filter===s.value}" :disabled="loading" @click="filter=s.value;loadList()">{{s.label}}</button></view>
   <view v-for="row in rows" :key="row.alertId" class="card" @click="open(row.alertId)"><view class="row"><text class="strong">{{row.alertTitle}}</text><text class="tag">{{labels[row.reviewStatus]}}</text></view><text class="muted">{{row.alertId}} · {{row.handledAt||'—'}}</text><view v-if="row.followUpDate" class="due">跟进：{{row.followUpOwner}} · {{row.followUpDate}}</view><text class="link">查看记录与复盘 ›</text></view>
   <view v-if="!loading&&!error&&!rows.length" class="card muted">暂无符合条件的已结束告警</view>
   <button v-if="rows.length<total" :disabled="loading" @click="loadList(true)">加载更多（{{rows.length}} / {{total}}）</button>
  </template>
  <template v-else-if="detail">
   <button size="mini" :disabled="saving" @click="back">返回复盘清单</button>
   <view class="card"><text class="strong">{{detail.alert.alertTitle}}</text><view class="muted">{{code}} · {{alertStates[detail.alert.status]}}</view><view class="prose">{{detail.alert.alertContent}}</view><view class="section-title">处置记录</view><view class="prose">{{detail.alert.handleRemark||'暂无处置说明'}}</view></view>
   <view v-if="detail.eligible" class="card">
    <view class="section-title">{{history.length?'追加复核':'登记复盘'}}</view><text class="muted">当前 V{{history[0]?.revision||0}}，提交后保留历史。四项说明均必填。</text>
    <view v-for="f in fields" :key="f.key" class="field"><text>{{f.label}}</text><textarea v-model="form[f.key]" :disabled="saving" maxlength="1000" :placeholder="f.hint" auto-height /></view>
    <view class="field"><text>复盘结论</text><view class="filters"><button size="mini" :disabled="saving" :class="{chosen:form.reviewStatus==='FOLLOW_UP'}" @click="form.reviewStatus='FOLLOW_UP'">仍需跟进</button><button size="mini" :disabled="saving" :class="{chosen:form.reviewStatus==='VERIFIED'}" @click="form.reviewStatus='VERIFIED'">已验证</button></view></view>
    <template v-if="form.reviewStatus==='FOLLOW_UP'"><view class="field"><text>跟进责任人（必填）</text><input v-model="form.followUpOwner" :disabled="saving" maxlength="100" placeholder="填写已协商的责任人" /></view><view class="field"><text>跟进日期（必填）</text><picker mode="date" :start="today()" :value="form.followUpDate" :disabled="saving" @change="form.followUpDate=$event.detail.value"><view class="date-picker">{{form.followUpDate||'选择日期'}} ›</view></picker></view><text class="muted">仅记录跟进约定，不会自动派发农事任务或发送通知。</text></template>
    <view v-if="saveError" class="error">{{saveError}}</view>
    <button class="btn-primary submit" :loading="saving" :disabled="saving||loading" @click="submit">保存复盘并回读</button>
   </view><view v-else class="card muted">请先完成告警处置或忽略，再登记复盘。</view>
   <view class="section-title">历史版本（{{history.length}}）</view>
   <view v-for="h in history" :key="h.revision" class="card"><view class="row"><text class="strong">V{{h.revision}} · {{labels[h.reviewStatus]}}</text><text>{{h.reviewedAt}}</text></view><view class="muted">复盘人 ID：{{h.reviewerId}}</view><view v-for="f in fields" :key="f.key" class="history-field"><text class="strong">{{f.label}}</text><view class="prose">{{h[f.key]}}</view></view><view v-if="h.followUpDate">跟进：{{h.followUpOwner}} · {{h.followUpDate}}</view></view>
  </template>
  <view v-if="loading" class="muted">正在加载…</view><view v-if="error" class="error">{{error}}<button :disabled="saving" size="mini" @click="reload">重新加载</button></view>
 </view>
</template>
<script setup lang="ts">
import {ref,computed} from 'vue'
import {onLoad,onShow,onHide,onUnload,onBackPress} from '@dcloudio/uni-app'
import {request,productionContextVersion} from '@/utils/request'
import {ensureWorkspaceSession,isProductionOps} from '@/utils/workspace'
import {resolveCurrentFarm} from '@/utils/auth-helper'
import {today} from '@/utils/format'
const code=ref(''),filter=ref('ALL'),rows=ref<any[]>([]),total=ref(0),summary=ref<any>({}),detail=ref<any>(),form=ref<any>({}),loading=ref(false),saving=ref(false),error=ref(''),saveError=ref('')
let page=1,seq=0,scope=-1,farm='',requestId='',expected=0
const history=computed<any[]>(()=>detail.value?.history||[])
const labels:Record<string,string>={PENDING:'待复盘',FOLLOW_UP:'仍需跟进',VERIFIED:'已验证'}
const alertStates:Record<number,string>={1:'未处理',2:'处理中',3:'已处理',4:'已忽略'}
const states=[{value:'ALL',label:'全部'},{value:'PENDING',label:'待复盘'},{value:'FOLLOW_UP',label:'待跟进'},{value:'OVERDUE',label:'逾期跟进'},{value:'VERIFIED',label:'已验证'}]
const metrics=[{key:'pending',label:'待复盘'},{key:'followUp',label:'待跟进'},{key:'overdue',label:'逾期'},{key:'verified',label:'已验证'}]
const fields=[{key:'rootCause',label:'原因分析',hint:'实际原因；误报请记录核实结果'},{key:'effectiveness',label:'处置效果',hint:'措施实施后发生了什么变化'},{key:'prevention',label:'预防措施',hint:'下次如何预防或改进'},{key:'evidence',label:'核验依据',hint:'现场观察、检测结果或凭据编号'}]
const api='/api/v1/production/alerts/reviews'
function guard(){if(scope!==productionContextVersion()||isProductionOps())throw new Error('业务范围已变化，请重新加载')}
function fill(){const latest=history.value[0]||{};form.value={rootCause:'',effectiveness:'',prevention:'',evidence:'',reviewStatus:'FOLLOW_UP',followUpOwner:'',followUpDate:'',...latest};expected=Number(latest.revision||0);requestId='review-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);saveError.value=''}
async function loadList(more=false){const n=++seq;loading.value=true;error.value='';const next=more?page+1:1;if(!more){rows.value=[];total.value=0;summary.value={}}try{guard();const result:any=await request({url:api,params:{farmId:farm,status:filter.value,pageNum:next,pageSize:20}});guard();if(n!==seq)return;rows.value=more?[...rows.value,...result.list]:result.list;total.value=result.total;summary.value=result.summary;page=next}catch(e:any){if(n===seq)error.value=e.message}finally{if(n===seq)loading.value=false}}
async function loadDetail(){const n=++seq;loading.value=true;error.value='';detail.value=undefined;try{guard();const result=await request({url:api+'/'+encodeURIComponent(code.value)});guard();if(n!==seq)return;detail.value=result;fill()}catch(e:any){if(n===seq)error.value=e.message}finally{if(n===seq)loading.value=false}}
async function reload(){if(saving.value)return;if(!await ensureWorkspaceSession())return;seq++;if(isProductionOps()){detail.value=undefined;rows.value=[];error.value='请切换到用户端查看复盘';return}try{const f=await resolveCurrentFarm();if(!f)throw new Error('请先选择农场');const next=productionContextVersion();if(scope!==-1&&scope!==next){code.value='';detail.value=undefined;rows.value=[]}scope=next;farm=String(f.farmId);await(code.value?loadDetail():loadList())}catch(e:any){error.value=e.message}}
function open(id:string){code.value=id;void loadDetail()}
function back(){code.value='';detail.value=undefined;void loadList()}
async function submit(){if(saving.value||loading.value)return;saveError.value='';try{guard();for(const f of fields)if(!String(form.value[f.key]||'').trim())throw new Error('请填写'+f.label);if(form.value.reviewStatus==='FOLLOW_UP'&&(!String(form.value.followUpOwner||'').trim()||!form.value.followUpDate||form.value.followUpDate<today()))throw new Error('请填写跟进人并选择不早于今天的日期');saving.value=true;const yes=await new Promise<boolean>(r=>uni.showModal({title:'确认保存复盘',content:'本次结论将追加为新版本，历史记录保留。',success:x=>r(x.confirm),fail:()=>r(false)}));if(!yes)return;guard();await request({url:api+'/'+encodeURIComponent(code.value),method:'POST',data:{...form.value,expectedRevision:expected,requestId}});guard();const result:any=await request({url:api+'/'+encodeURIComponent(code.value)});guard();if(!result.history?.some((h:any)=>h.requestId===requestId))throw new Error('已提交但回读未核实，请重新加载，勿重复提交');detail.value=result;fill();uni.showToast({title:'复盘已保存',icon:'success'})}catch(e:any){saveError.value=e.message}finally{saving.value=false}}
onLoad(o=>{code.value=String(o?.alertId||'')});onShow(()=>void reload());onHide(()=>{seq++;scope=-1});onUnload(()=>{seq++;scope=-1});onBackPress(()=>saving.value)
</script>
<style scoped>
.review-page{padding-bottom:60rpx}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12rpx;margin:20rpx 0}.metric{display:flex;flex-direction:column;align-items:center;background:#fff;padding:22rpx 4rpx;border-radius:16rpx;font-size:24rpx}.metric .strong{font-size:36rpx}.filters{display:flex;flex-wrap:wrap;gap:12rpx;margin:20rpx 0}.filters button{margin:0}.chosen{background:#126d43;color:white}.field{margin:28rpx 0}.field>text,.section-title{display:block;font-weight:600;margin-bottom:14rpx}.field textarea{width:100%;min-height:110rpx;box-sizing:border-box;padding:18rpx;background:#f5f6fa;border-radius:12rpx}.field input,.date-picker{background:#f5f6fa;padding:22rpx;border-radius:12rpx}.prose{white-space:pre-wrap;word-break:break-word;line-height:1.65;margin:12rpx 0}.history-field{margin-top:24rpx}.due{color:#986013;margin:12rpx 0}.link{display:block;color:#126d43;margin-top:20rpx}.submit{margin-top:28rpx}.error{white-space:pre-wrap}.row{flex-wrap:wrap;gap:12rpx}
</style>

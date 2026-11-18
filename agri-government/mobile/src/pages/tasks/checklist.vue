<script setup lang="ts">
import { useGovPage } from '../../useGovPage'
useGovPage()
import AuthorizationNotice from '../../components/AuthorizationNotice.vue'
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api } from '../../api'
const task=ref<Awaited<ReturnType<typeof api.task>>|null>(null)
const id=ref(0),result=ref(''),submitting=ref(false),loading=ref(false),error=ref(''),saved=ref(false)
const doneCount=computed(()=>task.value?.checklist.filter(i=>i.done).length??0)
const completed=computed(()=>saved.value||task.value?.status==='completed')
onLoad(o=>{id.value=Number(o?.id||0);load()})
async function load(){
  if(!id.value){error.value='缺少任务编号，请从任务列表进入';return}
  loading.value=true;error.value=''
  try{task.value=await api.task(id.value);result.value=task.value.result||''}catch(e){error.value=e instanceof Error?e.message:'加载失败'}finally{loading.value=false}
}
async function start(){
  if(submitting.value)return
  submitting.value=true
  try{task.value=await api.startTask(id.value)}catch(e){uni.showToast({title:e instanceof Error?e.message:'开始检查失败',icon:'none'})}finally{submitting.value=false}
}
function changeChecks(event:{detail:{value:string[]}}){if(!task.value||completed.value||submitting.value)return;const selected=new Set(event.detail.value);task.value.checklist.forEach(item=>{item.done=selected.has(String(item.id))})}
async function submit(){
  if(!task.value||submitting.value||completed.value)return
  if(!task.value.checklist.length||doneCount.value!==task.value.checklist.length)return uni.showToast({title:'请逐项完成核验，发现的问题填写在备注中',icon:'none'})
  if(!result.value.trim())return uni.showToast({title:'请填写检查结论',icon:'none'})
  uni.showModal({title:'提交检查结果',content:'提交后任务将完成，逐项记录和检查结论不能再次修改。确认提交？',success:async r=>{
    if(!r.confirm||submitting.value)return
    submitting.value=true
    try{await api.submitTask(id.value,{checks:task.value!.checklist.map(i=>({itemId:i.itemId,itemName:i.itemName,done:i.done,note:i.note||''})),result:result.value.trim()});saved.value=true;uni.showToast({title:'检查结果已入库',icon:'success'});uni.navigateBack({fail:()=>uni.redirectTo({url:`/pages/tasks/detail?id=${id.value}`})})}
    catch(e){uni.showToast({title:e instanceof Error?e.message:'提交失败',icon:'none'})}finally{submitting.value=false}
  }})
}
</script>
<template>
 <view class="page pad action-page">
  <view v-if="loading" class="loading">正在加载检查清单…</view>
  <view v-else-if="error" class="state-panel"><text>{{error}}</text><button class="btn" @tap="load">重新加载</button></view>
  <template v-else-if="task">
   <view class="page-heading"><text class="page-title">现场检查</text><text class="muted">{{task.subjectName}}</text><text class="tiny">{{task.taskNo}}</text></view>
   <AuthorizationNotice duty="inspection" context="tasks"/>
   <view class="notice">勾选表示已完成核验，不代表检查合格。发现的问题请记录在单项备注和检查结论中。</view>
   <view v-if="!task.checklist.length" class="state-panel"><text>该任务尚未生成检查清单</text><button v-if="!completed" class="btn btn-primary" :disabled="submitting" :loading="submitting" @tap="start">开始检查并生成清单</button></view>
   <checkbox-group @change="changeChecks"><view v-for="(item,index) in task.checklist" :key="item.id" class="card check-card">
    <label class="check-toggle"><checkbox :value="String(item.id)" :checked="item.done" :disabled="completed||submitting" color="#12764a" /><text class="check-title">{{index+1}}. {{item.itemName}}</text><text class="tiny">{{item.done?'已核验':'待核验'}}</text></label>
    <textarea :adjust-position="true" :cursor-spacing="120" class="textarea" v-model="item.note" :disabled="completed||submitting" :maxlength="300" auto-height placeholder="记录核验情况、发现的问题或不适用的原因"/>
   </view></checkbox-group>
   <view class="card"><text class="form-label">检查结论 <text class="required">*</text></text><textarea :adjust-position="true" :cursor-spacing="120" class="textarea conclusion" v-model="result" :disabled="completed||submitting" :maxlength="1000" placeholder="填写事实认定、发现的问题和处理意见"/><text class="tiny">{{result.length}} / 1000</text></view>
   <view class="bottom-action"><view><text class="strong">已核验 {{doneCount}} / {{task.checklist.length}}</text><text class="tiny">{{completed?'已归档，只读查看':'全部核验后可提交'}}</text></view><button class="btn btn-primary" :loading="submitting" :disabled="submitting||completed||!task.checklist.length||doneCount!==task.checklist.length" @tap="submit">{{completed?'已完成':'提交结果'}}</button></view>
  </template>
 </view>
</template>
<style scoped>
.check-toggle{display:flex;align-items:center;gap:16rpx;width:100%;min-height:88rpx;text-align:left;margin-bottom:16rpx}.check-title{flex:1;min-width:0;font-weight:650;font-size:29rpx}.check-box{display:flex;width:44rpx;height:44rpx;flex-shrink:0;align-items:center;justify-content:center;border:2rpx solid #93ab9e;border-radius:10rpx;color:#fff}.check-box.on{background:#12764a;border-color:#12764a}.check-card .textarea{min-height:96rpx}.conclusion{height:240rpx}.required{color:#b63829}
</style>

<script setup lang="ts">
import { useGovPage } from '../../useGovPage'
useGovPage()
import AuthorizationNotice from '../../components/AuthorizationNotice.vue'
import { ref } from 'vue'
import { onLoad,onShow } from '@dcloudio/uni-app'
import { api,statusMeta } from '../../api'
const task=ref<Awaited<ReturnType<typeof api.task>>|null>(null),id=ref(0),loading=ref(false),error=ref(''),starting=ref(false)
onLoad(o=>{id.value=Number(o?.id||0)})
onShow(load)
async function load(){if(!id.value){error.value='缺少任务编号，请从任务列表进入';return}loading.value=true;error.value='';try{task.value=await api.task(id.value)}catch(e){error.value=e instanceof Error?e.message:'加载失败'}finally{loading.value=false}}
async function checklist(){if(!task.value||starting.value)return;starting.value=true;try{if(task.value.status!=='completed')task.value=await api.startTask(id.value);uni.navigateTo({url:`/pages/tasks/checklist?id=${id.value}`})}catch(e){uni.showToast({title:e instanceof Error?e.message:'开始检查失败',icon:'none'})}finally{starting.value=false}}
function evidence(){uni.navigateTo({url:`/pages/evidence/index?taskNo=${encodeURIComponent(task.value?.taskNo||'')}`})}
function createCase(){uni.navigateTo({url:`/pages/cases/create?taskId=${id.value}`})}
function copyAddress(){if(!task.value?.address)return uni.showToast({title:'该任务未登记检查地点',icon:'none'});uni.setClipboardData({data:task.value.address})}
function contact(){const phone=task.value?.subject?.contactPhone;if(!phone)return uni.showToast({title:'监管主体未登记联系电话',icon:'none'});uni.makePhoneCall({phoneNumber:phone,fail:()=>uni.showModal({title:'联系电话',content:phone,showCancel:false})})}
</script>
<template>
 <view class="page pad action-page">
  <view v-if="loading" class="loading">正在加载任务…</view><view v-else-if="error" class="state-panel"><text>{{error}}</text><button class="btn" @tap="load">重新加载</button></view>
  <template v-else-if="task">
   <view class="card task-heading"><view class="between"><text class="tag" :class="statusMeta(task.status).tone">{{statusMeta(task.status).label}}</text><text class="tag orange" v-if="task.priority==='high'">优先处理</text></view><text class="page-title">{{task.subjectName}}</text><text class="muted">{{task.taskType}}</text><text class="tiny">{{task.taskNo}}</text></view>
   <AuthorizationNotice duty="inspection" context="tasks"/>
   <view class="card"><view class="field"><text class="field-label">截止时间</text><text class="field-value">{{task.deadline||'未设置'}}</text></view><view class="field"><text class="field-label">检查地点</text><text class="field-value">{{task.address||'未登记'}}</text></view><view class="field"><text class="field-label">承办人</text><text class="field-value">{{task.assignedTo}}</text></view></view>
   <view class="card"><view class="card-head"><text class="card-title">检查进度</text><text class="tag green">{{task.checklist.filter(i=>i.done).length}} / {{task.checklist.length}}</text></view><view v-for="item in task.checklist" :key="item.id" class="check-row"><text :class="{done:item.done}">{{item.done?'✓':'○'}}</text><view><text class="strong">{{item.itemName}}</text><text class="muted">{{item.note||'暂无记录'}}</text></view></view><text v-if="!task.checklist.length" class="muted">开始检查后生成清单</text></view>
   <view v-if="task.result" class="card"><text class="card-title">检查结论</text><text class="result-text">{{task.result}}</text></view>
   <view class="action-grid"><button class="btn" @tap="evidence">登记取证说明</button><button class="btn" @tap="createCase">关联任务立案</button><button class="btn" @tap="copyAddress">复制检查地点</button><button class="btn" @tap="contact">联系主体</button></view>
   <view class="bottom-action"><text class="muted">{{task.status==='completed'?'检查记录已归档':'逐项核验并记录现场情况'}}</text><button class="btn btn-primary" :loading="starting" :disabled="starting" @tap="checklist">{{task.status==='completed'?'查看检查表':task.status==='in_progress'?'继续检查':'开始检查'}}</button></view>
  </template>
 </view>
</template>
<style scoped>
.task-heading{border-left:8rpx solid #12764a}.task-heading>.muted,.task-heading>.tiny{display:block;margin-top:8rpx}.task-heading .page-title{margin-top:20rpx}.check-row{display:flex;gap:18rpx;padding:22rpx 0;border-bottom:1rpx solid #edf2ee}.check-row>view{flex:1;min-width:0;display:flex;flex-direction:column;gap:8rpx}.check-row>text{color:#82998a}.check-row>text.done{color:#12764a}.action-grid{display:flex;flex-wrap:wrap;gap:16rpx}.result-text{display:block;margin-top:16rpx;white-space:pre-wrap;line-height:1.7}
.action-grid>.btn{width:calc(50% - 8rpx)}
</style>

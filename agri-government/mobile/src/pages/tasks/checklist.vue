<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api } from '../../api'
const task=ref<Awaited<ReturnType<typeof api.task>>|null>(null)
const id=ref(0),result=ref(''),submitting=ref(false)
const doneCount=computed(()=>task.value?.checklist.filter(i=>i.done).length??0)
onLoad(async o=>{
  id.value=Number(o?.id||0)
  if(!id.value){uni.showToast({title:'缺少任务编号，请从任务列表进入',icon:'none'});setTimeout(()=>uni.switchTab({url:'/pages/tasks/index'}),600);return}
  try{task.value=await api.task(id.value)}catch(e){uni.showToast({title:e instanceof Error?e.message:'加载失败',icon:'none'})}
})
function toggle(index:number){if(task.value)task.value.checklist[index].done=!task.value.checklist[index].done}
async function submit(){
  if(!task.value)return
  if(!result.value.trim())return uni.showToast({title:'请填写检查结论',icon:'none'})
  submitting.value=true
  try{
    await api.submitTask(id.value,{
      checks:task.value.checklist.map(i=>({itemId:i.itemId,itemName:i.itemName,done:i.done,note:i.note||''})),
      result:result.value.trim(),
    })
    uni.showToast({title:`检查结果已提交（${doneCount.value}/${task.value.checklist.length} 项）`,icon:'success'})
    setTimeout(()=>uni.navigateBack(),700)
  }catch(e){uni.showToast({title:e instanceof Error?e.message:'提交失败',icon:'none'})}finally{submitting.value=false}
}
</script>
<template><view class="page pad" v-if="task"><view class="card"><view class="card-head"><text class="card-title">现场检查表</text><text class="tiny">{{task.subjectName}} · {{task.taskNo}}</text></view><view class="check" v-for="(item,index) in task.checklist" :key="item.id" @click="toggle(index)"><text class="box" :class="{on:item.done}">{{item.done?'✓':''}}</text><view><b>{{item.itemName}}</b><small>{{item.note}}</small></view></view><view class="count">已勾选 {{doneCount}}/{{task.checklist.length}} 项，未勾选项提交后会计入「未完成」并通知主体</view></view><view class="card"><text class="form-label">检查结论</text><textarea class="textarea" v-model="result" placeholder="现场发现的问题、事实认定与处理意见"/><view class="notice">提交后逐项结论、检查进度与结论写入监管档案，主体端同步收到通知。</view><button class="btn btn-primary btn-block" :loading="submitting" @click="submit">提交检查结果</button></view></view></template>
<style lang="scss" scoped>.check{display:flex;gap:13rpx;padding:16rpx 0;border-bottom:1rpx solid #edf2ee}.box{display:flex;width:40rpx;height:40rpx;flex:0 0 40rpx;align-items:center;justify-content:center;border:2rpx solid #cbd8cf;border-radius:10rpx;color:#fff}.box.on{border-color:#159a5e;background:#159a5e}.check>view{display:flex;flex-direction:column;gap:4rpx}.check b{font-size:22rpx}.check small{color:#94a198;font-size:19rpx}.count{margin-top:14rpx;color:#718277;font-size:19rpx}.notice{margin:14rpx 0;padding:14rpx;border-radius:12rpx;background:#fff3dd;color:#9b6b0d;font-size:19rpx}</style>

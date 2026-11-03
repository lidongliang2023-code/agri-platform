<script setup lang="ts">
import { reactive,ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api } from '../../api'
const form=reactive({taskId:0,subjectId:0,subjectName:'',caseType:'现场检查发现',summary:'',legalBasis:''}),submitting=ref(false)
const codeRef=ref(''),looking=ref(false),resolved=ref(false)
onLoad(o=>{
  form.taskId=Number(o?.taskId||0)
  form.subjectId=Number(o?.subjectId||0)
  form.subjectName=decodeURIComponent(String(o?.subjectName||''))
  resolved.value=Boolean(form.subjectId)
})
/** 主体不能由前端手填 ID：先用扫码/信用代码核验拿到监管主体档案，再立案。 */
async function lookup(){
  const key=codeRef.value.trim()
  if(!key)return uni.showToast({title:'请输入统一社会信用代码',icon:'none'})
  looking.value=true
  try{
    const result=await api.scan(key)
    if(result.type!=='subject'||!result.subject)throw new Error('该代码没有匹配到监管主体档案')
    form.subjectId=result.subject.id;form.subjectName=result.subject.subjectName;resolved.value=true
    uni.showToast({title:`已带出 ${form.subjectName}`,icon:'none'})
  }catch(e){form.subjectId=0;form.subjectName='';resolved.value=false;uni.showToast({title:e instanceof Error?e.message:'主体核验失败',icon:'none'})}finally{looking.value=false}
}
async function submit(){
  if(!form.subjectId)return uni.showToast({title:'请先核验监管主体',icon:'none'})
  if(!form.summary.trim())return uni.showToast({title:'请填写案情摘要',icon:'none'})
  submitting.value=true
  try{
    await api.createCase({taskId:form.taskId||undefined,subjectId:form.subjectId,subjectName:form.subjectName,
      caseType:form.caseType,summary:form.summary.trim(),legalBasis:form.legalBasis.trim()||'待匹配'})
    uni.showToast({title:'立案登记成功，主体已收到通知',icon:'success'})
    setTimeout(()=>uni.switchTab({url:'/pages/cases/index'}),700)
  }catch(e){uni.showToast({title:e instanceof Error?e.message:'立案失败',icon:'none'})}finally{submitting.value=false}
}
</script>
<template><view class="page pad"><view class="card"><view class="card-head"><text class="card-title">立案登记</text><text class="tag orange">一般程序</text></view>
  <view class="form-item"><text class="form-label">监管主体统一社会信用代码</text><view class="lookup"><input class="input" v-model="codeRef" placeholder="扫码或输入信用代码"/><button class="btn btn-sm" :loading="looking" @click="lookup">核验</button></view></view>
  <view class="subject-line"><text class="form-label">立案主体</text><text class="strong">{{ form.subjectName || '尚未核验' }}</text><text class="tag" :class="resolved?'green':'red'">{{ resolved?'档案已匹配':'未核验' }}</text></view>
  <view class="form-item"><text class="form-label">案件类型</text><input class="input" v-model="form.caseType"/></view>
  <view class="form-item"><text class="form-label">案情摘要</text><textarea class="textarea" v-model="form.summary" placeholder="记录现场发现、证据和涉嫌违法行为"/></view>
  <view class="form-item"><text class="form-label">法律依据</text><input class="input" v-model="form.legalBasis" placeholder="如《农产品质量安全法》第七十一条"/></view>
  <view class="notice">承办人默认记为当前执法人员（{{ form.taskId?`关联任务 #${form.taskId}`:'由任务详情进入可关联任务' }}）；立案后进入调查取证、裁量、处罚告知与结案归档流程。</view>
  <button class="btn btn-primary btn-block" :loading="submitting" @click="submit">提交立案登记</button></view></view></template>
<style lang="scss" scoped>.lookup{display:flex;gap:10rpx;margin-top:8rpx}.lookup .input{flex:1}.subject-line{display:flex;align-items:center;gap:12rpx;margin-bottom:18rpx;padding:16rpx;border-radius:14rpx;background:#f2fbf5}.subject-line .form-label{color:#53665a;font-size:20rpx}.subject-line .strong{flex:1;font-size:22rpx}.notice{margin-bottom:18rpx;padding:14rpx;border-radius:12rpx;background:#fff3dd;color:#9b6b0d;font-size:19rpx;line-height:1.6}</style>

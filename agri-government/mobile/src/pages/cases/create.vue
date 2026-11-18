<script setup lang="ts">
import { useGovPage } from '../../useGovPage'
useGovPage()
import AuthorizationNotice from '../../components/AuthorizationNotice.vue'
import { computed,ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api,type Task } from '../../api'
const tasks=ref<Task[]>([]),taskId=ref(0),summary=ref(''),legalBasis=ref(''),caseType=ref('现场检查发现'),loading=ref(false),error=ref(''),submitting=ref(false),saved=ref(false)
const selected=computed(()=>tasks.value.find(t=>t.id===taskId.value))
const labels=computed(()=>tasks.value.map(t=>`${t.subjectName} · ${t.taskNo}`))
const pickerIndex=computed(()=>Math.max(0,tasks.value.findIndex(t=>t.id===taskId.value)))
onLoad(o=>{taskId.value=Number(o?.taskId||0);load()})
async function load(){loading.value=true;error.value='';try{tasks.value=await api.tasks();if(taskId.value&&!selected.value)error.value='关联任务不在当前可办理范围，请重新选择'}catch(e){error.value=e instanceof Error?e.message:'任务加载失败'}finally{loading.value=false}}
function choose(e:any){taskId.value=tasks.value[Number(e.detail.value)]?.id||0;error.value=''}
async function submit(){
 if(submitting.value||saved.value)return
 if(!selected.value?.subjectId)return uni.showToast({title:'请选择关联执法任务',icon:'none'})
 if(!summary.value.trim())return uni.showToast({title:'请填写案情摘要',icon:'none'})
 if(!legalBasis.value.trim())return uni.showToast({title:'请填写法律依据',icon:'none'})
 submitting.value=true
 try{await api.createCase({taskId:selected.value.id,subjectId:selected.value.subjectId,caseType:caseType.value.trim()||'现场检查发现',summary:summary.value.trim(),legalBasis:legalBasis.value.trim()});saved.value=true;uni.showToast({title:'立案登记已入库',icon:'success'});uni.switchTab({url:'/pages/cases/index'})}catch(e){uni.showToast({title:e instanceof Error?e.message:'立案失败',icon:'none'})}finally{submitting.value=false}
}
</script>
<template><view class="page pad action-page"><view class="page-heading"><text class="page-title">立案登记</text><text class="muted">根据本人承办任务登记涉嫌违法事实</text></view><AuthorizationNotice duty="case" context="cases"/>
 <view v-if="loading" class="loading">正在加载可关联任务…</view><view v-if="error" class="state-panel"><text>{{error}}</text><button class="btn" @tap="load">重新加载</button></view>
 <view class="card"><text class="form-label">关联执法任务 *</text><picker :range="labels" :value="pickerIndex" :disabled="loading||submitting||!tasks.length" @change="choose"><view class="select-field">{{selected?`${selected.subjectName} · ${selected.taskNo}`:'请选择本人承办任务'}} <text>⌄</text></view></picker><text v-if="!loading&&!tasks.length" class="muted">暂无可关联任务，请联系监管运营分派。</text><view v-if="selected" class="field"><text class="field-label">立案主体</text><text class="field-value">{{selected.subjectName}}</text></view></view>
 <view class="card"><view class="form-item"><text class="form-label">案件类型</text><input class="input" v-model="caseType" :maxlength="80" :disabled="submitting"/></view><view class="form-item"><text class="form-label">案情摘要 *</text><textarea :adjust-position="true" :cursor-spacing="120" class="textarea" v-model="summary" :maxlength="1000" :disabled="submitting" placeholder="填写现场发现、相关证据和涉嫌违法行为"/><text class="tiny">{{summary.length}} / 1000</text></view><view class="form-item"><text class="form-label">法律依据 *</text><textarea :adjust-position="true" :cursor-spacing="120" class="textarea" v-model="legalBasis" :maxlength="800" :disabled="submitting" placeholder="填写适用法律和条款，不以自动推断替代认定"/></view><text class="muted">承办人和主体以服务端任务档案为准。后续案件阶段、处罚决定和结案由监管运营办理。</text></view>
 <view class="bottom-action"><text class="muted">立案后通知关联主体</text><button class="btn btn-primary" :disabled="submitting||saved||!selected" :loading="submitting" @tap="submit">提交立案登记</button></view>
</view></template>

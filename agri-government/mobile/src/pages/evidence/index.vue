<script setup lang="ts">
import AuthorizationNotice from '../../components/AuthorizationNotice.vue'
import { computed,ref } from 'vue'
import { onLoad,onShow } from '@dcloudio/uni-app'
import { api,type Task,type Evidence } from '../../api'
import { getGovUser } from '../../auth'
const tasks=ref<Task[]>([]),taskNo=ref(''),description=ref(''),saving=ref(false),loading=ref(false),error=ref(''),list=ref<Evidence[]>([]),draft=ref(false)
const selected=computed(()=>tasks.value.find(t=>t.taskNo===taskNo.value))
const labels=computed(()=>tasks.value.map(t=>`${t.subjectName} · ${t.taskNo}`))
const draftKey=()=>`gov-evidence-draft:${getGovUser()?.id||'anonymous'}`
onLoad(o=>{const raw=uni.getStorageSync(draftKey());if(raw&&typeof raw==='object'){taskNo.value=String(raw.taskNo||'');description.value=String(raw.description||'');draft.value=true}if(o?.taskNo&&String(o.taskNo)!==taskNo.value){taskNo.value=String(o.taskNo);description.value='';draft.value=false}})
onShow(refresh)
async function refresh(){loading.value=true;error.value='';try{const [t,e]=await Promise.all([api.tasks(),api.evidenceList()]);tasks.value=t;list.value=e}catch(e){error.value=e instanceof Error?e.message:'加载失败'}finally{loading.value=false}}
function choose(e:any){taskNo.value=tasks.value[Number(e.detail.value)]?.taskNo||''}
function saveDraft(){if(saving.value)return;if(!description.value.trim())return uni.showToast({title:'请先填写取证说明',icon:'none'});try{uni.setStorageSync(draftKey(),{taskNo:taskNo.value,description:description.value});draft.value=true;uni.showToast({title:'草稿已存本机，尚未入库',icon:'none'})}catch{uni.showToast({title:'本机存储失败，请复制说明留存',icon:'none'})}}
async function save(){
 if(saving.value)return
 if(!selected.value)return uni.showToast({title:'请选择本人承办的任务',icon:'none'})
 if(!description.value.trim())return uni.showToast({title:'请填写取证说明',icon:'none'})
 saving.value=true
 try{await api.evidence({taskNo:taskNo.value,description:description.value.trim(),evidenceType:'现场取证说明',uploaded:true});description.value='';draft.value=false;try{uni.removeStorageSync(draftKey())}catch{}uni.showToast({title:'取证说明已入库',icon:'success'});await refresh()}catch(e){uni.showToast({title:e instanceof Error?e.message:'保存失败，说明仍保留在当前页面',icon:'none'})}finally{saving.value=false}
}
function detail(item:Evidence){uni.showModal({title:item.evidenceNo,content:`类型：${item.evidenceType}\n关联任务：${item.taskNo||'关联案件'}\n说明：${item.description}\n摘要：${item.evidenceHash}\n登记时间：${item.capturedAt}`,showCancel:false})}
</script>
<template><view class="page pad action-page"><view class="page-heading"><text class="page-title">取证登记</text><text class="muted">记录现场事实，关联本人承办任务</text></view><AuthorizationNotice duty="inspection" context="evidence"/>
 <view class="notice">当前支持取证说明登记与摘要留痕，不上传照片、录音或视频原件。原始材料请按执法档案要求另行保管；摘要不代表已上链。</view>
 <view v-if="error" class="state-panel"><text>{{error}}</text><button class="btn" @click="refresh">重新加载</button></view>
 <view class="card"><view class="form-item"><text class="form-label">关联任务 *</text><picker :range="labels" :disabled="loading||saving||!tasks.length" @change="choose"><view class="select-field">{{selected?`${selected.subjectName} · ${selected.taskNo}`:taskNo||'请选择本人承办任务'}} <text>⌄</text></view></picker></view><view class="form-item"><text class="form-label">取证说明 *</text><textarea class="textarea evidence-note" v-model="description" :disabled="saving" :maxlength="1000" placeholder="记录现场时间、地点、事实、材料编号及原件保管位置"/><text class="tiny">{{description.length}} / 1000</text></view><text v-if="draft" class="tag orange">本机草稿 · 未入库</text><button class="btn btn-ghost" :disabled="saving" @click="saveDraft">暂存本机草稿</button></view>
 <view class="card"><view class="card-head"><text class="card-title">我的取证记录</text><text class="tiny">最近 {{list.length}} 条</text></view><view v-if="loading" class="loading">正在加载…</view><text v-else-if="!list.length&&!error" class="muted">暂无记录，完成上方登记后可在此查回。</text><view v-for="item in list" :key="item.id" class="record" @click="detail(item)"><text class="strong">{{item.evidenceType}}</text><text class="muted">{{item.description}}</text><text class="tiny">{{item.taskNo||'关联案件'}} · {{item.capturedAt}}</text><text class="tag" :class="item.uploaded?'green':'orange'">{{item.uploaded?'已登记':'历史暂存记录'}}</text></view></view>
 <view class="bottom-action"><text class="muted">提交后生成记录摘要</text><button class="btn btn-primary" :disabled="saving||!selected" :loading="saving" @click="save">提交取证说明</button></view>
</view></template>
<style scoped>.evidence-note{height:260rpx}.record{padding:24rpx 0;border-bottom:1rpx solid #e1e9e3;display:flex;flex-direction:column;gap:10rpx}.record .tag{align-self:flex-start}.record .muted{white-space:pre-wrap}.card>.btn{margin-top:20rpx}</style>

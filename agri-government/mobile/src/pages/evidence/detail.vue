<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { api, statusMeta, type Evidence } from '../../api'
import { useGovPage } from '../../useGovPage'
import AuthorizationNotice from '../../components/AuthorizationNotice.vue'
useGovPage()
const id=ref(0),record=ref<Evidence|null>(null),loading=ref(false),error=ref('')
onLoad(options=>{id.value=Number(options?.id||0)})
onShow(load)
onPullDownRefresh(load)
async function load(){
 if(loading.value){uni.stopPullDownRefresh();return}
 record.value=null
 if(!Number.isSafeInteger(id.value)||id.value<=0){error.value='记录编号无效，请从列表重新进入';uni.stopPullDownRefresh();return}
 loading.value=true;error.value=''
 try{const records=await api.evidenceList();record.value=records.find(item=>item.id===id.value)??null;if(!record.value)error.value='记录不存在或已不在当前账号可见范围，请返回列表刷新'}
 catch(e){error.value=e instanceof Error?e.message:'记录加载失败'}
 finally{loading.value=false;uni.stopPullDownRefresh()}
}
function back(){uni.navigateBack({fail:()=>uni.switchTab({url:'/pages/workbench/index'})})}
</script>
<template><view class="page pad">
 <view v-if="loading" class="loading">正在加载取证详情…</view>
 <view v-else-if="error" class="state-panel"><text>{{error}}</text><button class="btn" @tap="load">重新加载</button><button class="btn" @tap="back">返回</button></view>
 <template v-else-if="record"><view class="page-heading"><text class="page-title">{{record.evidenceType}}</text><text selectable class="tiny">{{record.evidenceNo||'未关联单号'}}</text></view><AuthorizationNotice duty="inspection" context="evidence"/><view class="card"><view class="field"><text class="field-label">关联任务</text><text selectable class="field-value">{{record.taskNo||'未登记'}}</text></view><view class="field"><text class="field-label">关联案件编号</text><text selectable class="field-value">{{record.caseId||'未登记'}}</text></view><view class="field"><text class="field-label">登记人</text><text selectable class="field-value">{{record.capturedBy||'未登记'}}</text></view><view class="field"><text class="field-label">登记时间</text><text selectable class="field-value">{{record.capturedAt||'未登记'}}</text></view></view><view class="card"><text class="card-title">取证说明</text><text selectable class="detail-content">{{record.description||'暂无记录'}}</text></view><view class="card"><text class="card-title">记录摘要</text><text selectable class="detail-content">{{record.evidenceHash||'暂无记录'}}</text></view><view class="notice">当前记录为取证说明及摘要，不代表原件已上传或已上链。</view><button class="btn btn-block" @tap="back">返回</button></template>
</view></template>

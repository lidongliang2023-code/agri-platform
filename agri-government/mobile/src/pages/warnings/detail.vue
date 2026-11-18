<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { api, statusMeta, type Warning } from '../../api'
import { useGovPage } from '../../useGovPage'
import AuthorizationNotice from '../../components/AuthorizationNotice.vue'
useGovPage()
const id=ref(0),record=ref<Warning|null>(null),loading=ref(false),error=ref('')
onLoad(options=>{id.value=Number(options?.id||0)})
onShow(load)
onPullDownRefresh(load)
async function load(){
 if(loading.value){uni.stopPullDownRefresh();return}
 record.value=null
 if(!Number.isSafeInteger(id.value)||id.value<=0){error.value='记录编号无效，请从列表重新进入';uni.stopPullDownRefresh();return}
 loading.value=true;error.value=''
 try{const records=await api.workbench().then(value=>value.warnings);record.value=records.find(item=>item.id===id.value)??null;if(!record.value)error.value='记录不存在或已不在当前账号可见范围，请返回列表刷新'}
 catch(e){error.value=e instanceof Error?e.message:'记录加载失败'}
 finally{loading.value=false;uni.stopPullDownRefresh()}
}
function back(){uni.navigateBack({fail:()=>uni.switchTab({url:'/pages/workbench/index'})})}
</script>
<template><view class="page pad">
 <view v-if="loading" class="loading">正在加载预警详情…</view>
 <view v-else-if="error" class="state-panel"><text>{{error}}</text><button class="btn" @tap="load">重新加载</button><button class="btn" @tap="back">返回</button></view>
 <template v-else-if="record"><view class="page-heading"><text class="page-title">{{record.title}}</text><text selectable class="tiny">{{record.warningNo||'未关联单号'}}</text></view><AuthorizationNotice duty="" context="warnings"/><view class="card"><view class="field"><text class="field-label">涉及主体</text><text selectable class="field-value">{{record.subjectName||'未登记'}}</text></view><view class="field"><text class="field-label">预警位置</text><text selectable class="field-value">{{record.location||'未登记'}}</text></view><view class="field"><text class="field-label">承办人</text><text selectable class="field-value">{{record.assignedTo||'未登记'}}</text></view><view class="field"><text class="field-label">生成时间</text><text selectable class="field-value">{{record.createdAt||'未登记'}}</text></view></view><view class="card"><text class="card-title">预警线索</text><text selectable class="detail-content">{{record.content||'暂无记录'}}</text></view><view class="card"><text class="card-title">处置意见</text><text selectable class="detail-content">{{record.handleNote||'暂无记录'}}</text></view><view class="notice">预警作为核查线索，分派和处置由监管运营办理。</view><button class="btn btn-block" @tap="back">返回</button></template>
</view></template>

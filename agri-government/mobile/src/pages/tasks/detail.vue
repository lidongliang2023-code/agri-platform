<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api,statusMeta,type Task } from '../../api'
const task=ref<(Task&{checklist:Array<{id:number;itemId?:number;itemName:string;note:string;done:boolean}>;subject?:{subjectName:string;creditCode:string;contactPhone?:string;address?:string}})|null>(null),id=ref(0)
onLoad(async o=>{
  id.value=Number(o?.id||0)
  if(!id.value){uni.showToast({title:'缺少任务编号，请从任务列表进入',icon:'none'});setTimeout(()=>uni.switchTab({url:'/pages/tasks/index'}),600);return}
  try{task.value=await api.task(id.value)}catch(e){uni.showToast({title:e instanceof Error?e.message:'加载失败',icon:'none'})}
})
function checklist(){uni.navigateTo({url:`/pages/tasks/checklist?id=${id.value}`})}
function evidence(){uni.navigateTo({url:`/pages/evidence/index?taskNo=${task.value?.taskNo||''}`})}
function createCase(){uni.navigateTo({url:`/pages/cases/create?taskId=${id.value}&subjectId=${task.value?.subjectId??''}&subjectName=${encodeURIComponent(task.value?.subjectName||'')}`})}
/** 主体档案里没有经纬度字段，导航只能落回地图 App；这里改为复制真实地址，避免用写死的坐标指路。 */
function copyAddress(){const address=task.value?.address||'';if(!address)return uni.showToast({title:'该任务没有登记检查地点',icon:'none'})
  uni.setClipboardData({data:address,success:()=>uni.showToast({title:'检查地点已复制，可粘贴到地图 App 导航',icon:'none'})})}
function contact(){const phone=task.value?.subject?.contactPhone
  if(!phone)return uni.showToast({title:'监管主体未登记联系电话',icon:'none'})
  uni.showModal({title:task.value?.subjectName||'监管主体',content:`联系电话 ${phone}\n统一社会信用代码 ${task.value?.subject?.creditCode||'未登记'}`,showCancel:false})}
</script>
<template><view class="page pad" v-if="task"><view class="card hero-card"><view class="between"><text class="tag" :class="statusMeta(task.status).tone">{{statusMeta(task.status).label}}</text><text class="tiny">{{task.deadline}}</text></view><text class="title">{{task.subjectName}}</text><text class="muted">{{task.taskType}} · {{task.taskNo}}</text><view class="info"><view><text>检查地点</text><b>{{task.address}}</b></view><view><text>距离</text><b>{{task.distanceKm}}km</b></view><view><text>承办人</text><b>{{task.assignedTo}}</b></view></view></view><view class="card"><view class="card-head"><text class="card-title">检查清单</text><text class="tag green">{{task.checklist.filter(i=>i.done).length}}/{{task.checklist.length}}</text></view><view class="check-row" v-for="item in task.checklist" :key="item.id"><text :class="{done:item.done}">{{item.done?'✓':'○'}}</text><view><b>{{item.itemName}}</b><small>{{item.note}}</small></view></view><button class="btn btn-primary btn-block" @click="checklist">进入现场检查表</button></view><view class="action-grid"><button class="btn btn-ghost" @click="evidence">📷 拍照取证</button><button class="btn btn-ghost" @click="copyAddress">📍 复制检查地点</button><button class="btn btn-ghost" @click="contact">📞 联系主体</button><button class="btn btn-ghost" @click="createCase">⚖️ 现场立案</button></view></view></template>
<style lang="scss" scoped>.hero-card{padding:24rpx;background:linear-gradient(140deg,#fff,#edf8f2)}.title{display:block;margin-top:12rpx;font-size:34rpx;font-weight:750}.hero-card>.muted{display:block;margin-top:5rpx}.info{display:grid;grid-template-columns:1.4fr .6fr .6fr;gap:10rpx;margin-top:18rpx;padding-top:16rpx;border-top:1rpx solid #dce8e0}.info view{display:flex;flex-direction:column;gap:4rpx}.info text{color:#718277;font-size:18rpx}.info b{font-size:21rpx}.check-row{display:flex;gap:12rpx;padding:14rpx 0;border-bottom:1rpx solid #edf2ee}.check-row>text{color:#94a198}.check-row>text.done{color:#159a5e}.check-row>view{display:flex;flex-direction:column;gap:4rpx}.check-row b{font-size:22rpx}.check-row small{color:#94a198;font-size:19rpx}.card .btn{margin-top:16rpx}.action-grid{display:grid;grid-template-columns:1fr 1fr;gap:12rpx}</style>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api, statusMeta, type Case, type Task, type Warning } from '../../api'
import { getGovUser } from '../../auth'

const data=ref<Awaited<ReturnType<typeof api.workbench>>|null>(null)
const statusBarHeight=ref(Number(uni.getSystemInfoSync().statusBarHeight||0))
const account=getGovUser()
const today=new Date().toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'})
/** 快捷入口要落到真实任务上：没有分派给自己的任务时，提示去任务列表而不是编一个单号。 */
const activeTask=computed(()=>data.value?.tasks.find(t=>t.status!=='completed')??data.value?.tasks[0]??null)
const inspectorName=computed(()=>data.value?.inspector.name||account?.nickname||account?.username||'执法人员')
const inspectorTeam=computed(()=>data.value?.inspector.team||'未绑定执法档案')
const inspectorGrid=computed(()=>data.value?.inspector.grid||'')
const certificateNo=computed(()=>data.value?.inspector.certificateNo||'')
onShow(load)
async function load(){try{data.value=await api.workbench()}catch(e){uni.showToast({title:e instanceof Error?e.message:'加载失败',icon:'none'})}}
function to(path:string){uni.navigateTo({url:path})}
function task(item:Task){to(`/pages/tasks/detail?id=${item.id}`)}
function caseDetail(item:Case){uni.showToast({title:`${item.caseNo} ${statusMeta(item.status).label}`,icon:'none'})}
function toTasks(){uni.switchTab({url:'/pages/tasks/index'})}
function toScan(){uni.switchTab({url:'/pages/scan/index'})}
function checkActive(){if(!activeTask.value)return uni.showToast({title:'当前没有分派给你的任务，请先在任务列表查看',icon:'none'});to(`/pages/tasks/checklist?id=${activeTask.value.id}`)}
function evidenceActive(){if(!activeTask.value)return uni.showToast({title:'当前没有可关联的任务',icon:'none'});to(`/pages/evidence/index?taskNo=${activeTask.value.taskNo}`)}
</script>
<template>
  <view class="page workbench-page">
    <view class="hero" :style="{paddingTop:`${statusBarHeight+16}px`}">
      <view class="between"><view><text class="hello">{{ inspectorName }} · {{ inspectorTeam }}</text><text class="tiny">统一账号 {{ account?.username || '' }}<text v-if="inspectorGrid"> · {{ inspectorGrid }}</text></text></view><text class="online">● 在岗</text></view>
      <view class="date">{{ today }}<text v-if="data"> · {{ data.inspector.organization }}</text></view>
      <view class="weather"><b>{{ data ? data.stats.pendingTasks : '—' }}</b><text>待办检查 · 执法证号 {{ certificateNo || '解析中' }}</text></view>
    </view>
    <view v-if="!data" class="loading">正在加载执法工作台…</view>
    <view v-else class="pad workbench-body">
      <view class="card stats-card"><view><b>{{data.stats.todayTasks}}</b><text>今日任务</text></view><view><b class="orange">{{data.stats.pendingTasks}}</b><text>待检查</text></view><view><b>{{data.stats.warnings}}</b><text>预警事件</text></view><view><b class="red">{{data.stats.openCases}}</b><text>在办案件</text></view></view>
      <view class="card"><view class="card-head"><text class="card-title">⚡ 快捷执法</text><text class="card-sub">{{ activeTask ? `当前任务 ${activeTask.taskNo}` : '暂无在办任务' }}</text></view><view class="quick-grid"><view @click="toScan"><text class="qi blue">⌕</text><text>扫码核验</text></view><view @click="toTasks"><text class="qi green">📝</text><text>巡查任务</text></view><view @click="evidenceActive"><text class="qi orange">📷</text><text>现场取证</text></view><view @click="to('/pages/cases/create')"><text class="qi red">⚖️</text><text>立案登记</text></view><view @click="checkActive"><text class="qi cyan">☑️</text><text>现场检查</text></view><view @click="to('/pages/evidence/index')"><text class="qi purple">🗂</text><text>取证记录</text></view><view @click="to('/pages/messages/index')"><text class="qi teal">🔔</text><text>消息通知</text></view><view @click="to('/pages/profile/index')"><text class="qi amber">🪪</text><text>我的证件</text></view></view></view>
      <view class="section-head"><text>⚠️ 风险预警</text><text class="card-sub">共 {{ data.warnings.length }} 条待处理</text></view>
      <view class="warning-card" v-for="warning in data.warnings.slice(0,3)" :key="warning.id" @click="toScan"><view class="between"><view><text class="warning-title">{{warning.title}}</text><text class="tiny">📍 {{warning.location}} · {{warning.subjectName}}</text></view><text class="tag" :class="statusMeta(warning.level).tone">{{statusMeta(warning.level).label}}</text></view><view class="ai-note"><text>✦ AI线索（置信度 {{warning.aiConfidence}}%）</text><text>{{warning.content}}</text></view></view>
      <view class="section-head"><text>🕘 最近任务</text><text class="card-sub" @click="toTasks">任务列表 ›</text></view>
      <view class="task-card" v-for="item in data.tasks.slice(0,3)" :key="item.id" @click="task(item)"><view class="between"><view><text class="task-title">{{item.subjectName}}</text><text class="tiny">{{item.taskType}} · {{item.deadline}} · {{item.distanceKm}}km</text></view><text class="tag" :class="statusMeta(item.status).tone">{{statusMeta(item.status).label}}</text></view><view class="task-foot"><view><text class="tiny">检查项 {{item.checklistDone}}/{{item.checklistTotal}}</text><view class="progress"><view :style="{width:`${item.checklistTotal?item.checklistDone/item.checklistTotal*100:0}%`}"/></view></view><button class="btn btn-sm btn-primary" @click.stop="task(item)">{{item.status==='in_progress'?'继续':'开始'}}</button></view></view>
      <view class="offline" @click="to('/pages/evidence/index')">📴 取证记录 {{data.evidenceCount}} 条 · 其中离线暂存 {{data.offlineRecords}} 条（点击处理）</view>
      <view class="card case-preview" v-if="data.recentCases.length"><view class="card-head"><text class="card-title">最近案件</text></view><view v-for="item in data.recentCases.slice(0,2)" :key="item.id" class="case-row" @click="caseDetail(item)"><view><text class="strong">{{item.subjectName}}</text><text class="tiny">{{item.caseNo}} · {{item.caseType}}</text></view><text class="tag" :class="statusMeta(item.status).tone">{{statusMeta(item.status).label}}</text></view></view>
    </view>
  </view>
</template>
<style lang="scss" scoped>
.hello{display:block;font-size:29rpx;font-weight:650}.online{margin-left:auto;padding:6rpx 12rpx;border-radius:18rpx;background:rgba(74,185,120,.16);color:#9ce8ba;font-size:18rpx}.date{margin-top:13rpx;color:rgba(255,255,255,.47);font-size:19rpx}.weather{display:flex;align-items:center;gap:14rpx;margin-top:16rpx}.weather b{font-family:monospace;font-size:36rpx;font-weight:400}.weather text{color:rgba(255,255,255,.55);font-size:20rpx}.workbench-body{margin-top:-26rpx;position:relative;z-index:2}.stats-card{display:grid;grid-template-columns:repeat(4,1fr);padding:22rpx 10rpx}.stats-card>view{display:flex;align-items:center;flex-direction:column;gap:4rpx;border-right:1rpx solid #edf2ee}.stats-card>view:last-child{border-right:0}.stats-card b{font-family:monospace;font-size:33rpx}.stats-card text{color:#718277;font-size:18rpx}.orange{color:#c88416}.red{color:#c54b4b}.quick-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20rpx 5rpx}.quick-grid>view{display:flex;align-items:center;flex-direction:column;gap:7rpx;font-size:20rpx}.qi{display:flex;width:76rpx;height:76rpx;align-items:center;justify-content:center;border-radius:20rpx;font-size:32rpx}.qi.blue{background:#e7f3fa}.qi.green{background:#e5f5eb}.qi.orange{background:#fff3dd}.qi.red{background:#feebeb}.qi.cyan{background:#e0f7fa}.qi.purple{background:#f2eafa}.qi.teal{background:#e6f6f4}.qi.amber{background:#fff8e1}.section-head{display:flex;justify-content:space-between;margin:26rpx 2rpx 12rpx;font-size:28rpx;font-weight:700}.warning-card,.task-card{margin-bottom:14rpx;padding:20rpx;border:1rpx solid #e1e9e3;border-radius:20rpx;background:#fff}.warning-title{display:block;font-size:23rpx;font-weight:650}.ai-note{display:flex;flex-direction:column;gap:5rpx;margin-top:12rpx;padding:13rpx;border-radius:12rpx;background:#f2eafa;color:#6b418d;font-size:19rpx;line-height:1.55}.task-title{display:block;font-size:23rpx;font-weight:650}.task-foot{display:flex;align-items:flex-end;justify-content:space-between;gap:15rpx;margin-top:14rpx}.task-foot>view{flex:1}.task-foot .progress{margin-top:6rpx}.offline{margin-top:10rpx;padding:14rpx;border-radius:13rpx;background:#fff8e1;color:#9b6b0d;font-size:19rpx;text-align:center}.case-row{display:flex;justify-content:space-between;padding:13rpx 0;border-bottom:1rpx solid #edf2ee}.case-row>view{display:flex;flex-direction:column;gap:4rpx}.case-row:last-child{border-bottom:0}
</style>

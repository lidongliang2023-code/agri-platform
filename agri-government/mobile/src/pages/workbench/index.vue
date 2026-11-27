<script setup lang="ts">
import { useGovPage } from '../../useGovPage'
useGovPage()
import AuthorizationNotice from '../../components/AuthorizationNotice.vue'
import { computed, ref } from 'vue'
import { onShow,onPullDownRefresh } from '@dcloudio/uni-app'
import { api, statusMeta, type Case, type Task, type Warning } from '../../api'
import { getGovToken, getGovUser } from '../../auth'

const error=ref(''),loading=ref(false)
const data=ref<Awaited<ReturnType<typeof api.workbench>>|null>(null)
const statusBarHeight=ref(Number(uni.getSystemInfoSync().statusBarHeight||0))
const account=getGovUser()
const today=new Date().toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'})
/** 快捷入口要落到真实任务上：没有分派给自己的任务时，提示去任务列表而不是编一个单号。 */
const activeTask=computed(()=>data.value?.tasks.find(t=>t.status!=='completed')??null)
const inspectorName=computed(()=>data.value?.inspector.name||account?.nickname||account?.username||'执法人员')
const inspectorTeam=computed(()=>data.value?.inspector.team||'未绑定执法档案')
const inspectorGrid=computed(()=>data.value?.inspector.grid||'')
const certificateNo=computed(()=>data.value?.inspector.certificateNo||'')
onShow(load)
onPullDownRefresh(load)
async function load() {
  const token = getGovToken()
  if (!token || loading.value) {
    uni.stopPullDownRefresh()
    return
  }
  loading.value = true
  error.value = ''
  try {
    const result = await api.workbench()
    if (token === getGovToken()) data.value = result
  } catch (e) {
    data.value = null
    if (token === getGovToken()) error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}
function to(path:string){uni.navigateTo({url:path})}
function task(item:Task){to(`/pages/tasks/detail?id=${item.id}`)}
function caseDetail(item:Case){to(`/pages/cases/detail?id=${item.id}`)}
function warningDetail(item:Warning){to(`/pages/warnings/detail?id=${item.id}`)}
function toTasks(){uni.switchTab({url:'/pages/tasks/index'})}
function toScan(){uni.switchTab({url:'/pages/scan/index'})}
function checkActive(){if(!activeTask.value)return uni.showToast({title:'当前没有分派给你的任务，请先在任务列表查看',icon:'none'});to(`/pages/tasks/detail?id=${activeTask.value.id}`)}
function evidenceActive(){if(!activeTask.value)return uni.showToast({title:'当前没有可关联的任务',icon:'none'});to(`/pages/evidence/index?taskNo=${encodeURIComponent(activeTask.value.taskNo)}`)}
</script>
<template>
  <view class="page workbench-page">
    <view class="hero" :style="{paddingTop:`${statusBarHeight+16}px`}">
      <view class="between"><view><text class="hello">{{ inspectorName }} · {{ inspectorTeam }}</text><text class="tiny">统一账号 {{ account?.username || '' }}<text v-if="inspectorGrid"> · {{ inspectorGrid }}</text></text></view><text class="online">执法工作台</text></view>
      <view class="date">{{ today }}<text v-if="data"> · {{ data.inspector.organization }}</text></view>
      <view class="weather"><text class="strong">{{ data ? data.stats.pendingTasks : '—' }}</text><text>待办检查 · 执法证号 {{ certificateNo || '解析中' }}</text></view>
    </view>
    <view v-if="error" class="state-panel"><text>{{error}}</text><button class="btn" @tap="load">重新加载</button></view><view v-else-if="!data" class="loading">正在加载执法工作台…</view>
    <view v-if="data" class="pad workbench-body"><AuthorizationNotice duty="" context="workbench"/>
      <view class="card stats-card"><view><text class="strong">{{data.stats.todayTasks}}</text><text>今日任务</text></view><view><text class="strong orange">{{data.stats.pendingTasks}}</text><text>待检查</text></view><view><text class="strong">{{data.stats.warnings}}</text><text>预警事件</text></view><view><text class="strong red">{{data.stats.openCases}}</text><text>在办案件</text></view></view>
      <view class="card"><view class="card-head"><text class="card-title">⚡ 快捷执法</text><text class="card-sub">{{ activeTask ? `当前任务 ${activeTask.taskNo}` : '暂无在办任务' }}</text></view><view class="quick-grid"><button @tap="toScan"><text class="qi blue">⌕</text><text>主体核验</text></button><button @tap="to('/pages/evidence/index')"><text class="qi green">▤</text><text>取证登记</text></button><button @tap="to('/pages/cases/create')"><text class="qi orange">＋</text><text>关联立案</text></button><button @tap="to('/pages/messages/index')"><text class="qi teal">♧</text><text>消息通知</text></button></view></view>
      <view class="section-head"><text>⚠️ 风险预警</text><text class="card-sub">共 {{ data.warnings.length }} 条待处理</text></view>
      <view class="warning-card" v-for="warning in data.warnings.slice(0,3)" :key="warning.id" @tap="warningDetail(warning)"><view class="between"><view><text class="warning-title">{{warning.title}}</text><text class="tiny">📍 {{warning.location}} · {{warning.subjectName}}</text></view><text class="tag" :class="statusMeta(warning.level).tone">{{statusMeta(warning.level).label}}</text></view><view class="ai-note"><text>✦ AI线索（置信度 {{warning.aiConfidence}}%）</text><text>{{warning.content}}</text></view></view>
      <view class="section-head"><text>🕘 最近任务</text><text class="ui-action-target card-sub" @tap="toTasks">任务列表 ›</text></view>
      <view class="task-card" v-for="item in data.tasks.slice(0,3)" :key="item.id" @tap="task(item)"><view class="between"><view><text class="task-title">{{item.subjectName}}</text><text class="tiny">{{item.taskType}} · {{item.deadline}}</text></view><text class="tag" :class="statusMeta(item.status).tone">{{statusMeta(item.status).label}}</text></view><view class="task-foot"><view><text class="tiny">检查项 {{item.checklistDone}}/{{item.checklistTotal}}</text><progress class="progress" :percent="item.checklistTotal?Math.min(100,Math.max(0,item.checklistDone/item.checklistTotal*100)):0" activeColor="#12764a" backgroundColor="#e7eee9" :stroke-width="4" /></view><button class="btn btn-sm btn-primary" @tap.stop="task(item)">{{item.status==='completed'?'查看':item.status==='in_progress'?'继续':'开始'}}</button></view></view>
      <view class="offline" @tap="to('/pages/evidence/index')">取证说明 {{data.evidenceCount}} 条 · 查看登记记录</view>
      <view class="card case-preview" v-if="data.recentCases.length"><view class="card-head"><text class="card-title">最近案件</text></view><view v-for="item in data.recentCases.slice(0,2)" :key="item.id" class="case-row" @tap="caseDetail(item)"><view><text class="strong">{{item.subjectName}}</text><text class="tiny">{{item.caseNo}} · {{item.caseType}}</text></view><text class="tag" :class="statusMeta(item.status).tone">{{statusMeta(item.status).label}}</text></view></view>
    </view>
  </view>
</template>
<style lang="scss" scoped>
.hello{display:block;font-size:29rpx;font-weight:650}.online{margin-left:auto;padding:6rpx 12rpx;border-radius:18rpx;background:rgba(74,185,120,.16);color:#9ce8ba;font-size:24rpx}.date{margin-top:13rpx;color:rgba(255,255,255,.47);font-size:24rpx}.weather{display:flex;align-items:center;gap:14rpx;margin-top:16rpx}.weather .strong{font-family:monospace;font-size:36rpx;font-weight:400}.weather text{color:rgba(255,255,255,.55);font-size:24rpx}.workbench-body{margin-top:0;position:relative;z-index:2}.stats-card{display:flex;padding:22rpx 10rpx}.stats-card>view{display:flex;align-items:center;flex-direction:column;gap:4rpx;border-right:1rpx solid #edf2ee}.stats-card>view:last-child{border-right:0}.stats-card .strong{font-family:monospace;font-size:33rpx}.stats-card text{color:#666666;font-size:24rpx}.orange{color:#8f4500}.red{color:#b71c1c}.quick-grid{display:flex;gap:20rpx 5rpx}.quick-grid>button{display:flex;align-items:center;flex-direction:column;gap:7rpx;font-size:24rpx}.qi{display:flex;width:76rpx;height:76rpx;align-items:center;justify-content:center;border-radius:20rpx;font-size:32rpx}.qi.blue{background:#e7f3fa}.qi.green{background:#e5f5eb}.qi.orange{background:#fff3dd}.qi.red{background:#feebeb}.qi.cyan{background:#e0f7fa}.qi.purple{background:#f2eafa}.qi.teal{background:#e6f6f4}.qi.amber{background:#fff8e1}.section-head{display:flex;justify-content:space-between;margin:26rpx 2rpx 12rpx;font-size:28rpx;font-weight:700}.warning-card,.task-card{margin-bottom:14rpx;padding:20rpx;border:1rpx solid #e1e9e3;border-radius:20rpx;background:#fff}.warning-title{display:block;font-size:24rpx;font-weight:650}.ai-note{display:flex;flex-direction:column;gap:5rpx;margin-top:12rpx;padding:13rpx;border-radius:12rpx;background:#f2eafa;color:#6b418d;font-size:24rpx;line-height:1.55}.task-title{display:block;font-size:24rpx;font-weight:650}.task-foot{display:flex;align-items:flex-end;justify-content:space-between;gap:15rpx;margin-top:14rpx}.task-foot>view{flex:1}.task-foot .progress{margin-top:6rpx}.offline{margin-top:10rpx;padding:14rpx;border-radius:13rpx;background:#fff8e1;color:#8f4500;font-size:24rpx;text-align:center}.case-row{display:flex;justify-content:space-between;padding:13rpx 0;border-bottom:1rpx solid #edf2ee}.case-row>view{display:flex;flex-direction:column;gap:4rpx}.case-row:last-child{border-bottom:0}
.stats-card>view,.quick-grid>button{flex:1;min-width:0}.section-head{gap:16rpx}.section-head .card-sub{min-height:88rpx;display:flex;align-items:center}

/* 2026-11-20：逐页实测控件的48px触控区。 */
.offline { min-height:48px; display:flex; align-items:center; }
</style>

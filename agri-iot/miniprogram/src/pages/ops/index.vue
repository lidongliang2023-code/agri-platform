<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import WorkspaceSwitch from '../../components/WorkspaceSwitch.vue'
import OpsTabBar from '../../components/OpsTabBar.vue'
const tab = ref<'overview' | 'business' | 'todo'>('overview')
const titles = { overview: '运营概览', business: '运营业务', todo: '待办中心' }
onLoad(options => {
  tab.value = options?.tab === 'business' ? 'business' : options?.tab === 'todo' ? 'todo' : 'overview'
  uni.setNavigationBarTitle({ title: titles[tab.value] })
})
import { opsMenus, reportLabels, refreshOpsTodos, opsTodoCounts, opsTodoTotal } from '../../api/ops'
import { type Row } from '../../api/iot'
const data = ref<Row|null>(null), error = ref(''), busy = ref(false), updated = ref('')
const groups = computed(() => Array.from(new Set(opsMenus.map(m => m.group))).map(name => ({ name, items: opsMenus.filter(m => m.group === name) })))
const metrics = ['tenants','devices','online','offline','openAlerts','pendingAccess','throughput','gateways']
const todos = [
  { key: 'alerts', title: '未解决告警', hint: '待处理与处理中', mark: '警', tone: 'red' },
  { key: 'access', title: '待审核接入', hint: '等待审核的接入申请', mark: '审', tone: 'orange' },
  { key: 'workorders', title: '未完成工单', hint: '待处理、已派单与处理中', mark: '维', tone: 'blue' },
]
const descriptions: Record<string,string> = {
  devices:'设备状态与指令回执', gateways:'网关状态与运维回执', products:'产品信息与接入协议', access:'查看申请与审核结果',
  alerts:'告警查询与处置', rules:'平台与主体阈值规则', workorders:'工单受理与处理记录', firmwares:'固件版本与发布信息',
  ota:'升级任务与执行进度', tenants:'主体信息与设备配额', logs:'操作对象与审计记录', reports:'平台统计与主体排名',
}
function count(value: unknown) {
  const n = Number(value)
  return Number.isSafeInteger(n) && n > 0 ? n : 0
}
const pending = opsTodoCounts
const total = opsTodoTotal
function badge(key: string) { const n = pending.value[key] || 0; return n > 99 ? '99+' : String(n) }
function entryLabel(key: string, title: string) {
  return data.value && key in pending.value ? `${title}，${pending.value[key]} 条待办${error.value ? '，数据未更新' : ''}` : title
}
async function load() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const snapshot = await refreshOpsTodos()
    data.value = snapshot.overview
    const now = new Date()
    updated.value = [now.getHours(), now.getMinutes(), now.getSeconds()].map(n => String(n).padStart(2,'0')).join(':')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '运营数据加载失败，请重试'
  } finally {
    busy.value = false
    uni.stopPullDownRefresh()
  }
}
function open(key: string, todo = false) { uni.navigateTo({ url: '/pages/ops/' + key + (todo ? '?filter=todo' : '') }) }
function account() { uni.switchTab({ url: '/pages/account/index' }) }
onShow(load)
onPullDownRefresh(load)
</script>
<template>
  <view class="page pad ops-home">
    <WorkspaceSwitch/>
    <view class="home-overview">
      <view class="overview-copy"><text class="scope-label">全平台范围</text><text class="overview-title">{{titles[tab]}}</text></view>
      <view class="overview-actions"><button role="button" class="btn" @tap="account">我的</button><button role="button" class="btn refresh-button" :disabled="busy" :loading="busy" @tap="load">刷新</button></view>
    </view>
    <view v-if="error" class="error-state" role="alert"><text class="strong">{{data?'刷新失败，以下为上次数据':'运营数据加载失败'}}</text><text class="error-message">{{error}}</text><button role="button" class="btn" :disabled="busy" @tap="load">重新加载</button></view>
    <view v-if="busy&&!data" class="loading-state" role="status"><text class="strong">正在加载运营数据…</text><text class="scope-label">待办与平台概况加载后显示</text></view>
    <template v-if="data && tab !== 'business'">
      <template v-if="tab !== 'overview' || total > 0">
      <view class="section-heading"><text class="section-name">待办处理</text><text class="section-meta">{{total ? '共 ' + total + ' 项' : '暂无待办'}}</text></view>
      <view class="todo-card">
        <button v-for="item in todos" :key="item.key" class="todo-entry" role="button" :aria-label="entryLabel(item.key,item.title)" @tap="open(item.key, true)">
          <text class="entry-icon" :class="item.tone">{{item.mark}}</text>
          <view class="entry-copy"><text class="entry-title">{{item.title}}</text><text class="entry-desc">{{item.hint}}</text></view>
          <text v-if="pending[item.key]" class="pending-badge">{{badge(item.key)}}</text><text v-else class="zero-label">暂无</text><text class="entry-chevron" aria-hidden="true">›</text>
        </button>
      </view>
      <text class="section-note">点击仅查看未完成事项，处理后返回自动刷新。</text>
      </template>
      <template v-if="tab === 'overview'">
      <view class="section-heading"><text class="section-name">平台概况</text><text class="section-meta">{{busy?'更新中…':error?'数据未更新':updated+' 更新'}}</text></view>
      <view class="overview-metrics"><view v-for="key in metrics" :key="key" class="metric-cell"><text class="metric-label">{{reportLabels[key]}}</text><text class="metric-value" :class="{'metric-alert':key==='openAlerts'&&count(data.metrics?.[key])>0}">{{data.metrics?.[key] ?? '—'}}</text></view></view>
      </template>
    </template>
    <template v-if="tab !== 'todo'">
    <view v-for="group in groups" :key="group.name" class="menu-section">
      <view class="section-heading"><text class="section-name">{{group.name}}</text><text class="section-meta">{{group.items.length}} 项功能</text></view>
      <view class="menu-grid">
        <button v-for="item in group.items" :key="item.key" class="menu-entry" role="button" :aria-label="entryLabel(item.key,item.title)" @tap="open(item.key)">
          <view class="menu-entry-head"><text class="entry-icon">{{item.mark}}</text><text v-if="pending[item.key]" class="pending-badge">{{badge(item.key)}}</text><text v-else class="entry-chevron" aria-hidden="true">›</text></view>
          <text class="entry-title">{{item.title}}</text><text class="entry-desc">{{descriptions[item.key]}}</text>
        </button>
      </view>
    </view>
    </template>
    <text class="home-end">全平台运营数据 · 下拉可刷新</text>
    <OpsTabBar :active="tab" />
  </view>
</template>
<style scoped>
.ops-home{max-width:750px;margin:auto;padding:12px 12px calc(24px + env(safe-area-inset-bottom));font-size:14px;color:#263f30}
.ops-home :deep(.workspace){padding:16px;margin-bottom:16px;border-radius:16px;font-size:14px}
.ops-home :deep(.workspace-head){gap:8px;flex-wrap:wrap}.ops-home :deep(.workspace-head .muted){font-size:12px}
.ops-home :deep(.workspace-actions){gap:8px;margin-top:12px}.ops-home :deep(.workspace-actions .btn){min-height:44px;font-size:14px;padding:8px;border-radius:10px}
.home-overview{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:2px 0 16px}.overview-copy{min-width:0}.scope-label{display:block;color:#65796d;font-size:12px;line-height:1.6}.overview-title{display:block;margin-top:4px;color:#173c2a;font-size:22px;font-weight:700;line-height:1.4}.overview-actions{display:flex;gap:8px;flex-shrink:0}
.ops-home .btn{min-height:44px;padding:8px 14px;border-radius:10px;font-size:14px;line-height:1.5}.refresh-button{color:#12764a}
.section-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 2px 12px}.section-name{font-size:16px;font-weight:700;line-height:1.5;color:#173c2a}.section-meta{font-size:12px;line-height:1.6;color:#65796d;text-align:right}.section-note{display:block;margin:10px 2px 0;color:#65796d;font-size:12px;line-height:1.7}
.todo-card{padding:0 14px;border:1px solid #e1e9e3;border-radius:16px;background:#fff}.todo-entry{display:flex;align-items:center;gap:12px;width:100%;min-height:80px;padding:14px 0;border-bottom:1px solid #edf2ee;border-radius:0;text-align:left;white-space:normal}.todo-entry:last-child{border-bottom:0}.entry-copy{flex:1;min-width:0}.entry-title{display:block;font-size:15px;font-weight:600;line-height:1.5;overflow-wrap:anywhere}.entry-desc{display:block;margin-top:4px;color:#65796d;font-size:12px;font-weight:400;line-height:1.6;overflow-wrap:anywhere}
.entry-icon{display:flex;align-items:center;justify-content:center;flex-shrink:0;width:36px;height:36px;border-radius:10px;background:#edf6f0;color:#12764a;font-size:16px;font-weight:700}.entry-icon.red{background:#feeeee;color:#b63232}.entry-icon.orange{background:#fff4df;color:#93600e}.entry-icon.blue{background:#eaf3fa;color:#176c93}.entry-chevron{flex-shrink:0;color:#809288;font-size:22px;line-height:1}.zero-label{flex-shrink:0;color:#718277;font-size:12px}
.pending-badge{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;min-width:24px;height:24px;padding:0 6px;border-radius:20px;background:#c93632;color:#fff;font-size:12px;font-weight:600;line-height:24px;font-variant-numeric:tabular-nums}
.overview-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));padding:4px 16px;border:1px solid #e1e9e3;border-radius:16px;background:#fff}.metric-cell{min-width:0;padding:14px 0;border-bottom:1px solid #edf2ee}.metric-cell:nth-child(odd){padding-right:12px}.metric-cell:nth-child(even){padding-left:16px;border-left:1px solid #edf2ee}.metric-cell:nth-last-child(-n+2){border-bottom:0}.metric-label{display:block;color:#65796d;font-size:12px;line-height:1.6}.metric-value{display:block;margin-top:5px;color:#173c2a;font-size:24px;font-weight:700;line-height:1.3;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.metric-value.metric-alert{color:#b63232}
.menu-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.menu-entry{min-width:0;width:100%;padding:14px;border:1px solid #e1e9e3;border-radius:16px;background:#fff;text-align:left;white-space:normal;box-shadow:0 3px 12px rgba(20,64,40,.025)}.menu-entry-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px}.menu-entry:only-child{grid-column:1/-1}.menu-entry:active,.todo-entry:active{background:#f2f8f4}.ops-home button:focus-visible{outline:2px solid #12764a;outline-offset:3px}
.loading-state{display:flex;flex-direction:column;gap:8px;padding:24px 16px;border:1px solid #e1e9e3;border-radius:16px;background:#fff;text-align:center}.error-state{padding:16px;border-radius:16px;background:#fff0ee;color:#a73636;font-size:14px;line-height:1.6}.error-message{display:block;margin:8px 0 12px;overflow-wrap:anywhere}.home-end{display:block;margin-top:24px;text-align:center;color:#718277;font-size:12px;line-height:1.6}
@media(max-width:360px){.todo-entry{gap:8px}.menu-entry{padding:12px}.overview-actions{gap:6px}.ops-home .btn{padding:8px 12px}}
</style>

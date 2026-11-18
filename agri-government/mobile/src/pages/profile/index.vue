<script setup lang="ts">
import { useGovPage } from '../../useGovPage'
useGovPage()
import AuthorizationNotice from '../../components/AuthorizationNotice.vue'
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api } from '../../api'
import { getGovUser,logoutGov } from '../../auth'
const statusBarHeight=ref(Number(uni.getSystemInfoSync().statusBarHeight||0))
const account=getGovUser()
const data=ref<Awaited<ReturnType<typeof api.workbench>>|null>(null)
const unread=ref(0)
const displayName=ref(account?.nickname||account?.username||'执法人员')
onShow(async()=>{
  try{data.value=await api.workbench();displayName.value=data.value.inspector.name}catch(e){data.value=null;uni.showToast({title:e instanceof Error?e.message:'执法档案解析失败',icon:'none'})}
  try{unread.value=(await api.messages()).filter(m=>!m.read).length}catch{unread.value=0}
})
function nav(url:string){uni.navigateTo({url})}
function certificate(){const i=data.value?.inspector;uni.showModal({title:'行政执法证件',content:i
  ?`姓名：${i.name}\n单位：${i.organization}\n队伍：${i.team}\n网格：${i.grid}\n执法证号：${i.certificateNo}`
  :'执法档案未绑定，请联系平台运营在「执法人员账号」里关联统一账号',showCancel:false})}
function statistics(){const current=data.value;if(!current)return uni.showModal({title:'我的辖区与办案统计',content:'统计数据加载失败',showCancel:false})
  uni.showModal({title:'我的辖区与办案统计',content:`网格：${current.inspector.grid}\n今日任务 ${current.stats.todayTasks} · 待检查 ${current.stats.pendingTasks}\n在办预警 ${current.stats.warnings} · 在办案件 ${current.stats.openCases}`,showCancel:false})}
function offline(){nav('/pages/evidence/index')}
function logout(){uni.showModal({title:'退出登录',content:'确定退出政府监管移动端吗？',success(result){if(result.confirm)void logoutGov()}})}
</script>
<template><view class="page"><view class="profile-hero" :style="{paddingTop:`${statusBarHeight+20}px`}"><view class="between"><text class="title">我的</text><text @tap="nav('/pages/messages/index')">🔔 {{ unread }}</text></view><view class="avatar">{{ displayName.slice(0,1) }}</view><text class="name">{{ displayName }}</text><text class="team">{{ data ? `${data.inspector.team} · ${data.inspector.grid}` : '执法档案解析中' }}</text><text class="tag green">统一账号 {{ account?.username || '' }}</text><view class="grid"><view><text class="strong">{{ data ? data.stats.todayTasks : '—' }}</text><text>今日任务</text></view><view><text class="strong">{{ data ? data.stats.pendingTasks : '—' }}</text><text>待检查</text></view><view><text class="strong">{{ data ? data.stats.warnings : '—' }}</text><text>在办预警</text></view><view><text class="strong">{{ data ? data.stats.openCases : '—' }}</text><text>在办案件</text></view></view></view><view class="pad"><AuthorizationNotice duty="" context="profile"/><view class="menu"><view @tap="certificate"><text>🪪</text><text class="strong">行政执法证件</text><text>{{ data ? data.inspector.certificateNo : '›' }}</text></view><view @tap="statistics"><text>🗺️</text><text class="strong">我的辖区与办案统计</text><text>›</text></view><view @tap="nav('/pages/messages/index')"><text>🔔</text><text class="strong">消息通知</text><text>{{ unread ? `${unread} 条未读` : '›' }}</text></view><view @tap="nav('/pages/evidence/index')"><text>🗂</text><text class="strong">我的取证记录</text><text>{{ data ? `${data.evidenceCount} 条` : '›' }}</text></view></view><view class="menu"><view @tap="offline"><text>📴</text><text class="strong">本机取证草稿</text><text>查看 ›</text></view><view @tap="logout"><text>↪</text><text class="strong">退出统一登录</text><text>›</text></view></view></view></view></template>
<style lang="scss" scoped>.profile-hero{display:flex;align-items:center;flex-direction:column;padding:0 28rpx 40rpx;border-radius:0 0 40rpx 40rpx;background:radial-gradient(circle at 85% 0,rgba(82,204,134,.23),transparent 390rpx),linear-gradient(145deg,#073821,#0d5a3a);color:#fff}.profile-hero>.between{width:100%;margin-bottom:15rpx}.title{font-size:32rpx;font-weight:700}.avatar{display:flex;width:120rpx;height:120rpx;align-items:center;justify-content:center;border:6rpx solid rgba(255,255,255,.16);border-radius:50%;background:linear-gradient(135deg,#26a96a,#12764a);font-size:43rpx;font-weight:700}.name{margin-top:13rpx;font-size:34rpx;font-weight:700}.team{margin:6rpx 0 12rpx;color:rgba(255,255,255,.55);font-size:24rpx}.grid{display:flex;width:100%;margin-top:25rpx;padding:18rpx 0;border-top:1rpx solid rgba(255,255,255,.1)}.grid view{display:flex;align-items:center;flex-direction:column;gap:4rpx}.grid .strong{font-family:monospace;font-size:30rpx}.grid text{color:rgba(255,255,255,.5);font-size:24rpx}.menu{margin-bottom:16rpx;overflow:hidden;border:1rpx solid #e1e9e3;border-radius:20rpx;background:#fff}.menu>view{display:flex;min-height:88rpx;align-items:center;gap:14rpx;padding:12rpx 20rpx;border-bottom:1rpx solid #edf2ee}.menu>view:last-child{border-bottom:0}.menu>view text:first-child{font-size:28rpx}.menu .strong{flex:1;font-size:24rpx}.menu>view text:last-child{color:#94a198;font-size:24rpx}.grid>view{flex:1;min-width:0}.menu>view text:last-child{max-width:40%;overflow-wrap:anywhere}
</style>

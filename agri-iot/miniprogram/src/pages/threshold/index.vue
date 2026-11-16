<script setup lang="ts">
import {ref} from 'vue'
import {onShow} from '@dcloudio/uni-app'
import {api,type Row} from '../../api/iot'
import {showError,confirmAction,go} from '../../utils/ui'
import SegTabs from '../../components/SegTabs.vue'
const levelLabel=(level:string)=>({critical:'紧急',major:'重要',normal:'一般',minor:'提示'} as Record<string,string>)[level]||level
const view=ref<Row|null>(null),risk=ref<Row[]>([]),tab=ref('effective'),error=ref(''),busy=ref(false)
onShow(load)
async function load(){busy.value=true;try{[view.value,risk.value]=await Promise.all([api.alertRuleView(),api.riskReadings()]);error.value=''}catch(e){error.value=e instanceof Error?e.message:'阈值加载失败'}finally{busy.value=false}}
async function toggle(id:number){try{await api.toggleAlertRule(id);await load()}catch(e){showError(e)}}
async function remove(id:number){if(!(await confirmAction('删除主体阈值','删除后该指标将恢复使用平台预置规则。')))return;try{await api.deleteAlertRule(id);await load()}catch(e){showError(e)}}
</script>
<template>
  <view class="page pad">
    <view class="toolbar">
      <view class="toolbar-main"><text class="toolbar-title">{{(view?.effective||[]).length}} 条规则生效中</text><text class="toolbar-sub">主体规则优先于平台预置规则</text></view>
      <view class="toolbar-actions"><button class="btn btn-sm btn-primary" @tap="go('/pages/threshold/edit')">新增阈值</button></view>
    </view>
    <view class="sticky-head"><SegTabs v-model="tab" :options="[['effective','生效规则'],['tenant','我的规则'],['platform','平台预置'],['risk','风险读数']]"/></view>
    <view v-if="error" class="error" @tap="load">{{error}}<text class="retry">点击重试</text></view>
    <view v-if="!view&&!error" class="loading">正在加载阈值…</view>
    <view v-if="view&&tab!=='risk'" class="list">
      <view v-for="r in (view[tab]||[])" :key="r.id" class="list-item column">
        <view class="item-head"><text class="item-title">{{r.ruleName}}</text><text class="tag" :class="r.enabled?'green':'gray'">{{r.enabled?'启用':'停用'}}</text></view>
        <view class="kv-grid"><view><text>条件</text><text class="kv-value">{{r.metricName}} {{r.operator}} {{r.threshold}}</text></view><view><text>持续</text><text class="kv-value">{{r.durationSeconds}} 秒</text></view><view><text>等级</text><text class="kv-value">{{levelLabel(r.level)}}</text></view></view>
        <text class="item-meta">{{r.deviceType||'全部设备'}} · {{r.source==='platform'?'平台预置':'主体规则'}}{{r.remark?' · '+r.remark:''}}</text>
        <view v-if="r.source==='tenant'" class="item-actions"><button class="btn btn-sm" @tap="go('/pages/threshold/edit?id='+r.id)">编辑</button><button class="btn btn-sm" @tap="toggle(r.id)">{{r.enabled?'停用':'启用'}}</button><button class="btn btn-sm btn-danger" @tap="remove(r.id)">删除</button></view>
      </view>
      <view v-if="!(view[tab]||[]).length" class="empty">暂无规则</view>
    </view>
    <view v-if="tab==='risk'" class="list">
      <view v-for="r in risk" :key="r.deviceId+'-'+r.metricKey" class="list-item column">
        <view class="item-head"><text class="item-title">{{r.deviceName}} · {{r.metricName}}</text><text class="tag red">{{levelLabel(r.level)}}</text></view>
        <view class="kv-grid"><view><text>读数</text><text class="kv-value">{{r.value}} {{r.unit}}</text></view><view><text>阈值</text><text class="kv-value">{{r.operator}} {{r.threshold}}</text></view><view><text>持续条件</text><text class="kv-value">{{r.sustained?'已满足':'未满足'}}</text></view></view>
        <text class="tiny">{{r.recordedAt}}</text>
      </view>
      <view v-if="!risk.length&&!busy" class="empty">暂无越线风险读数</view>
    </view>
  </view>
</template>

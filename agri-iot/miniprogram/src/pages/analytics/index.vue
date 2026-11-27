<script setup lang="ts">
import {ref} from 'vue'
import {onShow} from '@dcloudio/uni-app'
import {shareCsv} from '../../utils/report'
import {showError} from '../../utils/ui'
import {api,type Row} from '../../api/iot'
const data=ref<Row|null>(null),error=ref(''),busy=ref(false)
onShow(load)
async function load(){busy.value=true;try{data.value=await api.reports();error.value=''}catch(e){error.value=e instanceof Error?e.message:'分析加载失败'}finally{busy.value=false}}
const exporting=ref(false)
async function exportCsv(){if(!data.value||exporting.value)return;exporting.value=true;try{await shareCsv('物联网运行报表',[['日期','采集量','控制次数'],...(data.value.daily||[]).map((r:Row)=>[r.date,r.data,r.control])])}catch(e){showError(e)}finally{exporting.value=false}}

</script>
<template>
  <view class="page pad">
    <view class="toolbar">
      <view class="toolbar-main"><text class="toolbar-title">运行数据概览</text><text class="toolbar-sub">采集、在线、告警与控制统计</text></view>
      <view class="toolbar-actions"><button class="btn btn-sm" :disabled="!data||exporting" :loading="exporting" @tap="exportCsv">分享 CSV</button></view>
    </view>
    <view v-if="error" class="error" @tap="load">{{error}}<text class="retry">点击重试</text></view>
    <template v-if="data">
      <view class="card"><view class="metric-grid"><view><text class="muted">采集数据点</text><text class="value">{{data.summary.dataPoints}}</text></view><view><text class="muted">在线率</text><text class="value">{{data.summary.onlineRate}}%</text></view><view><text class="muted">告警数</text><text class="value">{{data.summary.alerts}}</text></view><view><text class="muted">控制次数</text><text class="value">{{data.summary.controls}}</text></view></view></view>
      <view class="card"><view class="card-head"><text class="card-title">日趋势</text></view><view v-for="r in data.daily" :key="r.date" class="field"><text>{{r.date}}</text><text class="muted">采集 {{r.data}} · 控制 {{r.control}}</text></view><text v-if="!data.daily?.length" class="muted">暂无数据</text></view>
      <view class="card"><view class="card-head"><text class="card-title">设备类型排行</text></view><view v-for="(r,index) in data.rank" :key="r.name" class="field"><text><text class="rank" :class="{top:index<3}">{{index+1}}</text>{{r.name}}</text><text class="muted">{{r.type}} · {{r.readings}} 点</text></view><text v-if="!data.rank?.length" class="muted">暂无数据</text></view>
    </template>
    <view v-else-if="!error" class="loading">正在加载分析数据…</view>
  </view>
</template>
<style scoped>.rank{display:inline-flex;width:40rpx;height:40rpx;margin-right:12rpx;align-items:center;justify-content:center;border-radius:10rpx;background:#eef2ef;color:#666666;font-size:24rpx}.rank.top{background:#e5f5eb;color:#12764a;font-weight:700}</style>

<script setup lang="ts">
import {ref} from 'vue'
import {onShow} from '@dcloudio/uni-app'
import {api,type Row} from '../../api/iot'
const data=ref<Row|null>(null),error=ref(''),busy=ref(false)
onShow(load)
async function load(){busy.value=true;try{data.value=await api.reports();error.value=''}catch(e){error.value=e instanceof Error?e.message:'分析加载失败'}finally{busy.value=false}}
function exportCsv(){if(!data.value)return;const rows=[['日期','采集量','控制次数'],...(data.value.daily||[]).map((r:Row)=>[r.date,r.data,r.control])];const csv='\ufeff'+rows.map((r:unknown[])=>r.map((x:unknown)=>`"${String(x??'').replaceAll('"','""')}"`).join(',')).join('\n');const fs=(uni as any).getFileSystemManager?.();if(fs){const path=(`${(uni as any).env?.USER_DATA_PATH||'_doc'}/iot-report.csv`);fs.writeFile({filePath:path,data:csv,encoding:'utf8',success:()=>uni.showToast({title:'报表已导出'}),fail:()=>uni.showToast({title:'当前端暂不支持文件导出',icon:'none'})})}else uni.showToast({title:'当前端暂不支持文件导出',icon:'none'})}
</script>
<template>
  <view class="page pad">
    <view class="toolbar">
      <view class="toolbar-main"><text class="toolbar-title">运行数据概览</text><text class="toolbar-sub">采集、在线、告警与控制统计</text></view>
      <view class="toolbar-actions"><button class="btn btn-sm" :disabled="!data" @tap="exportCsv">导出 CSV</button></view>
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
<style scoped>.rank{display:inline-flex;width:40rpx;height:40rpx;margin-right:12rpx;align-items:center;justify-content:center;border-radius:10rpx;background:#eef2ef;color:#718277;font-size:24rpx}.rank.top{background:#e5f5eb;color:#12764a;font-weight:700}</style>

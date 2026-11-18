<script setup lang="ts">
import {ref} from 'vue'
import {onLoad} from '@dcloudio/uni-app'
import {api,type Row} from '../../api/iot'
import {showError} from '../../utils/ui'
const id=ref(0),config=ref<Row|null>(null),busy=ref(false),error=ref('')
const defaultEnabled=ref(false)
onLoad(o=>{id.value=Number(o?.id);void load()})
async function load(){if(busy.value)return;busy.value=true;try{config.value=await api.sampling(id.value);defaultEnabled.value=config.value.intervalSeconds!=null;error.value=''}catch(e){error.value=e instanceof Error?e.message:'采样配置加载失败'}finally{busy.value=false}}
type SamplingField='intervalSeconds'|'toleranceSeconds'
// 开关与草稿分离；关闭再开启不会丢失用户已填的周期和容差。
function setDefault(event:any){
 if(busy.value||!config.value||typeof event?.detail?.value!=='boolean')return
 defaultEnabled.value=event.detail.value
 if(defaultEnabled.value&&config.value.intervalSeconds==null){config.value.intervalSeconds=30;config.value.toleranceSeconds=0}
}
function setMetricEnabled(metricKey:string,event:any){
 if(busy.value||typeof event?.detail?.value!=='boolean')return
 const metric=config.value?.metrics.find((item:Row)=>item.metricKey===metricKey)
 if(!metric)return
 metric.enabled=event.detail.value
 if(metric.enabled&&metric.intervalSeconds==null){metric.intervalSeconds=30;metric.toleranceSeconds=0}
}
function setDefaultField(field:SamplingField,event:any){
 if(!busy.value&&config.value&&defaultEnabled.value)config.value[field]=event.detail.value
}
function setMetricField(metricKey:string,field:SamplingField,event:any){
 if(busy.value)return
 const metric=config.value?.metrics.find((item:Row)=>item.metricKey===metricKey)
 if(metric?.enabled)metric[field]=event.detail.value
}
function integer(value:any,min:number,max:number,label:string){if((typeof value!=='number'&&typeof value!=='string')||String(value).trim()===''||!/^\d+$/.test(String(value).trim())||!Number.isSafeInteger(Number(value))||Number(value)<min||Number(value)>max)throw new Error(label+'须为 '+min+'～'+max+' 的整数秒');return Number(value)}
function policy(interval:any,tolerance:any,label:string){if(interval==null)return {intervalSeconds:null,toleranceSeconds:0};const seconds=integer(interval,1,86400,label+'周期');return {intervalSeconds:seconds,toleranceSeconds:integer(tolerance,0,seconds,label+'容差')}}
async function save(){if(busy.value||!config.value)return;try{
 const body={...policy(defaultEnabled.value?config.value.intervalSeconds:null,config.value.toleranceSeconds,'默认'),metrics:config.value.metrics.map((m:any)=>{
  if(m.enabled&&m.intervalSeconds==null)throw new Error(m.metricName+'请先填写独立周期')
  return {metricKey:m.metricKey,enabled:!!m.enabled,...policy(m.enabled?m.intervalSeconds:null,m.toleranceSeconds,m.metricName)}
 })}
 busy.value=true;config.value=await api.saveSampling(id.value,body);defaultEnabled.value=config.value.intervalSeconds!=null;uni.showToast({title:'采样配置已保存'})
}catch(e){showError(e)}finally{busy.value=false}}
</script>
<template>
  <view class="page pad has-footer">
    <view v-if="error" class="error" @tap="load">{{error}}<text class="retry">点击重试</text></view>
    <view v-if="!config&&!error" class="loading">正在加载采样配置…</view>
    <template v-if="config">
      <view class="card">
        <view class="card-head"><text class="card-title">默认采样策略</text></view>
        <view class="field"><text>启用默认周期</text><switch id="sampling-default-toggle" :disabled="busy" color="#12764a" :checked="defaultEnabled" @change="setDefault($event)"/></view>
        <view v-if="defaultEnabled" class="form-item gap"><text class="form-label">默认周期（秒）</text><input id="sampling-default-interval" :disabled="busy" class="input" type="number" :value="config.intervalSeconds" @input="setDefaultField('intervalSeconds',$event)"/></view>
        <view v-if="defaultEnabled" class="form-item gap"><text class="form-label">默认容差（秒）</text><input id="sampling-default-tolerance" :disabled="busy" class="input" type="number" :value="config.toleranceSeconds" @input="setDefaultField('toleranceSeconds',$event)"/></view>
        <text class="tiny block">{{config.fallbackDescription}}</text><text class="tiny block">用于平台告警连续性判定，保存不会调整设备实际采样频率。容差不能超过对应周期。</text>
      </view>
      <view class="section-title"><text>指标采样</text><text class="link">{{config.metrics?.length||0}} 项</text></view>
      <view v-for="m in config.metrics" :key="m.metricKey" class="card">
        <view class="item-head"><text class="card-title">{{m.metricName}}</text></view>
        <view class="field"><text>独立采样周期</text><switch :id="'sampling-metric-toggle-'+m.metricKey" :disabled="busy" color="#12764a" :checked="m.enabled" @change="setMetricEnabled(m.metricKey,$event)"/></view>
        <view v-if="m.enabled" class="form-item gap"><text class="form-label">采样周期（秒）</text><input :id="'sampling-metric-interval-'+m.metricKey" :disabled="busy" class="input" type="number" :value="m.intervalSeconds" @input="setMetricField(m.metricKey,'intervalSeconds',$event)"/></view>
        <view v-if="m.enabled" class="form-item gap"><text class="form-label">容差（秒）</text><input :id="'sampling-metric-tolerance-'+m.metricKey" :disabled="busy" class="input" type="number" :value="m.toleranceSeconds" @input="setMetricField(m.metricKey,'toleranceSeconds',$event)"/></view>
        <text class="tiny block">已保存生效周期 {{m.effectiveIntervalSeconds??'未配置'}} 秒 · 最大间隔 {{m.maxGapSeconds??'—'}} 秒</text>
      </view>
      <view class="footer-bar"><button id="sampling-save" class="btn btn-primary" :disabled="busy" :loading="busy" @tap="save">保存采样策略</button></view>
    </template>
  </view>
</template>
<style scoped>.gap{margin-top:18rpx;margin-bottom:12rpx}</style>

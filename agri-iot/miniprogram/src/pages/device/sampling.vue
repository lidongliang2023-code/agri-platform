<script setup lang="ts">
import {ref} from 'vue'
import {onLoad} from '@dcloudio/uni-app'
import {api,type Row} from '../../api/iot'
import {showError} from '../../utils/ui'
const id=ref(0),config=ref<Row|null>(null),busy=ref(false),error=ref('')
onLoad(o=>{id.value=Number(o?.id);void load()})
async function load(){busy.value=true;try{config.value=await api.sampling(id.value);error.value=''}catch(e){error.value=e instanceof Error?e.message:'采样配置加载失败'}finally{busy.value=false}}
function boolValue(event:any){return Boolean(event?.detail?.value)}
function setDefault(event:any){if(config.value)config.value.intervalSeconds=boolValue(event)?30:null}
function setMetric(m:any,event:any){m.intervalSeconds=boolValue(event)?30:null}
function setMetricEnabled(m:any,event:any){m.enabled=boolValue(event)}
function inputValue(event:any){return event?.detail?.value}
function validate(interval:any,tolerance:any,label:string){if(interval!=null&&(!Number.isInteger(Number(interval))||Number(interval)<1||Number(interval)>86400))throw new Error(label+'周期须为 1～86400 的整数秒');if(!Number.isInteger(Number(tolerance))||Number(tolerance)<0||Number(tolerance)>86400)throw new Error(label+'容差须为 0～86400 的整数秒')}
async function save(){if(busy.value||!config.value)return;try{const body=JSON.parse(JSON.stringify(config.value));validate(body.intervalSeconds,body.toleranceSeconds,'默认');body.intervalSeconds=body.intervalSeconds==null?null:Number(body.intervalSeconds);body.toleranceSeconds=Number(body.toleranceSeconds);for(const m of body.metrics){validate(m.intervalSeconds,m.toleranceSeconds,m.metricName);m.intervalSeconds=m.intervalSeconds==null?null:Number(m.intervalSeconds);m.toleranceSeconds=Number(m.toleranceSeconds)}busy.value=true;config.value=await api.saveSampling(id.value,body);uni.showToast({title:'采样配置已保存'})}catch(e){showError(e)}finally{busy.value=false}}

</script>
<template>
  <view class="page pad has-footer">
    <view v-if="error" class="error" @tap="load">{{error}}<text class="retry">点击重试</text></view>
    <view v-if="!config&&!error" class="loading">正在加载采样配置…</view>
    <template v-if="config">
      <view class="card">
        <view class="card-head"><text class="card-title">默认采样策略</text></view>
        <view class="field"><text>启用默认周期</text><switch color="#12764a" :checked="config.intervalSeconds!=null" @change="setDefault($event)"/></view>
        <view v-if="config.intervalSeconds!=null" class="form-item gap"><text class="form-label">默认周期（秒）</text><input class="input" type="number" v-model="config.intervalSeconds"/></view>
        <view class="form-item gap"><text class="form-label">默认容差（秒）</text><input class="input" type="number" v-model="config.toleranceSeconds"/></view>
        <text class="tiny block">{{config.fallbackDescription}}</text>
      </view>
      <view class="section-title"><text>指标采样</text><text class="link">{{config.metrics?.length||0}} 项</text></view>
      <view v-for="m in config.metrics" :key="m.metricKey" class="card">
        <view class="item-head"><text class="card-title">{{m.metricName}}</text><switch color="#12764a" :checked="m.enabled" @change="setMetricEnabled(m,$event)"/></view>
        <view class="field"><text>独立周期</text><switch color="#12764a" :checked="m.intervalSeconds!=null" @change="setMetric(m,$event)"/></view>
        <view v-if="m.intervalSeconds!=null" class="form-item gap"><text class="form-label">采样周期（秒）</text><input class="input" type="number" v-model="m.intervalSeconds"/></view>
        <view class="form-item gap"><text class="form-label">容差（秒）</text><input class="input" type="number" v-model="m.toleranceSeconds"/></view>
        <text class="tiny block">当前生效周期 {{m.effectiveIntervalSeconds??'未配置'}} 秒 · 最大间隔 {{m.maxGapSeconds??'—'}} 秒</text>
      </view>
      <view class="footer-bar"><button class="btn btn-primary" :disabled="busy" :loading="busy" @tap="save">保存采样策略</button></view>
    </template>
  </view>
</template>
<style scoped>.gap{margin-top:18rpx;margin-bottom:12rpx}</style>

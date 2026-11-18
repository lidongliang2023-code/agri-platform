<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {onLoad} from '@dcloudio/uni-app'
import {api,type Row} from '../../api/iot'
import BusinessForm,{type Field} from '../../components/BusinessForm.vue'
import {showError} from '../../utils/ui'
const form=ref<Row>({metricKey:'',deviceType:null,value:''}),options=ref<Row>({metrics:[],deviceTypes:[]}),result=ref<Row|null>(null),busy=ref(false),loaded=ref(false),error=ref('')
const fields=computed<Field[]>(()=>[{key:'metricKey',label:'试算指标',type:'select',required:true,options:options.value.metrics.map((m:Row)=>({value:m.key,label:m.name+(m.unit?'（'+m.unit+'）':'')}))},{key:'deviceType',label:'设备类型',type:'select',options:[{value:null,label:'全部设备'},...options.value.deviceTypes.map((t:string)=>({value:t,label:t}))]},{key:'value',label:'当前读数',required:true,hint:'可输入负数或小数'}])
watch(form,()=>{result.value=null},{deep:true})
onLoad(load)
async function load(){try{options.value=await api.alertRuleOptions();loaded.value=true;error.value=''}catch(e){error.value=e instanceof Error?e.message:'指标加载失败'}}
async function evaluate(){if(busy.value||!loaded.value)return;busy.value=true;result.value=null;try{const value=String(form.value.value).trim();if(!form.value.metricKey||!value||!Number.isFinite(Number(value)))throw new Error('请选择指标并输入有效读数');result.value=await api.evaluateAlertRule({...form.value,value:Number(value)})}catch(e){showError(e)}finally{busy.value=false}}
</script>
<template><view class="page pad has-footer"><view v-if="error" class="error" @tap="load">{{error}} · 点击重试</view><view class="notice">按当前经营主体的生效规则进行瞬时试算。不会创建告警或下发控制，持续条件需结合实际采样判断。</view><view v-if="loaded" class="card block"><BusinessForm v-model="form" :fields="fields" :busy="busy" submit-text="计算当前读数" @save="evaluate"/></view><view v-if="result" class="card"><view class="item-head"><text class="card-title">{{result.metricName}} · {{result.value}}</text><text class="tag" :class="result.breached?'orange':'green'">{{result.levelName}}</text></view><text class="block">{{result.note}}</text><view v-for="r in result.matchedRules" :key="r.source+'-'+r.id" class="field"><view><text>{{r.ruleName}}</text><text class="muted block">{{r.operator}} {{r.threshold}} · 持续 {{r.durationSeconds}} 秒</text></view></view><text class="tiny block">{{result.evaluatedAt}}</text></view><view v-if="!loaded&&!error" class="loading">正在加载指标…</view></view></template>

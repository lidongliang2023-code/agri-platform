<script setup lang="ts">
import { computed,ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api,statusMeta,type Alert } from '../../api/iot'
import SegTabs from '../../components/SegTabs.vue'
const items=ref<Alert[]>([]),tab=ref('all'),handling=ref(false),loading=ref(false),error=ref('')
onShow(load)
async function load(){loading.value=true;try{items.value=await api.alerts();error.value=''}catch(e){error.value=e instanceof Error?e.message:'加载失败'}finally{loading.value=false}}
const count=(status:string)=>items.value.filter(i=>i.status===status).length
const tabs=computed<Array<[string,string]>>(()=>[['all','全部'],['pending',`待处理 ${count('pending')}`],['handling',`处理中 ${count('handling')}`],['resolved','已处理']])
const visible=computed(()=>tab.value==='all'?items.value:items.value.filter(i=>i.status===tab.value))
async function handle(item:Alert){
  if(handling.value)return
  const next=item.status==='pending'?'handling':'resolved'
  uni.showModal({title:next==='handling'?'受理告警':'完成处置',editable:true,placeholderText:'填写4至200字实际处置说明',content:'',success:async r=>{
    if(!r.confirm)return
    const note=(r.content||'').trim()
    if(note.length<4||note.length>200){uni.showToast({title:'请填写4至200字实际处置说明',icon:'none'});return}
    handling.value=true
    try{await api.handleAlert(item.id,note,next);uni.showToast({title:'处置记录已保存',icon:'success'});await load()}
    catch(e){uni.showToast({title:e instanceof Error?e.message:'处置失败',icon:'none'})}
    finally{handling.value=false}
  }})
}
</script>
<template>
  <view class="page pad">
    <view class="toolbar">
      <view class="toolbar-main"><text class="toolbar-title">{{items.filter(i=>i.status!=='resolved').length}} 条告警待处理</text><text class="toolbar-sub">环境越线、设备离线与数据异常</text></view>
      <view class="toolbar-actions"><button class="btn btn-sm" :disabled="loading" @tap="load">刷新</button></view>
    </view>
    <view class="sticky-head"><SegTabs v-model="tab" :options="tabs"/></view>
    <view v-if="error" class="error" @tap="load">{{error}}<text class="retry">点击重试</text></view>
    <view v-if="loading&&!items.length" class="loading">正在加载告警…</view>
    <view v-else class="list">
      <view v-for="item in visible" :key="item.id" class="list-item column">
        <view class="item-head"><text class="item-title">{{item.title}}</text><text class="tag" :class="statusMeta(item.level).tone">{{statusMeta(item.level).label}}</text></view>
        <text class="item-meta">{{item.deviceName}} · {{item.content}}</text>
        <view class="kv-grid"><view><text>触发值</text><text class="kv-value">{{item.triggerValue}}</text></view><view><text>阈值</text><text class="kv-value">{{item.thresholdValue}}</text></view><view><text>状态</text><text class="kv-value">{{statusMeta(item.status).label}}</text></view></view>
        <text class="tiny">{{item.alertNo}} · {{item.createdAt}}</text>
        <text v-if="item.status==='resolved'&&item.handleNote" class="item-text">处置说明：{{item.handleNote}}</text>
        <view v-if="item.status!=='resolved'" class="item-actions"><button class="btn btn-sm btn-primary" :loading="handling" @tap="handle(item)">{{item.status==='pending'?'受理告警':'完成处置'}}</button></view>
      </view>
      <view v-if="!visible.length&&!error" class="empty">暂无告警</view>
    </view>
  </view>
</template>

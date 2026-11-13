<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api,statusMeta,type Alert } from '../../api/iot'
const items=ref<Alert[]>([]),tab=ref('all'),handling=ref(false)
onShow(load)
async function load(){try{items.value=await api.alerts()}catch(e){uni.showToast({title:e instanceof Error?e.message:'加载失败',icon:'none'})}}
const visible=()=>tab.value==='all'?items.value:items.value.filter(i=>i.status===tab.value)
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
<template><view class="page pad"><view class="between"><view><text class="page-title">预警中心</text><text class="tiny">环境、设备离线与数据异常</text></view><text class="tag red">{{items.filter(i=>i.status!=='resolved').length}} 待处理</text></view><view class="tabs"><button v-for="t in [['all','全部'],['pending','待处理'],['handling','处理中'],['resolved','已处理']]" :key="t[0]" :class="{on:tab===t[0]}" @click="tab=t[0]">{{t[1]}}</button></view><view class="alert-list"><view class="alert" v-for="item in visible()" :key="item.id"><view class="between"><text class="tag" :class="statusMeta(item.level).tone">{{statusMeta(item.level).label}}</text><text class="tag" :class="statusMeta(item.status).tone">{{statusMeta(item.status).label}}</text></view><text class="alert-title">{{item.title}}</text><text class="muted">{{item.deviceName}} · {{item.content}}</text><view class="values"><view><text>触发值</text><b>{{item.triggerValue}}</b></view><view><text>阈值</text><b>{{item.thresholdValue}}</b></view><view><text>时间</text><b>{{item.createdAt}}</b></view></view><view class="footer"><text class="tiny">{{item.alertNo}}</text><button v-if="item.status!=='resolved'" class="btn btn-sm btn-primary" :loading="handling" @click="handle(item)">{{item.status==='pending'?'受理告警':'完成处置'}}</button><text v-else class="tiny">{{item.handleNote}}</text></view></view></view></view></template>
<style lang="scss" scoped>.page-title{display:block;font-size:38rpx;font-weight:750}.tabs{display:flex;gap:8rpx;margin:18rpx 0}.tabs button{padding:10rpx 18rpx;border-radius:22rpx;background:#e9f0ec;color:#718277;font-size:24rpx}.tabs button.on{background:#12764a;color:#fff}.alert-list{display:flex;flex-direction:column;gap:13rpx}.alert{display:flex;flex-direction:column;gap:8rpx;padding:20rpx;border:1rpx solid #e1e9e3;border-radius:20rpx;background:#fff}.alert-title{font-size:25rpx;font-weight:650}.values{display:grid;grid-template-columns:repeat(3,1fr);gap:8rpx;margin-top:5rpx;padding:12rpx;border-radius:12rpx;background:#f7faf8}.values>view{display:flex;flex-direction:column;gap:3rpx}.values text{color:#94a198;font-size:24rpx}.values b{font-size:24rpx}.footer{display:flex;align-items:center;justify-content:space-between;margin-top:5rpx}</style>

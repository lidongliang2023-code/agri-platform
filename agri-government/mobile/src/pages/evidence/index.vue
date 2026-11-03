<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { api, type Evidence } from '../../api'
const taskNo=ref(''),description=ref(''),saving=ref(false),saved=ref<Evidence|null>(null)
const type=ref('现场照片'),offline=ref(false),list=ref<Evidence[]>([])
onLoad(o=>taskNo.value=String(o?.taskNo||''))
onShow(refresh)
async function refresh(){try{list.value=await api.evidenceList()}catch(e){uni.showToast({title:e instanceof Error?e.message:'取证记录加载失败',icon:'none'})}}
/** 现场素材只取本机路径做说明留痕：服务端落的是证据类型、说明与 SHA-256 摘要。 */
function capture(kind:string){type.value=kind
  if(kind==='现场照片'){uni.chooseImage({count:1,sourceType:['camera','album'],success:r=>{const p=String(r.tempFilePaths[0]||'');description.value+=`【现场照片 ${p.slice(-18)}】`}})}
  else uni.showToast({title:`已切换证据类型为「${kind}」`,icon:'none'})}
async function save(){
  if(!description.value.trim())return uni.showToast({title:'请填写取证说明',icon:'none'})
  saving.value=true
  try{
    saved.value=await api.evidence({taskNo:taskNo.value,description:description.value.trim(),evidenceType:type.value,uploaded:!offline.value})
    description.value='';uni.showToast({title:offline.value?'证据已离线暂存':'证据已保存并生成摘要',icon:'success'});refresh()
  }catch(e){uni.showToast({title:e instanceof Error?e.message:'保存失败',icon:'none'})}finally{saving.value=false}
}
function detail(item:Evidence){uni.showModal({title:item.evidenceNo,content:`类型：${item.evidenceType}\n关联任务：${item.taskNo||'未关联'}\n状态：${item.uploaded?'已上传':'离线暂存'}\n说明：${item.description}\n摘要：${item.evidenceHash}`,showCancel:false})}
function setOffline(event:Event){offline.value=Boolean((event as unknown as {detail?:{value?:boolean}}).detail?.value)}
</script>
<template><view class="page pad"><view class="card"><view class="card-head"><text class="card-title">现场取证</text><text class="tiny">{{ taskNo || '未关联任务（可按任务号补关联）' }}</text></view><view class="evidence-grid"><button @click="capture('现场照片')"><text>📷</text><text>拍照取证</text></button><button @click="capture('现场录音')"><text>🎙️</text><text>录音取证</text></button><button @click="capture('现场视频')"><text>🎬</text><text>视频取证</text></button><button @click="capture('书面材料')"><text>📄</text><text>材料扫描</text></button></view><view class="switch-row"><text class="form-label">当前证据类型</text><text class="strong">{{type}}</text></view><view class="switch-row"><text class="form-label">离线暂存（现场无网络）</text><switch :checked="offline" @change="setOffline"/></view><view class="form-item"><text class="form-label">取证说明</text><textarea class="textarea" v-model="description" placeholder="记录证据位置、现场情况和关联违法行为"/></view><button class="btn btn-primary btn-block" :loading="saving" @click="save">保存证据并生成哈希</button><view v-if="saved" class="saved"><text class="tag green">✓ 已入库 {{saved.evidenceNo}}</text><text>证据摘要 {{saved.evidenceHash}}</text><text>保存时间 {{saved.capturedAt}} · {{saved.uploaded?'已上传':'离线暂存'}}</text></view></view><view class="card"><view class="card-head"><text class="card-title">我的取证记录</text><text class="card-sub">{{list.length}} 条 · 全程留痕</text></view><view v-if="!list.length" class="empty"><text class="empty-icon">🗂</text><text>还没有取证记录</text></view><view class="chain"><view v-for="item in list.slice(0,8)" :key="item.id" @click="detail(item)"><text>✓</text><view><b>{{item.evidenceType}} · {{item.evidenceNo}}</b><small>{{item.taskNo||'未关联任务'}} · {{item.capturedAt}} · {{item.uploaded?'已上传':'离线暂存'}}</small></view></view></view></view></view></template>
<style lang="scss" scoped>.evidence-grid{display:grid;grid-template-columns:1fr 1fr;gap:12rpx;margin-bottom:20rpx}.evidence-grid button{display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8rpx;padding:22rpx;border:1rpx dashed #cbd8cf;border-radius:18rpx;background:#f2fbf5}.evidence-grid button text:first-child{font-size:36rpx}.evidence-grid button text:last-child{color:#53665a;font-size:20rpx}.switch-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:12rpx}.form-label{color:#53665a;font-size:21rpx}.saved{display:flex;flex-direction:column;gap:6rpx;margin-top:16rpx;padding:15rpx;border-radius:13rpx;background:#f2fbf5;font-size:19rpx}.chain>view{display:grid;grid-template-columns:36rpx 1fr;gap:2px 10rpx;padding:13rpx 0;border-bottom:1rpx solid #edf2ee}.chain>view>text{grid-row:1/span 2;display:flex;width:34rpx;height:34rpx;align-items:center;justify-content:center;border-radius:50%;background:#12764a;color:#fff;font-size:18rpx}.chain b{font-size:21rpx}.chain small{color:#94a198;font-size:18rpx}</style>

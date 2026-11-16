<script setup lang="ts">
import { onLoad,onShow } from '@dcloudio/uni-app'
import { requireTradeLogin, getTradeRole } from '../../auth'
import { ref, computed } from 'vue'
import { money, tradeApi, uploadContractEvidence, type TradeContract } from '../../api'
import { getTradeUser } from '../../auth'
const row = ref<TradeContract | null>(null)
const loading = ref(true)
const submitting = ref(false)
const uploading = ref(false)
const loadError = ref('')
const signerName = ref(getTradeUser()?.nickname || getTradeUser()?.username || '')
const evidence = ref('')
const confirmed = ref(false)
const role = ref(getTradeRole())
const merchantIds = ref<string[]>([])
const canSign = computed(() => !!row.value && row.value.contractStatus !== 'cancelled'
  && merchantIds.value.includes(String(row.value[role.value === 'buyer' ? 'buyerId' : 'sellerId']))
  && row.value[role.value === 'buyer' ? 'buyerSignStatus' : 'sellerSignStatus'] !== 'signed'
  && !(role.value === 'seller' && merchantIds.value.includes(String(row.value.buyerId)) && row.value.buyerSignStatus !== 'signed'))
let id = 0
onLoad((options?: Record<string,string>) => { id = Number(options?.id) })
onShow(()=>{role.value=getTradeRole();row.value=null;evidence.value='';confirmed.value=false;void load()})
async function load() { if (!requireTradeLogin()) return; loading.value = true; loadError.value = ''; try { if (!Number.isFinite(id) || id <= 0) throw new Error('合同链接无效'); const [contract, merchants] = await Promise.all([tradeApi.contract(id), tradeApi.merchants()]); merchantIds.value=merchants.map(item=>String(item.merchantId)); if (!contract) throw new Error('合同不存在或不可访问'); if(!merchantIds.value.includes(String(contract[role.value==='buyer'?'buyerId':'sellerId']))) throw new Error('该合同不属于当前中心，请在“我的”切换中心后查看'); row.value=contract } catch (error) { loadError.value = error instanceof Error ? error.message : '合同加载失败' } finally { loading.value = false } }
async function chooseEvidence() {
  if (!canSign.value || uploading.value || submitting.value) return
  uploading.value = true
  try {
    const path = await new Promise<string>((resolve,reject) => uni.chooseImage({ count:1, sizeType:['compressed'], success:(res:any) => resolve(res.tempFilePaths[0]), fail:reject }))
    evidence.value = await uploadContractEvidence(id,path)
    uni.showToast({ title:'签章凭证已上传', icon:'success' })
  } catch (error) { uni.showToast({ title:error instanceof Error ? error.message : '上传未完成', icon:'none' }) } finally { uploading.value = false }
}
async function sign() {
  if(!canSign.value || submitting.value || uploading.value)return
  if (!signerName.value.trim() || !evidence.value || !confirmed.value) { uni.showToast({ title:'请填写签署人、上传凭证并确认合同内容', icon:'none' }); return }
  submitting.value = true
  try { await tradeApi.signContract(id,signerName.value.trim(),evidence.value); uni.showToast({ title:'签署成功', icon:'success' }); await load() } catch (error) { uni.showToast({ title:error instanceof Error ? error.message : '签署失败', icon:'none' }) } finally { submitting.value = false }
}
</script>
<template>
  <view class="page">
    <view v-if="loading && !row" class="loading">正在加载合同…</view>
    <view v-else-if="loadError" class="load-error"><text>{{ loadError }}</text><button class="btn btn-ghost" @tap="load">重新加载合同</button></view>
    <template v-else-if="row">
      <view class="card">
        <text class="title">{{ row.contractName }}</text>
        <text class="tiny mono">{{ row.contractNo }}</text>
        <view class="kv first"><text class="kv-label">买方</text><text class="kv-value">{{ row.buyerName }}</text></view>
        <view class="kv"><text class="kv-label">卖方</text><text class="kv-value">{{ row.sellerName }}</text></view>
        <view class="kv"><text class="kv-label">合同金额</text><text class="kv-value price">{{ money(row.contractAmount) }}</text></view>
        <view class="kv"><text class="kv-label">签署状态</text><view class="kv-value sign-tags"><text class="tag" :class="row.buyerSignStatus === 'signed' ? '' : 'gray'">买方 {{ row.buyerSignStatus === 'signed' ? '已签' : '未签' }}</text><text class="tag" :class="row.sellerSignStatus === 'signed' ? '' : 'gray'">卖方 {{ row.sellerSignStatus === 'signed' ? '已签' : '未签' }}</text></view></view>
      </view>
      <view class="card"><text class="card-title">合同正文</text><text class="content">{{ row.contractContent || '合同条款由订单自动生成，请核对交易双方、货品、金额与交付信息。' }}</text></view>
      <view v-if="role === 'seller' && merchantIds.includes(String(row.buyerId)) && row.buyerSignStatus !== 'signed'" class="notice">当前账号同时代表双方，请先在买家中心完成买方签署，再在卖家中心签署。</view>
      <view v-if="canSign" class="card">
        <text class="card-title">{{ role === 'buyer' ? '买方签署合同' : '卖方签署合同' }}</text>
        <view class="form-item"><text class="form-label">签署人<text class="req"> *</text></text><input class="input" v-model="signerName" placeholder="请输入签署人姓名" /></view>
        <view class="form-item">
          <text class="form-label">签章凭证<text class="req"> *</text></text>
          <button class="btn btn-line btn-block" :loading="uploading" :disabled="uploading || submitting" @tap="chooseEvidence">{{ uploading ? '正在上传…' : evidence ? '✓ 已上传，点此重新上传' : '上传签章图片' }}</button>
        </view>
        <view class="confirm" @tap="confirmed = !confirmed"><text class="box" :class="{ on: confirmed }">{{ confirmed ? '✓' : '' }}</text><text>我已核对合同内容并同意签署</text></view>
        <button class="btn btn-primary btn-block" :loading="submitting" :disabled="submitting || uploading" @tap="sign">确认签署</button>
      </view>
    </template>
  </view>
</template>
<style scoped lang="scss">
.title { display: block; margin-bottom: 8rpx; font-size: 32rpx; font-weight: 700; line-height: 1.4; }
.kv.first { margin-top: 12rpx; }
.sign-tags { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 10rpx; }
.card-title { display: block; margin-bottom: 16rpx; }
.content { display: block; color: var(--c-text-2); font-size: 26rpx; line-height: 1.8; white-space: pre-wrap; }
.confirm { display: flex; min-height: 88rpx; align-items: center; gap: 16rpx; margin-bottom: 16rpx; color: var(--c-text-2); font-size: 26rpx; }
.box { display: flex; width: 40rpx; height: 40rpx; flex-shrink: 0; align-items: center; justify-content: center; border: 2rpx solid #b8c3bc; border-radius: 10rpx; color: #fff; font-size: 26rpx; }
.box.on { border-color: var(--c-primary); background: var(--c-primary); }
</style>
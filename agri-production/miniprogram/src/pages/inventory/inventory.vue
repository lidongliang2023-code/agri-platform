<template>
  <view class="page">
    <view class="search-bar inventory-search">
      <text class="search-icon">⌕</text><input v-model="keyword" placeholder="搜索品名 / 批次号" confirm-type="search" @confirm="load" /><text v-if="keyword" class="link" @click="keyword = ''; load()">清除</text>
    </view>



    <picker :range="healthOptions" range-key="label" @change="changeHealth"><view class="inventory-meta health-filter">库存状态：{{ healthOptions[healthIndex].label }} ⌄</view></picker>
    <view class="inventory-meta">有效期当天仍有效；次日起为已过期，未来30天内为临期。冻结状态单独显示。</view>
    <view v-if="rows.some(isExpired)" class="permission-note" role="status">
      <text>{{ permissionMessage }}</text>
      <button v-if="permissionState === 'error'" size="mini" @click="checkPermission">重试权限核验</button>
    </view>
    <view v-for="row in rows" :key="row.inventoryId ?? row.id" class="card">
      <view class="row">
        <text class="strong">{{ row.productName || row.category || '未命名' }}</text>
        <view><text class="tag" :style="{ color: healthColor(row) }">{{ healthLabel(row) }}</text><text v-if="isFrozen(row)" class="tag">已冻结</text></view>
      </view>
      <view class="inventory-meta">批次 {{ row.batchNo || '—' }} · 仓库 {{ row.warehouseName || '—' }}</view>
      <view class="inventory-meta">
        当前库存 {{ fmtNumber(row.currentQty, row.unit) }} · 可用 {{ fmtNumber(availableQty(row), row.unit) }}
        <text v-if="isFrozen(row)"> · 已冻结 {{ fmtNumber(row.frozenQty, row.unit) }}</text>
        <text v-if="row.safeQty !== null && row.safeQty !== undefined"> · 安全库存 {{ fmtNumber(row.safeQty, row.unit) }}</text>
        · 有效期至 {{ fmtDate(row.expireDate) }}
      </view>
      <view v-if="isExpired(row)" class="expiry-warning">库存已过期，禁止出库。负责人核实实物及处置凭据后登记过期处置，剩余库存保持冻结。</view>
      <view class="inventory-actions"><button v-if="isExpired(row) && Number(row.currentQty)>0" class="btn-primary btn-sm" :disabled="!canDispose" @click="openAction(row, 'dispose')">{{ canDispose ? '过期处置' : permissionState === 'member' ? '仅负责人可登记' : '权限待核验' }}</button><button class="btn-primary btn-sm" :disabled="isExpired(row)" @click="openAction(row, 'out')">{{ isExpired(row) ? '过期禁出' : '出库' }}</button><button class="btn-ghost btn-sm" @click="openAction(row, 'freeze')">冻结/解冻</button><button class="btn-ghost btn-sm" @click="openAction(row, 'loss')">登记损耗</button><button class="btn-ghost btn-sm" @click="openAction(row, 'transfer')">分仓调拨</button><button class="btn-ghost btn-sm" @click="showHistory(row)">处置与库存流水</button></view>
    </view>
    <view v-if="editor" class="overlay"><view class="sheet-head"><text>{{ editor.title }}</text><button size="mini" :disabled="busy" @click="editor=undefined">取消</button></view><scroll-view scroll-y class="sheet-body"><view class="inventory-meta">批次 {{ editor.row.batchNo }} · {{ editor.row.warehouseName }} · {{ editor.kind === 'dispose' ? '待处置' : '可用' }} {{ fmtNumber(editor.kind === 'dispose' ? editor.row.currentQty : availableQty(editor.row), editor.row.unit) }}</view><business-fields :fields="editor.fields" v-model="form" :disabled="busy" @ready="ready=$event"/><view v-if="actionError" class="error">{{ actionError }}</view></scroll-view><view class="bottom-actions"><button class="primary" :disabled="busy||!ready" :loading="busy" @click="submitAction">确认提交</button></view></view>
    <view v-if="historyRow" class="overlay"><view class="sheet-head"><text>处置与库存流水</text><button size="mini" @click="closeHistory">关闭</button></view><scroll-view scroll-y class="sheet-body"><view class="inventory-meta">{{historyRow.batchNo}} · {{historyRow.warehouseName}}</view><view v-for="item in history" :key="item.flowId" class="card"><view class="strong">{{({1:'入库',2:'出库',3:'调拨',4:'报损'} as any)[item.flowType] || '库存变动'}} {{fmtNumber(item.quantity,item.unit)}}</view><view class="inventory-meta">{{item.operatedAt}} · {{item.operatorName}}</view><view class="inventory-meta">凭据：{{item.orderNo || '—'}}</view><view class="inventory-meta">{{item.remark}}</view></view><view v-if="historyError" class="error">{{historyError}}</view><button v-if="historyError || history.length<historyTotal" :disabled="historyBusy" @click="loadHistory">{{historyError?'重试':'加载更多'}}</button><view v-if="!historyBusy && !history.length && !historyError" class="inventory-meta">暂无流水</view></scroll-view></view>
    <mobile-list-state :loading="loading" :error="error" :count="rows.length" :total="total" :has-more="hasMore" empty-text="暂无匹配库存" @retry="retry" @more="more" />
  </view>
</template>

<script setup lang="ts">
import { ensureWorkspaceSession, isProductionOps } from '@/utils/workspace'
import MobileListState from '@/components/mobile-list-state/mobile-list-state.vue'
import { useMobileList } from '@/composables/use-mobile-list'

import { computed, ref } from 'vue'
import { productionContextVersion, SUBJECT_KEY } from '@/utils/request'
import { onHide, onShow } from '@dcloudio/uni-app'
import { listInventory } from '@/api/production'
import { call, number, note, text, yesno, validateFields } from '@/api/native-business'
import type { Field, Row } from '@/api/native-business'
import BusinessFields from '@/components/business-fields/business-fields.vue'
import { ensureLogin } from '@/utils/auth-helper'
import { fmtDate, fmtNumber } from '@/utils/format'
import { inventoryExpiryState } from '../../../../../packages/agri-shared/src/production/inventory-expiry'


const permissionState = ref<'loading'|'owner'|'member'|'error'>('loading')
const permissionReason = ref(''), permissionTenant = ref('')
let permissionVersion = 0, permissionContext = -1, editorContext = -1
const canDispose = computed(() => permissionState.value === 'owner' && permissionContext === productionContextVersion())
const permissionMessage = computed(() => permissionState.value === 'loading' ? '正在核验当前经营主体的处置权限…' : permissionState.value === 'error' ? '暂时无法核验处置权限，请重试。库存和流水仍可查看。' : permissionReason.value)
async function checkPermission(): Promise<boolean> {
  const version = ++permissionVersion, context = productionContextVersion()
  permissionState.value = 'loading'; permissionTenant.value = ''
  try {
    const result = await call('/harvests/inventory/disposal-permission')
    if (version !== permissionVersion || context !== productionContextVersion()) return false
    const subject = String(uni.getStorageSync(SUBJECT_KEY) || '')
    if (!result.tenantId || (subject && subject !== String(result.tenantId)) || typeof result.allowed !== 'boolean') throw new Error('主体权限不匹配')
    permissionContext = context; permissionTenant.value = String(result.tenantId)
    permissionReason.value = result.reason; permissionState.value = result.allowed ? 'owner' : 'member'
    return result.allowed
  } catch { if (version === permissionVersion) permissionState.value = 'error'; return false }
}
onHide(() => { permissionVersion++; permissionState.value = 'loading'; editor.value = undefined })

const historyRow = ref<Row>(), history = ref<Row[]>([]), historyTotal=ref(0), historyBusy=ref(false), historyError=ref('')
let historyPage=1, historyVersion=0
function closeHistory(){ historyVersion++; historyRow.value=undefined; historyBusy.value=false }
function showHistory(row:Row){ closeHistory(); historyRow.value=row; history.value=[]; historyTotal.value=0; historyPage=1; void loadHistory() }
async function loadHistory(){
  if(!historyRow.value || historyBusy.value)return
  const version=historyVersion, row=historyRow.value; historyBusy.value=true; historyError.value=''
  try { const result=await call(`/harvests/${row.batchId}/flows`,'GET',undefined,{inventoryId:row.inventoryId ?? row.id,pageNum:historyPage,pageSize:20}); if(version!==historyVersion)return
    history.value.push(...(result.list ?? result.records ?? []));historyTotal.value=Number(result.total ?? history.value.length);historyPage++
  }catch(e:any){if(version===historyVersion)historyError.value=e.message || '流水读取失败'}finally{if(version===historyVersion)historyBusy.value=false}
}
const keyword = ref('')
const healthIndex = ref(0)
const healthOptions = [{label:'全部状态',value:''},{label:'已过期',value:'expired'},{label:'临期',value:'expiring'},{label:'库存不足',value:'shortage'},{label:'正常',value:'normal'}]
function changeHealth(event: any) { healthIndex.value = Number(event.detail.value); void load() }
const editor = ref<{ title: string; path: string; fields: Field[]; row: Row; kind: string }>()
const form = ref<Row>({}), ready = ref(false), busy = ref(false), actionError = ref('')
const { rows: rows, loading, error, total, hasMore, reload: load, more, retry, cancel } = useMobileList(async (pageNum, pageSize) => {
  if (!await ensureWorkspaceSession() || isProductionOps()) throw new Error('请切换到用户端查看库存')
  return listInventory({ healthStatus: healthOptions[healthIndex.value].value || undefined, keyword: keyword.value.trim() || undefined, pageNum, pageSize })
}, row => String(row.inventoryId ?? row.id))

/**
 * 健康状态：优先用后端返回的 healthStatus；没有就用"安全库存 / 有效期"这两个**真实字段**判，
 * 两个都缺时显示「—」而不是编一个"正常"。
 */
function healthLabel(row: any): string {
  const expiry = inventoryExpiryState(row.expireDate)
  if (expiry === 'expired' || row.healthStatus === 'expired') return '已过期'
  const backend = row.healthStatus
  if (backend === 'low' || backend === 'shortage') return '库存不足'
  const safe = row.safeQty == null ? NaN : Number(row.safeQty)
  const current = row.currentQty == null ? NaN : Number(row.currentQty)
  if (!backend && Number.isFinite(safe) && Number.isFinite(current) && current <= safe) return '库存不足'
  if (expiry === 'expiring' || backend === 'expiring') return '临期'
  if (backend === 'normal' || expiry === 'normal') return '正常'
  return '—'
}

const isExpired = (row: Row): boolean => inventoryExpiryState(row.expireDate) === 'expired' || row.healthStatus === 'expired'
const isFrozen = (row: Row): boolean => row.frozenFlag === true || Number(row.frozen) === 1
const availableQty = (row: Row): number => isFrozen(row) ? 0 : Math.max(0, Number(row.currentQty || 0) - Number(row.frozenQty || 0))

function openAction(row: Row, kind: string): void {
  if (kind === 'dispose' && !canDispose.value) { uni.showToast({ title: permissionState.value === 'member' ? '请联系当前主体负责人登记处置' : '请先重试权限核验', icon: 'none' }); return }
  if (kind === 'loss' && isExpired(row)) { uni.showModal({ title: '过期库存需专用处置', content: canDispose.value ? '请使用“过期处置”登记实物处置和凭据。' : '请将批次、仓库、处置数量及凭据交给当前主体负责人登记。你仍可查看库存流水。', showCancel: false }); return }
  editorContext = productionContextVersion()
  const batchId = row.batchId
  if (!batchId || !(row.inventoryId ?? row.id)) { uni.showToast({ title: '库存标识缺失，请刷新后重试', icon: 'none' }); return }
  if (kind === 'out' && isExpired(row)) { uni.showToast({ title: '库存已过期，禁止出库', icon: 'none' }); return }
  if (kind !== 'freeze' && kind !== 'dispose' && isFrozen(row)) { uni.showToast({ title: '该分仓库存已冻结，请先解冻', icon: 'none' }); return }
  const configs: Record<string, { title: string; path: string; fields: Field[] }> = {
    dispose: { title: '过期处置（负责人确认）', path: `/harvests/inventory/${batchId}/loss`, fields: [number('quantity','处置数量',true,0.0001), {key:'disposalMethod',label:'处置方式',type:'select',required:true,options:[{label:'销毁',value:'DESTROY'},{label:'无害化处理',value:'HARMLESS'}]}, text('evidenceNo','处置凭据编号',true), note('reason','处置说明',true)] },
    out: { title: '出库', path: `/harvests/inventory/${batchId}/out`, fields: [number('qty','出库数量',true,0.001), text('operatorName','操作人',true), text('relatedOrderNo','关联订单号')] },
    freeze: { title: '冻结 / 解冻', path: `/harvests/inventory/${batchId}/freeze`, fields: [yesno('frozen','冻结该分仓库存')] },
    loss: { title: '登记损耗', path: `/harvests/inventory/${batchId}/loss`, fields: [number('quantity','损耗数量',true,0.001), note('reason','损耗原因',true), text('operatorName','操作人',true)] },
    transfer: { title: '分仓调拨', path: `/harvests/inventory/${batchId}/transfer`, fields: [number('quantity','调拨数量',true,0.001), text('targetWarehouse','目标仓库',true), text('operatorName','操作人',true), note()] },
  }
  const config = configs[kind]
  if (!config) return
  editor.value = { ...config, row, kind }; form.value = kind === 'freeze' ? { frozen: !isFrozen(row) } : {}; ready.value = false; actionError.value = ''
}

async function submitAction(): Promise<void> {
  if (!editor.value || busy.value) return
  busy.value = true; actionError.value = ''
  try {
    if (editor.value.path.endsWith('/out') && isExpired(editor.value.row)) throw new Error('库存已过期，禁止出库，请先核查并按损耗流程处置')
    const payload: Row = validateFields(editor.value.fields, form.value)
    payload.inventoryId = editor.value.row.inventoryId ?? editor.value.row.id
    if (!payload.inventoryId) throw new Error('库存标识缺失，请刷新后重试')
    const quantity = payload.qty ?? payload.quantity
    if (quantity !== undefined && quantity > (editor.value.kind === 'dispose' ? Number(editor.value.row.currentQty) : availableQty(editor.value.row))) throw new Error('数量不能超过该分仓可用库存')
    if (editor.value.path.endsWith('/freeze') && typeof payload.frozen !== 'boolean') throw new Error('请选择冻结或解冻')
    if (editor.value.path.endsWith('/transfer') && payload.targetWarehouse === editor.value.row.warehouseName) throw new Error('目标仓库不能与当前仓库相同')
    if (editor.value.kind === 'dispose') {
      if (!isExpired(editor.value.row)) throw new Error('仅可处置已过期库存')
      if (String(payload.evidenceNo).length > 80 || String(payload.reason).length > 1000) throw new Error('凭据最多80字，说明最多1000字')
      const confirmed = await new Promise<boolean>(resolve => uni.showModal({title:'确认过期处置',content:`核销 ${quantity} ${editor.value!.row.unit || ''}，将生成报损流水，余量保持冻结。请确认实物已完成处置。`,success:r=>resolve(r.confirm),fail:()=>resolve(false)}))
      if (!confirmed) return
      const expectedTenant = permissionTenant.value
      if (!await checkPermission()) throw new Error(permissionState.value === 'member' ? '仅当前经营主体负责人可登记过期处置，请联系负责人' : '处置权限核验失败，请重试；未提交处置')
      if (!editor.value || editorContext !== productionContextVersion() || expectedTenant !== permissionTenant.value) throw new Error('经营主体或页面已变化，请重新打开处置表单')
      payload.expiredDisposal = true; payload.expectedQty = editor.value.row.currentQty
    }
    await call(editor.value.path, 'POST', editor.value.path.endsWith('/freeze') || editor.value.path.endsWith('/out') ? undefined : payload, editor.value.path.endsWith('/freeze') || editor.value.path.endsWith('/out') ? payload : undefined)
    editor.value = undefined
    uni.showToast({ title: '已提交', icon: 'success' })
    await load()
  } catch (err: any) { actionError.value = err?.message ?? '提交失败' }
  finally { busy.value = false }
}

function healthColor(row: any): string {
  const label = healthLabel(row)
  if (label === '正常') return '#1e6b38'
  if (label === '—') return '#666666'
  return label === '临期' ? '#8f4500' : '#cf1322'
}

onShow(async () => {
  closeHistory(); editor.value=undefined; cancel(); rows.value = []
  if (!await ensureWorkspaceSession() || isProductionOps()) return
  void checkPermission()
  void load()
})
</script>

<style scoped>
.permission-note { margin: 20rpx 0; padding: 20rpx; border-radius: 12rpx; background: #eef5fb; color: #36566c; font-size: 26rpx; line-height: 1.6; }
.permission-note button { margin-top: 12rpx; }
.expiry-warning { margin-top: 14rpx; padding: 14rpx 18rpx; color: #a43e28; background: #fff0e8; border-radius: 10rpx; font-size: 24rpx; line-height: 1.5; }
.inventory-search { margin-top: 20rpx; }
.inventory-meta { margin-top: 9rpx; color: #5b6b62; font-size: 24rpx; line-height: 1.5; }
.inventory-actions { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 18rpx; }
.overlay { position: fixed; inset: 0; z-index: 90; background: #fff; display: flex; flex-direction: column; }
.sheet-head { display: flex; justify-content: space-between; align-items: center; padding: 24rpx 28rpx; border-bottom: 1rpx solid #e7eee9; font-size: 30rpx; font-weight: 600; }
.sheet-body { flex: 1; height: 0; padding: 0 28rpx; box-sizing: border-box; }
.bottom-actions { padding: 20rpx 28rpx calc(20rpx + env(safe-area-inset-bottom)); }
.primary { width: 100%; background: #126d43; color: #fff; }
.error { margin: 20rpx 0; padding: 20rpx; background: #fff0e8; color: #a43e28; }
</style>

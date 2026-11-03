<template>
  <el-dialog
    :model-value="modelValue"
    width="min(610px, 94vw)"
    class="fund-invest-dialog"
    @update:model-value="close"
  >
    <template #header>
      <div class="invest-dialog-title">
        <span>资金配置确认</span>
        <small>核对资产、收益与风险后提交</small>
      </div>
    </template>

    <div v-if="asset" class="fund-invest">
      <section class="fund-invest-asset">
        <div class="fund-invest-mark">资</div>
        <div>
          <small>{{ asset.assetNo }} · {{ asset.assetType }}</small>
          <strong>{{ asset.assetName }}</strong>
          <p>{{ asset.borrowerName }} · {{ asset.borrowerRating }} 级 · 期限 {{ asset.term }} 个月</p>
        </div>
        <div class="fund-invest-rate">
          <strong>{{ number(asset.holdingPeriodRate) }}%</strong>
          <small>持有期参考收益</small>
        </div>
      </section>

      <section class="fund-invest-facts">
        <div><span>资产剩余额度</span><strong>{{ money(asset.availableAmount) }}</strong></div>
        <div><span>资金方可配置</span><strong>{{ money(account?.availableAmount) }}</strong></div>
        <div><span>最低起投</span><strong>{{ money(account?.minimumInvestment) }}</strong></div>
        <div><span>预计到期日</span><strong>{{ expectedDate }}</strong></div>
      </section>

      <section class="fund-invest-form">
        <label>本次配置金额</label>
        <el-input v-model="amount" size="large" inputmode="decimal" placeholder="请输入投资金额">
          <template #prefix>¥</template>
          <template #suffix>元</template>
        </el-input>
        <div class="fund-invest-quick">
          <button
            v-for="ratio in quickRatios"
            :key="ratio"
            type="button"
            @click="setRatio(ratio)"
          >
            {{ ratio === 1 ? '全部可投' : `${ratio * 100}%` }}
          </button>
        </div>
        <p>本次最多可配置 {{ money(maxInvestable) }}，提交后将实时占用资产及资金机构额度。</p>
      </section>

      <section class="fund-invest-estimate">
        <div><span>预计到期收益</span><strong>{{ money(expectedGain) }}</strong></div>
        <div><span>预计回款本息</span><b>{{ money(validAmount + expectedGain) }}</b></div>
      </section>

      <section class="fund-invest-risk">
        <strong>配置前请确认</strong>
        <p>{{ asset.recommendationReason || '该资产已完成平台基础审核，仍需关注农业经营周期、质押物价格和回款风险。' }}</p>
        <div>
          <span>{{ asset.iotMonitored ? 'IoT 持续监控' : '待补充 IoT 监控' }}</span>
          <span>{{ asset.collateralType || '信用融资' }}</span>
          <span>质押率 {{ number(asset.pledgeRate) }}%</span>
        </div>
      </section>

      <el-checkbox v-model="confirmed">
        我已核对资产信息、收益测算和风险提示，确认使用机构资金完成本次配置。
      </el-checkbox>
    </div>

    <template #footer>
      <el-button class="finance-ghost-button" :disabled="investing" @click="close">取消</el-button>
      <el-button
        class="finance-action-button"
        :loading="investing"
        :disabled="!confirmed || maxInvestable <= 0"
        @click="submit"
      >
        确认配置 {{ validAmount ? money(validAmount) : '' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { operationsApi } from '@/api/operations'
import { money } from '@/api/finance'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  asset: { type: Object, default: null },
  account: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue', 'success'])
const amount = ref('')
const confirmed = ref(false)
const investing = ref(false)
const quickRatios = [0.1, 0.25, 0.5, 1]

const maxInvestable = computed(() => Math.max(0, Math.min(
  Number(props.asset?.availableAmount || 0),
  Number(props.account?.availableAmount || 0),
)))
const validAmount = computed(() => {
  const value = Number(amount.value)
  return Number.isFinite(value) && value > 0 ? value : 0
})
const expectedGain = computed(() => {
  const amountValue = validAmount.value
  const assetAmount = Number(props.asset?.amount || 0)
  const expectedReturn = Number(props.asset?.expectedReturn || 0)
  if (!amountValue || !assetAmount) return 0
  return Math.round(amountValue * expectedReturn / assetAmount * 100) / 100
})
const expectedDate = computed(() => {
  const date = new Date()
  date.setMonth(date.getMonth() + Number(props.asset?.term || 1))
  return date.toLocaleDateString('zh-CN')
})

watch(() => props.modelValue, (open) => {
  if (!open) return
  amount.value = String(Math.min(maxInvestable.value, Math.max(
    Number(props.account?.minimumInvestment || 0),
    50000,
  )).toFixed(0))
  confirmed.value = false
})

function number(value) {
  return Number(value || 0).toFixed(2)
}

function setRatio(ratio) {
  const value = Math.floor(maxInvestable.value * ratio)
  amount.value = String(value)
}

function close() {
  if (investing.value) return
  emit('update:modelValue', false)
}

async function submit() {
  const value = Number(amount.value)
  const minimum = Number(props.account?.minimumInvestment || 0)
  if (!Number.isFinite(value) || value <= 0) {
    ElMessage.warning('请输入有效的配置金额')
    return
  }
  if (value < minimum) {
    ElMessage.warning(`本次配置不能低于 ${money(minimum)}`)
    return
  }
  if (value > maxInvestable.value) {
    ElMessage.warning('配置金额超过资产或资金机构剩余额度')
    return
  }
  if (!confirmed.value) {
    ElMessage.warning('请先确认资产信息和风险提示')
    return
  }

  investing.value = true
  try {
    const receipt = await operationsApi.subscribe(props.asset.id, value)
    emit('success', receipt)
    emit('update:modelValue', false)
    ElMessage.success('资金配置成功，已计入投资组合')
  } catch (error) {
    ElMessage.error(error.message || '资金配置失败')
  } finally {
    investing.value = false
  }
}
</script>

<style scoped>
.invest-dialog-title span, .invest-dialog-title small { display: block; }
.invest-dialog-title span { color: #213f2e; font-size: 16px; font-weight: 800; }
.invest-dialog-title small { margin-top: 3px; color: #8a9a91; font-size: var(--fin-fs-xs); }
.fund-invest { display: grid; gap: 12px; }
.fund-invest-asset { display: flex; align-items: center; gap: 11px; padding: 13px; border: 1px solid #dfe9e2; border-radius: 12px; background: #f6faf7; }
.fund-invest-mark { display: grid; width: 42px; height: 42px; place-items: center; flex: 0 0 auto; border-radius: 11px; background: #dff1e7; color: #176f49; font-size: 15px; font-weight: 800; }
.fund-invest-asset > div:nth-child(2) { min-width: 0; flex: 1; }
.fund-invest-asset small, .fund-invest-asset strong, .fund-invest-asset p { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fund-invest-asset small { color: #819388; font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); }
.fund-invest-asset strong { margin-top: 3px; color: #294936; font-size: 12px; }
.fund-invest-asset p { margin: 3px 0 0; color: #809187; font-size: var(--fin-fs-xs); }
.fund-invest-rate { text-align: right; }
.fund-invest-rate strong { color: #14764a; font-family: ui-monospace, Consolas, monospace; font-size: 18px; }
.fund-invest-rate small { color: #829289; font-size: var(--fin-fs-xs); }
.fund-invest-facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; overflow: hidden; border-radius: 9px; background: #e9efeb; }
.fund-invest-facts > div { padding: 9px 10px; background: #fbfcfb; }
.fund-invest-facts span, .fund-invest-facts strong { display: block; }
.fund-invest-facts span { color: #85968c; font-size: var(--fin-fs-xs); }
.fund-invest-facts strong { margin-top: 3px; color: #345340; font-family: ui-monospace, Consolas, monospace; font-size: var(--fin-fs-xs); }
.fund-invest-form > label { display: block; margin-bottom: 6px; color: #3d5948; font-size: var(--fin-fs-xs); font-weight: 700; }
.fund-invest-quick { display: flex; gap: 6px; margin-top: 7px; }
.fund-invest-quick button { padding: 5px 10px; border: 1px solid #d7e4db; border-radius: 99px; background: #f8fbf9; color: #5d7466; cursor: pointer; font-size: var(--fin-fs-xs); }
.fund-invest-quick button:hover { border-color: #95c8aa; color: #126b46; }
.fund-invest-form > p { margin: 7px 0 0; color: #8a9991; font-size: var(--fin-fs-xs); }
.fund-invest-estimate { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 13px; border-radius: 9px; background: #eff8f3; }
.fund-invest-estimate span, .fund-invest-estimate strong, .fund-invest-estimate b { display: block; }
.fund-invest-estimate span { color: #708478; font-size: var(--fin-fs-xs); }
.fund-invest-estimate strong { margin-top: 2px; color: #d05a42; font-family: ui-monospace, Consolas, monospace; font-size: 17px; }
.fund-invest-estimate b { color: #176a46; font-family: ui-monospace, Consolas, monospace; font-size: 15px; }
.fund-invest-risk { padding: 11px 13px; border: 1px solid #efe4ca; border-radius: 9px; background: #fffaf0; }
.fund-invest-risk strong { color: #715a2e; font-size: var(--fin-fs-xs); }
.fund-invest-risk p { margin: 4px 0 7px; color: #806f4d; font-size: var(--fin-fs-xs); line-height: 1.6; }
.fund-invest-risk > div { display: flex; flex-wrap: wrap; gap: 5px; }
.fund-invest-risk span { padding: 3px 7px; border-radius: 5px; background: #f8efd9; color: #79683f; font-size: var(--fin-fs-xs); }
.fund-invest :deep(.el-checkbox__label) { color: #566c5d; font-size: var(--fin-fs-xs); white-space: normal; }
@media (max-width: 620px) {
  .fund-invest-asset { align-items: flex-start; flex-wrap: wrap; }
  .fund-invest-rate { margin-left: 53px; text-align: left; }
  .fund-invest-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fund-invest-estimate { align-items: flex-start; flex-direction: column; }
}
</style>

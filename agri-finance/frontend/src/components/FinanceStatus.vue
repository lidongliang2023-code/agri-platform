<template>
  <span :class="['finance-status', tone]">{{ text }}</span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: { type: [String, Number, Boolean], default: '' },
  label: { type: String, default: '' },
})

const MAP = {
  已通过: '通过', 待审批: '待审批', 已拒绝: '已拒绝',
  还款中: '还款中', 已结清: '已结清', 逾期: '已逾期',
  待还款: '待还款', 已还款: '已还款',
  已生效: '已生效', 待审核: '待审核', 已释放: '已释放', 已终止: '已终止',
  待质押: '待质押', 已质押: '已质押',
  已签署: '已签署', 融资方已签: '融资方已签', 待签署: '待签署', 待融资方签署: '待融资方签署', 待复核: '待复核', 执行中: '执行中', 生效中: '生效中',
  可投资: '可投资', 已售罄: '已售罄', 已下线: '已下线', 投资中: '投资中', 待回款: '待回款', 已完成: '已完成',
  正常: '正常', ACTIVE: '正常', HIGH: '高优先级', MEDIUM: '中优先级', LOW: '低优先级',
  启用: '启用', 禁用: '已停用',
}

const text = computed(() => props.label || MAP[props.value] || props.value || '—')

const tone = computed(() => {
  const value = String(props.value)
  if (['已通过', '还款中', '已生效', '已签署', '执行中', '生效中', '正常', 'ACTIVE', '可投资', '投资中', '已质押', '启用'].includes(value)) return 'green'
  if (['待审批', '待还款', '待审核', '待复核', '待签署', '待融资方签署', '融资方已签', 'MEDIUM', '待回款', '待质押'].includes(value)) return 'amber'
  if (['已拒绝', '逾期', 'HIGH', '已下线', '禁用'].includes(value)) return 'red'
  if (['已结清', '已还款', '已释放', '已完成', '已售罄'].includes(value)) return 'blue'
  return 'gray'
})
</script>

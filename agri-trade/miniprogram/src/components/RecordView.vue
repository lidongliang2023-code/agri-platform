<script setup lang="ts">
import { computed } from 'vue'
import { labels, statusLabels } from '../business'

const props = defineProps<{ data: any; fields?: string[] }>()
const entries = computed(() => Object.entries(props.data || {}).filter(([key, value]) => value != null && value !== '' && (!props.fields || props.fields.includes(key))))

const valueLabels: Record<string, string> = {
  true: '是', false: '否',
  BOTH: '买卖双向', BUYER: '采购方', SELLER: '供货方', owner: '负责人', admin: '管理员', member: '成员', operator: '经办人',
  spot: '现货', forward: '远期', road: '公路', rail: '铁路', air: '航空', sea: '水运',
  buyer: '买方', seller: '卖方', buyer_center: '买家中心', seller_center: '卖家中心',
  electronic: '电子发票', ordinary: '普通发票', special: '专用发票',
}

function labelFor(key: string): string {
  if (labels[key]) return labels[key]
  if (/Id$/i.test(key)) return '关联编号'
  if (/Url$/i.test(key)) return '相关资料'
  if (/Time|Date/i.test(key)) return '时间'
  if (/Name$/i.test(key)) return '名称'
  if (/Status$/i.test(key)) return '状态'
  if (/Amount|Price|Quantity|Count/i.test(key)) return '数量或金额'
  return '其他信息'
}

/** 只有这些字段的 0 / 1 是「否 / 是」；金额、数量里的 0 就是 0。 */
const BOOL_KEY = /^(unread|claimed|mine|buyer_confirmed|seller_confirmed|enabled|deleted|default|is[A-Z_]|has[A-Z_])/
const MONEY_KEY = /(Amount|Spent|Revenue|Fee|Receivable|Price|price|freight)$/

function scalar(value: any, key = ''): string {
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (value == null) return ''
  const text = String(value)
  const numeric = typeof value === 'number' || /^-?\d+(\.\d+)?$/.test(text)
  if (numeric && BOOL_KEY.test(key) && (text === '0' || text === '1')) return text === '1' ? '是' : '否'
  if (numeric && key === 'status' && (text === '0' || text === '1')) return text === '1' ? '正常' : '停用'
  if (numeric && MONEY_KEY.test(key)) return `¥${Number(text).toFixed(2)}`
  if (numeric) return text
  if (/Url$/i.test(key) && /^https?:\/\//i.test(text)) return '已配置'
  return statusLabels[text] || valueLabels[text] || text
}

function display(value: any, key = ''): string {
  if (typeof value === 'string') {
    const text = value.trim()
    if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
      try { return display(JSON.parse(text), key) } catch { return text }
    }
    return scalar(text, key)
  }
  if (Array.isArray(value)) {
    if (!value.length) return '暂无'
    return value.map(item => typeof item === 'object' && item !== null ? display(item, key) : scalar(item, key)).join('、')
  }
  if (typeof value === 'object') {
    return Object.entries(value)
      .filter(([, item]) => item != null && item !== '')
      .map(([itemKey, item]) => `${labelFor(itemKey)}：${display(item, itemKey)}`)
      .join('；')
  }
  return scalar(value, key)
}
</script>

<template>
  <view class="record-view">
    <view v-for="entry in entries" :key="entry[0]" class="record-row">
      <text class="record-label">{{ labelFor(entry[0]) }}：</text>
      <text selectable class="record-value">{{ display(entry[1], entry[0]) }}</text>
    </view>
    <view v-if="!entries.length" class="record-empty">暂无可展示的信息</view>
  </view>
</template>

<style scoped>
.record-view { width: 100%; min-width: 0; }
/* 标签和值使用原生文本流，避免固定标签列宽及 text 的 flex 尺寸造成大块留白。 */
.record-row { display: block; height: auto; min-height: 0; margin: 0; padding: 8rpx 0; border-bottom: 1rpx solid var(--c-line); font-size: 26rpx; line-height: 40rpx; text-align: left; white-space: normal; overflow-wrap: break-word; }
.record-row:last-child { border-bottom: 0; }
.record-label { display: inline; margin: 0 8rpx 0 0; padding: 0; color: var(--c-text-3); font-size: inherit; line-height: inherit; white-space: normal; }
.record-value { display: inline; margin: 0; padding: 0; color: var(--c-text); font-size: inherit; line-height: inherit; white-space: pre-wrap; overflow-wrap: break-word; word-break: break-all; }
.record-empty { padding: 24rpx 0; color: var(--c-text-3); font-size: 26rpx; text-align: center; }
</style>

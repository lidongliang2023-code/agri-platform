<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { infoApi, toast, type AlertRule, type Quote } from '../../api'

const rules = ref<AlertRule[]>([])
const quotes = ref<Quote[]>([])
const loading = ref(true)

const form = ref({
  quoteIndex: 0,
  metric: '价格',
  operator: '>',
  threshold: '',
  channel: '站内消息',
})

const metrics = ['价格', '涨跌幅']
const operators = ['>', '<']
const channels = ['站内消息', '短信', '电话']

const quoteNames = computed(() => quotes.value.map((item) => `${item.icon} ${item.name}（${item.origin}）`))
const selectedQuote = computed<Quote | undefined>(() => quotes.value[form.value.quoteIndex])
const unit = computed(() => selectedQuote.value?.priceUnit || '元/斤')

const enabledCount = computed(() => rules.value.filter((item) => item.enabled).length)
const hitTotal = computed(() => rules.value.reduce((sum, item) => sum + (item.hitCount || 0), 0))

onLoad((options) => {
  const preset = Number(options?.quoteId || 0)
  if (preset) uni.setStorageSync('info_alert_quote', preset)
})

onShow(() => {
  load()
})

async function load() {
  loading.value = true
  try {
    const [ruleList, market] = await Promise.all([infoApi.alertRules(), infoApi.markets({})])
    rules.value = ruleList
    quotes.value = market.quotes
    const preset = Number(uni.getStorageSync('info_alert_quote') || 0)
    if (preset) {
      const index = quotes.value.findIndex((item) => item.id === preset)
      if (index >= 0) {
        form.value.quoteIndex = index
        form.value.threshold = String(quotes.value[index].price)
      }
      uni.removeStorageSync('info_alert_quote')
    }
  } catch (error) {
    toast(error instanceof Error ? error.message : '加载失败')
  } finally {
    loading.value = false
  }
}

function onQuoteChange(event: { detail: { value: number | string } }) {
  const index = Number(event.detail.value)
  form.value.quoteIndex = index
  const quote = quotes.value[index]
  if (quote) form.value.threshold = String(quote.price)
}

function onMetricChange(event: { detail: { value: number | string } }) {
  form.value.metric = metrics[Number(event.detail.value)]
}

function onOperatorChange(event: { detail: { value: number | string } }) {
  form.value.operator = operators[Number(event.detail.value)]
}

function onChannelChange(event: { detail: { value: number | string } }) {
  form.value.channel = channels[Number(event.detail.value)]
}

async function save() {
  if (!selectedQuote.value) {
    toast('请选择品种')
    return
  }
  const threshold = Number(form.value.threshold)
  if (!threshold || Number.isNaN(threshold)) {
    toast('请填写有效阈值')
    return
  }
  try {
    const quote = selectedQuote.value
    await infoApi.createAlertRule({
      ruleName: `${quote.name}${form.value.metric}${form.value.operator}${threshold}`,
      quoteId: quote.id,
      quoteName: quote.name,
      metric: form.value.metric,
      operator: form.value.operator,
      threshold,
      channel: form.value.channel,
    })
    toast('预警已创建', 'success')
    rules.value = await infoApi.alertRules()
  } catch (error) {
    toast(error instanceof Error ? error.message : '创建失败')
  }
}

async function toggle(rule: AlertRule) {
  try {
    const result = await infoApi.updateAlertRule(rule.id, { enabled: !rule.enabled })
    rules.value = result.rules
    toast(rule.enabled ? '已暂停该预警' : '已恢复该预警')
  } catch (error) {
    toast(error instanceof Error ? error.message : '操作失败')
  }
}

function remove(rule: AlertRule) {
  uni.showModal({
    title: '删除预警',
    content: `确定删除「${rule.ruleName}」吗？删除后不再推送该条件。`,
    success: async (result: { confirm: boolean }) => {
      if (!result.confirm) return
      try {
        await infoApi.updateAlertRule(rule.id, { enabled: false })
        rules.value = await infoApi.alertRules()
        toast('已停止推送，可在运营端彻底删除')
      } catch (error) {
        toast(error instanceof Error ? error.message : '操作失败')
      }
    },
  })
}

function toMessages() {
  uni.navigateTo({ url: '/pages/alert/messages' })
}

function metricLabel(rule: AlertRule) {
  const symbol = rule.operator === '>' ? '＞' : '＜'
  return `${rule.metric} ${symbol} ${rule.threshold}`
}
</script>

<template>
  <view class="page">
    <view class="head">
      <view class="head-copy">
        <text class="head-title">已关注 {{ quotes.length }} 个品种</text>
        <text class="head-sub">{{ enabledCount }} 条预警生效中 · 本周触发 {{ hitTotal }} 次</text>
      </view>
      <view class="head-btn" @click="toMessages">预警消息 ›</view>
    </view>

    <view class="page-pad">
      <view class="section-head">
        <text class="section-title">我的预警</text>
        <text class="card-sub">{{ rules.length }} 条</text>
      </view>

      <view v-if="loading" class="loading">正在加载…</view>
      <view v-else-if="!rules.length" class="empty">
        <text class="empty-icon">🔔</text>
        <text>还没有设置价格预警</text>
      </view>

      <view v-else class="card rule-card">
        <view v-for="rule in rules" :key="rule.id" class="rule">
          <view class="rule-top">
            <view class="rule-copy">
              <text class="rule-name">{{ rule.ruleName }}</text>
              <text class="tiny">品种：{{ rule.quoteName }}</text>
            </view>
            <switch
              :checked="rule.enabled"
              color="#12764a"
              style="transform: scale(0.72)"
              @change="toggle(rule)"
            />
          </view>
          <view class="rule-body">
            <text class="tag green">触发条件：{{ metricLabel(rule) }} {{ unit }}</text>
            <text class="tag gray">推送：{{ rule.channel }}</text>
            <text v-if="!rule.enabled" class="tag orange">已暂停</text>
            <text v-if="rule.hitCount" class="tag red">已触发 {{ rule.hitCount }} 次</text>
          </view>
          <view class="rule-foot">
            <text class="link" @click="remove(rule)">删除</text>
          </view>
        </view>
      </view>

      <view class="section-head">
        <text class="section-title">添加新预警</text>
      </view>

      <view class="card">
        <view class="form-item">
          <text class="form-label">选择品种</text>
          <picker mode="selector" :range="quoteNames" :value="form.quoteIndex" @change="onQuoteChange">
            <view class="picker">
              <text>{{ quoteNames[form.quoteIndex] || '请选择品种' }}</text>
              <text class="item-arrow">›</text>
            </view>
          </picker>
        </view>

        <view class="form-item">
          <text class="form-label">预警类型</text>
          <picker mode="selector" :range="metrics" :value="metrics.indexOf(form.metric)" @change="onMetricChange">
            <view class="picker">
              <text>{{ form.metric }}</text>
              <text class="item-arrow">›</text>
            </view>
          </picker>
        </view>

        <view class="form-item">
          <text class="form-label">阈值条件</text>
          <view class="operator-row">
            <view
              v-for="item in operators"
              :key="item"
              :class="['op', { active: form.operator === item }]"
              @click="form.operator = item"
            >
              {{ item === '>' ? '大于' : '小于' }}
            </view>
            <input v-model="form.threshold" class="input threshold" type="digit" :placeholder="`阈值（${unit}）`" />
          </view>
        </view>

        <view class="form-item">
          <text class="form-label">推送方式</text>
          <picker mode="selector" :range="channels" :value="channels.indexOf(form.channel)" @change="onChannelChange">
            <view class="picker">
              <text>{{ form.channel }}</text>
              <text class="item-arrow">›</text>
            </view>
          </picker>
        </view>

        <button class="btn btn-primary btn-block" @click="save">保存预警</button>

        <view class="notice" style="margin-top: 18rpx">
          <text>·</text>
          <text>同一品种同一条件 5 分钟内不重复触发；预警有效期默认 1 年，到期前 30 天提醒续期。</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.head {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 26rpx 24rpx;
  background: radial-gradient(circle at 92% 0, rgba(83, 213, 138, 0.24), transparent 380rpx), linear-gradient(145deg, #073821, #0d5d3b);
  color: #ffffff;
}

.head-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 6rpx;
}

.head-title {
  font-size: 30rpx;
  font-weight: 700;
}

.head-sub {
  color: rgba(255, 255, 255, 0.6);
  font-size: 21rpx;
}

.head-btn {
  padding: 10rpx 16rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.2);
  border-radius: 14rpx;
  background: rgba(255, 255, 255, 0.1);
  font-size: 21rpx;
}

.rule-card {
  padding: 6rpx 26rpx;
}

.rule {
  padding: 22rpx 0;
  border-bottom: 1rpx solid #edf2ee;
}

.rule:last-child {
  border-bottom: 0;
}

.rule-top {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.rule-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4rpx;
}

.rule-name {
  font-size: 27rpx;
  font-weight: 650;
}

.rule-body {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 12rpx;
}

.rule-foot {
  display: flex;
  justify-content: flex-end;
  margin-top: 12rpx;
}

.link {
  color: #c54b4b;
  font-size: 21rpx;
}

.picker {
  display: flex;
  min-height: 82rpx;
  align-items: center;
  justify-content: space-between;
  padding: 0 22rpx;
  border: 1rpx solid #dfe8e2;
  border-radius: 16rpx;
  background: #ffffff;
  font-size: 25rpx;
}

.operator-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.op {
  padding: 18rpx 26rpx;
  border: 1rpx solid #dfe8e2;
  border-radius: 14rpx;
  color: #53665a;
  font-size: 24rpx;
}

.op.active {
  border-color: #12764a;
  background: #eef7f2;
  color: #0e5233;
  font-weight: 650;
}

.threshold {
  flex: 1;
}
</style>

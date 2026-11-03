<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { infoApi, toast, type Quote, type Subscription } from '../../api'

const subs = ref<Subscription[]>([])
const quotes = ref<Quote[]>([])
const channels = ref<string[]>([])
const loading = ref(true)
const addOpen = ref(false)
const addType = ref<'品种' | '频道'>('品种')
const addIndex = ref(0)
const saving = ref(false)

const quoteNames = computed(() => quotes.value.map((item) => `${item.icon} ${item.name}（${item.origin}）`))

const quoteSubs = computed(() => subs.value.filter((item) => item.targetType === '品种' || item.targetType === 'quote'))
const channelSubs = computed(() => subs.value.filter((item) => item.targetType === '频道' || item.targetType === 'channel'))
const otherSubs = computed(() =>
  subs.value.filter((item) => !quoteSubs.value.includes(item) && !channelSubs.value.includes(item)),
)

const enabledCount = computed(() => subs.value.filter((item) => item.enabled).length)

onShow(() => {
  load()
})

async function load() {
  loading.value = true
  try {
    const [list, market, channelList] = await Promise.all([
      infoApi.subscriptions(),
      infoApi.markets({}),
      infoApi.channels(),
    ])
    subs.value = list
    quotes.value = market.quotes
    channels.value = channelList.map((item) => item.name)
  } catch (error) {
    toast(error instanceof Error ? error.message : '加载失败')
  } finally {
    loading.value = false
  }
}

async function toggle(sub: Subscription) {
  try {
    const result = await infoApi.toggleSubscription(sub.id, !sub.enabled)
    subs.value = result.subscriptions
    toast(sub.enabled ? '已暂停推送' : '已恢复推送')
  } catch (error) {
    toast(error instanceof Error ? error.message : '操作失败')
  }
}

async function create() {
  if (saving.value) return
  const targetName =
    addType.value === '品种' ? quotes.value[addIndex.value]?.name : channels.value[addIndex.value]
  if (!targetName) {
    toast('请选择订阅对象')
    return
  }
  saving.value = true
  try {
    const result = await infoApi.createSubscription({
      targetType: addType.value,
      targetName,
      channel: '站内消息',
      frequency: '每日',
    })
    subs.value = result.subscriptions
    addOpen.value = false
    toast('订阅已创建', 'success')
  } catch (error) {
    toast(error instanceof Error ? error.message : '创建失败')
  } finally {
    saving.value = false
  }
}

function openAdd() {
  addIndex.value = 0
  addOpen.value = true
}

function switchAddType(type: '品种' | '频道') {
  addType.value = type
  addIndex.value = 0
}
</script>

<template>
  <view class="page">
    <view class="head">
      <text class="head-title">{{ subs.length }} 个订阅</text>
      <text class="head-sub">{{ enabledCount }} 个生效中 · 每日 07:30 推送行情早报</text>
    </view>

    <view class="page-pad">
      <view v-if="loading" class="loading">正在加载…</view>

      <template v-else>
        <view class="section-head">
          <text class="section-title">品种行情订阅</text>
          <text class="card-sub" @click="openAdd">＋ 添加</text>
        </view>
        <view class="card">
          <view v-if="!quoteSubs.length" class="empty" style="min-height: 180rpx">
            <text>还没有订阅品种</text>
          </view>
          <view v-for="sub in quoteSubs" :key="sub.id" class="sub-row">
            <view class="item-icon">📈</view>
            <view class="item-body">
              <text class="item-title">{{ sub.targetName }}</text>
              <text class="item-sub">{{ sub.frequency }} · {{ sub.channel }}</text>
            </view>
            <switch :checked="sub.enabled" color="#12764a" style="transform: scale(0.72)" @change="toggle(sub)" />
          </view>
        </view>

        <view class="section-head">
          <text class="section-title">资讯频道订阅</text>
        </view>
        <view class="card">
          <view v-if="!channelSubs.length" class="empty" style="min-height: 180rpx">
            <text>还没有订阅频道</text>
          </view>
          <view v-for="sub in channelSubs" :key="sub.id" class="sub-row">
            <view class="item-icon">📜</view>
            <view class="item-body">
              <text class="item-title">{{ sub.targetName }}</text>
              <text class="item-sub">{{ sub.frequency }} · {{ sub.channel }}</text>
            </view>
            <switch :checked="sub.enabled" color="#12764a" style="transform: scale(0.72)" @change="toggle(sub)" />
          </view>
        </view>

        <view v-if="otherSubs.length" class="card">
          <view v-for="sub in otherSubs" :key="sub.id" class="sub-row">
            <view class="item-icon">⭐</view>
            <view class="item-body">
              <text class="item-title">{{ sub.targetName }}</text>
              <text class="item-sub">{{ sub.targetType }} · {{ sub.frequency }}</text>
            </view>
            <switch :checked="sub.enabled" color="#12764a" style="transform: scale(0.72)" @change="toggle(sub)" />
          </view>
        </view>

        <view class="section-head">
          <text class="section-title">推送时间与方式</text>
        </view>
        <view class="card">
          <view class="field">
            <text class="field-label">每日行情早报</text>
            <text class="field-value">07:30</text>
          </view>
          <view class="field">
            <text class="field-label">突发预警</text>
            <text class="field-value">即时推送</text>
          </view>
          <view class="field">
            <text class="field-label">产业周报</text>
            <text class="field-value">周一 09:00</text>
          </view>
          <view class="notice" style="margin-top: 14rpx">
            <text>·</text>
            <text>推送方式与免打扰时段可在「设置」中调整；订阅数据按统一账号隔离，多端同步。</text>
          </view>
        </view>
      </template>
    </view>

    <view v-if="addOpen" class="mask" @click="addOpen = false">
      <view class="sheet" @click.stop>
        <view class="sheet-head">
          <text class="card-title">添加订阅</text>
          <text class="card-sub" @click="addOpen = false">关闭</text>
        </view>

        <view class="seg" style="margin-bottom: 18rpx">
          <view :class="{ active: addType === '品种' }" @click="switchAddType('品种')">品种</view>
          <view :class="{ active: addType === '频道' }" @click="switchAddType('频道')">频道</view>
        </view>

        <picker
          v-if="addType === '品种'"
          mode="selector"
          :range="quoteNames"
          :value="addIndex"
          @change="addIndex = Number($event.detail.value)"
        >
          <view class="picker">
            <text>{{ quoteNames[addIndex] || '请选择品种' }}</text>
            <text class="item-arrow">›</text>
          </view>
        </picker>

        <picker
          v-else
          mode="selector"
          :range="channels"
          :value="addIndex"
          @change="addIndex = Number($event.detail.value)"
        >
          <view class="picker">
            <text>{{ channels[addIndex] || '请选择频道' }}</text>
            <text class="item-arrow">›</text>
          </view>
        </picker>

        <button class="btn btn-primary btn-block" style="margin-top: 18rpx" :disabled="saving" @click="create">
          {{ saving ? '创建中…' : '确认订阅' }}
        </button>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.head {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  padding: 26rpx 24rpx;
  background: radial-gradient(circle at 92% 0, rgba(83, 213, 138, 0.24), transparent 380rpx), linear-gradient(145deg, #073821, #0d5d3b);
  color: #ffffff;
}

.head-title {
  font-size: 30rpx;
  font-weight: 700;
}

.head-sub {
  color: rgba(255, 255, 255, 0.6);
  font-size: 21rpx;
}

.sub-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 18rpx 0;
  border-bottom: 1rpx solid #edf2ee;
}

.sub-row:last-child {
  border-bottom: 0;
}

.mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 50;
  display: flex;
  align-items: flex-end;
  background: rgba(6, 26, 16, 0.44);
}

.sheet {
  width: 100%;
  padding: 24rpx 24rpx calc(24rpx + env(safe-area-inset-bottom));
  border-radius: 26rpx 26rpx 0 0;
  background: #ffffff;
}

.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18rpx;
}

.picker {
  display: flex;
  min-height: 82rpx;
  align-items: center;
  justify-content: space-between;
  padding: 0 22rpx;
  border: 1rpx solid #dfe8e2;
  border-radius: 16rpx;
  font-size: 25rpx;
}
</style>

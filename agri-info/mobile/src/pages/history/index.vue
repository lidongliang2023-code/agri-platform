<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { clearViews, dayLabel, getViews, timeAgo, type ViewRecord } from '../../api'

const records = ref<ViewRecord[]>([])

onShow(() => {
  records.value = getViews()
})

const groups = computed(() => {
  const map = new Map<string, ViewRecord[]>()
  records.value.forEach((item) => {
    const key = dayLabel(item.at)
    if (!map.has(key)) map.set(key, [])
    map.get(key)?.push(item)
  })
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }))
})

function open(record: ViewRecord) {
  if (record.type === 'article') {
    uni.navigateTo({ url: `/pages/news/article?id=${record.id}` })
    return
  }
  if (record.type === 'quote') {
    uni.navigateTo({ url: `/pages/market/variety?id=${record.id}` })
    return
  }
  if (record.type === 'sd') {
    uni.navigateTo({ url: `/pages/sd/detail?id=${record.id}` })
    return
  }
  if (record.type === 'report') {
    uni.navigateTo({ url: `/pages/report/detail?id=${record.id}` })
    return
  }
}

function clear() {
  if (!records.value.length) return
  uni.showModal({
    title: '清空浏览历史',
    content: '仅清除本机记录的浏览轨迹，不影响平台侧的内容统计。',
    success: (result: { confirm: boolean }) => {
      if (!result.confirm) return
      clearViews()
      records.value = []
      uni.showToast({ title: '已清空', icon: 'none' })
    },
  })
}
</script>

<template>
  <view class="page">
    <view class="bar">
      <text class="tiny">共 {{ records.length }} 条浏览记录</text>
      <text class="clear" @click="clear">清空</text>
    </view>

    <view class="page-pad">
      <view v-if="!records.length" class="empty">
        <text class="empty-icon">🕘</text>
        <text>还没有浏览记录</text>
      </view>

      <template v-else>
        <view v-for="group in groups" :key="group.label" class="group">
          <text class="group-label">{{ group.label }}</text>
          <view class="card">
            <view v-for="item in group.items" :key="`${item.type}-${item.id}`" class="list-item" @click="open(item)">
              <view class="item-icon">{{ item.icon || '📄' }}</view>
              <view class="item-body">
                <text class="item-title clamp-2">{{ item.title }}</text>
                <text class="item-sub">{{ item.summary }}</text>
              </view>
              <text class="tiny">{{ timeAgo(item.at) }}</text>
              <text class="item-arrow">›</text>
            </view>
          </view>
        </view>
      </template>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18rpx 24rpx;
  background: #ffffff;
}

.clear {
  color: #c54b4b;
  font-size: 22rpx;
}

.group {
  margin-bottom: 8rpx;
}

.group-label {
  display: block;
  margin: 14rpx 2rpx 10rpx;
  color: #718277;
  font-size: 22rpx;
  font-weight: 650;
}
</style>

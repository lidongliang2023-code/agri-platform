<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { infoApi, timeAgo, toast, type Favorite } from '../../api'

const items = ref<Favorite[]>([])
const tab = ref('all')
const loading = ref(true)

const labels: Record<string, string> = {
  article: '资讯',
  quote: '品种',
  course: '课程',
  report: '报告',
  knowledge: '农技',
  sd: '供需',
}

const tabs = computed(() => {
  const types = Array.from(new Set(items.value.map((item) => item.targetType)))
  return [
    { key: 'all', label: `全部 ${items.value.length}` },
    ...types.map((type) => ({
      key: type,
      label: `${labels[type] || type} ${items.value.filter((item) => item.targetType === type).length}`,
    })),
  ]
})

const filtered = computed(() =>
  tab.value === 'all' ? items.value : items.value.filter((item) => item.targetType === tab.value),
)

onShow(() => {
  load()
})

async function load() {
  loading.value = true
  try {
    items.value = await infoApi.favorites()
  } catch (error) {
    toast(error instanceof Error ? error.message : '加载失败')
  } finally {
    loading.value = false
  }
}

function open(item: Favorite) {
  if (item.targetType === 'article') {
    uni.navigateTo({ url: `/pages/news/article?id=${item.targetId}` })
    return
  }
  if (item.targetType === 'quote') {
    uni.navigateTo({ url: `/pages/market/variety?id=${item.targetId}` })
    return
  }
  if (item.targetType === 'report') {
    uni.navigateTo({ url: `/pages/report/detail?id=${item.targetId}` })
    return
  }
  if (item.targetType === 'sd') {
    uni.navigateTo({ url: `/pages/sd/detail?id=${item.targetId}` })
    return
  }
  uni.showToast({ title: item.summary || item.title, icon: 'none' })
}

function remove(item: Favorite) {
  uni.showModal({
    title: '取消收藏',
    content: `确定取消收藏「${item.title}」吗？`,
    success: async (result: { confirm: boolean }) => {
      if (!result.confirm) return
      try {
        await infoApi.removeFavorite(item.id)
        items.value = items.value.filter((row) => row.id !== item.id)
        toast('已取消收藏')
      } catch (error) {
        toast(error instanceof Error ? error.message : '操作失败')
      }
    },
  })
}

function manage() {
  uni.showModal({
    title: '收藏管理',
    content: '长按或点击右侧「取消」可移除单条收藏。收藏数据按统一账号隔离，换端登录同样可见。',
    showCancel: false,
  })
}
</script>

<template>
  <view class="page">
    <view class="bar">
      <scroll-view scroll-x class="chips" :show-scrollbar="false">
        <view
          v-for="item in tabs"
          :key="item.key"
          :class="['chip', { active: tab === item.key }]"
          @click="tab = item.key"
        >
          {{ item.label }}
        </view>
      </scroll-view>
      <text class="manage" @click="manage">管理</text>
    </view>

    <view class="page-pad">
      <view v-if="loading" class="loading">正在加载…</view>
      <view v-else-if="!filtered.length" class="empty">
        <text class="empty-icon">⭐</text>
        <text>还没有收藏内容</text>
      </view>

      <view v-else class="card">
        <view v-for="item in filtered" :key="item.id" class="fav-row" @click="open(item)">
          <view class="item-icon">{{ item.targetType === 'quote' ? '📈' : '📄' }}</view>
          <view class="item-body">
            <text class="item-title clamp-2">{{ item.title }}</text>
            <text class="item-sub">{{ item.summary }}</text>
            <view class="meta">
              <text class="tag gray">{{ labels[item.targetType] || item.targetType }}</text>
              <text class="tiny">收藏于 {{ timeAgo(item.createdAt) }}</text>
            </view>
          </view>
          <text class="remove" @click.stop="remove(item)">取消</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.bar {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 14rpx 24rpx;
  background: #ffffff;
}

.bar .chips {
  flex: 1;
  white-space: nowrap;
}

.manage {
  color: #12764a;
  font-size: 24rpx;
}

.fav-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #edf2ee;
}

.fav-row:last-child {
  border-bottom: 0;
}

.meta {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-top: 4rpx;
}

.remove {
  color: #c54b4b;
  font-size: 24rpx;
}
</style>

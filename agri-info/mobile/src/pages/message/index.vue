<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { infoApi, timeAgo, toast, type AlertMessage, type Article, type Subscription } from '../../api'

interface Group {
  key: string
  icon: string
  title: string
  desc: string
  time: string
  badge?: number
  url?: string
  tab?: boolean
}

const groups = ref<Group[]>([])
const policyList = ref<Article[]>([])
const loading = ref(true)

onShow(() => {
  load()
})

async function load() {
  loading.value = true
  try {
    const [alerts, overview, subs, articles] = await Promise.all([
      infoApi.alertMessages(),
      infoApi.overview(),
      infoApi.subscriptions(),
      infoApi.articles({ channel: '政策法规', page: 1, size: 3 }),
    ])
    policyList.value = articles.items
    groups.value = buildGroups(alerts, overview?.todos || [], subs, articles.items)
  } catch (error) {
    toast(error instanceof Error ? error.message : '加载失败')
  } finally {
    loading.value = false
  }
}

function buildGroups(
  alerts: { items: AlertMessage[]; unread: number },
  todos: Array<{ title: string; content: string; page: string; tag: string }>,
  subs: Subscription[],
  policies: Article[],
): Group[] {
  const latestAlert = alerts.items[0]
  const latestTodo = todos[0]
  const latestPolicy = policies[0]
  const enabledSubs = subs.filter((item) => item.enabled)
  return [
    {
      key: 'alert',
      icon: '🔔',
      title: '价格预警',
      desc: latestAlert ? latestAlert.title : '暂无新的价格预警',
      time: latestAlert ? timeAgo(latestAlert.createdAt) : '',
      badge: alerts.unread,
      url: '/pages/alert/messages',
    },
    {
      key: 'system',
      icon: '📢',
      title: '系统通知',
      desc: latestTodo ? `${latestTodo.title}：${latestTodo.content}` : '行情数据每日 18:00 更新',
      time: latestTodo ? '今天' : '',
      url: '/pages/help/index',
    },
    {
      key: 'comment',
      icon: '📝',
      title: '评论与互动',
      desc: '你关注的资讯有新评论与回复',
      time: '2天前',
      url: '/pages/favorite/index',
    },
    {
      key: 'sub',
      icon: '⭐',
      title: '订阅更新',
      desc: enabledSubs.length
        ? `${enabledSubs.length} 个订阅生效中：${enabledSubs.map((item) => item.targetName).slice(0, 3).join('、')}`
        : '还没有订阅任何品种或频道',
      time: '',
      url: '/pages/subscription/index',
    },
    {
      key: 'policy',
      icon: '📜',
      title: '政策推送',
      desc: latestPolicy ? latestPolicy.title : '暂无政策更新',
      time: latestPolicy ? timeAgo(latestPolicy.publishedAt) : '',
      url: '/pages/news/channel?channel=政策法规',
    },
  ]
}

function open(group: Group) {
  if (!group.url) return
  if (group.tab) {
    uni.switchTab({ url: group.url })
    return
  }
  uni.navigateTo({ url: group.url })
}

async function readAll() {
  try {
    const result = await infoApi.readAllAlerts()
    toast(result.updated ? `已标记 ${result.updated} 条为已读` : '没有未读消息', 'success')
    load()
  } catch (error) {
    toast(error instanceof Error ? error.message : '操作失败')
  }
}

function openPolicy(id: number) {
  uni.navigateTo({ url: `/pages/news/article?id=${id}` })
}
</script>

<template>
  <view class="page">
    <view class="bar">
      <text class="tiny">共 {{ groups.length }} 类消息通道</text>
      <text class="read-all" @click="readAll">全部已读</text>
    </view>

    <view class="page-pad">
      <view v-if="loading" class="loading">正在加载…</view>

      <view v-else class="card group-card">
        <view v-for="group in groups" :key="group.key" class="group-row" @click="open(group)">
          <view class="group-icon">{{ group.icon }}</view>
          <view class="group-body">
            <view class="between">
              <text class="group-title">{{ group.title }}</text>
              <text class="tiny">{{ group.time }}</text>
            </view>
            <text class="group-desc">{{ group.desc }}</text>
          </view>
          <view v-if="group.badge" class="badge">{{ group.badge }}</view>
          <text class="item-arrow">›</text>
        </view>
      </view>

      <view class="section-head">
        <text class="section-title">政策推送</text>
        <text class="card-sub">匹配你的地区与品类</text>
      </view>

      <view v-if="policyList.length" class="card">
        <view v-for="item in policyList" :key="item.id" class="list-item" @click="openPolicy(item.id)">
          <view class="item-icon">{{ item.coverIcon }}</view>
          <view class="item-body">
            <text class="item-title clamp-2">{{ item.title }}</text>
            <text class="item-sub">{{ item.channel }} · {{ timeAgo(item.publishedAt) }}</text>
          </view>
          <text class="item-arrow">›</text>
        </view>
      </view>
      <view v-else class="empty" style="min-height: 240rpx">
        <text>暂无政策更新</text>
      </view>
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

.read-all {
  color: #12764a;
  font-size: 22rpx;
}

.group-card {
  padding: 4rpx 24rpx;
}

.group-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 22rpx 0;
  border-bottom: 1rpx solid #edf2ee;
}

.group-row:last-child {
  border-bottom: 0;
}

.group-icon {
  display: flex;
  width: 76rpx;
  height: 76rpx;
  flex: 0 0 76rpx;
  align-items: center;
  justify-content: center;
  border-radius: 20rpx;
  background: #eef6f1;
  font-size: 34rpx;
}

.group-body {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 6rpx;
}

.group-title {
  font-size: 26rpx;
  font-weight: 650;
}

.group-desc {
  overflow: hidden;
  color: #718277;
  font-size: 21rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge {
  min-width: 34rpx;
  height: 34rpx;
  padding: 0 8rpx;
  border-radius: 17rpx;
  background: #e44949;
  color: #ffffff;
  font-size: 18rpx;
  line-height: 34rpx;
  text-align: center;
}
</style>

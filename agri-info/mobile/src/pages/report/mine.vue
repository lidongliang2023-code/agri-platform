<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { infoApi, money, toast, type Report } from '../../api'

const mine = ref<Report[]>([])
const all = ref<Report[]>([])
const categories = ref<string[]>([])
const tab = ref<'mine' | 'all'>('mine')
const category = ref('')
const loading = ref(true)

const visible = computed(() => {
  if (tab.value === 'mine') return mine.value
  return category.value ? all.value.filter((item) => item.category === category.value) : all.value
})

onShow(() => {
  load()
})

async function load() {
  loading.value = true
  try {
    const [mineList, catalog] = await Promise.all([infoApi.myReports(), infoApi.reports()])
    mine.value = mineList
    all.value = catalog.items || []
    categories.value = catalog.categories || []
  } catch (error) {
    toast(error instanceof Error ? error.message : '加载失败')
  } finally {
    loading.value = false
  }
}

function open(item: Report) {
  uni.navigateTo({ url: `/pages/report/detail?id=${item.id}` })
}

function subscribe() {
  uni.showModal({
    title: '订阅设置',
    content: '开启后每月 5 日推送上月定期报告，关注品类的专题报告上新时优先提醒，推送渠道可在「设置」中调整。',
    success: async (result: { confirm: boolean }) => {
      if (!result.confirm) return
      try {
        await infoApi.createSubscription({
          targetType: '报告',
          targetName: category.value || '数据报告',
          channel: '站内消息',
          frequency: '每月',
        })
        toast('订阅成功', 'success')
      } catch (error) {
        toast(error instanceof Error ? error.message : '订阅失败')
      }
    },
  })
}

function download(item: Report) {
  uni.showModal({
    title: '下载报告',
    content: `《${item.title}》PDF 约 ${item.pageCount} 页。移动端将生成下载任务，可在「我的报告 - 下载记录」中查看。`,
    success: async (result: { confirm: boolean }) => {
      if (!result.confirm) return
      try {
        const res = await infoApi.downloadReport(item.id)
        toast(res.message || '已开始下载', 'success')
      } catch (error) {
        toast(error instanceof Error ? error.message : '下载失败')
      }
    },
  })
}
</script>

<template>
  <view class="page">
    <view class="bar">
      <view class="seg">
        <view :class="{ active: tab === 'mine' }" @click="tab = 'mine'">已购 {{ mine.length }}</view>
        <view :class="{ active: tab === 'all' }" @click="tab = 'all'">报告库 {{ all.length }}</view>
      </view>
      <text class="sub-link" @click="subscribe">订阅设置</text>
    </view>

    <view v-if="tab === 'all'" class="page-pad" style="padding-bottom: 0">
      <scroll-view scroll-x class="chips" :show-scrollbar="false">
        <view :class="['chip', { active: !category }]" @click="category = ''">全部</view>
        <view
          v-for="item in categories"
          :key="item"
          :class="['chip', { active: category === item }]"
          @click="category = item"
        >
          {{ item }}
        </view>
      </scroll-view>
    </view>

    <view class="page-pad">
      <view v-if="loading" class="loading">正在加载…</view>
      <view v-else-if="!visible.length" class="empty">
        <text class="empty-icon">📑</text>
        <text>{{ tab === 'mine' ? '还没有购买报告' : '暂无该分类报告' }}</text>
      </view>

      <view v-else class="card">
        <view v-for="item in visible" :key="item.id" class="report-row" @click="open(item)">
          <view class="report-icon">📑</view>
          <view class="report-body">
            <text class="report-title clamp-2">{{ item.title }}</text>
            <text class="item-sub">{{ item.category }} · {{ item.pageCount }} 页 · {{ item.period }}</text>
            <view class="report-meta">
              <text class="tag green">{{ item.isFree ? '免费' : `¥${money(item.price, 0)}` }}</text>
              <text class="tiny">{{ item.downloads }} 人已购</text>
            </view>
          </view>
          <view class="report-actions">
            <text class="act" @click.stop="download(item)">下载</text>
            <text class="item-arrow">›</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.bar {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 16rpx 24rpx;
  background: #ffffff;
}

.bar .seg {
  flex: 1;
}

.sub-link {
  color: #12764a;
  font-size: 22rpx;
}

.chips {
  margin-bottom: 12rpx;
  white-space: nowrap;
}

.report-row {
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #edf2ee;
}

.report-row:last-child {
  border-bottom: 0;
}

.report-icon {
  display: flex;
  width: 76rpx;
  height: 76rpx;
  flex: 0 0 76rpx;
  align-items: center;
  justify-content: center;
  border-radius: 20rpx;
  background: #eef6f1;
  font-size: 32rpx;
}

.report-body {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 5rpx;
}

.report-title {
  font-size: 26rpx;
  font-weight: 650;
  line-height: 1.45;
}

.report-meta {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-top: 2rpx;
}

.report-actions {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.act {
  color: #12764a;
  font-size: 21rpx;
}
</style>

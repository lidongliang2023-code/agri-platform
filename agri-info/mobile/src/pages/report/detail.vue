<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { infoApi, money, pushView, toArray, toast, type Report } from '../../api'

const id = ref(0)
const report = ref<Report | null>(null)
const loading = ref(true)
const statusBarHeight = ref(0)
const bought = ref(false)

try {
  statusBarHeight.value = Number(uni.getSystemInfoSync().statusBarHeight || 0)
} catch {
  statusBarHeight.value = 0
}

const sections = computed(() => toArray(report.value?.sections))

onLoad((options) => {
  id.value = Number(options?.id || 0)
  load()
})

async function load() {
  loading.value = true
  try {
    const data = await infoApi.report(id.value)
    report.value = data
    pushView({
      type: 'report',
      id: data.id,
      title: data.title,
      summary: `${data.category} · ${data.pageCount} 页`,
      icon: '📑',
    })
  } catch (error) {
    toast(error instanceof Error ? error.message : '加载失败')
  } finally {
    loading.value = false
  }
}

async function purchase() {
  if (!report.value) return
  try {
    const result = await infoApi.downloadReport(report.value.id)
    bought.value = true
    report.value.downloads = result.downloads
    uni.showModal({
      title: '购买成功',
      content: `${result.message}\n可在「我的报告」中永久查看与下载。`,
      showCancel: false,
      success: () => uni.redirectTo({ url: '/pages/report/mine' }),
    })
  } catch (error) {
    toast(error instanceof Error ? error.message : '购买失败')
  }
}

function subscribe() {
  uni.showModal({
    title: '订阅年度报告',
    content: '订阅后每月 5 日自动推送上月定期报告，专题报告上新优先提醒，会员价购买享受折扣。',
    success: async (result: { confirm: boolean }) => {
      if (!result.confirm) return
      try {
        await infoApi.createSubscription({
          targetType: '报告',
          targetName: report.value?.category || '数据报告',
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

function share() {
  uni.setClipboardData({
    data: `丰链云报告：${report.value?.title || ''}（编号 ${report.value?.reportNo || ''}）`,
    success: () => toast('链接已复制'),
  })
}

function goBack() {
  uni.navigateBack({ delta: 1 })
}

function openReport(reportId: number) {
  uni.redirectTo({ url: `/pages/report/detail?id=${reportId}` })
}
</script>

<template>
  <view class="page report-page">
    <view class="nav-holder" :style="{ paddingTop: `${statusBarHeight}px` }">
      <view class="custom-nav">
        <text class="back" @click="goBack">‹</text>
        <text class="title">报告详情</text>
        <text class="right" @click="share">分享</text>
      </view>
    </view>

    <view v-if="loading" class="loading">正在加载…</view>

    <template v-else-if="report">
      <view class="head">
        <text class="head-title">{{ report.title }}</text>
        <text class="head-sub">{{ report.category }} · {{ report.period }}</text>
        <view class="head-meta">
          <text class="tag green">{{ report.isFree ? '免费' : '付费报告' }}</text>
          <text class="tiny">发布 {{ report.publishedAt }}</text>
        </view>

        <view class="stat-grid">
          <view class="stat-cell">
            <text class="stat-num">{{ report.pageCount }}</text>
            <text class="stat-label">页数</text>
          </view>
          <view class="stat-cell">
            <text class="stat-num">{{ report.downloads }}</text>
            <text class="stat-label">已购买</text>
          </view>
          <view class="stat-cell">
            <text class="stat-num">{{ sections.length }}</text>
            <text class="stat-label">章节</text>
          </view>
        </view>
      </view>

      <view class="page-pad">
        <view class="card">
          <view class="card-head">
            <text class="card-title">报告目录</text>
            <text class="card-sub">共 {{ sections.length }} 章</text>
          </view>
          <view v-for="(item, index) in sections" :key="index" class="toc-row">
            <text class="toc-no">{{ index + 1 }}</text>
            <text class="toc-title">{{ item }}</text>
          </view>
          <view v-if="!sections.length" class="empty" style="min-height: 160rpx">
            <text>暂无目录信息</text>
          </view>
        </view>

        <view class="card">
          <view class="card-head">
            <text class="card-title">报告简介</text>
          </view>
          <text class="summary">{{ report.summary }}</text>
          <view class="notice" style="margin-top: 16rpx">
            <text>·</text>
            <text>报告数据来源于平台采集与公开渠道，仅供经营参考，不构成投资建议。购买后可在「我的报告」中永久查看与下载。</text>
          </view>
        </view>

        <view v-if="report.attestation" class="attest">
          <text class="attest-icon">🔗</text>
          <view class="attest-copy">
            <text class="strong">报告已上链存证</text>
            <text class="tiny">{{ report.attestation.attestNo }} · 区块 {{ report.attestation.blockHeight }}</text>
          </view>
        </view>

        <view v-if="report.related?.length" class="section-head">
          <text class="section-title">相关报告</text>
        </view>
        <view v-if="report.related?.length" class="card">
          <view
            v-for="item in report.related"
            :key="item.id"
            class="list-item"
            @click="openReport(item.id)"
          >
            <view class="item-icon">📑</view>
            <view class="item-body">
              <text class="item-title clamp-2">{{ item.title }}</text>
              <text class="item-sub">{{ item.category }} · {{ item.period }}</text>
            </view>
            <text class="item-arrow">›</text>
          </view>
        </view>
      </view>

      <view class="action-bar">
        <view class="price-block">
          <text class="price">{{ report.isFree ? '免费' : `¥${money(report.price, 0)}` }}</text>
          <text class="tiny">一次购买永久查看 · 可开发票</text>
        </view>
        <button class="btn" @click="subscribe">订阅年度</button>
        <button class="btn btn-primary" :disabled="bought" @click="purchase">
          {{ bought ? '已购买' : '立即购买' }}
        </button>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.report-page {
  padding-bottom: 190rpx;
  background: #f4f7f5;
}

.nav-holder {
  background: #ffffff;
}

.head {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 24rpx 24rpx 28rpx;
  background: #ffffff;
}

.head-title {
  font-size: 36rpx;
  font-weight: 750;
  line-height: 1.4;
}

.head-sub {
  color: #718277;
  font-size: 22rpx;
}

.head-meta {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 6rpx;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 20rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid #edf2ee;
}

.toc-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 14rpx 0;
  border-bottom: 1rpx solid #f1f5f2;
}

.toc-row:last-child {
  border-bottom: 0;
}

.toc-no {
  width: 34rpx;
  color: #94a198;
  font-family: "DIN Alternate", monospace;
  font-size: 21rpx;
  text-align: center;
}

.toc-title {
  flex: 1;
  font-size: 24rpx;
  line-height: 1.5;
}

.summary {
  color: #53665a;
  font-size: 23rpx;
  line-height: 1.8;
}

.attest {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 20rpx;
  border: 1rpx solid #d9e9df;
  border-radius: 18rpx;
  background: #f4faf6;
}

.attest-icon {
  font-size: 30rpx;
}

.attest-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4rpx;
}

.price-block {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2rpx;
}

.price-block .price {
  color: #0e5233;
  font-size: 38rpx;
}
</style>

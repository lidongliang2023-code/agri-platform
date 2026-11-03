<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import {
  infoApi,
  pushView,
  splitParagraphs,
  timeAgo,
  toast,
  type ArticleDetail,
} from '../../api'

const id = ref(0)
const detail = ref<ArticleDetail | null>(null)
const loading = ref(true)
const liked = ref(false)
const favorited = ref(false)
const commenting = ref(false)
const commentText = ref('')
const submitting = ref(false)

const blocks = computed(() => splitParagraphs(detail.value?.content || ''))
const statusBarHeight = ref(0)
try {
  statusBarHeight.value = Number(uni.getSystemInfoSync().statusBarHeight || 0)
} catch {
  statusBarHeight.value = 0
}

onLoad((options) => {
  id.value = Number(options?.id || 0)
  load()
})

async function load() {
  loading.value = true
  try {
    const data = await infoApi.article(id.value)
    detail.value = data
    favorited.value = data.favorited
    pushView({
      type: 'article',
      id: data.id,
      title: data.title,
      summary: data.summary,
      icon: data.coverIcon,
    })
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function like() {
  if (liked.value || !detail.value) return
  try {
    const result = await infoApi.likeArticle(detail.value.id)
    detail.value.likeCount = result.likeCount
    liked.value = true
    toast('已点赞', 'success')
  } catch (error) {
    toast(error instanceof Error ? error.message : '点赞失败')
  }
}

async function toggleFavorite() {
  if (!detail.value) return
  try {
    if (favorited.value) {
      await infoApi.removeFavorite(detail.value.id)
      favorited.value = false
      toast('已取消收藏')
      return
    }
    await infoApi.addFavorite({
      targetType: 'article',
      targetId: detail.value.id,
      title: detail.value.title,
      summary: detail.value.summary,
    })
    favorited.value = true
    toast('已收藏', 'success')
  } catch (error) {
    toast(error instanceof Error ? error.message : '操作失败')
  }
}

async function submitComment() {
  if (!commentText.value.trim() || !detail.value || submitting.value) return
  submitting.value = true
  try {
    await infoApi.commentArticle(detail.value.id, { content: commentText.value.trim() })
    commentText.value = ''
    commenting.value = false
    toast('评论已提交', 'success')
    load()
  } catch (error) {
    toast(error instanceof Error ? error.message : '评论失败')
  } finally {
    submitting.value = false
  }
}

function share() {
  uni.setClipboardData({
    data: `丰链云资讯：${detail.value?.title || ''}（编号 ${detail.value?.articleNo || ''}）`,
    success: () => toast('链接已复制'),
  })
}

function openVariety(name: string) {
  uni.switchTab({ url: '/pages/market/index' })
  uni.setStorageSync('info_market_keyword', name)
}

function openAttest(attestId: number) {
  uni.navigateTo({ url: `/pages/attest/detail?id=${attestId}` })
}

function openArticle(articleId: number) {
  uni.navigateTo({ url: `/pages/news/article?id=${articleId}` })
}

function goBack() {
  uni.navigateBack({ delta: 1 })
}
</script>

<template>
  <view class="page article-page">
    <view class="nav-holder" :style="{ paddingTop: `${statusBarHeight}px` }">
      <view class="custom-nav">
        <text class="back" @click="goBack">‹</text>
        <text class="title">资讯详情</text>
        <text class="right" @click="share">分享</text>
      </view>
    </view>

    <view v-if="loading" class="loading">正在加载…</view>

    <template v-else-if="detail">
      <view class="head">
        <text class="title">{{ detail.title }}</text>
        <view class="meta">
          <view class="avatar">{{ detail.author.slice(0, 1) }}</view>
          <view class="meta-copy">
            <text class="strong">{{ detail.author }}</text>
            <text class="tiny">{{ detail.publishedAt }} · 👁 {{ detail.readCount }}</text>
          </view>
          <text v-if="detail.aiGenerated" class="tag purple">✦ AI生成</text>
          <text v-else class="tag green">{{ detail.channel }}</text>
        </view>
      </view>

      <view class="body">
        <view class="article-body">
          <template v-for="(block, index) in blocks" :key="index">
            <text v-if="block.type === 'h'" class="h">{{ block.text }}</text>
            <view v-else-if="block.type === 'q'" class="quote">{{ block.text }}</view>
            <text v-else>{{ block.text }}</text>
          </template>
        </view>

        <view v-if="detail.tags?.length" class="tags">
          <text v-for="tag in detail.tags" :key="tag" class="tag gray">#{{ tag }}</text>
        </view>

        <view v-if="detail.attestation" class="attest" @click="openAttest(detail.attestation.id)">
          <text class="attest-icon">🔗</text>
          <view class="attest-copy">
            <text class="strong">内容已上链存证</text>
            <text class="tiny">{{ detail.attestation.attestNo }} · 区块 {{ detail.attestation.blockHeight }}</text>
          </view>
          <text class="item-arrow">›</text>
        </view>

        <view class="quote-card" @click="openVariety(detail.channel)">
          <view class="quote-head">
            <text class="tag green">📈 实时行情</text>
            <text class="tiny">去行情页 ›</text>
          </view>
          <text class="quote-title">{{ detail.title.slice(0, 18) }}… 相关品种走势</text>
          <text class="tiny">查看该品种 7 日价格、多产区对比与 AI 预测</text>
        </view>

        <view class="section-head">
          <text class="section-title">评论 {{ detail.commentCount }}</text>
          <text class="card-sub" @click="commenting = true">写评论 ›</text>
        </view>

        <view v-if="!detail.comments?.length" class="empty" style="min-height: 200rpx">
          <text>还没有评论，来说两句</text>
        </view>
        <view v-else class="comment-list">
          <view v-for="comment in detail.comments" :key="comment.id" class="comment">
            <view class="avatar sm">{{ comment.userName.slice(0, 1) }}</view>
            <view class="comment-body">
              <view class="between">
                <text class="strong">{{ comment.userName }}</text>
                <text class="tiny">👍 {{ comment.likeCount }}</text>
              </view>
              <text class="comment-text">{{ comment.content }}</text>
              <text class="tiny">{{ comment.userRegion }} · {{ timeAgo(comment.createdAt) }}</text>
            </view>
          </view>
        </view>

        <view class="section-head">
          <text class="section-title">相关推荐</text>
        </view>
        <view class="card">
          <view
            v-for="item in detail.related || []"
            :key="item.id"
            class="list-item"
            @click="openArticle(item.id)"
          >
            <view class="item-icon">{{ item.coverIcon }}</view>
            <view class="item-body">
              <text class="item-title clamp-2">{{ item.title }}</text>
              <text class="item-sub">{{ item.channel }} · {{ timeAgo(item.publishedAt) }}</text>
            </view>
            <text class="item-arrow">›</text>
          </view>
        </view>
      </view>

      <view class="action-bar">
        <view class="icon-btn" @click="like">
          <text>{{ liked ? '👍' : '👍' }}</text>
          <text>{{ detail.likeCount }}</text>
        </view>
        <view class="icon-btn" @click="commenting = true">
          <text>💬</text>
          <text>{{ detail.commentCount }}</text>
        </view>
        <view class="icon-btn" @click="toggleFavorite">
          <text>{{ favorited ? '★' : '☆' }}</text>
          <text>收藏</text>
        </view>
        <button class="btn btn-primary grow" @click="share">分享给同行</button>
      </view>

      <view v-if="commenting" class="comment-mask" @click="commenting = false">
        <view class="comment-sheet" @click.stop>
          <textarea
            v-model="commentText"
            class="textarea"
            placeholder="说说你的看法…"
            :maxlength="200"
            auto-height
          />
          <button class="btn btn-primary btn-block" :disabled="submitting" @click="submitComment">
            {{ submitting ? '提交中…' : '发表评论' }}
          </button>
        </view>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.article-page {
  padding-bottom: 180rpx;
  background: #ffffff;
}

.nav-holder {
  background: #ffffff;
}

.head {
  padding: 10rpx 28rpx 22rpx;
}

.head .title {
  display: block;
  color: #0b1a12;
  font-size: 42rpx;
  font-weight: 750;
  line-height: 1.38;
}

.meta {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-top: 22rpx;
}

.avatar {
  display: flex;
  width: 64rpx;
  height: 64rpx;
  flex: 0 0 64rpx;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #e5f5eb;
  color: #0e5233;
  font-size: 26rpx;
  font-weight: 700;
}

.avatar.sm {
  width: 54rpx;
  height: 54rpx;
  flex: 0 0 54rpx;
  font-size: 22rpx;
}

.meta-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4rpx;
}

.body {
  padding: 0 28rpx;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin: 24rpx 0;
}

.attest {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-bottom: 20rpx;
  padding: 20rpx;
  border: 1rpx solid #d9e9df;
  border-radius: 18rpx;
  background: #f4faf6;
}

.attest-icon {
  font-size: 32rpx;
}

.attest-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4rpx;
}

.quote-card {
  margin-bottom: 8rpx;
  padding: 22rpx;
  border: 1rpx solid #e1e9e3;
  border-radius: 20rpx;
  background: linear-gradient(135deg, #f7fbf8, #eef6f1);
}

.quote-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.quote-title {
  display: block;
  margin-bottom: 6rpx;
  font-size: 26rpx;
  font-weight: 650;
}

.comment-list {
  padding: 6rpx 0;
}

.comment {
  display: flex;
  gap: 14rpx;
  padding: 18rpx 0;
  border-bottom: 1rpx solid #f1f5f2;
}

.comment:last-child {
  border-bottom: 0;
}

.comment-body {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 6rpx;
}

.comment-text {
  color: #34473b;
  font-size: 24rpx;
  line-height: 1.6;
}

.comment-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 40;
  display: flex;
  align-items: flex-end;
  background: rgba(6, 26, 16, 0.42);
}

.comment-sheet {
  width: 100%;
  padding: 24rpx 24rpx calc(24rpx + env(safe-area-inset-bottom));
  border-radius: 26rpx 26rpx 0 0;
  background: #ffffff;
}

.comment-sheet .btn {
  margin-top: 16rpx;
}
</style>

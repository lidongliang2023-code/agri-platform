<script setup lang="ts">
import { computed, ref } from 'vue'

const keyword = ref('')
const openIndex = ref(-1)

const faqs = [
  {
    q: '行情价格多久更新一次？',
    a: '批发市场报价由合作市场接口实时同步，一般 5-15 分钟一次；产地价由信息员每日 18:00 统一更新。页面上的「更新于」即最后一次采集时间。',
  },
  {
    q: '价格预警为什么不生效？',
    a: '常见原因有三个：①规则被暂停（开关关闭）；②阈值设置与当前价差距过大，短期不会触发；③免打扰时段内只入库不弹窗。可在「价格预警」页检查开关与阈值。',
  },
  {
    q: 'AI 回答准不准？能直接用药吗？',
    a: 'AI 回答基于平台农技知识库与病虫害图谱，页面会显示置信度与参考来源。置信度低于 80% 时建议转接在线农技专家。用药方案请以当地植保部门指导与农药标签为准。',
  },
  {
    q: '投稿后多久能发布？',
    a: '资讯与供需信息提交后进入平台审核队列，一般 2 小时内完成；涉及政策解读、价格预测的内容需二次复核，最长 1 个工作日。审核通过后自动上链存证。',
  },
  {
    q: '存证能证明什么？',
    a: '平台在内容审核通过后计算 SHA-256 内容哈希并上链，链上只保存哈希与元数据。任何内容改动都会导致哈希不一致，可在「内容验证」中随时复核。',
  },
  {
    q: '为什么换了手机还能看到我的发布？',
    a: '信息资讯模块的私域数据（我的发布、预警、订阅、收藏、AI 记录）按平台统一账号隔离，不绑定设备，因此换端登录同一账号即可看到。',
  },
]

const filtered = computed(() => {
  const key = keyword.value.trim()
  if (!key) return faqs
  return faqs.filter((item) => item.q.includes(key) || item.a.includes(key))
})

function toggle(index: number) {
  openIndex.value = openIndex.value === index ? -1 : index
}

function askAi() {
  uni.setStorageSync('info_ai_question', keyword.value.trim() || '大蒜叶子发黄是什么原因？')
  uni.switchTab({ url: '/pages/ai/index' })
}

function contact() {
  uni.showModal({
    title: '联系人工客服',
    content: '客服热线 400-000-0000（工作日 09:00-18:00）\n也可在「帮助与反馈」提交问题，平台将在 1 个工作日内回复。',
    showCancel: false,
  })
}

function feedback() {
  uni.showModal({
    title: '提交反馈',
    editable: true,
    placeholderText: '请描述你遇到的问题或建议',
    success: (result: { confirm: boolean; content?: string }) => {
      if (!result.confirm) return
      uni.showToast({ title: '反馈已提交，感谢支持', icon: 'none' })
    },
  })
}
</script>

<template>
  <view class="page">
    <view class="search-block">
      <view class="search-box">
        <text class="search-icon">⌕</text>
        <input v-model="keyword" class="search-input" placeholder="常见问题搜索" placeholder-class="ph" />
      </view>
    </view>

    <view class="page-pad">
      <view class="card faq-card">
        <view v-for="(item, index) in filtered" :key="item.q" class="faq">
          <view class="faq-q" @click="toggle(index)">
            <text class="q-text">{{ item.q }}</text>
            <text class="q-caret">{{ openIndex === index ? '⌃' : '⌄' }}</text>
          </view>
          <text v-if="openIndex === index" class="faq-a">{{ item.a }}</text>
        </view>
        <view v-if="!filtered.length" class="empty" style="min-height: 200rpx">
          <text>没有匹配的问题，试试问 AI 助手</text>
        </view>
      </view>

      <view class="card help-card">
        <view class="help-head">
          <text class="help-title">✦ 还没解决？</text>
          <text class="tiny">可转接在线农技专家，或提交反馈给客服团队</text>
        </view>
        <view class="help-actions">
          <button class="btn btn-primary grow" @click="askAi">问 AI 助手</button>
          <button class="btn btn-ghost grow" @click="contact">联系人工客服</button>
        </view>
        <button class="btn btn-block" style="margin-top: 14rpx" @click="feedback">提交问题反馈</button>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.search-block {
  padding: 16rpx 24rpx;
  background: #ffffff;
}

.search-box {
  display: flex;
  height: 76rpx;
  align-items: center;
  gap: 10rpx;
  padding: 0 20rpx;
  border-radius: 16rpx;
  background: #f2f5f3;
}

.search-icon {
  color: #94a198;
  font-size: 28rpx;
}

.search-input {
  height: 100%;
  flex: 1;
  font-size: 24rpx;
}

.ph {
  color: #b3c0b7;
}

.faq-card {
  padding: 6rpx 26rpx;
}

.faq {
  padding: 22rpx 0;
  border-bottom: 1rpx solid #edf2ee;
}

.faq:last-child {
  border-bottom: 0;
}

.faq-q {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
}

.q-text {
  flex: 1;
  font-size: 26rpx;
  font-weight: 600;
}

.q-caret {
  color: #94a198;
  font-size: 24rpx;
}

.faq-a {
  display: block;
  margin-top: 12rpx;
  padding: 16rpx;
  border-radius: 14rpx;
  background: #f6faf7;
  color: #53665a;
  font-size: 24rpx;
  line-height: 1.72;
}

.help-head {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  margin-bottom: 18rpx;
}

.help-title {
  color: #6b418d;
  font-size: 27rpx;
  font-weight: 700;
}

.help-actions {
  display: flex;
  gap: 14rpx;
}
</style>

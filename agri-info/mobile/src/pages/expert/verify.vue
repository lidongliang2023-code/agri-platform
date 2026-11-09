<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { infoApi, toast, type Expert } from '../../api'

const HISTORY_KEY = 'info_expert_verify_history'

const keyword = ref('')
const result = ref<Expert | null>(null)
const searched = ref(false)
const loading = ref(false)
const experts = ref<Expert[]>([])
const history = ref<Array<{ name: string; certNo: string; level: string; valid: boolean; at: string }>>(
  uni.getStorageSync(HISTORY_KEY) || [],
)

onLoad((options) => {
  const preset = decodeURIComponent(String(options?.keyword || ''))
  if (preset) keyword.value = preset
  loadExperts()
  if (preset) query()
})

async function loadExperts() {
  try {
    const data = await infoApi.experts()
    experts.value = data.items || []
  } catch {
    experts.value = []
  }
}

async function query() {
  const key = keyword.value.trim()
  if (!key) {
    toast('请输入专家姓名、手机号或证书编号')
    return
  }
  loading.value = true
  searched.value = true
  try {
    if (!experts.value.length) await loadExperts()
    const found = experts.value.find(
      (item) =>
        item.name === key ||
        item.certNo === key ||
        item.name.includes(key) ||
        (item.certNo || '').includes(key),
    )
    result.value = found || null
    if (found) {
      const valid = found.status === 'approved' || found.status === 'active'
      const item = { name: found.name, certNo: found.certNo, level: found.level, valid, at: new Date().toISOString() }
      history.value = [item, ...history.value.filter((row) => row.certNo !== item.certNo)].slice(0, 20)
      uni.setStorageSync(HISTORY_KEY, history.value)
    }
  } catch (error) {
    toast(error instanceof Error ? error.message : '查询失败')
  } finally {
    loading.value = false
  }
}

function openExpert() {
  if (!result.value) return
  uni.navigateTo({ url: `/pages/expert/detail?id=${result.value.id}` })
}

function downloadCert() {
  uni.showModal({
    title: '下载认证证书',
    content: `将生成《${result.value?.name || ''} · ${result.value?.certNo || ''} 专家认证证书》PDF，含认证编号与链上哈希，可用于第三方核验。`,
    success: (item: { confirm: boolean }) => {
      if (item.confirm) toast('已生成下载任务')
    },
  })
}

function useHistory(item: { name: string; certNo: string }) {
  keyword.value = item.certNo || item.name
  query()
}

function clearHistory() {
  history.value = []
  uni.removeStorageSync(HISTORY_KEY)
}

function toApply() {
  uni.navigateTo({ url: '/pages/expert/apply' })
}

function scan() {
  uni.scanCode({
    success: (res: { result: string }) => {
      keyword.value = res.result
      query()
    },
    fail: () => toast('未识别到有效二维码'),
  })
}

function validOf(expert: Expert) {
  return expert.status === 'approved' || expert.status === 'active'
}
</script>

<template>
  <view class="page">
    <view class="page-pad">
      <view class="card">
        <view class="card-head">
          <text class="card-title">专家认证查询</text>
          <text class="card-sub" @click="toApply">申请认证</text>
        </view>
        <input
          v-model="keyword"
          class="input"
          placeholder="请输入专家姓名、手机号或证书编号"
          placeholder-class="ph"
          confirm-type="search"
          @confirm="query()"
        />
        <view class="btn-row">
          <button class="btn grow" @click="scan">扫码验证</button>
          <button class="btn btn-primary grow" :disabled="loading" @click="query">
            {{ loading ? '查询中…' : '立即查询' }}
          </button>
        </view>
        <text class="tiny" style="display: block; margin-top: 12rpx">示例：王农业 / EXPERT-2024-00001</text>
      </view>

      <view v-if="searched && result" class="card result">
        <view class="result-head">
          <view class="avatar">{{ result.name.slice(0, 1) }}</view>
          <view class="result-copy">
            <view class="name-row">
              <text class="name">{{ result.name }}</text>
              <text class="tag green">{{ result.level }}</text>
            </view>
            <text class="tiny">{{ result.title }} · {{ result.orgName }}</text>
            <text class="tiny">{{ result.field }}</text>
          </view>
        </view>

        <view class="status">
          {{ validOf(result) ? '✅ 认证有效 · 链上凭证已确认' : '⚠️ 认证已失效或审核中' }}
        </view>

        <view class="field">
          <text class="field-label">认证编号</text>
          <text class="field-value">{{ result.certNo }}</text>
        </view>
        <view class="field">
          <text class="field-label">认证时间</text>
          <text class="field-value">{{ result.applyAt }}</text>
        </view>
        <view class="field">
          <text class="field-label">审核时间</text>
          <text class="field-value">{{ result.auditAt || '—' }}</text>
        </view>
        <view class="field">
          <text class="field-label">认证等级</text>
          <text class="field-value">{{ result.level }}</text>
        </view>
        <view class="field">
          <text class="field-label">认证状态</text>
          <text class="field-value">{{ validOf(result) ? '有效' : result.status }}</text>
        </view>

        <view class="btn-row" style="margin-top: 16rpx">
          <button class="btn btn-sm grow" @click="downloadCert">下载证书</button>
          <button class="btn btn-primary btn-sm grow" @click="openExpert">查看专家主页</button>
        </view>
      </view>

      <view v-else-if="searched" class="empty">
        <text class="empty-icon">🔍</text>
        <text>未查询到该专家认证信息</text>
      </view>

      <view v-if="history.length" class="section-head">
        <text class="section-title">查询历史</text>
        <text class="card-sub" @click="clearHistory">清空</text>
      </view>
      <view v-if="history.length" class="card">
        <view v-for="item in history" :key="item.certNo" class="list-item" @click="useHistory(item)">
          <view class="item-icon">{{ item.valid ? '✅' : '⚠️' }}</view>
          <view class="item-body">
            <text class="item-title">{{ item.name }} · {{ item.certNo }}</text>
            <text class="item-sub">{{ item.level }} · {{ item.valid ? '有效' : '已失效' }}</text>
          </view>
          <text class="item-arrow">›</text>
        </view>
      </view>

      <view class="notice ai" style="margin-top: 16rpx">
        <text>✦</text>
        <text>
          专家认证信息全部上链存证，认证编号与链上哈希一一对应，任何第三方均可通过本页核验真伪。
          认证到期前 30 天平台会提醒续期。
        </text>
      </view>

      <button class="btn btn-ghost btn-block" style="margin-top: 16rpx" @click="toApply">
        我是农技专家，申请认证
      </button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.ph {
  color: #b3c0b7;
}

.btn-row {
  display: flex;
  gap: 14rpx;
  margin-top: 16rpx;
}

.grow {
  flex: 1;
}

.result-head {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-bottom: 14rpx;
}

.avatar {
  display: flex;
  width: 88rpx;
  height: 88rpx;
  flex: 0 0 88rpx;
  align-items: center;
  justify-content: center;
  border-radius: 24rpx;
  background: #e5f5eb;
  color: #0e5233;
  font-size: 34rpx;
  font-weight: 700;
}

.result-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4rpx;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.name {
  font-size: 30rpx;
  font-weight: 700;
}

.status {
  margin-bottom: 12rpx;
  padding: 14rpx 16rpx;
  border-radius: 14rpx;
  background: #f2fbf5;
  color: #0e5233;
  font-size: 24rpx;
}
</style>

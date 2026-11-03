<template>
  <div class="mds-page">
    <PageHeader
      title="实名认证"
      subtitle="个人实名核验的只读视图：提交、核验与审核结果。提交与修改在用户中心办理。"
      source="只读 · 用户中心主责"
    >
      <template #actions>
        <button class="mds-btn" @click="openUserCenter">前往用户中心 · 实名认证</button>
        <button class="mds-btn" :disabled="loading" @click="load">刷新</button>
      </template>
    </PageHeader>

    <NoticeBar tone="info" title="只读视图：">
      证件号由服务端掩码返回，前端不接触明文；驳回原因可在此核对，重新提交请到用户中心。
    </NoticeBar>

    <div v-if="loading" class="mds-card"><div class="mds-card-body mds-empty">正在加载实名信息…</div></div>

    <template v-else>
      <div class="mds-card">
        <div class="mds-card-head">
          <div>
            <h2 class="mds-card-title">认证进度</h2>
            <p class="mds-card-sub">{{ identity ? '按当前记录状态推导' : '尚未提交实名信息' }}</p>
          </div>
          <StatusTag :text="statusText(identity?.status)" :tone="statusTone(identity?.status)" />
        </div>
        <div class="mds-card-body">
          <div class="mds-steps">
            <div class="mds-step" :class="stepClass(1)">
              <span class="mds-step__no">1</span>提交身份信息
            </div>
            <span class="mds-step__line" />
            <div class="mds-step" :class="stepClass(2)">
              <span class="mds-step__no">2</span>公安核验 / 活体
            </div>
            <span class="mds-step__line" />
            <div class="mds-step" :class="stepClass(3)">
              <span class="mds-step__no">3</span>人工审核
            </div>
            <span class="mds-step__line" />
            <div class="mds-step" :class="stepClass(4)">
              <span class="mds-step__no">4</span>实名生效
            </div>
          </div>
          <p class="mds-hint" style="margin-top: 12px">
            核验结果来自记录上的 <code>policeVerified</code> / <code>livenessVerified</code> 字段；没有记录时四步都未开始。
          </p>
        </div>
      </div>

      <div v-if="!identity" class="mds-card">
        <div class="mds-card-body">
          <EmptyState title="还没有实名记录" description="提交实名信息后，这里会显示证件掩码、核验结果与审核意见。">
            <button class="mds-btn" style="margin-top: 12px" @click="openUserCenter">去用户中心提交</button>
          </EmptyState>
        </div>
      </div>

      <div v-else class="mds-card" style="margin-bottom: 0">
        <div class="mds-card-head">
          <h2 class="mds-card-title">认证信息</h2>
        </div>
        <div class="mds-card-body">
          <div class="mds-kv-grid">
            <div class="mds-kv"><span class="mds-kv__k">姓名</span><span class="mds-kv__v">{{ identity.realName || '—' }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">证件号</span><span class="mds-kv__v mds-mono">{{ identity.idNoMasked || '—' }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">身份编号</span><span class="mds-kv__v mds-mono">{{ identity.identityNo || '—' }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">公安核验</span><span class="mds-kv__v">{{ identity.policeVerified ? '已核对' : '未核对' }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">活体检测</span><span class="mds-kv__v">{{ identity.livenessVerified ? '已通过' : '未通过' }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">提交时间</span><span class="mds-kv__v">{{ formatTime(identity.submitTime) }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">审核时间</span><span class="mds-kv__v">{{ formatTime(identity.reviewTime) }}</span></div>
            <div class="mds-kv" style="grid-column: 1 / -1">
              <span class="mds-kv__k">审核意见</span><span class="mds-kv__v">{{ identity.reviewRemark || '—' }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { getMyRealName, type MyIdentity } from '@/utils/me'

const loading = ref(false)
const identity = ref<MyIdentity | null>(null)

const STATUS_TEXT: Record<string, string> = {
  verified: '已实名',
  approved: '已实名',
  pending: '审核中',
  rejected: '已驳回',
  draft: '未提交',
}
const statusText = (status?: string | null) => STATUS_TEXT[status ?? ''] ?? status ?? '未提交'
const statusTone = (status?: string | null) => {
  if (status === 'verified' || status === 'approved') return 'success'
  if (status === 'pending') return 'warning'
  if (status === 'rejected') return 'danger'
  return 'gray'
}

/** 1 提交 / 2 核验 / 3 审核 / 4 生效 */
const reachedStep = computed(() => {
  const record = identity.value
  if (!record) return 0
  if (record.status === 'verified' || record.status === 'approved') return 4
  if (record.status === 'rejected') return 3
  if (record.status === 'pending') {
    return record.policeVerified || record.livenessVerified ? 3 : 2
  }
  return 1
})
const stepClass = (step: number) => {
  if (step < reachedStep.value) return 'is-done'
  if (step === reachedStep.value) return 'is-current'
  return ''
}

const formatTime = (value?: string) => (value ? String(value).replace('T', ' ').slice(0, 16) : '—')

function openUserCenter() {
  window.open(`${window.location.protocol}//${window.location.hostname}:8115/user-center-ops/`, '_blank', 'noopener')
}

async function load() {
  loading.value = true
  try {
    const response = await getMyRealName().catch(() => null)
    identity.value = (response?.data ?? null) as MyIdentity | null
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

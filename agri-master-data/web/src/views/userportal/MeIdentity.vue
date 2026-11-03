<template>
  <div class="mds-page">
    <PageHeader
      title="我的身份"
      subtitle="当前账号的实名身份记录与业务身份索引。身份的开通、认证与切换由用户中心统一维护。"
      source="只读 · 用户中心主责"
    >
      <template #actions>
        <button class="mds-btn" @click="openUserCenter">前往用户中心 · 身份管理</button>
        <button class="mds-btn" :disabled="loading" @click="load">刷新</button>
      </template>
    </PageHeader>

    <NoticeBar tone="info" title="只读视图：">
      平台目前只提供“个人实名”这一条身份记录（<code>/identity/real-name/mine</code>）；
      收购商 / 服务商等业务身份还没有对应的自助接口，因此本页不会列出虚构的多身份卡片。
    </NoticeBar>

    <div v-if="loading" class="mds-card"><div class="mds-card-body mds-empty">正在加载身份信息…</div></div>

    <div v-else-if="!identity" class="mds-card">
      <div class="mds-card-body">
        <EmptyState
          icon="🪪"
          title="还没有实名身份记录"
          description="完成实名认证后，这里会显示身份编号、证件掩码与认证状态。"
        >
          <div class="mds-head-actions" style="justify-content: center; margin-top: 12px">
            <button class="mds-btn" @click="router.push('/user/realname')">查看实名认证</button>
            <button class="mds-btn" @click="openUserCenter">去用户中心提交</button>
          </div>
        </EmptyState>
      </div>
    </div>

    <div v-else class="mds-grid mds-grid--2">
      <div class="mds-card" style="margin-bottom: 0">
        <div class="mds-card-head">
          <div>
            <h2 class="mds-card-title">个人实名身份</h2>
            <p class="mds-card-sub">{{ identity.identityNo || '—' }}</p>
          </div>
          <StatusTag :text="statusText(identity.status)" :tone="statusTone(identity.status)" />
        </div>
        <div class="mds-card-body">
          <div class="mds-kv-grid" style="grid-template-columns: repeat(2, minmax(0, 1fr))">
            <div class="mds-kv"><span class="mds-kv__k">姓名</span><span class="mds-kv__v">{{ identity.realName || '—' }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">证件号</span><span class="mds-kv__v mds-mono">{{ identity.idNoMasked || '—' }}</span></div>
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

      <div class="mds-card" style="margin-bottom: 0">
        <div class="mds-card-head">
          <h2 class="mds-card-title">业务身份</h2>
        </div>
        <div class="mds-card-body">
          <EmptyState
            icon="🎭"
            title="业务身份暂未接入"
            description="收购商 / 零售商 / 服务商等身份的自助查询接口尚未提供；在用户中心完成开通后，这里仍需后端补充接口才能展示。"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { getMyRealName, type MyIdentity } from '@/utils/me'

const router = useRouter()
const loading = ref(false)
const identity = ref<MyIdentity | null>(null)

const STATUS_TEXT: Record<string, string> = {
  verified: '已实名',
  approved: '已实名',
  pending: '审核中',
  rejected: '已驳回',
  draft: '未提交',
}
const statusText = (status?: string) => STATUS_TEXT[status ?? ''] ?? status ?? '未提交'
const statusTone = (status?: string) => {
  if (status === 'verified' || status === 'approved') return 'success'
  if (status === 'pending') return 'warning'
  if (status === 'rejected') return 'danger'
  return 'gray'
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

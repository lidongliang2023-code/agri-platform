<template>
  <div class="mds-page">
    <PageHeader
      title="资料与安全"
      subtitle="当前统一账号的基础资料、实名状态与安全项；账号级设置由用户中心统一维护。"
      source="只读 · 用户中心主责"
    >
      <template #actions>
        <button class="mds-btn" @click="openUserCenter">前往用户中心 · 资料与安全</button>
        <button class="mds-btn" :disabled="loading" @click="load">刷新</button>
      </template>
    </PageHeader>

    <NoticeBar tone="info" title="只读视图：">
      昵称、手机号、密码与二次验证都在用户中心修改；本页展示的是这些设置在企业端的使用结果（如实名是否生效）。
    </NoticeBar>

    <div class="mds-grid mds-grid--2">
      <div class="mds-card" style="margin-bottom: 0">
        <div class="mds-card-head">
          <h2 class="mds-card-title">账号资料</h2>
        </div>
        <div class="mds-card-body">
          <div class="profile-head">
            <span class="avatar">{{ initial }}</span>
            <div>
              <strong>{{ userInfo.nickname || userInfo.username || '未命名账号' }}</strong>
              <small>{{ userInfo.username || '—' }} · {{ userInfo.roles?.join(' / ') || '未分配角色' }}</small>
            </div>
          </div>
          <div class="mds-kv-grid" style="grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 14px">
            <div class="mds-kv"><span class="mds-kv__k">登录账号</span><span class="mds-kv__v mds-mono">{{ userInfo.username || '—' }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">昵称</span><span class="mds-kv__v">{{ userInfo.nickname || '—' }}</span></div>
            <div class="mds-kv" style="grid-column: 1 / -1">
              <span class="mds-kv__k">平台角色</span>
              <span class="mds-kv__v">
                <StatusTag v-for="role in userInfo.roles || []" :key="role" :text="role" tone="gray" plain />
                <span v-if="!userInfo.roles?.length" class="mds-muted">未分配</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="mds-card" style="margin-bottom: 0">
        <div class="mds-card-head">
          <div>
            <h2 class="mds-card-title">实名与安全</h2>
            <p class="mds-card-sub">实名状态来自个人实名记录，其余安全项需到用户中心查看</p>
          </div>
        </div>
        <div class="mds-card-body mds-card-body--flush">
          <div class="sec-row">
            <span class="sec-label">个人实名</span>
            <StatusTag :text="realnameText" :tone="realnameTone" />
          </div>
          <div class="sec-row">
            <span class="sec-label">证件号</span>
            <span class="sec-value mds-mono">{{ identity?.idNoMasked || '—' }}</span>
          </div>
          <div class="sec-row">
            <span class="sec-label">公安核验</span>
            <span class="sec-value">{{ identity?.policeVerified ? '已核对' : '未核对' }}</span>
          </div>
          <div class="sec-row">
            <span class="sec-label">登录密码</span>
            <span class="sec-value mds-muted">在用户中心修改</span>
          </div>
          <div class="sec-row">
            <span class="sec-label">二次验证（2FA）</span>
            <span class="sec-value mds-muted">平台暂无自助接口</span>
          </div>
          <div class="sec-row">
            <span class="sec-label">登录设备</span>
            <span class="sec-value mds-muted">在用户中心的会话管理查看</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import { useSessionStore } from '@/stores/session'
import { getMyRealName, type MyIdentity } from '@/utils/me'

const session = useSessionStore()
const loading = ref(false)
const identity = ref<MyIdentity | null>(null)

const userInfo = computed(() => session.user ?? { username: '', nickname: '', roles: [] })
const initial = computed(() => (userInfo.value.nickname || userInfo.value.username || '用').slice(0, 1))

const realnameText = computed(() => {
  const status = identity.value?.status
  if (status === 'verified' || status === 'approved') return '已实名'
  if (status === 'pending') return '审核中'
  if (status === 'rejected') return '已驳回'
  return '未实名'
})
const realnameTone = computed(() => {
  const status = identity.value?.status
  if (status === 'verified' || status === 'approved') return 'success'
  if (status === 'pending') return 'warning'
  if (status === 'rejected') return 'danger'
  return 'gray'
})

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

<style scoped>
.profile-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar {
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: linear-gradient(135deg, #159a5e, #0ea5e9);
  color: #fff;
  font-size: 17px;
  font-weight: 700;
}

.profile-head strong {
  display: block;
  font-size: 15px;
}

.profile-head small {
  color: var(--mds-text-3);
  font-size: 12px;
}

.sec-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 18px;
  border-bottom: 1px solid var(--mds-line-soft);
  font-size: 13px;
}

.sec-row:last-child {
  border-bottom: 0;
}

.sec-label {
  color: var(--mds-text-2);
}

.sec-value {
  text-align: right;
}
</style>

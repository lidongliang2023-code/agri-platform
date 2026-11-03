<template>
  <div class="mds-page">
    <PageHeader
      title="资质证照"
      subtitle="当前主体提交的企业资质认证记录：营业执照、法人信息与对公核验结果。"
      source="只读 · 用户中心主责"
    >
      <template #actions>
        <button class="mds-btn" @click="openUserCenter">前往用户中心 · 证照管理</button>
        <button class="mds-btn" :disabled="loading" @click="load">刷新</button>
      </template>
    </PageHeader>

    <NoticeBar tone="info" title="只读视图：">
      证照的上传、续期与变更由用户中心运营端办理；本页展示当前主体的认证记录与审核意见。
      主体认证未通过时，交易/金融模块的相关能力会受限。
    </NoticeBar>

    <div v-if="loading" class="mds-card"><div class="mds-card-body mds-empty">正在加载资质记录…</div></div>

    <div v-else-if="!certs.length" class="mds-card">
      <div class="mds-card-body">
        <EmptyState
          icon="📄"
          title="还没有企业资质认证记录"
          description="当前主体尚未提交企业资质认证；未认证时交易与金融模块的能力会受限。"
        >
          <button class="mds-btn" style="margin-top: 12px" @click="openUserCenter">去用户中心提交</button>
        </EmptyState>
      </div>
    </div>

    <div v-else class="cert-grid">
      <article v-for="item in certs" :key="item.id" class="mds-card cert-card">
        <div class="mds-card-head">
          <div>
            <h2 class="mds-card-title">{{ item.companyName || item.merchantName }}</h2>
            <p class="mds-card-sub">{{ item.certNo }}</p>
          </div>
          <StatusTag :text="statusText(item.certStatus)" :tone="statusTone(item.certStatus)" />
        </div>
        <div class="mds-card-body">
          <div class="mds-kv-grid" style="grid-template-columns: repeat(2, minmax(0, 1fr))">
            <div class="mds-kv"><span class="mds-kv__k">统一信用代码</span><span class="mds-kv__v mds-mono">{{ item.creditCode || '—' }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">法人代表</span><span class="mds-kv__v">{{ item.legalPerson || '—' }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">联系人</span><span class="mds-kv__v">{{ item.contactName || '—' }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">联系电话</span><span class="mds-kv__v mds-mono">{{ item.contactPhone || '—' }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">提交时间</span><span class="mds-kv__v">{{ formatTime(item.submitTime) }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">审核时间</span><span class="mds-kv__v">{{ formatTime(item.reviewTime) }}</span></div>
            <div class="mds-kv" style="grid-column: 1 / -1">
              <span class="mds-kv__k">审核意见</span><span class="mds-kv__v">{{ item.reviewRemark || '—' }}</span>
            </div>
          </div>
          <div class="cert-files">
            <span :class="['file-chip', item.businessLicenseUrl ? 'is-ok' : '']">营业执照</span>
            <span :class="['file-chip', item.businessLicenseUrl ? 'is-ok' : '']">法人身份证</span>
            <span class="mds-hint" style="margin-left: 6px">
              影像材料按需向用户中心申请查看，本页不直接暴露文件地址
            </span>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { getMyCertifications, type MyCertification } from '@/utils/me'

const loading = ref(false)
const certs = ref<MyCertification[]>([])

const STATUS_TEXT: Record<string, string> = {
  approved: '已通过',
  verified: '已通过',
  pending: '审核中',
  rejected: '已驳回',
  draft: '草稿',
  unverified: '未提交',
}
const statusText = (status?: string) => STATUS_TEXT[status ?? ''] ?? status ?? '未提交'
const statusTone = (status?: string) => {
  if (status === 'approved' || status === 'verified') return 'success'
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
    const response = await getMyCertifications().catch(() => null)
    certs.value = (response?.data ?? []) as MyCertification[]
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.cert-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
  gap: 16px;
}

.cert-card {
  margin-bottom: 0;
}

.cert-files {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--mds-line);
}

.file-chip {
  padding: 2px 9px;
  border-radius: 999px;
  background: var(--mds-gray-soft);
  color: var(--mds-text-2);
  font-size: var(--agri-font-size-micro);
}

.file-chip.is-ok {
  background: var(--mds-brand-soft);
  color: var(--mds-brand-deep);
}
</style>

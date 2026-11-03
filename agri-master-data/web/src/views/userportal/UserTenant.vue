<template>
  <div class="mds-page">
    <PageHeader
      title="租户与套餐"
      subtitle="当前主体信息与主数据用量计数；套餐额度与账单由订阅计费引擎维护，本页只做只读展示。"
      source="主数据 · 我的主体"
    >
      <template #actions>
        <button class="mds-btn" :disabled="loading" @click="load">刷新</button>
      </template>
    </PageHeader>

    <NoticeBar tone="info" title="说明：">
      下方是<b>真实计数</b>（组织 / 成员 / 商品 / 客户 / 供应商），不是套餐额度；
      额度、账单与升降级在订阅计费侧，本端暂无自助接口。
    </NoticeBar>

    <div class="mds-grid mds-grid--2">
      <div class="mds-card" style="margin-bottom: 0">
        <div class="mds-card-head">
          <div>
            <h2 class="mds-card-title">主体信息</h2>
            <p class="mds-card-sub">来自统一认证的主体绑定</p>
          </div>
          <StatusTag :text="verifyText(me.current?.verifyStatus)" :tone="verifyTone(me.current?.verifyStatus)" />
        </div>
        <div class="mds-card-body">
          <div class="mds-kv-grid" style="grid-template-columns: repeat(2, minmax(0, 1fr))">
            <div class="mds-kv"><span class="mds-kv__k">主体名称</span><span class="mds-kv__v">{{ me.current?.merchantName || '—' }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">主体 ID</span><span class="mds-kv__v mds-mono">{{ me.current?.merchantId || '—' }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">主体类型</span><span class="mds-kv__v">{{ typeText(me.current?.merchantType) }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">我的角色</span><span class="mds-kv__v">{{ roleText(me.current?.roleInMerchant) }}</span></div>
            <div class="mds-kv"><span class="mds-kv__k">加入时间</span><span class="mds-kv__v">{{ formatTime(me.current?.createdAt) }}</span></div>
          </div>
        </div>
      </div>

      <div class="mds-card" style="margin-bottom: 0">
        <div class="mds-card-head">
          <div>
            <h2 class="mds-card-title">套餐与账单</h2>
            <p class="mds-card-sub">订阅计费引擎提供</p>
          </div>
          <StatusTag text="未接入" tone="gray" plain />
        </div>
        <div class="mds-card-body">
          <EmptyState
            icon="🧾"
            title="套餐与账单暂未接入"
            description="本端没有订阅计费的只读接口，因此不显示任何额度或账单数字；需要查看请联系平台运营。"
          />
        </div>
      </div>
    </div>

    <div class="mds-card" style="margin-top: 16px">
      <div class="mds-card-head">
        <div>
          <h2 class="mds-card-title">主数据用量</h2>
          <p class="mds-card-sub">按当前主体实时计数（不是套餐上限）</p>
        </div>
      </div>
      <div class="mds-card-body mds-card-body--flush">
        <div v-if="!summary" class="mds-empty">正在加载用量…</div>
        <table v-else class="mds-table">
          <thead>
            <tr>
              <th>统计项</th>
              <th class="mds-num">当前数量</th>
              <th>数据来源</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in usageRows" :key="row.name">
              <td class="mds-name">{{ row.name }}</td>
              <td class="mds-num">{{ row.value }}</td>
              <td class="mds-muted">{{ row.source }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { userGet } from '@/utils/userApi'
import { useMeStore } from '@/stores/me'

interface Summary {
  merchantId?: string
  orgCount?: number
  memberCount?: number
  productCount?: number
  customerCount?: number
  supplierCount?: number
}

const me = useMeStore()
const loading = ref(false)
const summary = ref<Summary | null>(null)

const ROLE_TEXT: Record<string, string> = { owner: '负责人', admin: '管理员', member: '成员', finance: '财务' }
const roleText = (code?: string) => ROLE_TEXT[code ?? ''] ?? code ?? '成员'
const TYPE_TEXT: Record<string, string> = { BOTH: '企业 + 个人', ENTERPRISE: '企业主体', PERSONAL: '个人主体' }
const typeText = (type?: string) => TYPE_TEXT[type ?? ''] ?? type ?? '—'

const VERIFY_TEXT: Record<string, string> = {
  approved: '已认证',
  verified: '已认证',
  pending: '认证中',
  rejected: '已驳回',
  unverified: '未认证',
}
const verifyText = (status?: string) => VERIFY_TEXT[status ?? ''] ?? status ?? '未认证'
const verifyTone = (status?: string) => {
  if (status === 'approved' || status === 'verified') return 'success'
  if (status === 'pending') return 'warning'
  if (status === 'rejected') return 'danger'
  return 'gray'
}
const formatTime = (value?: string) => (value ? String(value).replace('T', ' ').slice(0, 16) : '—')

const usageRows = computed(() => [
  { name: '组织节点', value: summary.value?.orgCount ?? '—', source: 'agri_md_organization' },
  { name: '成员账号', value: summary.value?.memberCount ?? '—', source: 'agri_md_user' },
  { name: '商品 SPU', value: summary.value?.productCount ?? '—', source: 'agri_md_product' },
  { name: '客户档案', value: summary.value?.customerCount ?? '—', source: 'agri_md_customer' },
  { name: '供应商档案', value: summary.value?.supplierCount ?? '—', source: 'agri_md_supplier' },
])

async function load() {
  loading.value = true
  try {
    await me.load()
    const response = await userGet<Summary>('/api/user/tenant-summary')
    summary.value = (response.data ?? null) as Summary | null
  } catch {
    summary.value = null
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

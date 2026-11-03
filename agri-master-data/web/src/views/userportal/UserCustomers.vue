<template>
  <div class="mds-page">
    <PageHeader
      title="客户档案"
      subtitle="本主体的客户档案：类型、等级、联系人与状态。数据按主体隔离。"
      source="主数据 · 我的主体"
    >
      <template #actions>
        <button class="mds-btn" :disabled="loading" @click="load">刷新</button>
      </template>
    </PageHeader>

    <div class="mds-card">
      <div class="mds-table-wrap">
        <table class="mds-table">
          <thead>
            <tr>
              <th>客户编码</th>
              <th>客户名称</th>
              <th>类型</th>
              <th class="mds-center">等级</th>
              <th>联系人</th>
              <th>联系电话</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading"><td colspan="7" class="mds-empty">正在加载客户…</td></tr>
            <tr v-else-if="!rows.length">
              <td colspan="7">
                <EmptyState
                  icon="🤝"
                  title="当前主体还没有客户档案"
                  description="主数据里没有属于该主体的客户记录；客户建档请到运营端或等待业务同步。"
                />
              </td>
            </tr>
            <tr v-for="row in rows" :key="row.id">
              <td class="mds-mono">{{ row.customerCode || '—' }}</td>
              <td class="mds-name">{{ row.customerName || '—' }}</td>
              <td><StatusTag :text="row.customerType === 'individual' ? '个人客户' : '企业客户'" :tone="row.customerType === 'individual' ? 'brand' : 'info'" plain /></td>
              <td class="mds-center"><StatusTag :text="row.level || '—'" :tone="levelTone(row.level)" plain /></td>
              <td>{{ row.contactName || '—' }}</td>
              <td class="mds-mono">{{ row.contactPhone || '—' }}</td>
              <td><StatusTag :text="Number(row.status) === 1 ? '正常' : '禁用'" :tone="Number(row.status) === 1 ? 'success' : 'gray'" /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { userGet } from '@/utils/userApi'
import { useMeStore } from '@/stores/me'

interface CustomerRow {
  id: number
  customerCode?: string
  customerName?: string
  customerType?: string
  level?: string
  contactName?: string
  contactPhone?: string
  status?: number
}

const me = useMeStore()
const rows = ref<CustomerRow[]>([])
const loading = ref(false)
const levelTone = (level?: string) => ({ A: 'purple', B: 'info', C: 'gray' }[level ?? ''] ?? 'gray')

/**
 * 走企业端统一接口 `/api/user/customers`。
 *
 * <p>原来用的是 `/api/customer/list`：同一份客户数据有两个接口、语义重叠，
 * 而且那个不支持分页与搜索。工作台已经用 `/api/user/customers`，
 * 这里统一过来，避免"同一个列表两处行为不一致"。</p>
 */
async function load() {
  loading.value = true
  try {
    await me.load()
    const response = await userGet<{ list: CustomerRow[]; total: number | string }>(
      '/api/user/customers',
      { pageNum: 1, pageSize: 100 },
    )
    if (response.code !== 200) throw new Error(response.message || '客户加载失败')
    rows.value = response.data?.list ?? []
  } catch {
    rows.value = []
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

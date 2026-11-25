<template>
  <div class="mds-page">
    <PageHeader
      title="客户档案"
      subtitle="本主体的客户档案：类型、等级、联系人与状态。数据按主体隔离。"
      source="主数据 · 我的主体"
    >
      
    </PageHeader>

    <div class="mds-card">
      <AgriVueTable
        :columns="columns"
        :data="rows.filter(item => !listAppliedKeyword1 || [item.customerCode, item.customerName, item.contactName].some(value => String(value ?? '').toLowerCase().includes(listAppliedKeyword1)))"
        row-key="id"
        :loading="loading"
        loading-text="正在加载客户…"
        column-settings-storage-key="mds:cols:user-customers"
        client-pagination
        v-model:page="listPage1"
        @refresh="load"
      >
        <template #filter>
          <AgriVueFilterBar :field-count="1" :loading="loading" @search="applyListFilter1" @reset="resetListFilter1">
            <div class="agri-vue-filter-field">
              <label>客户</label>
              <input v-model="listKeyword1" class="mds-input" type="search" />
            </div>
          </AgriVueFilterBar>
        </template>
        <template #empty>
          <EmptyState
                            icon="🤝"
                            title="当前主体还没有客户档案"
                            description="主数据里没有属于该主体的客户记录；客户建档请到运营端或等待业务同步。"
                          />
        </template>
        <template #cell-customerName="{ row: row }">
          <div class="mds-name">
            {{ row.customerName || '—' }}
          </div>
        </template>
        <template #cell-customerType="{ row: row }">
          <StatusTag :text="row.customerType === 'individual' ? '个人客户' : '企业客户'" :tone="row.customerType === 'individual' ? 'brand' : 'info'" plain />
        </template>
        <template #cell-level="{ row: row }">
          <StatusTag :text="row.level || '—'" :tone="levelTone(row.level)" plain />
        </template>
        <template #cell-status="{ row: row }">
          <StatusTag :text="Number(row.status) === 1 ? '正常' : '禁用'" :tone="Number(row.status) === 1 ? 'success' : 'gray'" />
        </template>
      </AgriVueTable>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AgriVueTable, AgriVueFilterBar, type VueListColumn } from '@agri/shared/vue/list'
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

const columns: VueListColumn[] = [
  { prop: 'customerCode', label: '客户编码', minWidth: 142, locked: true, kind: 'code' },
  { prop: 'customerName', label: '客户名称', width: 128 },
  { prop: 'customerType', label: '类型', width: 128, ellipsis: false },
  { prop: 'level', label: '等级', width: 128, align: 'center', ellipsis: false },
  { prop: 'contactName', label: '联系人', width: 128 },
  { prop: 'contactPhone', label: '联系电话', width: 142, kind: 'code' },
  { prop: 'status', label: '状态', width: 104, kind: 'status', ellipsis: false },
]

const listKeyword1 = ref('')
const listAppliedKeyword1 = ref('')

const listPage1 = ref(1)
function applyListFilter1() {
  listAppliedKeyword1.value = listKeyword1.value.trim().toLowerCase()
  listPage1.value = 1
}

function resetListFilter1() {
  listKeyword1.value = ''
  applyListFilter1()
}
</script>

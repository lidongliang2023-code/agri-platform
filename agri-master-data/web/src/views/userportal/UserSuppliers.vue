<template>
  <div class="mds-page">
    <PageHeader
      title="供应商档案"
      subtitle="本主体的供应商档案：类型、等级、联系人与状态。数据按主体隔离。"
      source="主数据 · 我的主体"
    >
      
    </PageHeader>

    <div class="mds-card">
      <AgriVueTable
        :columns="columns"
        :data="rows.filter(item => !listAppliedKeyword1 || [item.supplierCode, item.supplierName, item.contactPerson].some(value => String(value ?? '').toLowerCase().includes(listAppliedKeyword1)))"
        row-key="id"
        :loading="loading"
        loading-text="正在加载供应商…"
        column-settings-storage-key="mds:cols:user-suppliers"
        client-pagination
        v-model:page="listPage1"
        @refresh="load"
      >
        <template #filter>
          <AgriVueFilterBar :field-count="1" :loading="loading" @search="applyListFilter1" @reset="resetListFilter1">
            <div class="agri-vue-filter-field">
              <label>供应商</label>
              <input v-model="listKeyword1" class="mds-input" type="search" />
            </div>
          </AgriVueFilterBar>
        </template>
        <template #empty>
          <EmptyState
                            icon="🚚"
                            title="当前主体还没有供应商档案"
                            description="主数据里没有属于该主体的供应商记录；供应商建档请到运营端或等待业务同步。"
                          />
        </template>
        <template #cell-supplierName="{ row: row }">
          <div class="mds-name">
            {{ row.supplierName || '—' }}
          </div>
        </template>
        <template #cell-supplierType="{ row: row }">
          <StatusTag :text="typeText(row.supplierType)" tone="cyan" plain />
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

interface SupplierRow {
  id: number
  supplierCode?: string
  supplierName?: string
  supplierType?: string
  level?: string
  contactPerson?: string
  contactPhone?: string
  status?: number
}

const me = useMeStore()
const rows = ref<SupplierRow[]>([])
const loading = ref(false)
const typeText = (type?: string) =>
  ({ manufacturer: '生产厂家', dealer: '经销商', agent: '代理商' }[type ?? ''] ?? type ?? '—')
const levelTone = (level?: string) => ({ A: 'purple', B: 'info', C: 'gray' }[level ?? ''] ?? 'gray')

async function load() {
  loading.value = true
  try {
    await me.load()
    const response = await userGet<SupplierRow[]>('/api/supplier/list')
    if (response.code !== 200) throw new Error(response.message || '供应商加载失败')
    rows.value = response.data ?? []
  } catch {
    rows.value = []
  } finally {
    loading.value = false
  }
}

onMounted(load)

const columns: VueListColumn[] = [
  { prop: 'supplierCode', label: '供应商编码', minWidth: 142, locked: true, kind: 'code' },
  { prop: 'supplierName', label: '供应商名称', width: 128 },
  { prop: 'supplierType', label: '类型', width: 128, ellipsis: false },
  { prop: 'level', label: '等级', width: 128, align: 'center', ellipsis: false },
  { prop: 'contactPerson', label: '联系人', width: 128 },
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

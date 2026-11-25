<template>
  <div class="mds-page">
    <PageHeader
      title="商品 SPU 与 SKU"
      subtitle="本主体的标准商品档案（SPU）：编码、品类、价格与审核/上架状态。"
      source="主数据 · 我的主体"
    >
      
    </PageHeader>

    <div class="mds-card">

      <AgriVueTable
        :columns="columns"
        :data="rows"
        row-key="id"
        :loading="loading"
        loading-text="正在加载商品…"
        column-settings-storage-key="mds:cols:user-products"
        :page="page"
        :page-size="pageSize"
        :total="total"
        @page-change="(next, size) => size !== pageSize ? changePageSize(size) : changePage(next)"
        @refresh="load"
      >
        <template #filter>
          <AgriVueFilterBar :field-count="1" :loading="loading" @search="search" @reset="reset">
            <div class="agri-vue-filter-field">
              <label>关键字</label>
              <input v-model="keyword" class="mds-input" type="search" placeholder="商品名称 / 编码" />
            </div>
          </AgriVueFilterBar>
        </template>
        <template #empty>
          <EmptyState
                            icon="📦"
                            title="当前主体还没有商品档案"
                            description="SPU 由主体在商品档案中创建；主数据里暂无属于该主体的商品。"
                          />
        </template>
        <template #cell-productName="{ row: row }">
          <div class="mds-name">
            {{ row.productName || '—' }}
          </div>
        </template>
        <template #cell-price="{ row: row }">
          {{ money(row.price) }}
        </template>
        <template #cell-auditStatus="{ row: row }">
          <StatusTag :text="auditText(row.auditStatus)" :tone="auditTone(row.auditStatus)" />
        </template>
        <template #cell-status="{ row: row }">
          <StatusTag
                            :text="Number(row.status) === 1 ? '已上架' : '未上架'"
                            :tone="Number(row.status) === 1 ? 'success' : 'gray'"
                            plain
                          />
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

interface ProductRow {
  id: number
  productCode?: string
  productName?: string
  categoryName?: string
  brand?: string
  price?: number | string
  status?: number
  auditStatus?: string
}

const me = useMeStore()
const rows = ref<ProductRow[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const keyword = ref('')

const AUDIT_TEXT: Record<string, string> = { PENDING: '待审核', APPROVED: '已通过', REJECTED: '已驳回' }
const AUDIT_TONE: Record<string, 'warning' | 'success' | 'danger' | 'gray'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
}
const auditText = (status?: string) => AUDIT_TEXT[(status ?? '').toUpperCase()] ?? '未提交'
const auditTone = (status?: string) => AUDIT_TONE[(status ?? '').toUpperCase()] ?? 'gray'
const money = (value?: number | string) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? `¥${parsed.toFixed(2)}` : '—'
}

async function load() {
  loading.value = true
  try {
    await me.load()
    const response = await userGet<{ list: ProductRow[]; total: number | string }>('/api/user/products', {
      pageNum: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined,
    })
    if (response.code !== 200) throw new Error(response.message || '商品加载失败')
    rows.value = response.data?.list ?? []
    total.value = Number(response.data?.total ?? 0)
  } catch {
    rows.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function search() {
  page.value = 1
  void load()
}
function reset() {
  keyword.value = ''
  search()
}
function changePage(next: number) {
  page.value = next
  void load()
}
function changePageSize(size: number) {
  pageSize.value = size
  page.value = 1
  void load()
}

onMounted(load)

const columns: VueListColumn[] = [
  { prop: 'productCode', label: 'SPU 编码', minWidth: 142, locked: true, kind: 'code' },
  { prop: 'productName', label: '商品名称', width: 128 },
  { prop: 'categoryName', label: '品类', width: 128 },
  { prop: 'brand', label: '品牌', width: 128 },
  { prop: 'price', label: '参考价', width: 104, kind: 'number', ellipsis: false },
  { prop: 'auditStatus', label: '审核状态', width: 104, kind: 'status', ellipsis: false },
  { prop: 'status', label: '上架', width: 104, kind: 'status', ellipsis: false },
]
</script>

<style scoped>
.product-table {
  min-width: 900px;
}
</style>

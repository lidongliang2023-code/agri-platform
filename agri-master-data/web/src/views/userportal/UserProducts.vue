<template>
  <div class="mds-page">
    <PageHeader
      title="商品 SPU 与 SKU"
      subtitle="本主体的标准商品档案（SPU）：编码、品类、价格与审核/上架状态。"
      source="主数据 · 我的主体"
    >
      <template #actions>
        <button class="mds-btn" :disabled="loading" @click="load">刷新</button>
      </template>
    </PageHeader>

    <div class="mds-card">
      <div class="mds-filter">
        <input v-model="keyword" class="mds-input" type="search" placeholder="商品名称 / 编码" @keyup.enter="search" />
        <button class="mds-btn mds-btn--primary" @click="search">查询</button>
        <button class="mds-btn" @click="reset">重置</button>
      </div>

      <div class="mds-table-wrap">
        <table class="mds-table product-table">
          <thead>
            <tr>
              <th>SPU 编码</th>
              <th>商品名称</th>
              <th>品类</th>
              <th>品牌</th>
              <th class="mds-num">参考价</th>
              <th>审核状态</th>
              <th>上架</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading"><td colspan="7" class="mds-empty">正在加载商品…</td></tr>
            <tr v-else-if="!rows.length">
              <td colspan="7">
                <EmptyState
                  icon="📦"
                  title="当前主体还没有商品档案"
                  description="SPU 由主体在商品档案中创建；主数据里暂无属于该主体的商品。"
                />
              </td>
            </tr>
            <tr v-for="row in rows" :key="row.id">
              <td class="mds-mono">{{ row.productCode || '—' }}</td>
              <td class="mds-name">{{ row.productName || '—' }}</td>
              <td>{{ row.categoryName || '—' }}</td>
              <td>{{ row.brand || '—' }}</td>
              <td class="mds-num">{{ money(row.price) }}</td>
              <td><StatusTag :text="auditText(row.auditStatus)" :tone="auditTone(row.auditStatus)" /></td>
              <td>
                <StatusTag
                  :text="Number(row.status) === 1 ? '已上架' : '未上架'"
                  :tone="Number(row.status) === 1 ? 'success' : 'gray'"
                  plain
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <PagerBar :page="page" :page-size="pageSize" :total="total" @change="changePage" @update:page-size="changePageSize" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PagerBar from '@/components/ui/PagerBar.vue'
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
</script>

<style scoped>
.product-table {
  min-width: 900px;
}
</style>

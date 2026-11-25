<template>
  <div class="mds-page">
    <PageHeader
      title="商品（SPU）准入审核"
      subtitle="平台标准库 SPU 准入：按品类合规、属性完整与图文规范复核。审核只改 audit_status，不等于上架。"
      source="主数据 · SPU 审核"
    >
      
    </PageHeader>

    <StatGrid :items="statItems" />

    <NoticeBar tone="info" title="审核与上架是两件事：">
      通过审核只把 SPU 标为「已通过」，是否对外售卖由<b>上架状态</b>决定（官网上架商品页维护）。
      这样驳回过的商品不会因为一次误操作直接对外可见。
    </NoticeBar>

    <div class="mds-card">

      <AgriVueTable
        :columns="columns"
        :data="rows"
        row-key="id"
        :loading="loading"
        loading-text="正在加载 SPU…"
        column-settings-storage-key="mds:cols:spu-audit"
        :page="page"
        :page-size="pageSize"
        :total="total"
        @page-change="(next, size) => size !== pageSize ? changePageSize(size) : changePage(next)"
        @refresh="reloadAll"
      >
        <template #filter>
          <AgriVueFilterBar :field-count="3" :loading="loading" @search="search" @reset="reset">
            <div class="agri-vue-filter-field">
              <label>关键字</label>
              <input
                        v-model="filters.keyword"
                        class="mds-input"
                        type="search"
                        placeholder="搜索 SPU 编码 / 商品名称"
                      />
            </div>
            <div class="agri-vue-filter-field">
              <label>审核状态</label>
              <select v-model="filters.auditStatus" class="mds-select" @change="search">
                        <option value="PENDING">待审核</option>
                        <option value="APPROVED">已通过</option>
                        <option value="REJECTED">已驳回</option>
                        <option value="">全部审核状态</option>
                      </select>
            </div>
            <div class="agri-vue-filter-field">
              <label>品类</label>
              <select v-model="filters.categoryId" class="mds-select" @change="search">
                        <option value="">全部品类</option>
                        <option v-for="item in categories" :key="item.id" :value="String(item.id)">{{ item.name }}</option>
                      </select>
            </div>
          </AgriVueFilterBar>
        </template>
        <template #toolbar-left>
          <button class="mds-btn" @click="router.push('/product/catalog')">品类标准</button>
        </template>
        <template #empty>
          <EmptyState
                            title="没有符合条件的 SPU"
                            :description="`当前筛选：${auditLabel(filters.auditStatus) || '全部状态'}。审核状态存于 agri_md_product.audit_status。`"
                          />
        </template>
        <template #cell-productName="{ row: row }">
          <div class="mds-name">
            {{ row.productName || '—' }}
          </div>
        </template>
        <template #cell-brand="{ row: row }">
          <div>{{ row.brand || '—' }}</div>
                          <div class="mds-hint">{{ specText(row.specJson) }}</div>
        </template>
        <template #cell-price="{ row: row }">
          {{ money(row.price) }}
        </template>
        <template #cell-createTime="{ row: row }">
          <div class="mds-muted">
            {{ formatDate(row.createTime) }}
          </div>
        </template>
        <template #cell-auditStatus="{ row: row }">
          <StatusTag :text="auditLabel(row.auditStatus)" :tone="auditTone(row.auditStatus)" />
        </template>
        <template #cell-actions="{ row: row }">
          <MdsRowActions
            :actions="[
              { key: '1', label: &quot;详情&quot;, onClick: () => openDetail(row.id) },
              { key: '2', label: &quot;通过&quot;, onClick: () => decide(row, 'APPROVED'), disabled: busyId === row.id || row.auditStatus === 'APPROVED' },
              { key: '3', label: &quot;驳回&quot;, onClick: () => decide(row, 'REJECTED'), disabled: busyId === row.id || row.auditStatus === 'REJECTED', danger: true },
            ]"
          />
        </template>
      </AgriVueTable>
      
    </div>

    <div v-if="detail" class="mds-card">
      <div class="mds-card-head">
        <div>
          <h2 class="mds-card-title">SPU 详情 · {{ detail.productName }}</h2>
          <p class="mds-card-sub">{{ detail.productCode }} · {{ detail.categoryName || '未归类' }}</p>
        </div>
        <div class="mds-head-actions">
          <StatusTag :text="auditLabel(detail.auditStatus)" :tone="auditTone(detail.auditStatus)" />
          <button class="mds-btn" @click="detail = null">收起</button>
        </div>
      </div>
      <div class="mds-card-body">
        <div class="mds-kv-grid">
          <div class="mds-kv"><span class="mds-kv__k">商品名称</span><span class="mds-kv__v">{{ detail.productName || '—' }}</span></div>
          <div class="mds-kv"><span class="mds-kv__k">SPU 编码</span><span class="mds-kv__v mds-mono">{{ detail.productCode || '—' }}</span></div>
          <div class="mds-kv"><span class="mds-kv__k">所属品类</span><span class="mds-kv__v">{{ detail.categoryName || '—' }}</span></div>
          <div class="mds-kv"><span class="mds-kv__k">品牌</span><span class="mds-kv__v">{{ detail.brand || '—' }}</span></div>
          <div class="mds-kv"><span class="mds-kv__k">单价 / 单位</span><span class="mds-kv__v">{{ money(detail.price) }} / {{ detail.unit || '—' }}</span></div>
          <div class="mds-kv"><span class="mds-kv__k">产地</span><span class="mds-kv__v">{{ detail.origin || '—' }}</span></div>
          <div class="mds-kv"><span class="mds-kv__k">规格</span><span class="mds-kv__v">{{ specText(detail.specJson) }}</span></div>
          <div class="mds-kv"><span class="mds-kv__k">归属主体</span><span class="mds-kv__v mds-mono">{{ detail.tenantId || '—' }}</span></div>
          <div class="mds-kv"><span class="mds-kv__k">上架状态</span><span class="mds-kv__v">{{ Number(detail.status) === 1 ? '已上架' : '未上架' }}</span></div>
          <div class="mds-kv"><span class="mds-kv__k">提交人</span><span class="mds-kv__v">{{ detail.createBy || '—' }}</span></div>
          <div class="mds-kv"><span class="mds-kv__k">提交时间</span><span class="mds-kv__v">{{ formatDate(detail.createTime) }}</span></div>
          <div class="mds-kv"><span class="mds-kv__k">备注</span><span class="mds-kv__v">{{ detail.remark || '—' }}</span></div>
        </div>
        <div class="mds-form-actions">
          <button v-point="'PUT /admin/masterdata/product/{id}/audit'" class="mds-btn mds-btn--danger" :disabled="!detail.auditStatus || detail.auditStatus === 'REJECTED'" @click="decide(detail, 'REJECTED')">
            驳回
          </button>
          <button v-point="'PUT /admin/masterdata/product/{id}/audit'" class="mds-btn mds-btn--primary" :disabled="detail.auditStatus === 'APPROVED'" @click="decide(detail, 'APPROVED')">
            审核通过
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AgriVueTable, AgriVueFilterBar, type VueListColumn } from '@agri/shared/vue/list'
import MdsRowActions from '@/components/ui/MdsRowActions.vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatGrid, { type StatItem } from '@/components/ui/StatGrid.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import {
  auditProduct,
  getProductCategoryTree,
  getProductDetail,
  getProductList,
  getProductStatistics,
} from '@/utils/api'

interface SpuRow {
  id: number
  productCode?: string
  productName?: string
  categoryId?: number
  categoryName?: string
  brand?: string
  unit?: string
  origin?: string
  specJson?: string
  price?: number | string
  status?: number
  auditStatus?: string
  tenantId?: string
  createBy?: string
  createTime?: string
  remark?: string
}

interface CategoryNode {
  id: number
  categoryName: string
  children?: CategoryNode[]
}

const router = useRouter()
const rows = ref<SpuRow[]>([])
const detail = ref<SpuRow | null>(null)
const categories = ref<Array<{ id: number; name: string }>>([])
const loading = ref(false)
const busyId = ref<number | null>(null)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const stats = ref<{
  totalProducts?: number
  activeProducts?: number
  publishedProducts?: number
  pendingProducts?: number
  offlineProducts?: number
}>({})

const filters = reactive({ keyword: '', auditStatus: 'PENDING', categoryId: '' })

const statItems = computed<StatItem[]>(() => [
  { label: '待审核', value: stats.value.pendingProducts ?? 0, hint: 'PENDING', tone: 'warning' },
  { label: '已通过', value: stats.value.publishedProducts ?? 0, hint: 'APPROVED', tone: 'success' },
  { label: '已驳回', value: stats.value.offlineProducts ?? 0, hint: 'REJECTED', tone: 'danger' },
  { label: 'SPU 总数', value: stats.value.totalProducts ?? 0, hint: `已上架 ${stats.value.activeProducts ?? 0}` },
])

const AUDIT_TEXT: Record<string, string> = { PENDING: '待审核', APPROVED: '已通过', REJECTED: '已驳回' }
const AUDIT_TONE: Record<string, 'warning' | 'success' | 'danger' | 'gray'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
}
const auditLabel = (value?: string) => AUDIT_TEXT[(value ?? '').toUpperCase()] ?? '未提交'
const auditTone = (value?: string) => AUDIT_TONE[(value ?? '').toUpperCase()] ?? 'gray'

const money = (value?: number | string) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? `¥${parsed.toFixed(2)}` : '—'
}

const specText = (raw?: string) => {
  if (!raw) return '—'
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      return Object.entries(parsed)
        .map(([key, value]) => `${key}: ${String(value)}`)
        .join(' · ')
    }
  } catch {
    return raw
  }
  return String(raw)
}

const formatDate = (value?: string) => (value ? String(value).replace('T', ' ').slice(0, 16) : '—')

function flatten(nodes: CategoryNode[], out: Array<{ id: number; name: string }> = []) {
  nodes.forEach((node) => {
    out.push({ id: node.id, name: node.categoryName })
    if (node.children?.length) flatten(node.children, out)
  })
  return out
}

async function loadCategories() {
  try {
    const response = await getProductCategoryTree()
    if (response.code === 200) {
      categories.value = flatten((response.data ?? []) as CategoryNode[])
    }
  } catch {
    categories.value = []
  }
}

async function loadStats() {
  try {
    const response = await getProductStatistics()
    if (response.code === 200) {
      stats.value = (response.data ?? {}) as typeof stats.value
    }
  } catch {
    // 统计失败不影响列表；卡片显示 0 由接口字段决定，前端不编数
  }
}

async function loadList() {
  loading.value = true
  try {
    const response = await getProductList({
      pageNum: page.value,
      pageSize: pageSize.value,
      productName: filters.keyword || undefined,
      productCode: filters.keyword || undefined,
      categoryId: filters.categoryId || undefined,
      auditStatus: filters.auditStatus || undefined,
    })
    if (response.code !== 200) throw new Error(response.message || 'SPU 加载失败')
    rows.value = (response.data?.list ?? []) as SpuRow[]
    total.value = Number(response.data?.total ?? 0)
  } catch (error) {
    rows.value = []
    total.value = 0
    message.error(error instanceof Error ? error.message : 'SPU 加载失败')
  } finally {
    loading.value = false
  }
}

function reloadAll() {
  void loadList()
  void loadStats()
}

function search() {
  page.value = 1
  reloadAll()
}

function reset() {
  filters.keyword = ''
  filters.auditStatus = 'PENDING'
  filters.categoryId = ''
  search()
}

function changePage(next: number) {
  page.value = next
  void loadList()
}

function changePageSize(size: number) {
  pageSize.value = size
  page.value = 1
  void loadList()
}

async function openDetail(id: number) {
  try {
    const response = await getProductDetail(id)
    if (response.code !== 200) throw new Error(response.message || '详情加载失败')
    detail.value = (response.data ?? null) as SpuRow | null
    if (detail.value) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '详情加载失败')
  }
}

async function decide(row: SpuRow, auditStatus: 'APPROVED' | 'REJECTED') {
  if (auditStatus === 'REJECTED' && !window.confirm(`确认驳回「${row.productName}」？驳回只改审核状态，不会下架已上架商品。`)) {
    return
  }
  busyId.value = row.id
  try {
    const response = await auditProduct(row.id, auditStatus)
    if (response.code !== 200) throw new Error(response.message || '审核失败')
    message.success(auditStatus === 'APPROVED' ? 'SPU 已通过审核' : 'SPU 已驳回')
    if (detail.value?.id === row.id) {
      detail.value = { ...detail.value, auditStatus }
    }
    await loadList()
    await loadStats()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '审核失败')
  } finally {
    busyId.value = null
  }
}

onMounted(async () => {
  await loadCategories()
  await Promise.all([loadList(), loadStats()])
})

const columns: VueListColumn[] = [
  { prop: 'productCode', label: 'SPU 编码', minWidth: 142, locked: true, kind: 'code' },
  { prop: 'productName', label: '商品名称', width: 128 },
  { prop: 'categoryName', label: '品类', width: 128 },
  { prop: 'brand', label: '品牌 / 规格', width: 128, ellipsis: false },
  { prop: 'price', label: '参考价', width: 104, kind: 'number', ellipsis: false },
  { prop: 'tenantId', label: '归属主体', width: 128 },
  { prop: 'createTime', label: '提交时间', width: 152, ellipsis: false },
  { prop: 'auditStatus', label: '审核状态', width: 104, kind: 'status', ellipsis: false },
  { key: 'actions', label: '操作', width: 138, kind: 'action', ellipsis: false },
]
</script>

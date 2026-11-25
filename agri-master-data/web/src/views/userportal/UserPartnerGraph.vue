<template>
  <div class="mds-page">
    <PageHeader
      title="伙伴关系图"
      subtitle="本主体与客户、供应商之间的合作关系：交易次数、合作金额与等级。关系数据只展示本主体范围内。"
      source="主数据 · 客商关系"
    >
      
    </PageHeader>

    <StatGrid :items="statItems" />

    <NoticeBar tone="info" title="展示方式：">
      关系数据来自客商关系表（按主体过滤）。上方拓扑只画 TOP4、线宽按金额映射，完整清单见下表；
      节点数为 0 时表示本主体确实没有关系记录，而不是画不出来。
    </NoticeBar>

    <div class="mds-card">
      <div class="mds-card-head">
        <div>
          <h2 class="mds-card-title">关系拓扑</h2>
          <p class="mds-card-sub">中心为本主体，左右分别为客户与供应商；连线粗细按累计合作金额映射，仅展示 TOP 4</p>
        </div>
        <span class="mds-tag mds-tag--plain">{{ rows.length }} 条关系</span>
      </div>
      <div class="mds-card-body">
        <div v-if="!graph.nodes.length" class="mds-empty">暂无可绘制的客商关系</div>
        <svg v-else class="graph" :viewBox="`0 0 ${graph.width} ${graph.height}`" role="img" aria-label="客商关系拓扑">
          <line
            v-for="edge in graph.edges"
            :key="edge.key"
            :x1="graph.center.x"
            :y1="graph.center.y"
            :x2="edge.x"
            :y2="edge.y"
            stroke="#b9dfc9"
            :stroke-width="edge.width"
          />
          <g :transform="`translate(${graph.center.x}, ${graph.center.y})`">
            <rect x="-90" y="-26" width="180" height="52" rx="10" fill="#13a05a" />
            <text x="0" y="0" text-anchor="middle" fill="#fff" font-size="13" font-weight="700">本主体</text>
            <text x="0" y="16" text-anchor="middle" fill="rgba(255,255,255,.75)" font-size="10.5">
              {{ me.current?.merchantName || '—' }}
            </text>
          </g>
          <g v-for="node in graph.nodes" :key="node.key" :transform="`translate(${node.x}, ${node.y})`">
            <rect x="-78" y="-20" width="156" height="40" rx="8" :fill="node.side === 'customer' ? '#e9f6ef' : '#e3f2fd'" />
            <text x="0" y="-3" text-anchor="middle" font-size="11.5" fill="#1f2329">{{ node.label }}</text>
            <text x="0" y="12" text-anchor="middle" font-size="10" fill="#8f959e">
              {{ node.side === 'customer' ? '客户' : '供应商' }} · ¥{{ node.amount.toFixed(0) }}
            </text>
          </g>
        </svg>
        <div class="legend">
          <span><i class="dot dot--customer" />客户</span>
          <span><i class="dot dot--supplier" />供应商</span>
          <span>线宽 ≈ 累计合作金额</span>
        </div>
      </div>
    </div>

    <div class="mds-card">
      <AgriVueTable
        :columns="columns"
        :data="rows.filter(item => !listAppliedKeyword1 || [item.customerName, item.supplierName].some(value => String(value ?? '').toLowerCase().includes(listAppliedKeyword1)))"
        row-key="id"
        :loading="loading"
        loading-text="正在加载关系…"
        column-settings-storage-key="mds:cols:user-partner-graph"
        client-pagination
        v-model:page="listPage1"
        @refresh="load"
      >
        <template #filter>
          <AgriVueFilterBar :field-count="1" :loading="loading" @search="applyListFilter1" @reset="resetListFilter1">
            <div class="agri-vue-filter-field">
              <label>合作伙伴</label>
              <input v-model="listKeyword1" class="mds-input" type="search" />
            </div>
          </AgriVueFilterBar>
        </template>
        <template #empty>
          <EmptyState
                            icon="🕸️"
                            title="还没有客商关系数据"
                            description="关系由交易成交生成；主数据里暂无本主体的客户 / 供应商关系。"
                          />
        </template>
        <template #cell-customerName="{ row: row }">
          <div class="mds-name">
            {{ row.customerName || row.customerId }}
          </div>
        </template>
        <template #cell-supplierName="{ row: row }">
          <div class="mds-name">
            {{ row.supplierName || row.supplierId }}
          </div>
        </template>
        <template #cell-relationType="{ row: row }">
          {{ relationText(row.relationType) }}
        </template>
        <template #cell-transactionCount="{ row: row }">
          {{ row.transactionCount ?? 0 }}
        </template>
        <template #cell-totalAmount="{ row: row }">
          {{ money(row.totalAmount) }}
        </template>
        <template #cell-status="{ row: row }">
          <StatusTag :text="Number(row.status) === 1 ? '合作中' : '停用'" :tone="Number(row.status) === 1 ? 'success' : 'gray'" />
        </template>
      </AgriVueTable>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AgriVueTable, AgriVueFilterBar, type VueListColumn } from '@agri/shared/vue/list'
import { computed, onMounted, ref } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatGrid from '@/components/ui/StatGrid.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { userGet } from '@/utils/userApi'
import { useMeStore } from '@/stores/me'

interface RelationRow {
  id: string
  customerId?: string
  customerName?: string
  supplierId?: string
  supplierName?: string
  relationType?: string
  cooperationLevel?: string
  transactionCount?: number
  totalAmount?: number | string
  status?: number
}

const me = useMeStore()
const rows = ref<RelationRow[]>([])
const loading = ref(false)

const RELATION_TEXT: Record<string, string> = {
  LONG_TERM: '长期合作',
  NORMAL: '一般合作',
  TEMPORARY: '临时',
}
const relationText = (type?: string) => RELATION_TEXT[type ?? ''] ?? type ?? '—'
const money = (value?: number | string) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? `¥${parsed.toFixed(2)}` : '—'
}

/** 拓扑数据：按客户/供应商聚合金额，各取 TOP4；宽度按最大金额归一化 */
const graph = computed(() => {
  const customers = new Map()
  const suppliers = new Map()
  const bump = (map, id, name, amount) => {
    if (!id) return
    const key = String(id)
    const entry = map.get(key) ?? { key, label: name || key, amount: 0 }
    entry.amount += Number(amount) || 0
    if (name) entry.label = name
    map.set(key, entry)
  }
  rows.value.forEach((row) => {
    const amount = Number(row.totalAmount) || 0
    bump(customers, row.customerId, row.customerName, amount)
    bump(suppliers, row.supplierId, row.supplierName, amount)
  })
  const top = (map) => Array.from(map.values()).sort((a, b) => b.amount - a.amount).slice(0, 4)
  const left = top(customers)
  const right = top(suppliers)
  if (!left.length && !right.length) {
    return { width: 900, height: 320, center: { x: 450, y: 160 }, nodes: [], edges: [] }
  }
  const count = Math.max(left.length, right.length, 1)
  const height = Math.max(320, count * 84 + 60)
  const center = { x: 450, y: height / 2 }
  const maxAmount = Math.max(...[...left, ...right].map((node) => node.amount), 1)
  const place = (list, x, side) =>
    list.map((node, index) => ({
      ...node,
      side,
      x,
      y: center.y + (index - (list.length - 1) / 2) * 84,
      width: 1.5 + Math.min(6, (node.amount / maxAmount) * 6),
    }))
  const nodes = [...place(left, 150, 'customer'), ...place(right, 750, 'supplier')]
  return {
    width: 900,
    height,
    center,
    nodes,
    edges: nodes.map((node) => ({ key: node.key, x: node.x, y: node.y, width: node.width })),
  }
})

const statItems = computed(() => {
  const totalAmount = rows.value.reduce((sum, row) => sum + (Number(row.totalAmount) || 0), 0)
  const customers = new Set(rows.value.map((row) => row.customerId).filter(Boolean))
  const suppliers = new Set(rows.value.map((row) => row.supplierId).filter(Boolean))
  return [
    { label: '关系数', value: rows.value.length },
    { label: '客户数', value: customers.size, tone: 'brand' },
    { label: '供应商数', value: suppliers.size },
    { label: '累计合作金额', value: `¥${totalAmount.toFixed(2)}` },
  ]
})

async function load() {
  loading.value = true
  try {
    await me.load()
    const response = await userGet<RelationRow[]>('/api/user/relations')
    rows.value = response.data ?? []
  } catch {
    rows.value = []
  } finally {
    loading.value = false
  }
}

onMounted(load)

const columns: VueListColumn[] = [
  { prop: 'customerName', label: '客户', minWidth: 174, locked: true, ellipsis: false },
  { prop: 'supplierName', label: '供应商', width: 128, ellipsis: false },
  { prop: 'relationType', label: '关系类型', width: 128, ellipsis: false },
  { prop: 'cooperationLevel', label: '合作等级', width: 128 },
  { prop: 'transactionCount', label: '交易次数', width: 104, kind: 'number', ellipsis: false },
  { prop: 'totalAmount', label: '累计金额', width: 104, kind: 'number', ellipsis: false },
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

<style scoped>
.relation-table { min-width: 960px; }

.graph {
  width: 100%;
  height: auto;
  max-height: 420px;
}

.legend {
  display: flex;
  gap: 18px;
  align-items: center;
  margin-top: 8px;
  color: var(--mds-text-3);
  font-size: var(--agri-font-size-micro);
}

.legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 9px;
  height: 9px;
  border-radius: 2px;
  display: inline-block;
}

.dot--customer {
  background: #e9f6ef;
  border: 1px solid #b9dfc9;
}

.dot--supplier {
  background: #e3f2fd;
  border: 1px solid #b6d8f2;
}
</style>

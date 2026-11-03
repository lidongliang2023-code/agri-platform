<template>
  <div class="mds-page">
    <PageHeader
      title="我的品类"
      subtitle="平台标准品类（全租户共享，只读）与本主体自定义分类（仅本主体可见）。"
      source="主数据 · 我的主体"
    >
      <template #actions>
        <button class="mds-btn" :disabled="loading" @click="load">刷新</button>
      </template>
    </PageHeader>

    <NoticeBar tone="info" title="口径：">
      平台标准分类由平台统一维护，租户只能引用；「本主体自定义」标记的分类才是本主体可调整的。
    </NoticeBar>

    <StatGrid :items="statItems" />

    <div class="mds-card">
      <div class="mds-table-wrap">
        <table class="mds-table category-table">
          <thead>
            <tr>
              <th>分类名称</th>
              <th>分类编码</th>
              <th>归属</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading"><td colspan="4" class="mds-empty">正在加载品类…</td></tr>
            <tr v-else-if="!rows.length">
              <td colspan="4">
                <EmptyState
                  icon="🌳"
                  title="当前主体还没有可用品类"
                  description="平台标准品类尚未初始化（种子数据绑在演示租户上），主数据里也没有本主体自定义分类。"
                />
              </td>
            </tr>
            <tr v-for="row in flat" :key="row.id">
              <td>
                <span class="mds-name" :style="{ paddingLeft: `${row.depth * 16}px` }">{{ row.categoryName }}</span>
              </td>
              <td class="mds-mono">{{ row.categoryCode || '—' }}</td>
              <td>
                <StatusTag :text="row.custom ? '本主体自定义' : '平台标准'" :tone="row.custom ? 'brand' : 'info'" plain />
              </td>
              <td>
                <StatusTag :text="Number(row.status) === 1 ? '启用' : '停用'" :tone="Number(row.status) === 1 ? 'success' : 'gray'" />
              </td>
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
import StatGrid from '@/components/ui/StatGrid.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { userGet } from '@/utils/userApi'
import { useMeStore } from '@/stores/me'

interface CategoryRow {
  id: number
  categoryCode?: string
  categoryName?: string
  parentId?: number | null
  status?: number
  tenantId?: string | null
  custom?: boolean
}
interface CategoryNode extends CategoryRow {
  depth: number
}

const me = useMeStore()
const rows = ref<CategoryRow[]>([])
const loading = ref(false)

const statItems = computed(() => [
  { label: '分类总数', value: rows.value.length },
  { label: '平台标准', value: rows.value.filter((row) => !row.custom).length, tone: 'brand' },
  { label: '本主体自定义', value: rows.value.filter((row) => row.custom).length },
  { label: '启用中', value: rows.value.filter((row) => Number(row.status) === 1).length, tone: 'success' },
])

/** 平铺 → 按父子关系缩进；父节点缺失时按一级处理 */
const flat = computed<CategoryNode[]>(() => {
  const ids = new Set(rows.value.map((row) => String(row.id)))
  const byParent = new Map<string, CategoryRow[]>()
  rows.value.forEach((row) => {
    const parent = row.parentId && ids.has(String(row.parentId)) ? String(row.parentId) : '__root__'
    if (!byParent.has(parent)) byParent.set(parent, [])
    byParent.get(parent)!.push(row)
  })
  const out: CategoryNode[] = []
  const walk = (parent: string, depth: number) => {
    ;(byParent.get(parent) ?? []).forEach((row) => {
      out.push({ ...row, depth })
      walk(String(row.id), depth + 1)
    })
  }
  walk('__root__', 0)
  const seen = new Set(out.map((row) => String(row.id)))
  rows.value.forEach((row) => {
    if (!seen.has(String(row.id))) out.push({ ...row, depth: 0 })
  })
  return out
})

async function load() {
  loading.value = true
  try {
    await me.load()
    const response = await userGet<CategoryRow[]>('/api/user/categories')
    rows.value = response.data ?? []
  } catch {
    rows.value = []
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.category-table { min-width: 720px; }
</style>

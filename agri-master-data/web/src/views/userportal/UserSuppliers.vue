<template>
  <div class="mds-page">
    <PageHeader
      title="供应商档案"
      subtitle="本主体的供应商档案：类型、等级、联系人与状态。数据按主体隔离。"
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
              <th>供应商编码</th>
              <th>供应商名称</th>
              <th>类型</th>
              <th class="mds-center">等级</th>
              <th>联系人</th>
              <th>联系电话</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading"><td colspan="7" class="mds-empty">正在加载供应商…</td></tr>
            <tr v-else-if="!rows.length">
              <td colspan="7">
                <EmptyState
                  icon="🚚"
                  title="当前主体还没有供应商档案"
                  description="主数据里没有属于该主体的供应商记录；供应商建档请到运营端或等待业务同步。"
                />
              </td>
            </tr>
            <tr v-for="row in rows" :key="row.id">
              <td class="mds-mono">{{ row.supplierCode || '—' }}</td>
              <td class="mds-name">{{ row.supplierName || '—' }}</td>
              <td><StatusTag :text="typeText(row.supplierType)" tone="cyan" plain /></td>
              <td class="mds-center"><StatusTag :text="row.level || '—'" :tone="levelTone(row.level)" plain /></td>
              <td>{{ row.contactPerson || '—' }}</td>
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
</script>

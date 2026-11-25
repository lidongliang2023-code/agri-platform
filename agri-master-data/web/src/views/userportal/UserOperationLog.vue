<template>
  <div class="mds-page">
    <PageHeader
      title="操作记录"
      subtitle="本主体主数据变更的审计流水：谁、何时、对什么做了什么，结果可追溯。"
      source="主数据 · 审计日志"
    >
      
    </PageHeader>

    <NoticeBar tone="info" title="只读：">
      日志由服务端在写操作时自动记录，不可编辑或删除；查询操作本身不入库。
    </NoticeBar>

    <div class="mds-card">

      <AgriVueTable
        :columns="columns"
        :data="rows"
        row-key="id"
        :loading="loading"
        loading-text="正在加载操作记录…"
        column-settings-storage-key="mds:cols:user-operation-log"
        :page="page"
        :page-size="pageSize"
        :total="total"
        @page-change="(next, size) => size !== pageSize ? changePageSize(size) : changePage(next)"
        @refresh="load"
      >
        <template #filter>
          <AgriVueFilterBar :field-count="1" :loading="loading" @search="search" @reset="reset">
            <div class="agri-vue-filter-field">
              <label>操作类型</label>
              <select v-model="operationType" class="mds-select" @change="search">
                        <option value="">全部操作类型</option>
                        <option value="create">新增</option>
                        <option value="update">修改</option>
                        <option value="delete">删除</option>
                        <option value="other">其他</option>
                      </select>
            </div>
          </AgriVueFilterBar>
        </template>
        <template #empty>
          <EmptyState
                            icon="📜"
                            title="暂无操作记录"
                            description="主数据里还没有本主体的写操作流水；产生变更后这里会自动出现记录。"
                          />
        </template>
        <template #cell-createTime="{ row: row }">
          <div class="mds-mono">
            {{ formatTime(row.createTime) }}
          </div>
        </template>
        <template #cell-operationType="{ row: row }">
          <StatusTag :text="typeText(row.operationType)" :tone="typeTone(row.operationType)" plain />
        </template>
        <template #cell-result="{ row: row }">
          <StatusTag
                            :text="row.result === 'success' ? '成功' : '失败'"
                            :tone="row.result === 'success' ? 'success' : 'danger'"
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
import NoticeBar from '@/components/ui/NoticeBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { userGet } from '@/utils/userApi'
import { useMeStore } from '@/stores/me'

interface LogRow {
  id: string
  module?: string
  operationType?: string
  operationDesc?: string
  targetId?: string
  operator?: string
  ipAddress?: string
  result?: string
  createTime?: string
}

const me = useMeStore()
const rows = ref<LogRow[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const operationType = ref('')

const TYPE_TEXT: Record<string, string> = { create: '新增', update: '修改', delete: '删除', other: '其他' }
const TYPE_TONE: Record<string, 'success' | 'warning' | 'danger' | 'gray'> = {
  create: 'success',
  update: 'warning',
  delete: 'danger',
  other: 'gray',
}
const typeText = (type?: string) => TYPE_TEXT[type ?? ''] ?? type ?? '其他'
const typeTone = (type?: string) => TYPE_TONE[type ?? ''] ?? 'gray'
const formatTime = (value?: string) => (value ? String(value).replace('T', ' ').slice(0, 19) : '—')

async function load() {
  loading.value = true
  try {
    await me.load()
    const response = await userGet<{ list: LogRow[]; total: number | string }>('/api/user/operation-logs', {
      pageNum: page.value,
      pageSize: pageSize.value,
      operationType: operationType.value || undefined,
    })
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
  operationType.value = ''
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
  { prop: 'createTime', label: '时间', minWidth: 152, locked: true, ellipsis: false },
  { prop: 'operator', label: '操作人', width: 128 },
  { prop: 'operationType', label: '类型', width: 128, ellipsis: false },
  { prop: 'operationDesc', label: '操作内容', width: 210 },
  { prop: 'targetId', label: '对象', width: 128 },
  { prop: 'ipAddress', label: '来源 IP', width: 142, kind: 'code' },
  { prop: 'result', label: '结果', width: 128, ellipsis: false },
]
</script>

<style scoped>
.log-table { min-width: 1000px; }
</style>

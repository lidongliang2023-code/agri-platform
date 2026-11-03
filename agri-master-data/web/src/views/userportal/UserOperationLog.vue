<template>
  <div class="mds-page">
    <PageHeader
      title="操作记录"
      subtitle="本主体主数据变更的审计流水：谁、何时、对什么做了什么，结果可追溯。"
      source="主数据 · 审计日志"
    >
      <template #actions>
        <button class="mds-btn" :disabled="loading" @click="load">刷新</button>
      </template>
    </PageHeader>

    <NoticeBar tone="info" title="只读：">
      日志由服务端在写操作时自动记录，不可编辑或删除；查询操作本身不入库。
    </NoticeBar>

    <div class="mds-card">
      <div class="mds-filter">
        <select v-model="operationType" class="mds-select" @change="search">
          <option value="">全部操作类型</option>
          <option value="create">新增</option>
          <option value="update">修改</option>
          <option value="delete">删除</option>
          <option value="other">其他</option>
        </select>
        <button class="mds-btn mds-btn--primary" @click="search">查询</button>
        <button class="mds-btn" @click="reset">重置</button>
      </div>

      <div class="mds-table-wrap">
        <table class="mds-table log-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>操作人</th>
              <th>类型</th>
              <th>操作内容</th>
              <th>对象</th>
              <th>来源 IP</th>
              <th>结果</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading"><td colspan="7" class="mds-empty">正在加载操作记录…</td></tr>
            <tr v-else-if="!rows.length">
              <td colspan="7">
                <EmptyState
                  icon="📜"
                  title="暂无操作记录"
                  description="主数据里还没有本主体的写操作流水；产生变更后这里会自动出现记录。"
                />
              </td>
            </tr>
            <tr v-for="row in rows" :key="row.id">
              <td class="mds-mono">{{ formatTime(row.createTime) }}</td>
              <td>{{ row.operator || '—' }}</td>
              <td><StatusTag :text="typeText(row.operationType)" :tone="typeTone(row.operationType)" plain /></td>
              <td>{{ row.operationDesc || '—' }}</td>
              <td class="mds-mono">{{ row.targetId || '—' }}</td>
              <td class="mds-mono">{{ row.ipAddress || '—' }}</td>
              <td>
                <StatusTag
                  :text="row.result === 'success' ? '成功' : '失败'"
                  :tone="row.result === 'success' ? 'success' : 'danger'"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <PagerBar
        :page="page"
        :page-size="pageSize"
        :total="total"
        @change="changePage"
        @update:page-size="changePageSize"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PagerBar from '@/components/ui/PagerBar.vue'
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
</script>

<style scoped>
.log-table { min-width: 1000px; }
</style>

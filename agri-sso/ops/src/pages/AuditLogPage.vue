<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="系统设置"
      title="操作审计"
      :description="`管理员与运营动作流水 ${total} 条 · 只读视图，本运营端没有任何删除或修改审计记录的接口`"
    />

    <ErrorBlock v-if="error" :message="error" @retry="load" />

    <AgriAntdvListTable
      v-else
      :columns="columns"
      :data="rows"
      row-key="id"
      :loading="loading"
      :page="pageNum"
      :page-size="pageSize"
      :total="total"
      column-settings-storage-key="uc-ops:audit-logs"
      @page-change="handlePageChange"
      @refresh="load"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="2" :loading="loading" @search="submitSearch" @reset="resetFilters">
          <div class="agri-vue-filter-field">
            <label>关键字</label>
            <a-input
              v-model:value="draft"
              allow-clear
              placeholder="搜动作名 / 对象 / 说明"
              @press-enter="submitSearch"
            />
          </div>
          <div class="agri-vue-filter-field">
            <label>动作类型</label>
            <a-select
              v-model:value="actionPrefix"
              :options="ACTION_PREFIX_OPTIONS"
              @change="pageNum = 1"
            />
          </div>
        </AgriVueFilterBar>
      </template>

      <template #cell-createdAt="{ value }">{{ formatTime(String(value ?? '')) }}</template>
      <template #cell-operator="{ value }"><b>{{ value }}</b></template>
      <template #cell-actionLabel="{ value, record }">
        <div>
          {{ value || '—' }}
          <div class="small muted">{{ record.action }}</div>
        </div>
      </template>
      <template #cell-target="{ value }">{{ value || '—' }}</template>
      <template #cell-detail="{ value }">
        <span class="small">{{ value || '—' }}</span>
      </template>
      <template #cell-ip="{ value }">{{ value || '—' }}</template>
      <template #cell-result="{ value }">
        <StatusTag :status="String(value ?? '')" />
      </template>
    </AgriAntdvListTable>

    <section class="surface-card">
      <SectionHeading kicker="口径" title="和用户端「操作日志」是同一张表" />
      <div class="small muted" style="line-height: 1.9">
        审计记录写在 <code>platform_user_operation_log</code>，用户端「账号安全 · 操作日志」读的也是它。
        这里额外能看到<b>别人</b>的动作（按 admin 权限），用户端只能看到自己的。
        <a-tag class="soft-tag tone-green" style="margin-left: 8px">不可篡改（无写接口）</a-tag>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  AgriAntdvListTable,
  AgriVueFilterBar,
  type VueListColumn,
} from '@agri/shared/vue/antdv'
import { ucApi } from '../api'
import ErrorBlock from '../components/ErrorBlock.vue'
import PageTitle from '../components/PageTitle.vue'
import SectionHeading from '../components/SectionHeading.vue'
import StatusTag from '../components/StatusTag.vue'
import { formatTime } from '../components/ui-constants'
import type { AuditLog } from '../types'

const ACTION_PREFIX_OPTIONS = [
  { label: '全部动作', value: '' },
  { label: '审核类（uc.review）', value: 'uc.review' },
  { label: '冻结/解封（uc.freeze）', value: 'uc.freeze' },
  { label: '配置变更（uc.config）', value: 'uc.config' },
  { label: '推送（uc.push）', value: 'uc.push' },
  { label: '应用审核（uc.auth-app）', value: 'uc.auth-app' },
  { label: '用户端操作（account.）', value: 'account.' },
]

const columns: VueListColumn[] = [
  { key: 'createdAt', prop: 'createdAt', label: '时间', width: 160 },
  { key: 'operator', prop: 'operator', label: '操作人', width: 130 },
  { key: 'actionLabel', prop: 'actionLabel', label: '动作', minWidth: 180 },
  { key: 'target', prop: 'target', label: '对象', width: 200 },
  { key: 'detail', prop: 'detail', label: '说明', minWidth: 200 },
  { key: 'ip', prop: 'ip', label: 'IP', width: 130 },
  { key: 'result', prop: 'result', label: '结果', width: 90 },
]

const rows = ref<AuditLog[]>([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const draft = ref('')
const actionPrefix = ref('')
const loading = ref(true)
const error = ref('')

function load() {
  loading.value = true
  error.value = ''
  ucApi.auditLogs({
    pageNum: pageNum.value,
    pageSize: pageSize.value,
    keyword: keyword.value || undefined,
    actionPrefix: actionPrefix.value || undefined,
  })
    .then((data) => {
      rows.value = data.records
      total.value = data.total
    })
    .catch((reason: Error) => { error.value = reason.message })
    .finally(() => { loading.value = false })
}

watch([pageNum, pageSize, keyword, actionPrefix], load, { immediate: true })

function submitSearch() {
  const next = draft.value.trim()
  const same = keyword.value === next && pageNum.value === 1
  keyword.value = next
  pageNum.value = 1
  if (same) load()
}

function resetFilters() {
  const same = !draft.value && !keyword.value && !actionPrefix.value && pageNum.value === 1
  draft.value = ''
  keyword.value = ''
  actionPrefix.value = ''
  pageNum.value = 1
  if (same) load()
}

function handlePageChange(next: number, nextSize: number) {
  pageSize.value = nextSize
  pageNum.value = next
}
</script>

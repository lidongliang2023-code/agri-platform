<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="安全风控"
      title="设备与登录日志"
      :description="`累计 ${total} 条操作日志 · 与用户端「登录设备」读同一张表，口径一致`"
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
      column-settings-storage-key="uc-ops:device-logs"
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
              placeholder="搜动作 / IP / UA"
              @press-enter="submitSearch"
            />
          </div>
          <div class="agri-vue-filter-field">
            <label>结果</label>
            <a-select
              v-model:value="result"
              :options="resultOptions"
              @change="pageNum = 1"
            />
          </div>
        </AgriVueFilterBar>
      </template>

      <template #cell-createdAt="{ value }">{{ formatTime(String(value ?? '')) }}</template>
      <template #cell-username="{ value }">{{ value || '—' }}</template>
      <template #cell-actionLabel="{ value, record }">
        <div>
          {{ value || record.action }}
          <div class="small muted">{{ record.action }}</div>
        </div>
      </template>
      <template #cell-device="{ value }">
        <a-tag class="soft-tag">{{ value }}</a-tag>
      </template>
      <template #cell-ip="{ value }">{{ value || '—' }}</template>
      <template #cell-result="{ value }">
        <StatusTag :status="String(value ?? '')" />
      </template>
      <template #cell-userAgent="{ value }">
        <span class="small muted">{{ String(value || '—').slice(0, 56) }}</span>
      </template>
    </AgriAntdvListTable>
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
import StatusTag from '../components/StatusTag.vue'
import { formatTime } from '../components/ui-constants'
import type { DeviceLog } from '../types'

const resultOptions = [
  { label: '全部结果', value: '' },
  { label: '成功', value: 'success' },
  { label: '失败', value: 'fail' },
]

const columns: VueListColumn[] = [
  { key: 'createdAt', prop: 'createdAt', label: '时间', width: 160 },
  { key: 'username', prop: 'username', label: '账号', width: 160 },
  { key: 'actionLabel', prop: 'actionLabel', label: '动作', minWidth: 180 },
  { key: 'device', prop: 'device', label: '端类型', width: 110 },
  { key: 'ip', prop: 'ip', label: 'IP', width: 140 },
  { key: 'result', prop: 'result', label: '结果', width: 90 },
  { key: 'userAgent', prop: 'userAgent', label: 'User-Agent', minWidth: 220 },
]

const rows = ref<DeviceLog[]>([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const draft = ref('')
const result = ref('')
const loading = ref(true)
const error = ref('')

function load() {
  loading.value = true
  error.value = ''
  ucApi.deviceLogs({
    pageNum: pageNum.value,
    pageSize: pageSize.value,
    keyword: keyword.value || undefined,
    result: result.value || undefined,
  })
    .then((data) => {
      rows.value = data.records
      total.value = data.total
    })
    .catch((reason: Error) => { error.value = reason.message })
    .finally(() => { loading.value = false })
}

watch([pageNum, pageSize, keyword, result], load, { immediate: true })

function submitSearch() {
  const next = draft.value.trim()
  const same = keyword.value === next && pageNum.value === 1
  keyword.value = next
  pageNum.value = 1
  if (same) load()
}

function resetFilters() {
  const same = !draft.value && !keyword.value && !result.value && pageNum.value === 1
  draft.value = ''
  keyword.value = ''
  result.value = ''
  pageNum.value = 1
  if (same) load()
}

function handlePageChange(next: number, nextSize: number) {
  pageSize.value = nextSize
  pageNum.value = next
}
</script>

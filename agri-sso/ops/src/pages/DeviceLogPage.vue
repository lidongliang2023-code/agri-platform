<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="安全风控"
      title="设备与登录日志"
      :description="`累计 ${total} 条操作日志 · 与用户端「登录设备」读同一张表，口径一致`"
    />

    <ErrorBlock v-if="error" :message="error" @retry="load" />

    <section class="surface-card">
      <div class="chip-row" style="margin-bottom: 14px">
        <a-input
          v-model:value="draft"
          placeholder="搜动作 / IP / UA"
          style="width: 240px"
          @press-enter="submitSearch"
        />
        <a-button type="primary" @click="submitSearch">搜索</a-button>
        <a-select
          :value="result"
          style="width: 140px"
          :options="resultOptions"
          @change="(val: string) => { result = val; pageNum = 1 }"
        />
      </div>
      <a-table
        row-key="id"
        size="middle"
        :loading="loading"
        :data-source="rows"
        :scroll="{ x: 1100 }"
        :columns="columns"
        :pagination="{
          current: pageNum,
          pageSize: 20,
          total,
          showTotal: (count: number) => `共 ${count} 条`,
          onChange: (next: number) => { pageNum = next },
        }"
      >
        <template #bodyCell="{ column, record, text }">
          <template v-if="column.key === 'createdAt'">{{ formatTime(text) }}</template>
          <template v-else-if="column.key === 'username'">{{ text || '—' }}</template>
          <div v-else-if="column.key === 'actionLabel'">
            {{ text || record.action }}
            <div class="small muted">{{ record.action }}</div>
          </div>
          <a-tag v-else-if="column.key === 'device'" class="soft-tag">{{ text }}</a-tag>
          <template v-else-if="column.key === 'ip'">{{ text || '—' }}</template>
          <StatusTag v-else-if="column.key === 'result'" :status="text" />
          <span v-else-if="column.key === 'userAgent'" class="small muted">{{ String(text || '—').slice(0, 56) }}</span>
        </template>
      </a-table>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
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

const columns = [
  { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 160 },
  { title: '账号', dataIndex: 'username', key: 'username', width: 160 },
  { title: '动作', dataIndex: 'actionLabel', key: 'actionLabel' },
  { title: '端类型', dataIndex: 'device', key: 'device', width: 110 },
  { title: 'IP', dataIndex: 'ip', key: 'ip', width: 140 },
  { title: '结果', dataIndex: 'result', key: 'result', width: 90 },
  { title: 'User-Agent', dataIndex: 'userAgent', key: 'userAgent' },
]

const rows = ref<DeviceLog[]>([])
const total = ref(0)
const pageNum = ref(1)
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
    pageSize: 20,
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

watch([pageNum, keyword, result], load, { immediate: true })

function submitSearch() {
  keyword.value = draft.value.trim()
  pageNum.value = 1
}
</script>

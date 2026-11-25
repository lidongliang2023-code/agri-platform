<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="系统设置"
      title="操作审计"
      :description="`管理员与运营动作流水 ${total} 条 · 只读视图，本运营端没有任何删除或修改审计记录的接口`"
    />

    <ErrorBlock v-if="error" :message="error" @retry="load" />

    <section class="surface-card">
      <div class="chip-row" style="margin-bottom: 14px">
        <a-input
          v-model:value="draft"
          placeholder="搜动作名 / 对象 / 说明"
          style="width: 260px"
          @press-enter="submitSearch"
        />
        <a-button type="primary" @click="submitSearch">搜索</a-button>
        <a-select
          :value="actionPrefix"
          style="width: 240px"
          :options="ACTION_PREFIX_OPTIONS"
          @change="(val: string) => { actionPrefix = val; pageNum = 1 }"
        />
      </div>
      <a-table
        row-key="id"
        size="middle"
        :loading="loading"
        :data-source="rows"
        :scroll="{ x: 1120 }"
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
          <b v-else-if="column.key === 'operator'">{{ text }}</b>
          <div v-else-if="column.key === 'actionLabel'">
            {{ text || '—' }}
            <div class="small muted">{{ record.action }}</div>
          </div>
          <template v-else-if="column.key === 'target' || column.key === 'ip'">{{ text || '—' }}</template>
          <span v-else-if="column.key === 'detail'" class="small">{{ text || '—' }}</span>
          <StatusTag v-else-if="column.key === 'result'" :status="text" />
        </template>
      </a-table>
    </section>

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

const columns = [
  { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 160 },
  { title: '操作人', dataIndex: 'operator', key: 'operator', width: 130 },
  { title: '动作', dataIndex: 'actionLabel', key: 'actionLabel' },
  { title: '对象', dataIndex: 'target', key: 'target', width: 200 },
  { title: '说明', dataIndex: 'detail', key: 'detail' },
  { title: 'IP', dataIndex: 'ip', key: 'ip', width: 130 },
  { title: '结果', dataIndex: 'result', key: 'result', width: 90 },
]

const rows = ref<AuditLog[]>([])
const total = ref(0)
const pageNum = ref(1)
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
    pageSize: 20,
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

watch([pageNum, keyword, actionPrefix], load, { immediate: true })

function submitSearch() {
  keyword.value = draft.value.trim()
  pageNum.value = 1
}
</script>

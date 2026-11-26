<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="第三方授权"
      title="授权记录"
      :description="`累计 ${total} 条授权流水 · 用户授权与撤回都留痕，用于合规追溯`"
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
      column-settings-storage-key="uc-ops:auth-records"
      @page-change="handlePageChange"
      @refresh="load"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="1" :loading="loading" @search="submitSearch" @reset="resetFilters">
          <div class="agri-vue-filter-field">
            <label>关键字</label>
            <a-input
              v-model:value="draft"
              allow-clear
              placeholder="搜用户 / 应用名"
              @press-enter="submitSearch"
            />
          </div>
        </AgriVueFilterBar>
      </template>

      <template #cell-createdAt="{ value }">{{ formatTime(String(value ?? '')) }}</template>
      <template #cell-userName="{ value, record }">{{ value || `用户 ${record.userId}` }}</template>
      <template #cell-appName="{ value }">{{ value || '—' }}</template>
      <template #cell-action="{ value }">
        <a-tag :class="`soft-tag tone-${value === 'grant' ? 'green' : 'up'}`">
          {{ value === 'grant' ? '授权' : '撤回' }}
        </a-tag>
      </template>
      <template #cell-scopes="{ value }">
        <span class="small">{{ value || '—' }}</span>
      </template>
      <template #cell-ip="{ value }">{{ value || '—' }}</template>
    </AgriAntdvListTable>

    <section class="surface-card">
      <SectionHeading kicker="说明" title="这张表和用户端「授权管理」的关系" />
      <div class="small muted" style="line-height: 1.9">
        用户端「第三方授权」页读的是 <code>platform_user_binding</code> 的<b>当前绑定态</b>（现在授了谁）；
        本页读的是 <code>uc_third_party_auth_record</code> 的<b>历史流水</b>（什么时候授的、什么时候撤的）。
        两者不能合并：绑定态会被覆盖，而合规要求授权历史可追溯。
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
import { formatTime } from '../components/ui-constants'
import type { AuthRecord } from '../types'

const rows = ref<AuthRecord[]>([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const draft = ref('')
const loading = ref(true)
const error = ref('')

const columns: VueListColumn[] = [
  { key: 'createdAt', prop: 'createdAt', label: '时间', width: 160 },
  { key: 'userName', prop: 'userName', label: '用户', width: 160 },
  { key: 'appName', prop: 'appName', label: '应用', minWidth: 180 },
  { key: 'action', prop: 'action', label: '动作', width: 100 },
  { key: 'scopes', prop: 'scopes', label: '授权范围', minWidth: 200 },
  { key: 'ip', prop: 'ip', label: 'IP', width: 140 },
]

function load() {
  loading.value = true
  error.value = ''
  ucApi.authRecords({ pageNum: pageNum.value, pageSize: pageSize.value, keyword: keyword.value || undefined })
    .then((data) => {
      rows.value = data.records
      total.value = data.total
    })
    .catch((reason: Error) => { error.value = reason.message })
    .finally(() => { loading.value = false })
}

watch([pageNum, pageSize, keyword], load, { immediate: true })

function submitSearch() {
  const next = draft.value.trim()
  const same = keyword.value === next && pageNum.value === 1
  keyword.value = next
  pageNum.value = 1
  if (same) load()
}

function resetFilters() {
  const same = !draft.value && !keyword.value && pageNum.value === 1
  draft.value = ''
  keyword.value = ''
  pageNum.value = 1
  if (same) load()
}

function handlePageChange(next: number, nextSize: number) {
  pageSize.value = nextSize
  pageNum.value = next
}
</script>

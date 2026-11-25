<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="第三方授权"
      title="授权记录"
      :description="`累计 ${total} 条授权流水 · 用户授权与撤回都留痕，用于合规追溯`"
    />

    <ErrorBlock v-if="error" :message="error" @retry="load" />

    <section class="surface-card">
      <div class="chip-row" style="margin-bottom: 14px">
        <a-input
          v-model:value="draft"
          placeholder="搜用户 / 应用名"
          style="width: 240px"
          @press-enter="submitSearch"
        />
        <a-button type="primary" @click="submitSearch">搜索</a-button>
      </div>
      <a-table
        row-key="id"
        size="middle"
        :loading="loading"
        :data-source="rows"
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
          <template v-else-if="column.key === 'userName'">{{ text || `用户 ${record.userId}` }}</template>
          <template v-else-if="column.key === 'appName'">{{ text || '—' }}</template>
          <a-tag v-else-if="column.key === 'action'" :class="`soft-tag tone-${text === 'grant' ? 'green' : 'up'}`">
            {{ text === 'grant' ? '授权' : '撤回' }}
          </a-tag>
          <span v-else-if="column.key === 'scopes'" class="small">{{ text || '—' }}</span>
          <template v-else-if="column.key === 'ip'">{{ text || '—' }}</template>
        </template>
      </a-table>
    </section>

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
import { ucApi } from '../api'
import ErrorBlock from '../components/ErrorBlock.vue'
import PageTitle from '../components/PageTitle.vue'
import SectionHeading from '../components/SectionHeading.vue'
import { formatTime } from '../components/ui-constants'
import type { AuthRecord } from '../types'

const rows = ref<AuthRecord[]>([])
const total = ref(0)
const pageNum = ref(1)
const keyword = ref('')
const draft = ref('')
const loading = ref(true)
const error = ref('')

const columns = [
  { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 160 },
  { title: '用户', dataIndex: 'userName', key: 'userName', width: 160 },
  { title: '应用', dataIndex: 'appName', key: 'appName' },
  { title: '动作', dataIndex: 'action', key: 'action', width: 100 },
  { title: '授权范围', dataIndex: 'scopes', key: 'scopes' },
  { title: 'IP', dataIndex: 'ip', key: 'ip', width: 140 },
]

function load() {
  loading.value = true
  error.value = ''
  ucApi.authRecords({ pageNum: pageNum.value, pageSize: 20, keyword: keyword.value || undefined })
    .then((data) => {
      rows.value = data.records
      total.value = data.total
    })
    .catch((reason: Error) => { error.value = reason.message })
    .finally(() => { loading.value = false })
}

watch([pageNum, keyword], load, { immediate: true })

function submitSearch() {
  keyword.value = draft.value.trim()
  pageNum.value = 1
}
</script>

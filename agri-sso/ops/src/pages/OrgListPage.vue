<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="组织管理"
      title="组织列表"
      :description="`平台组织 ${total} 家 · 组织与账号是多对多关系，认证状态决定能否参与业务`"
    />

    <div class="grid-3">
      <div class="stat-tile">
        <span class="stat-label">组织总数</span>
        <b class="stat-value">{{ total }}<small>家</small></b>
        <span class="stat-note">当前筛选条件下的全部组织</span>
      </div>
      <div class="stat-tile">
        <span class="stat-label">当前页已认证</span>
        <b class="stat-value">{{ certified }}<small>家</small></b>
        <span class="stat-note">认证通过，可参与业务</span>
      </div>
      <div class="stat-tile">
        <span class="stat-label">当前页待认证</span>
        <b class="stat-value">{{ pending }}<small>家</small></b>
        <span class="stat-note">等待资质审核</span>
      </div>
    </div>

    <section class="surface-card list-card">
      <div class="list-toolbar">
        <a-input
          v-model:value="draft"
          placeholder="搜组织名称 / 编码 / 信用代码"
          style="width: 260px"
          @press-enter="submitSearch"
        />
        <a-button type="primary" @click="submitSearch">搜索</a-button>
        <a-select
          :value="type"
          style="width: 160px"
          :options="typeOptions"
          @change="(val: string) => { type = val; pageNum = 1 }"
        />
        <a-select
          :value="verifyStatus"
          style="width: 150px"
          :options="verifyOptions"
          @change="(val: string) => { verifyStatus = val; pageNum = 1 }"
        />
        <a-button v-if="filtered" type="link" @click="resetFilters">清空筛选</a-button>
      </div>

      <ErrorBlock v-if="error" :message="error" @retry="load" />
      <a-table
        v-else
        class="agri-list-table"
        row-key="id"
        size="middle"
        :loading="loading"
        :data-source="rows"
        :scroll="{ x: 1180 }"
        :columns="columns"
        :pagination="{
          current: pageNum,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (count: number) => `共 ${count} 家组织`,
          onChange: handlePageChange,
        }"
      >
        <template #bodyCell="{ column, record, text }">
          <div v-if="column.key === 'name'">
            <b>{{ text }}</b>
            <div class="small muted">{{ record.code }} · {{ record.creditCode || '未填信用代码' }}</div>
          </div>
          <template v-else-if="column.key === 'type'">{{ ORG_TYPE_LABEL[text] ?? text ?? '—' }}</template>
          <template v-else-if="column.key === 'industry'">{{ text || '—' }}</template>
          <template v-else-if="column.key === 'address'">{{ text || '未填写' }}</template>
          <div v-else-if="column.key === 'contactName'">
            {{ text || '—' }}
            <div class="small muted">{{ record.contactPhone || '—' }}</div>
          </div>
          <template v-else-if="column.key === 'memberCount'">{{ text ? `${text} 人` : '—' }}</template>
          <StatusTag v-else-if="column.key === 'verifyStatus'" :status="text" />
          <a-button v-else-if="column.key === 'action'" size="small" type="link" @click="app.navigate('org-detail', String(record.id))">
            详情
          </a-button>
        </template>
      </a-table>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAppStore } from '../app-context'
import { ucApi } from '../api'
import ErrorBlock from '../components/ErrorBlock.vue'
import PageTitle from '../components/PageTitle.vue'
import StatusTag from '../components/StatusTag.vue'
import { ORG_TYPE_LABEL } from '../components/ui-constants'
import type { OrgRecord } from '../types'

const app = useAppStore()
const rows = ref<OrgRecord[]>([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const draft = ref('')
const type = ref('')
const verifyStatus = ref('')
const loading = ref(true)
const error = ref('')

const typeOptions = [
  { label: '全部类型', value: '' },
  ...Object.entries(ORG_TYPE_LABEL).map(([value, label]) => ({ value, label })),
]
const verifyOptions = [
  { label: '全部认证状态', value: '' },
  { label: '已认证', value: 'approved' },
  { label: '待认证', value: 'pending' },
  { label: '已驳回', value: 'rejected' },
]

const columns = [
  { title: '组织', dataIndex: 'name', key: 'name' },
  { title: '类型', dataIndex: 'type', key: 'type', width: 120 },
  { title: '行业', dataIndex: 'industry', key: 'industry', width: 120 },
  { title: '所在地', dataIndex: 'address', key: 'address', width: 190 },
  { title: '联系人', dataIndex: 'contactName', key: 'contactName', width: 150 },
  { title: '成员', dataIndex: 'memberCount', key: 'memberCount', width: 80 },
  { title: '认证', dataIndex: 'verifyStatus', key: 'verifyStatus', width: 100 },
  { title: '操作', key: 'action', width: 100 },
]

function load() {
  loading.value = true
  error.value = ''
  ucApi.orgs({
    pageNum: pageNum.value,
    pageSize: pageSize.value,
    keyword: keyword.value || undefined,
    type: type.value || undefined,
    verifyStatus: verifyStatus.value || undefined,
  })
    .then((data) => {
      rows.value = data.records
      total.value = data.total
    })
    .catch((reason: Error) => { error.value = reason.message })
    .finally(() => { loading.value = false })
}

watch([pageNum, pageSize, keyword, type, verifyStatus], load, { immediate: true })

const certified = computed(() => rows.value.filter((row) => row.verifyStatus === 'approved').length)
const pending = computed(() => rows.value.filter((row) => row.verifyStatus === 'pending').length)
const filtered = computed(() => Boolean(keyword.value || type.value || verifyStatus.value))

function submitSearch() {
  keyword.value = draft.value.trim()
  pageNum.value = 1
}

function resetFilters() {
  draft.value = ''
  keyword.value = ''
  type.value = ''
  verifyStatus.value = ''
  pageNum.value = 1
}

function handlePageChange(next: number, nextSize: number) {
  if (nextSize && nextSize !== pageSize.value) {
    pageSize.value = nextSize
    pageNum.value = 1
  } else {
    pageNum.value = next
  }
}
</script>

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
      total-unit="家组织"
      column-settings-storage-key="uc-ops:orgs"
      @page-change="handlePageChange"
      @refresh="load"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="3" :loading="loading" @search="submitSearch" @reset="resetFilters">
          <div class="agri-vue-filter-field">
            <label>关键字</label>
            <a-input
              v-model:value="draft"
              allow-clear
              placeholder="搜组织名称 / 编码 / 信用代码"
              @press-enter="submitSearch"
            />
          </div>
          <div class="agri-vue-filter-field">
            <label>组织类型</label>
            <a-select
              v-model:value="type"
              :options="typeOptions"
              @change="pageNum = 1"
            />
          </div>
          <div class="agri-vue-filter-field">
            <label>认证状态</label>
            <a-select
              v-model:value="verifyStatus"
              :options="verifyOptions"
              @change="pageNum = 1"
            />
          </div>
        </AgriVueFilterBar>
      </template>

      <template #cell-name="{ value, record }">
        <div>
          <b>{{ value }}</b>
          <div class="small muted">{{ record.code }} · {{ record.creditCode || '未填信用代码' }}</div>
        </div>
      </template>
      <template #cell-type="{ value }">
        {{ ORG_TYPE_LABEL[String(value ?? '')] ?? value ?? '—' }}
      </template>
      <template #cell-industry="{ value }">{{ value || '—' }}</template>
      <template #cell-address="{ value }">{{ value || '未填写' }}</template>
      <template #cell-contactName="{ value, record }">
        <div>
          {{ value || '—' }}
          <div class="small muted">{{ record.contactPhone || '—' }}</div>
        </div>
      </template>
      <template #cell-memberCount="{ value }">{{ value ? `${value} 人` : '—' }}</template>
      <template #cell-verifyStatus="{ value }">
        <StatusTag :status="String(value ?? '')" />
      </template>
      <template #cell-action="{ record }">
        <AgriVueRowActions
          :actions="[{ key: 'detail', label: '详情', onClick: () => app.navigate('org-detail', String(record.id)) }]"
        />
      </template>
    </AgriAntdvListTable>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  AgriAntdvListTable,
  AgriVueFilterBar,
  AgriVueRowActions,
  type VueListColumn,
} from '@agri/shared/vue/antdv'
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

const columns: VueListColumn[] = [
  { key: 'name', prop: 'name', label: '组织', minWidth: 220 },
  { key: 'type', prop: 'type', label: '类型', width: 120 },
  { key: 'industry', prop: 'industry', label: '行业', width: 120 },
  { key: 'address', prop: 'address', label: '所在地', width: 190 },
  { key: 'contactName', prop: 'contactName', label: '联系人', width: 150 },
  { key: 'memberCount', prop: 'memberCount', label: '成员数', width: 90 },
  { key: 'verifyStatus', prop: 'verifyStatus', label: '认证', width: 100 },
  { key: 'action', label: '操作', width: 100, fixed: 'right' },
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

function submitSearch() {
  const next = draft.value.trim()
  const same = keyword.value === next && pageNum.value === 1
  keyword.value = next
  pageNum.value = 1
  if (same) load()
}

function resetFilters() {
  const same = !draft.value && !keyword.value && !type.value && !verifyStatus.value && pageNum.value === 1
  draft.value = ''
  keyword.value = ''
  type.value = ''
  verifyStatus.value = ''
  pageNum.value = 1
  if (same) load()
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

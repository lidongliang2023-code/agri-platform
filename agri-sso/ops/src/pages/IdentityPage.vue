<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="用户与身份"
      title="身份管理"
      :description="`全平台身份实例 ${instanceTotal} 个 · ${distribution.filter((item) => item.c > 0).length} 类身份 · 一个账号可同时持有多个身份`"
    />

    <ErrorBlock v-if="error" :message="error" @retry="load" />

    <div v-else class="grid-main-aside">
      <AgriAntdvListTable
        :columns="columns"
        :data="data?.page.records ?? []"
        row-key="id"
        :loading="loading"
        :page="pageNum"
        :page-size="pageSize"
        :total="data?.page.total ?? 0"
        total-unit="条身份"
        column-settings-storage-key="uc-ops:identities"
        @page-change="handlePageChange"
        @refresh="load"
      >
        <template #filter>
          <AgriVueFilterBar :field-count="1" :loading="loading" @search="load" @reset="resetFilters">
            <div class="agri-vue-filter-field">
              <label>身份类型</label>
              <a-select
                v-model:value="roleCode"
                :options="[{ label: '全部身份类型', value: '' }, ...distribution.map((item) => ({ label: roleText(item.code), value: item.code }))]"
                @change="pageNum = 1"
              />
            </div>
          </AgriVueFilterBar>
        </template>

        <template #toolbar-left>
          <span class="small muted">按账号列出的身份实例</span>
        </template>

        <template #cell-username="{ record }">
          <div>
            <b>{{ record.nickname || record.username }}</b>
            <div class="small muted">{{ record.username }}</div>
          </div>
        </template>
        <template #cell-roleName="{ value, record }">
          <a-tag class="soft-tag">{{ roleText(String(record.roleCode ?? '')) || value }}</a-tag>
        </template>
        <template #cell-realnameStatus="{ value }">
          <StatusTag :status="String(value ?? '')" />
        </template>
        <template #cell-orgCount="{ value }">{{ value === 0 ? '—' : `${value} 个` }}</template>
        <template #cell-action="{ record }">
          <AgriVueRowActions
            :actions="[{ key: 'view', label: '查看账号', onClick: () => app.navigate('user-detail', String(record.userId)) }]"
          />
        </template>
      </AgriAntdvListTable>

      <section class="surface-card">
        <SectionHeading kicker="分布" title="按身份类型" />
        <BarList :items="distribution.map((item) => ({ label: roleText(item.code), value: item.c }))" />
        <div class="uc-inline-note">
          身份实例来自 <code>platform_user_role</code>：一个账号绑了几个角色就计几次，
          因此总数会大于账号数。实名状态取该账号最新一条实名记录。
        </div>
      </section>
    </div>
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
import BarList from '../components/BarList.vue'
import ErrorBlock from '../components/ErrorBlock.vue'
import PageTitle from '../components/PageTitle.vue'
import SectionHeading from '../components/SectionHeading.vue'
import StatusTag from '../components/StatusTag.vue'
import { roleText } from '../components/ui-constants'
import type { IdentityPageData } from '../types'

const app = useAppStore()
const data = ref<IdentityPageData | null>(null)
const pageNum = ref(1)
const pageSize = ref(20)
const roleCode = ref('')
const loading = ref(true)
const error = ref('')

const columns: VueListColumn[] = [
  { key: 'username', prop: 'username', label: '账号', minWidth: 180 },
  { key: 'roleName', prop: 'roleName', label: '身份', width: 150 },
  { key: 'realnameStatus', prop: 'realnameStatus', label: '实名', width: 110 },
  { key: 'orgCount', prop: 'orgCount', label: '组织数', width: 100 },
  { key: 'action', label: '操作', width: 110, fixed: 'right' },
]

function load() {
  loading.value = true
  error.value = ''
  ucApi.identities({ pageNum: pageNum.value, pageSize: pageSize.value, roleCode: roleCode.value || undefined })
    .then((res) => { data.value = res })
    .catch((reason: Error) => { error.value = reason.message })
    .finally(() => { loading.value = false })
}

watch([pageNum, pageSize, roleCode], load, { immediate: true })

const distribution = computed(() => data.value?.distribution ?? [])
const instanceTotal = computed(() => distribution.value.reduce((sum, item) => sum + item.c, 0))

function resetFilters() {
  const same = !roleCode.value && pageNum.value === 1
  roleCode.value = ''
  pageNum.value = 1
  if (same) load()
}

function handlePageChange(next: number, nextSize: number) {
  pageSize.value = nextSize
  pageNum.value = next
}
</script>

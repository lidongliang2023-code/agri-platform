<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="用户与身份"
      title="身份管理"
      :description="`全平台身份实例 ${instanceTotal} 个 · ${distribution.filter((item) => item.c > 0).length} 类身份 · 一个账号可同时持有多个身份`"
    />

    <ErrorBlock v-if="error" :message="error" @retry="load" />

    <div class="grid-main-aside">
      <section class="surface-card">
        <SectionHeading kicker="身份实例" title="按账号列出的身份" />
        <div class="chip-row" style="margin-bottom: 12px">
          <a-select
            :value="roleCode"
            style="width: 180px"
            :options="[{ label: '全部身份类型', value: '' }, ...distribution.map((item) => ({ label: roleText(item.code), value: item.code }))]"
            @change="(val: string) => { roleCode = val; pageNum = 1 }"
          />
        </div>
        <a-table
          row-key="id"
          size="middle"
          :loading="loading"
          :data-source="data?.page.records ?? []"
          :scroll="{ x: 780 }"
          :columns="columns"
          :pagination="{
            current: pageNum,
            pageSize: 20,
            total: data?.page.total ?? 0,
            showTotal: (count: number) => `共 ${count} 条身份`,
            onChange: (next: number) => { pageNum = next },
          }"
        >
          <template #bodyCell="{ column, record, text }">
            <div v-if="column.key === 'username'">
              <b>{{ record.nickname || record.username }}</b>
              <div class="small muted">{{ record.username }}</div>
            </div>
            <a-tag v-else-if="column.key === 'roleName'" class="soft-tag">{{ roleText(record.roleCode) || text }}</a-tag>
            <StatusTag v-else-if="column.key === 'realnameStatus'" :status="text" />
            <template v-else-if="column.key === 'orgCount'">{{ text === 0 ? '—' : `${text} 个` }}</template>
            <a-button v-else-if="column.key === 'action'" size="small" type="link" @click="app.navigate('user-detail', record.userId)">
              查看账号
            </a-button>
          </template>
        </a-table>
      </section>

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
const roleCode = ref('')
const loading = ref(true)
const error = ref('')

const columns = [
  { title: '账号', dataIndex: 'username', key: 'username' },
  { title: '身份', dataIndex: 'roleName', key: 'roleName', width: 150 },
  { title: '实名', dataIndex: 'realnameStatus', key: 'realnameStatus', width: 110 },
  { title: '组织数', dataIndex: 'orgCount', key: 'orgCount', width: 100 },
  { title: '操作', key: 'action', width: 110 },
]

function load() {
  loading.value = true
  error.value = ''
  ucApi.identities({ pageNum: pageNum.value, pageSize: 20, roleCode: roleCode.value || undefined })
    .then((res) => { data.value = res })
    .catch((reason: Error) => { error.value = reason.message })
    .finally(() => { loading.value = false })
}

watch([pageNum, roleCode], load, { immediate: true })

const distribution = computed(() => data.value?.distribution ?? [])
const instanceTotal = computed(() => distribution.value.reduce((sum, item) => sum + item.c, 0))
</script>

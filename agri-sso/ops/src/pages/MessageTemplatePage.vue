<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="消息中心"
      title="消息模板"
      :description="`${rows.length} 个模板 · 覆盖 ${sceneCount} 类场景 · 支持 {变量} 占位符`"
    />

    <ErrorBlock v-if="error" :message="error" @retry="load" />

    <AgriAntdvListTable
      v-else
      :columns="columns"
      :data="filteredRows"
      row-key="id"
      :loading="loading"
      client-pagination
      :page="pageNum"
      :page-size="pageSize"
      total-unit="个模板"
      column-settings-storage-key="uc-ops:message-templates"
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
              placeholder="搜模板编码 / 标题 / 内容"
              @press-enter="submitSearch"
            />
          </div>
          <div class="agri-vue-filter-field">
            <label>业务场景</label>
            <a-select
              v-model:value="scene"
              :options="sceneFilterOptions"
              @change="pageNum = 1"
            />
          </div>
        </AgriVueFilterBar>
      </template>

      <template #toolbar-left>
        <a-button type="primary" @click="openCreate">＋ 新建模板</a-button>
      </template>

      <template #cell-code="{ value, record }">
        <div>
          <b>{{ record.title }}</b>
          <div class="small muted">{{ value }}</div>
        </div>
      </template>
      <template #cell-scene="{ value }">
        <a-tag class="soft-tag">{{ SCENE_LABEL[String(value ?? '')] ?? value }}</a-tag>
      </template>
      <template #cell-channels="{ value }">
        <span class="small">{{ channelText(String(value ?? '')) }}</span>
      </template>
      <template #cell-content="{ value }">
        <span class="small" style="color: #53665a">
          {{ String(value || '').slice(0, 60) }}{{ String(value || '').length > 60 ? '…' : '' }}
        </span>
      </template>
      <template #cell-variables="{ value }">
        <div class="tag-row">
          <a-tag v-for="v in splitVars(String(value ?? ''))" :key="v" class="soft-tag tone-purple">{{ '{' + v + '}' }}</a-tag>
          <span v-if="!value" class="small muted">无</span>
        </div>
      </template>
      <template #cell-status="{ value }">
        <StatusTag :status="String(value ?? '')" />
      </template>
      <template #cell-action="{ record }">
        <AgriVueRowActions
          :actions="[{ key: 'edit', label: '编辑', onClick: () => openEdit(record as MessageTemplate) }]"
        />
      </template>
    </AgriAntdvListTable>

    <a-modal
      v-model:open="creating"
      :title="editing ? `编辑模板：${editing.code}` : '新建消息模板'"
      :confirm-loading="saving"
      ok-text="保存"
      :width="620"
      @ok="submit"
    >
      <a-form ref="formRef" :model="formState" layout="vertical" style="margin-top: 12px">
        <a-form-item name="code" label="模板编码" :rules="[{ required: true, message: '请填写编码' }]">
          <a-input v-model:value="formState.code" placeholder="TPL_XXX_XXX" :disabled="Boolean(editing)" />
        </a-form-item>
        <a-form-item name="scene" label="场景" :rules="[{ required: true, message: '请选择场景' }]">
          <a-select v-model:value="formState.scene" :options="sceneOptions" />
        </a-form-item>
        <a-form-item name="channels" label="适用渠道">
          <a-input v-model:value="formState.channels" placeholder="逗号分隔，如 station,wechat,sms" />
        </a-form-item>
        <a-form-item name="title" label="标题模板" :rules="[{ required: true, message: '请填写标题' }]">
          <a-input v-model:value="formState.title" :maxlength="120" />
        </a-form-item>
        <a-form-item name="content" label="正文模板">
          <a-textarea v-model:value="formState.content" :rows="4" placeholder="用 {变量} 表示占位符" />
        </a-form-item>
        <a-form-item name="variables" label="可用变量">
          <a-input v-model:value="formState.variables" placeholder="逗号分隔，如 orgName,expireDate" />
        </a-form-item>
        <a-form-item name="status" label="状态">
          <a-select v-model:value="formState.status" :options="[{ value: 'enabled', label: '启用' }, { value: 'disabled', label: '停用' }]" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { message, type FormInstance } from 'ant-design-vue'
import {
  AgriAntdvListTable,
  AgriVueFilterBar,
  AgriVueRowActions,
  type VueListColumn,
} from '@agri/shared/vue/antdv'
import { ucApi } from '../api'
import ErrorBlock from '../components/ErrorBlock.vue'
import PageTitle from '../components/PageTitle.vue'
import StatusTag from '../components/StatusTag.vue'
import { SCENE_LABEL, channelText } from '../components/ui-constants'
import type { MessageTemplate } from '../types'

const sceneOptions = Object.entries(SCENE_LABEL).map(([value, label]) => ({ value, label }))
const sceneFilterOptions = [{ label: '全部场景', value: '' }, ...sceneOptions]

const columns: VueListColumn[] = [
  { key: 'code', prop: 'code', label: '模板', width: 210 },
  { key: 'scene', prop: 'scene', label: '场景', width: 110 },
  { key: 'channels', prop: 'channels', label: '渠道', width: 190 },
  { key: 'content', prop: 'content', label: '内容预览', minWidth: 220 },
  { key: 'variables', prop: 'variables', label: '变量', width: 200 },
  { key: 'status', prop: 'status', label: '状态', width: 90 },
  { key: 'action', label: '操作', width: 90, fixed: 'right' },
]

const rows = ref<MessageTemplate[]>([])
const scene = ref('')
const draft = ref('')
const keyword = ref('')
const pageNum = ref(1)
const pageSize = ref(20)
const loading = ref(true)
const error = ref('')
const editing = ref<MessageTemplate | null>(null)
const creating = ref(false)
const saving = ref(false)
const formRef = ref<FormInstance>()

const formState = reactive({
  code: '',
  scene: 'cert_audit',
  channels: 'station',
  title: '',
  content: '',
  variables: '',
  status: 'enabled',
})

const sceneCount = computed(() => new Set(rows.value.map((r) => r.scene)).size)

const filteredRows = computed(() => {
  const kw = keyword.value.toLowerCase()
  if (!kw) return rows.value
  return rows.value.filter((item) =>
    `${item.code} ${item.title} ${item.content ?? ''}`.toLowerCase().includes(kw),
  )
})

function splitVars(val?: string | null): string[] {
  return (val || '').split(',').map((s) => s.trim()).filter(Boolean)
}

function load() {
  loading.value = true
  error.value = ''
  ucApi.templates(scene.value || undefined)
    .then((res) => { rows.value = res })
    .catch((reason: Error) => { error.value = reason.message })
    .finally(() => { loading.value = false })
}

watch(scene, load, { immediate: true })

function submitSearch() {
  keyword.value = draft.value.trim()
  pageNum.value = 1
}

function resetFilters() {
  const same = !scene.value && !draft.value && !keyword.value && pageNum.value === 1
  draft.value = ''
  keyword.value = ''
  scene.value = ''
  pageNum.value = 1
  if (same) load()
}

function handlePageChange(next: number, nextSize: number) {
  pageSize.value = nextSize
  pageNum.value = next
}

function openCreate() {
  editing.value = null
  formState.code = ''
  formState.scene = 'cert_audit'
  formState.channels = 'station'
  formState.title = ''
  formState.content = ''
  formState.variables = ''
  formState.status = 'enabled'
  creating.value = true
}

function openEdit(row: MessageTemplate) {
  editing.value = row
  formState.code = row.code
  formState.scene = row.scene
  formState.channels = row.channels ?? ''
  formState.title = row.title
  formState.content = row.content ?? ''
  formState.variables = row.variables ?? ''
  formState.status = row.status
  creating.value = true
}

function submit() {
  formRef.value?.validate()
    .then(() => {
      saving.value = true
      const payload = { ...formState }
      return editing.value
        ? ucApi.updateTemplate(String(editing.value.id), payload)
        : ucApi.createTemplate(payload)
    })
    .then(() => {
      message.success(editing.value ? '模板已更新' : '模板已创建')
      creating.value = false
      load()
    })
    .catch((reason: Error) => {
      if (reason?.message) message.error(reason.message)
    })
    .finally(() => { saving.value = false })
}
</script>

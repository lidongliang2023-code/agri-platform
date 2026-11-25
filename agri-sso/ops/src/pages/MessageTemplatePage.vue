<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="消息中心"
      title="消息模板"
      :description="`${rows.length} 个模板 · 覆盖 ${sceneCount} 类场景 · 支持 {变量} 占位符`"
    >
      <template #actions>
        <a-select v-model:value="scene" style="width: 160px" :options="sceneFilterOptions" />
        <a-button type="primary" @click="openCreate">＋ 新建模板</a-button>
      </template>
    </PageTitle>

    <ErrorBlock v-if="error" :message="error" @retry="load" />

    <section class="surface-card">
      <a-table
        row-key="id"
        size="middle"
        :loading="loading"
        :data-source="rows"
        :scroll="{ x: 1100 }"
        :columns="columns"
        :pagination="false"
      >
        <template #bodyCell="{ column, record, text }">
          <div v-if="column.key === 'code'">
            <b>{{ record.title }}</b>
            <div class="small muted">{{ text }}</div>
          </div>
          <a-tag v-else-if="column.key === 'scene'" class="soft-tag">{{ SCENE_LABEL[text] ?? text }}</a-tag>
          <span v-else-if="column.key === 'channels'" class="small">{{ channelText(text) }}</span>
          <span v-else-if="column.key === 'content'" class="small" style="color: #53665a">
            {{ String(text || '').slice(0, 60) }}{{ String(text || '').length > 60 ? '…' : '' }}
          </span>
          <div v-else-if="column.key === 'variables'" class="tag-row">
            <a-tag v-for="v in splitVars(text)" :key="v" class="soft-tag tone-purple">{{ '{' + v + '}' }}</a-tag>
            <span v-if="!text" class="small muted">无</span>
          </div>
          <StatusTag v-else-if="column.key === 'status'" :status="text" />
          <a-button v-else-if="column.key === 'action'" size="small" type="link" @click="openEdit(record as MessageTemplate)">
            编辑
          </a-button>
        </template>
      </a-table>
    </section>

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
import { ucApi } from '../api'
import ErrorBlock from '../components/ErrorBlock.vue'
import PageTitle from '../components/PageTitle.vue'
import StatusTag from '../components/StatusTag.vue'
import { SCENE_LABEL, channelText } from '../components/ui-constants'
import type { MessageTemplate } from '../types'

const sceneOptions = Object.entries(SCENE_LABEL).map(([value, label]) => ({ value, label }))
const sceneFilterOptions = [{ label: '全部场景', value: '' }, ...sceneOptions]

const columns = [
  { title: '模板', dataIndex: 'code', key: 'code', width: 210 },
  { title: '场景', dataIndex: 'scene', key: 'scene', width: 110 },
  { title: '渠道', dataIndex: 'channels', key: 'channels', width: 190 },
  { title: '内容预览', dataIndex: 'content', key: 'content' },
  { title: '变量', dataIndex: 'variables', key: 'variables', width: 200 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
  { title: '操作', key: 'action', width: 90 },
]

const rows = ref<MessageTemplate[]>([])
const scene = ref('')
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

<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="消息中心"
      title="消息推送"
      :description="`累计推送 ${total} 次 · 入队后由后台按批投递，站内信真实写入用户端「消息中心」`"
    />

    <ErrorBlock v-if="error" :message="error" @retry="load()" />

    <div class="grid-main-aside">
      <section class="surface-card">
        <SectionHeading kicker="新建推送" title="目标人群与内容" />
        <a-form ref="formRef" :model="formState" layout="vertical">
          <a-form-item name="audience" label="目标人群" :rules="[{ required: true, message: '请选择目标人群' }]">
            <a-select v-model:value="formState.audience" :options="AUDIENCE_OPTIONS" />
          </a-form-item>
          <a-form-item name="templateCode" label="消息模板（可选，选中自动填充标题与正文）">
            <a-select
              v-model:value="formState.templateCode"
              allow-clear
              placeholder="不使用模板"
              :options="templateOptions"
              @change="handleTemplateChange"
            />
          </a-form-item>
          <a-form-item name="channels" label="推送渠道">
            <a-checkbox-group v-model:value="formState.channels" :options="CHANNEL_OPTIONS" />
          </a-form-item>
          <a-form-item name="title" label="消息标题（选模板可留空）">
            <a-input v-model:value="formState.title" placeholder="如 资质临期提醒（10 月）" :maxlength="120" />
          </a-form-item>
          <a-form-item name="content" label="消息正文">
            <a-textarea v-model:value="formState.content" :rows="4" placeholder="支持 {变量} 占位，实际发送前需由模板提供变量值" />
          </a-form-item>
          <a-button type="primary" :loading="sending" @click="send">加入推送队列</a-button>
        </a-form>
        <div class="uc-inline-note">
          <b>渠道说明：</b>当前只有「站内信」会真正落库到 <code>platform_message</code>；
          微信 / 短信 / APP 推送需要各自的通道凭据，未配置时只记录在任务里、不会实际外发。
          <br />
          <b>人群说明：</b>「批发商身份」「资质临期」两个口径依赖平台尚未落地的身份分类与证照有效期，
          目前按全量处理（宁可多发不漏发）。
        </div>
      </section>

      <section class="surface-card">
        <SectionHeading kicker="预估触达" title="这次会发给谁" />
        <div class="uc-metric" style="margin-bottom: 12px">
          <div class="uc-metric-label">当前人群</div>
          <div class="uc-metric-value">{{ previewLoading ? '…' : (preview?.count ?? '—') }}</div>
          <div class="uc-metric-note">
            {{ preview ? AUDIENCE_LABEL[preview.audience] ?? preview.audience : '选择人群后自动统计' }}
          </div>
        </div>
        <div class="small muted" style="line-height: 1.9">
          <div>· 全部用户 = 状态正常的账号</div>
          <div>· 已实名 = 最新一条实名记录状态为 verified</div>
          <div>· 企业账号 = 已认证组织下的全部成员账号</div>
          <div>· 30 日未登录 = 账号 30 天无更新</div>
          <div style="margin-top: 10px">
            提交后只入队，后台每 3 秒投一批（500 条）；列表里的「触达」列会实时往上走。
          </div>
        </div>
      </section>
    </div>

    <AgriAntdvListTable
      :columns="columns"
      :data="rows"
      row-key="id"
      :loading="loading"
      :page="pageNum"
      :page-size="pageSize"
      :total="total"
      total-unit="次"
      column-settings-storage-key="uc-ops:message-pushes"
      @page-change="handlePageChange"
      @refresh="load()"
    >
      <template #toolbar-left>
        <span style="font-weight: 600">历史推送记录（{{ total }}）</span>
        <a-tag v-if="polling" class="soft-tag tone-green">投递中，自动刷新</a-tag>
      </template>

      <template #cell-title="{ value, record }">
        <div>
          <b>{{ value }}</b>
          <div v-if="record.templateCode" class="small muted">{{ record.templateCode }}</div>
          <div v-if="record.failReason" class="small" style="color: var(--red-700)">{{ record.failReason }}</div>
        </div>
      </template>
      <template #cell-audience="{ value }">{{ AUDIENCE_LABEL[String(value ?? '')] ?? value }}</template>
      <template #cell-channels="{ value }">
        <span class="small">{{ channelText(String(value ?? '')) }}</span>
      </template>
      <template #cell-reachCount="{ value, record }">
        <div>
          <b>{{ value }}</b>
          <span class="small muted"> / {{ record.targetCount || '—' }}</span>
        </div>
      </template>
      <template #cell-status="{ value }">
        <StatusTag :status="String(value ?? '')" />
      </template>
      <template #cell-sendTime="{ value }">{{ formatTime(String(value ?? '')) }}</template>
      <template #cell-operatorName="{ value }">{{ value || '—' }}</template>
    </AgriAntdvListTable>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { message, type FormInstance } from 'ant-design-vue'
import { AgriAntdvListTable, type VueListColumn } from '@agri/shared/vue/antdv'
import { ucApi } from '../api'
import ErrorBlock from '../components/ErrorBlock.vue'
import PageTitle from '../components/PageTitle.vue'
import SectionHeading from '../components/SectionHeading.vue'
import StatusTag from '../components/StatusTag.vue'
import { AUDIENCE_LABEL, channelText, formatTime } from '../components/ui-constants'
import type { MessageTemplate, PushTask } from '../types'

const CHANNEL_OPTIONS = [
  { label: '站内信', value: 'station' },
  { label: '微信服务通知', value: 'wechat' },
  { label: '短信', value: 'sms' },
  { label: 'APP 推送', value: 'app' },
]

const AUDIENCE_OPTIONS = Object.entries(AUDIENCE_LABEL).map(([value, label]) => ({ value, label }))

const columns: VueListColumn[] = [
  { key: 'title', prop: 'title', label: '标题', minWidth: 200 },
  { key: 'audience', prop: 'audience', label: '人群', width: 130 },
  { key: 'channels', prop: 'channels', label: '渠道', width: 190 },
  { key: 'reachCount', prop: 'reachCount', label: '触达 / 目标', width: 130 },
  { key: 'status', prop: 'status', label: '状态', width: 100 },
  { key: 'sendTime', prop: 'sendTime', label: '发送时间', width: 160 },
  { key: 'operatorName', prop: 'operatorName', label: '操作人', width: 110 },
]

const rows = ref<PushTask[]>([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = ref(20)
const templates = ref<MessageTemplate[]>([])
const loading = ref(true)
const error = ref('')
const sending = ref(false)
const preview = ref<{ audience: string; count: number } | null>(null)
const previewLoading = ref(false)
const polling = ref(false)
const formRef = ref<FormInstance>()

const formState = reactive({
  audience: 'all',
  templateCode: undefined as string | undefined,
  channels: ['station'] as string[],
  title: '',
  content: '',
})

const templateOptions = computed(() =>
  templates.value.map((item) => ({
    value: item.code,
    label: `${item.code} · ${item.title}`,
  })),
)

let pollTimer: number | undefined

function load(silent = false) {
  if (!silent) {
    loading.value = true
    error.value = ''
  }
  ucApi.pushes({ pageNum: pageNum.value, pageSize: pageSize.value })
    .then((data) => {
      rows.value = data.records
      total.value = data.total
      polling.value = data.records.some((row) => row.status === 'queued' || row.status === 'sending')
    })
    .catch((reason: Error) => {
      if (!silent) error.value = reason.message
    })
    .finally(() => {
      if (!silent) loading.value = false
    })
}

watch([pageNum, pageSize], () => load(), { immediate: true })

watch(polling, (isPolling) => {
  if (pollTimer) {
    window.clearInterval(pollTimer)
    pollTimer = undefined
  }
  if (isPolling) {
    pollTimer = window.setInterval(() => load(true), 2000)
  }
})

onMounted(() => {
  ucApi.templates()
    .then((res) => { templates.value = res })
    .catch(() => undefined)
})

onUnmounted(() => {
  if (pollTimer) window.clearInterval(pollTimer)
})

watch(() => formState.audience, (aud) => {
  if (!aud) return
  previewLoading.value = true
  ucApi.audienceCount(aud)
    .then((res) => { preview.value = res })
    .catch(() => { preview.value = null })
    .finally(() => { previewLoading.value = false })
}, { immediate: true })

function handlePageChange(next: number, nextSize: number) {
  pageSize.value = nextSize
  pageNum.value = next
}

function handleTemplateChange(code?: unknown) {
  if (!code) return
  const hit = templates.value.find((item) => item.code === String(code))
  if (!hit) return
  formState.title = hit.title
  formState.content = hit.content ?? ''
}

function send() {
  formRef.value?.validate()
    .then(() => {
      sending.value = true
      return ucApi.sendPush({
        title: formState.title || undefined,
        content: formState.content || undefined,
        templateCode: formState.templateCode || undefined,
        audience: formState.audience,
        channels: (formState.channels ?? []).join(','),
      })
    })
    .then((result) => {
      message.success(result.message)
      formState.audience = 'all'
      formState.templateCode = undefined
      formState.channels = ['station']
      formState.title = ''
      formState.content = ''
      load()
    })
    .catch((reason: Error) => {
      if (reason?.message) message.error(reason.message)
    })
    .finally(() => { sending.value = false })
}
</script>

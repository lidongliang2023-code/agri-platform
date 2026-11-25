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

    <section class="surface-card">
      <SectionHeading
        kicker="推送任务"
        :title="`历史记录（${total}）`"
        :action="polling ? '投递中，自动刷新' : undefined"
        @action="load()"
      />
      <a-table
        row-key="id"
        size="middle"
        :loading="loading"
        :data-source="rows"
        :scroll="{ x: 1080 }"
        :columns="columns"
        :pagination="{
          current: pageNum,
          pageSize: 20,
          total,
          showTotal: (count: number) => `共 ${count} 次`,
          onChange: (next: number) => { pageNum = next },
        }"
      >
        <template #bodyCell="{ column, record, text }">
          <div v-if="column.key === 'title'">
            <b>{{ text }}</b>
            <div v-if="record.templateCode" class="small muted">{{ record.templateCode }}</div>
            <div v-if="record.failReason" class="small" style="color: var(--red-700)">{{ record.failReason }}</div>
          </div>
          <template v-else-if="column.key === 'audience'">{{ AUDIENCE_LABEL[text] ?? text }}</template>
          <span v-else-if="column.key === 'channels'" class="small">{{ channelText(text) }}</span>
          <div v-else-if="column.key === 'reachCount'">
            <b>{{ text }}</b>
            <span class="small muted"> / {{ record.targetCount || '—' }}</span>
          </div>
          <StatusTag v-else-if="column.key === 'status'" :status="text" />
          <template v-else-if="column.key === 'sendTime'">{{ formatTime(text) }}</template>
          <template v-else-if="column.key === 'operatorName'">{{ text || '—' }}</template>
        </template>
      </a-table>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { message, type FormInstance } from 'ant-design-vue'
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

const columns = [
  { title: '标题', dataIndex: 'title', key: 'title' },
  { title: '人群', dataIndex: 'audience', key: 'audience', width: 130 },
  { title: '渠道', dataIndex: 'channels', key: 'channels', width: 190 },
  { title: '触达 / 目标', dataIndex: 'reachCount', key: 'reachCount', width: 130 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '发送时间', dataIndex: 'sendTime', key: 'sendTime', width: 150 },
  { title: '操作人', dataIndex: 'operatorName', key: 'operatorName', width: 110 },
]

const rows = ref<PushTask[]>([])
const total = ref(0)
const pageNum = ref(1)
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
  ucApi.pushes({ pageNum: pageNum.value, pageSize: 20 })
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

watch(pageNum, () => load(), { immediate: true })

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

function handleTemplateChange(code?: string) {
  if (!code) return
  const hit = templates.value.find((item) => item.code === code)
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

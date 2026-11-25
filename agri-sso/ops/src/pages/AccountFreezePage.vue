<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="安全风控"
      title="账号冻结与解封"
      :description="`当前筛选 ${total} 条 · 冻结会同时改 platform_user.status，两处必须一致 · 申诉受理即解封`"
    >
      <template #actions>
        <a-select
          :value="status"
          style="width: 140px"
          :options="statusOptions"
          @change="(val: string) => { status = val; pageNum = 1 }"
        />
        <a-select
          :value="appealStatus"
          style="width: 150px"
          :options="appealOptions"
          @change="(val: string) => { appealStatus = val; pageNum = 1 }"
        />
        <a-button type="primary" danger @click="createOpen = true">＋ 手动冻结</a-button>
      </template>
    </PageTitle>

    <ErrorBlock v-if="error" :message="error" @retry="load" />

    <section class="surface-card">
      <a-table
        row-key="id"
        size="middle"
        :loading="loading"
        :data-source="rows"
        :scroll="{ x: 1280 }"
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
          <div v-if="column.key === 'username'">
            <b>{{ text || `用户 ${record.userId}` }}</b>
            <div class="small muted">{{ record.userId }}</div>
          </div>
          <a-tag v-else-if="column.key === 'freezeType'" class="soft-tag tone-up">{{ FREEZE_TYPE_LABEL[text] ?? text }}</a-tag>
          <span v-else-if="column.key === 'reason'" class="small">{{ text || '—' }}</span>
          <template v-else-if="column.key === 'freezeTime'">{{ formatTime(text) }}</template>
          <template v-else-if="column.key === 'expireTime'">{{ text ? formatTime(text) : '永久' }}</template>
          <StatusTag v-else-if="column.key === 'status'" :status="text" />
          <template v-else-if="column.key === 'operatorName'">{{ text || '—' }}</template>
          <template v-else-if="column.key === 'appealStatus'">
            <span v-if="!text || text === 'none'" class="small muted">未申诉</span>
            <div v-else>
              <StatusTag :status="text" />
              <div v-if="record.appealReason" class="small muted" style="margin-top: 4px">
                {{ String(record.appealReason).slice(0, 28) }}{{ String(record.appealReason).length > 28 ? '…' : '' }}
              </div>
              <div v-if="record.appealRemark" class="small muted">处理意见：{{ String(record.appealRemark).slice(0, 24) }}</div>
            </div>
          </template>
          <div v-else-if="column.key === 'action'" style="display: flex; gap: 4px; flex-wrap: wrap">
            <a-button
              v-if="record.appealStatus === 'appealing'"
              size="small"
              type="primary"
              @click="openAppeal(record as FreezeRecord)"
            >
              处理申诉
            </a-button>
            <a-button v-if="record.status === 'frozen'" size="small" ghost @click="unfreezeTarget = record as FreezeRecord">
              解封
            </a-button>
            <span v-if="record.status !== 'frozen' && record.appealStatus !== 'appealing'" class="small muted">
              {{ formatTime(record.unfreezeTime) }}
            </span>
          </div>
        </template>
      </a-table>
    </section>

    <a-modal
      v-model:open="createOpen"
      title="手动冻结账号"
      :confirm-loading="creating"
      ok-text="确认冻结"
      :ok-button-props="{ danger: true }"
      @ok="freeze"
    >
      <a-form ref="formRef" :model="formState" layout="vertical" style="margin-top: 12px">
        <a-form-item
          name="userId"
          label="用户 ID"
          :rules="[{ required: true, message: '请填写用户 ID（雪花 ID，可从用户详情页复制）' }]"
        >
          <a-input v-model:value="formState.userId" placeholder="19 位用户 ID" />
        </a-form-item>
        <a-form-item name="freezeType" label="冻结类型">
          <a-select v-model:value="formState.freezeType" :options="freezeTypeOptions" />
        </a-form-item>
        <a-form-item name="reason" label="冻结原因" :rules="[{ required: true, message: '请填写原因' }]">
          <a-textarea v-model:value="formState.reason" :rows="3" placeholder="会记入冻结记录，用于后续申诉核对" />
        </a-form-item>
      </a-form>
      <div class="uc-inline-note">
        冻结会同时把 <code>platform_user.status</code> 置 0，账号立即无法登录。
        解封时两处一起恢复 —— 只改一处会出现「记录说冻了、人还能登」。
      </div>
    </a-modal>

    <a-modal
      :open="Boolean(unfreezeTarget)"
      :title="`解封：${unfreezeTarget?.username ?? ''}`"
      ok-text="确认解封"
      @cancel="unfreezeTarget = null"
      @ok="unfreeze"
    >
      <div class="stack" style="margin-top: 12px">
        <div class="small muted">冻结原因：{{ unfreezeTarget?.reason || '—' }}</div>
        <a-textarea v-model:value="remark" :rows="3" placeholder="解封说明（如申诉通过、误判等）" />
      </div>
    </a-modal>

    <a-modal
      :open="Boolean(appealTarget)"
      :title="`处理申诉：${appealTarget?.username ?? ''}`"
      :confirm-loading="appealBusy"
      :ok-text="appealPass ? '受理并解封' : '驳回申诉'"
      :ok-button-props="{ danger: !appealPass }"
      :width="560"
      @cancel="appealTarget = null"
      @ok="submitAppeal"
    >
      <div class="stack" style="margin-top: 12px">
        <a-descriptions :column="1" size="small" bordered>
          <a-descriptions-item label="冻结类型">
            {{ FREEZE_TYPE_LABEL[appealTarget?.freezeType ?? ''] ?? appealTarget?.freezeType ?? '—' }}
          </a-descriptions-item>
          <a-descriptions-item label="冻结原因">{{ appealTarget?.reason || '—' }}</a-descriptions-item>
          <a-descriptions-item label="冻结时间">{{ formatTime(appealTarget?.freezeTime) }}</a-descriptions-item>
          <a-descriptions-item label="申诉提交">{{ formatTime(appealTarget?.appealTime) }}</a-descriptions-item>
          <a-descriptions-item label="申诉理由">{{ appealTarget?.appealReason || '—' }}</a-descriptions-item>
        </a-descriptions>
        <a-select
          :value="appealPass ? 'pass' : 'reject'"
          style="width: 100%"
          :options="[
            { label: '受理（复核通过，立即解封）', value: 'pass' },
            { label: '驳回（账号保持冻结）', value: 'reject' },
          ]"
          @change="(val: string) => { appealPass = val === 'pass' }"
        />
        <a-textarea
          v-model:value="appealRemark"
          :rows="3"
          :placeholder="appealPass ? '受理说明（可选）' : '驳回理由（必填，用户需要知道为什么）'"
        />
        <div class="small muted">
          受理会同时解除冻结并恢复账号可用（与「解封」走同一段逻辑）；
          驳回则保持冻结，但申诉状态改为「已驳回」，用户可补充说明后重新提交。
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { message, type FormInstance } from 'ant-design-vue'
import { ucApi } from '../api'
import ErrorBlock from '../components/ErrorBlock.vue'
import PageTitle from '../components/PageTitle.vue'
import StatusTag from '../components/StatusTag.vue'
import { FREEZE_TYPE_LABEL, formatTime } from '../components/ui-constants'
import type { FreezeRecord } from '../types'

const statusOptions = [
  { label: '冻结中', value: 'frozen' },
  { label: '已解封', value: 'unfrozen' },
  { label: '全部状态', value: '' },
]

const appealOptions = [
  { label: '申诉中', value: 'appealing' },
  { label: '申诉已受理', value: 'accepted' },
  { label: '申诉已驳回', value: 'rejected' },
  { label: '全部申诉', value: '' },
]

const freezeTypeOptions = Object.entries(FREEZE_TYPE_LABEL).map(([value, label]) => ({ value, label }))

const columns = [
  { title: '账号', dataIndex: 'username', key: 'username', width: 180 },
  { title: '冻结类型', dataIndex: 'freezeType', key: 'freezeType', width: 120 },
  { title: '原因', dataIndex: 'reason', key: 'reason', width: 200 },
  { title: '冻结时间', dataIndex: 'freezeTime', key: 'freezeTime', width: 150 },
  { title: '期限', dataIndex: 'expireTime', key: 'expireTime', width: 150 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '操作人', dataIndex: 'operatorName', key: 'operatorName', width: 100 },
  { title: '申诉', dataIndex: 'appealStatus', key: 'appealStatus', width: 210 },
  { title: '操作', key: 'action', width: 150 },
]

const rows = ref<FreezeRecord[]>([])
const total = ref(0)
const pageNum = ref(1)
const status = ref('frozen')
const appealStatus = ref('appealing')
const loading = ref(true)
const error = ref('')
const createOpen = ref(false)
const creating = ref(false)
const unfreezeTarget = ref<FreezeRecord | null>(null)
const remark = ref('')
const appealTarget = ref<FreezeRecord | null>(null)
const appealPass = ref(true)
const appealRemark = ref('')
const appealBusy = ref(false)
const formRef = ref<FormInstance>()

const formState = reactive({
  userId: '',
  freezeType: 'violation',
  reason: '',
})

function load() {
  loading.value = true
  error.value = ''
  ucApi.freezes({
    pageNum: pageNum.value,
    pageSize: 20,
    status: status.value || undefined,
    appealStatus: appealStatus.value || undefined,
  })
    .then((data) => {
      rows.value = data.records
      total.value = data.total
    })
    .catch((reason: Error) => { error.value = reason.message })
    .finally(() => { loading.value = false })
}

watch([pageNum, status, appealStatus], load, { immediate: true })

function freeze() {
  formRef.value?.validate()
    .then(() => {
      creating.value = true
      return ucApi.freeze({ ...formState })
    })
    .then(() => {
      message.success('账号已冻结，同时置为停用状态')
      createOpen.value = false
      formRef.value?.resetFields()
      load()
    })
    .catch((reason: Error) => {
      if (reason?.message) message.error(reason.message)
    })
    .finally(() => { creating.value = false })
}

function openAppeal(row: FreezeRecord) {
  appealTarget.value = row
  appealPass.value = true
  appealRemark.value = ''
}

function submitAppeal() {
  if (!appealTarget.value) return
  if (!appealPass.value && !appealRemark.value.trim()) {
    message.warning('驳回申诉必须填写理由')
    return
  }
  appealBusy.value = true
  ucApi.handleAppeal(String(appealTarget.value.id), appealPass.value, appealRemark.value.trim())
    .then((result) => {
      message.success(result.message)
      appealTarget.value = null
      appealRemark.value = ''
      load()
    })
    .catch((reason: Error) => message.error(reason.message))
    .finally(() => { appealBusy.value = false })
}

function unfreeze() {
  if (!unfreezeTarget.value) return
  ucApi.unfreeze(String(unfreezeTarget.value.id), remark.value)
    .then(() => {
      message.success('已解封，账号恢复可用')
      unfreezeTarget.value = null
      remark.value = ''
      load()
    })
    .catch((reason: Error) => message.error(reason.message))
}
</script>

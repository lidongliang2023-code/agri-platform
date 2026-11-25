<template>
  <section class="device-remote-control" aria-label="远程控制">
    <header class="device-control-head">
      <div><h3>远程控制</h3><span>提交申请 → 接入端领取 → 执行回执</span></div>
      <a-tag :color="disabled ? undefined : offline ? 'orange' : 'green'">
        {{ disabled ? '设备已停用' : offline ? '设备离线' : '设备在线' }}
      </a-tag>
    </header>

    <template v-if="device.controlCapable">
      <div class="device-control-form">
        <span class="device-control-label">控制动作</span>
        <a-radio-group
          v-model:value="action"
          :disabled="submitting || disabled || Boolean(pending)"
          option-type="button"
          button-style="solid"
          :options="actionOptions"
        />
        <a-button
          type="primary"
          :danger="action === '关闭设备' || action === '重启设备'"
          :disabled="!action || disabled || Boolean(pending) || Boolean(activeCommand) || busy || Boolean(error)"
          :loading="submitting"
          @click="confirm(false)"
        >
          <template #icon><SendOutlined /></template>
          提交指令
        </a-button>
      </div>
      <p class="device-control-hint">
        {{ disabled ? '设备已停用，当前不可提交控制申请。' : selection?.hint || '选择控制动作后提交；具体能力以设备接入端支持为准。' }}
        {{ offline && !disabled ? ' 当前离线，登记后需等待接入端领取。' : '' }}
      </p>
    </template>
    <p v-else class="device-control-hint">该设备仅采集数据，不支持远程控制，可在下方查看历史指令。</p>

    <div class="device-control-notice">有效期 5 分钟 · 登记成功 ≠ 执行成功 · 超时先核实现场，不自动重发</div>

    <div v-if="pending || submitError" class="device-command-error" role="alert">
      <template v-if="pending">
        <b>提交结果待核对</b>
        <div>动作：{{ pending.action }} · 原编号：<code>{{ pending.requestNo }}</code></div>
        <p>{{ submitError || '存在尚未确认的申请，请先刷新指令记录。' }} 不要重新生成相同指令；如仍无法确认，可复用原编号重试。</p>
        <a-button size="small" :disabled="submitting || disabled" @click="confirm(true)">复用原编号重试</a-button>
      </template>
      <template v-else>{{ submitError }}</template>
    </div>

    <p v-if="activeCommand" class="device-control-notice">
      设备有待完成指令（{{ activeCommand.action }}），暂不可提交新的控制申请。
    </p>
    <div v-if="submittedNo" class="device-control-submitted" role="status">
      最新提交：<code>{{ submittedNo }}</code><span>请以下方实时回执为准</span>
    </div>

    <div class="device-command-head">
      <div><h4>指令记录</h4><span>每 10 秒更新{{ updatedAt ? ` · 最近更新 ${updatedAt}` : '' }}</span></div>
      <a-button size="small" :loading="busy" @click="revision++">
        <template #icon><ReloadOutlined /></template>
        刷新
      </a-button>
    </div>

    <div v-if="error" class="device-command-error" role="alert">
      {{ error }}{{ rows.length > 0 ? '，下方为上次读取的记录。' : '，请刷新重试。' }}
    </div>

    <div class="device-command-table" :aria-busy="busy">
      <div class="device-command-columns">
        <span>指令 / 申请时间</span><span>执行状态</span><span>申请人</span><span>结果与详情</span>
      </div>
      <article v-for="(row, index) in rows" :key="row.commandNo || `${page}-${index}`" class="device-command-row">
        <div class="device-command-action"><b>{{ row.action || '历史指令' }}</b><time>{{ formatTime(row.createdAt) }}</time></div>
        <div><a-tag :color="statusMetaOf(row.status).color">{{ statusMetaOf(row.status).label }}</a-tag></div>
        <div class="device-command-operator"><span class="device-command-mobile-label">申请人：</span>{{ row.operator || '—' }}</div>
        <div class="device-command-result">
          <span>{{ row.result || '暂无执行结果' }}</span>
          <p v-if="guidance[row.status]" class="device-command-guidance">{{ guidance[row.status] }}</p>
          <details>
            <summary>查看详情</summary>
            <dl>
              <dt>指令编号</dt><dd><code>{{ row.commandNo || '历史记录（未采集编号）' }}</code></dd>
              <dt>申请时间</dt><dd>{{ formatTime(row.createdAt) }}</dd>
              <dt>领取时间</dt><dd>{{ formatTime(row.sentAt) }}</dd>
              <dt>回执时间</dt><dd>{{ formatTime(row.receiptAt) }}</dd>
              <dt>到期时间</dt><dd>{{ formatTime(row.expiresAt) }}</dd>
              <template v-if="row.progress != null">
                <dt>执行进度</dt><dd>{{ row.progress }}%{{ row.installedVersion ? ` · ${row.installedVersion}` : '' }}</dd>
              </template>
            </dl>
          </details>
        </div>
      </article>
      <div v-if="!rows.length" class="device-command-empty">
        {{ busy ? '正在读取指令记录…' : error ? '暂时无法读取指令记录' : '暂无指令记录' }}
      </div>
    </div>

    <footer class="device-command-footer">
      <span>第 {{ page }} 页 · 本页 {{ rows.length }} 条</span>
      <div>
        <a-button size="small" :disabled="page === 1 || busy" @click="page--">上一页</a-button>
        <a-button size="small" :disabled="rows.length < 20 || busy || Boolean(error)" @click="page++">下一页</a-button>
      </div>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, h, onUnmounted, ref, watch } from 'vue'
import { Modal, message } from 'ant-design-vue'
import { ReloadOutlined, SendOutlined } from '@ant-design/icons-vue'
import type { CommandReceipt } from '../../../shared-ui/vue/types'
import { CommandSubmissionError, iotApi, type IotDevice } from '../api/iotExperience'
import './device-remote-control.css'

const props = defineProps<{ device: IotDevice }>()

const actions = [
  { value: '开启设备', label: '开启', hint: '申请启动设备，请确认现场具备启动条件。' },
  { value: '关闭设备', label: '关闭', hint: '可能中断当前作业，请确认可以停止设备。' },
  { value: '重启设备', label: '重启', hint: '将暂时中断设备连接与作业，请确认现场允许重启。' },
]
const actionOptions = actions.map((item) => ({ value: item.value, label: item.label }))

const statusMeta: Record<string, { label: string; color?: string }> = {
  PENDING: { label: '待领取', color: 'gold' },
  SENT: { label: '待回执', color: 'blue' },
  RUNNING: { label: '执行中', color: 'blue' },
  SUCCEEDED: { label: '回执成功', color: 'green' },
  FAILED: { label: '回执失败', color: 'red' },
  TIMEOUT: { label: '超时待核实', color: 'orange' },
  EXPIRED: { label: '未领取已过期', color: 'default' },
  LEGACY: { label: '历史无回执' },
}

const guidance: Record<string, string> = {
  PENDING: '等待接入端领取；请勿重复提交。',
  SENT: '接入端已领取，请等待执行回执。',
  FAILED: '请核实失败原因和现场状态，排除故障后再申请；平台不会自动重发。',
  TIMEOUT: '执行结果未知，请核实现场、设备日志或联系运维，勿直接重发。',
  EXPIRED: '有效期内未领取，平台未下发；核实现场后可重新申请。',
}

type PendingSubmission = { deviceId: number; action: string; requestNo: string }
const pendingKey = (id: number) => `iot-control-pending-${id}`
function restorePending(id: number): PendingSubmission | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(pendingKey(id)) || 'null')
    return v?.deviceId === id && /^CMD[a-f0-9]{32}$/i.test(v.requestNo) && actions.some((a) => a.value === v.action) ? v : null
  } catch {
    return null
  }
}

function formatTime(value?: string | null): string {
  return value ? value.replace('T', ' ').replace(/(\d{2}:\d{2}:\d{2})\.\d+/, '$1') : '—'
}

function statusMetaOf(status: string) {
  return statusMeta[status] || { label: status || '状态未知' }
}

const action = ref<string | undefined>()
const submitting = ref(false)
const rows = ref<CommandReceipt[]>([])
const page = ref(1)
const busy = ref(true)
const error = ref('')
const revision = ref(0)
const updatedAt = ref('')
const submittedNo = ref('')
const pending = ref<PendingSubmission | null>(restorePending(props.device.id))
const submitError = ref('')

let recordScope = ''
let locked = false
let mounted = true
let activeDialog: { destroy: () => void } | null = null
let pollTimer: number | undefined

const selection = computed(() => actions.find((item) => item.value === action.value))
const disabled = computed(() => props.device.status === 'disabled')
const offline = computed(() => props.device.onlineStatus === 'offline')
const activeCommand = computed(() => rows.value.find((row) => ['PENDING', 'SENT', 'RUNNING'].includes(row.status)))

function clearPending() {
  try { sessionStorage.removeItem(pendingKey(props.device.id)) } catch { /* ignore */ }
  pending.value = null
}

watch(() => props.device.id, (id) => {
  page.value = 1
  action.value = undefined
  submittedNo.value = ''
  submitError.value = ''
  pending.value = restorePending(id)
  activeDialog?.destroy()
  locked = false
})

watch([() => props.device.id, page, revision], ([deviceId, currentPage], _, onCleanup) => {
  let active = true
  let running = false
  const scope = `${deviceId}:${currentPage}`
  if (recordScope !== scope) {
    rows.value = []
    updatedAt.value = ''
    error.value = ''
    recordScope = scope
  }
  const refresh = async () => {
    if (running) return
    running = true
    busy.value = true
    try {
      const next = await iotApi.commandReceipts(deviceId, currentPage)
      if (active) {
        const saved = restorePending(deviceId)
        if (saved && next.some((row) => row.commandNo === saved.requestNo)) {
          try { sessionStorage.removeItem(pendingKey(deviceId)) } catch { /* ignore */ }
          pending.value = null
          submitError.value = ''
          submittedNo.value = saved.requestNo
        }
        rows.value = next
        error.value = ''
        updatedAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
      }
    } catch (e) {
      if (active) error.value = e instanceof Error ? e.message : '指令记录加载失败'
    } finally {
      running = false
      if (active) busy.value = false
    }
  }
  void refresh()
  pollTimer = window.setInterval(() => void refresh(), 10000)
  onCleanup(() => {
    active = false
    if (pollTimer) window.clearInterval(pollTimer)
  })
}, { immediate: true })

onUnmounted(() => {
  mounted = false
  activeDialog?.destroy()
  if (pollTimer) window.clearInterval(pollTimer)
})

function confirm(retry = false) {
  const chosen = retry && pending.value ? actions.find((item) => item.value === pending.value?.action) : selection.value
  if (!chosen || locked || disabled.value || !props.device.controlCapable || (!retry && (pending.value || busy.value || error.value || activeCommand.value))) {
    return
  }
  locked = true
  const command = chosen.value
  const request: PendingSubmission = retry && pending.value
    ? pending.value
    : { deviceId: props.device.id, action: command, requestNo: 'CMD' + crypto.randomUUID().replace(/-/g, '') }
  const dialog = Modal.confirm({
    title: retry ? `核对原申请：${command}` : `确认${command}？`,
    content: h('div', { class: 'device-control-confirm' }, [
      h('p', [h('b', props.device.deviceName)]),
      h('p', props.device.deviceCode),
      h('p', chosen.hint),
      offline.value ? h('p', '设备当前离线，指令登记后仍需等待接入端领取。') : null,
      h('p', retry
        ? `本次复用原提交编号 ${request.requestNo}；已登记则只返回原记录，未登记才创建申请。`
        : '指令有效期为 5 分钟，提交成功不代表设备执行成功，请以回执为准。'),
    ]),
    okText: '确认提交',
    cancelText: '取消',
    maskClosable: false,
    okButtonProps: { danger: command !== '开启设备' },
    onCancel: () => { locked = false },
    onOk: async () => {
      submitting.value = true
      pending.value = request
      submitError.value = ''
      try { sessionStorage.setItem(pendingKey(props.device.id), JSON.stringify(request)) } catch { /* ignore */ }
      dialog.update({ cancelButtonProps: { disabled: true }, closable: false, keyboard: false })
      try {
        const result = await iotApi.control(props.device.id, command, request.requestNo)
        if (!mounted) return
        clearPending()
        submitError.value = ''
        submittedNo.value = String(result.commandNo || '')
        page.value = 1
        revision.value++
        action.value = undefined
        message.success('申请记录已确认，请以下方实际回执为准')
      } catch (e) {
        if (!mounted) return
        const uncertain = !(e instanceof CommandSubmissionError) || e.uncertain
        const text = e instanceof Error ? e.message : '指令提交结果尚未确认'
        submitError.value = text
        if (!uncertain) clearPending()
        page.value = 1
        revision.value++
        if (uncertain) message.warning(text)
        else message.error(text)
      } finally {
        if (mounted) submitting.value = false
        locked = false
      }
    },
  })
  activeDialog = dialog
}
</script>

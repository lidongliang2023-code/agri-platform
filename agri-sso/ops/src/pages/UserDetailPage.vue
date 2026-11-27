<template>
  <div v-if="error" class="agri-detail-page">
    <div class="uc-detail-state is-error">
      <p>{{ error }}</p>
      <div style="margin-top: 12px; display: flex; justify-content: center; gap: 8px">
        <a-button @click="app.navigate('user-list')">返回用户列表</a-button>
        <a-button type="primary" @click="loadDetail">重新加载</a-button>
      </div>
    </div>
  </div>
  <div v-else-if="!data" class="agri-detail-page">
    <div class="uc-detail-state">正在加载用户详情…</div>
  </div>
  <AgriVueDetailLayout
    v-else
    :code="data.user.username || `UID-${data.user.id}`"
    :title="data.user.nickname && data.user.nickname !== data.user.username ? data.user.nickname : ''"
    :status="accountStatusBadge"
    :extra-statuses="extraStatuses"
    :meta="headerMeta"
    :tabs="tabs"
    v-model:active-tab="activeTab"
    back-label="返回用户列表"
    @back="app.navigate('user-list')"
  >
    <template #actions>
      <a-button @click="printPage">打印</a-button>
      <a-button :loading="loading || sessionsLoading" @click="refreshAll">刷新</a-button>
      <a-popconfirm
        title="重置该账号的登录密码？"
        description="会生成一次性临时密码、吊销全部会话，并给用户发站内信通知。"
        ok-text="确认重置"
        cancel-text="取消"
        @confirm="doResetPassword"
      >
        <a-button :disabled="acting">重置密码</a-button>
      </a-popconfirm>
      <a-popconfirm
        title="强制该账号下线？"
        description="会清掉全部 SSO 会话并吊销已发出的访问令牌，用户需重新登录。"
        ok-text="确认下线"
        cancel-text="取消"
        @confirm="doForceLogout"
      >
        <a-button danger :disabled="acting">强制下线 ({{ sessions.length }})</a-button>
      </a-popconfirm>
      <a-button type="primary" @click="app.navigate('account-freeze')">
        {{ data.freeze ? '去解封' : '账号冻结管理' }}
      </a-button>
    </template>

    <template v-if="data.freeze" #banner>
      <a-alert
        type="warning"
        show-icon
        :message="`当前账号处于「${freezeTypeLabel(data.freeze.freezeType)}」状态`"
        :description="data.freeze.reason ? `原因：${data.freeze.reason}` : '可前往账号冻结与解封页处理解封或审核申诉。'"
      />
    </template>

    <template v-if="activeTab === 'detail'">
      <AgriVueDetailSection title="账号基础信息">
        <AgriVueDetailInfoGrid :items="accountItems">
          <template #value-roles>
            <div v-if="data.roles.length" class="tag-row">
              <a-tag v-for="role in data.roles" :key="role.code" class="soft-tag">{{ roleText(role.code) }}</a-tag>
            </div>
            <span v-else>—</span>
          </template>
        </AgriVueDetailInfoGrid>
      </AgriVueDetailSection>

      <AgriVueDetailSection title="实名认证核验">
        <template #extra>
          <StatusTag v-if="data.identity" :status="data.identity.status" />
          <span v-else class="small muted">未提交实名认证</span>
        </template>
        <AgriVueDetailInfoGrid v-if="data.identity" :items="identityItems" />
        <EmptyState v-else icon="🪪" title="尚未提交实名认证" description="该账号未做过实名核验，无法进行交易与融资。" />
      </AgriVueDetailSection>

      <AgriVueDetailSection title="所属经营主体" :flush="true">
        <template #extra>
          <button
            v-if="data.orgs.length > 0"
            type="button"
            class="agri-detail-section-link"
            @click="activeTab = 'orgs'"
          >
            查看全部 {{ data.orgs.length }} 家
          </button>
        </template>
        <a-table
          row-key="id"
          size="small"
          :pagination="false"
          :data-source="data.orgs.slice(0, 5)"
          :locale="{ emptyText: '未绑定任何经营主体' }"
          :columns="orgColumns"
        >
          <template #bodyCell="{ column, record, text }">
            <span v-if="column.key === 'code'" class="agri-detail-mono">{{ text || '—' }}</span>
            <b v-else-if="column.key === 'name'">{{ text || '—' }}</b>
            <template v-else-if="column.key === 'type'">{{ orgTypeLabel(text) }}</template>
            <StatusTag v-else-if="column.key === 'verifyStatus'" :status="text" />
            <a-button
              v-else-if="column.key === 'action'"
              size="small"
              type="link"
              @click="app.navigate('org-detail', String(record.id))"
            >
              查看组织
            </a-button>
            <template v-else>{{ text || '—' }}</template>
          </template>
        </a-table>
        <template #footer>
          <span>共关联 <strong class="agri-detail-mono">{{ data.orgs.length }}</strong> 家经营主体</span>
        </template>
      </AgriVueDetailSection>
    </template>

    <template v-else-if="activeTab === 'orgs'">
      <AgriVueDetailSection title="所属经营主体明细" :flush="true">
        <a-table
          row-key="id"
          size="small"
          :pagination="false"
          :data-source="data.orgs"
          :locale="{ emptyText: '未绑定任何经营主体' }"
          :columns="orgColumns"
        >
          <template #bodyCell="{ column, record, text }">
            <span v-if="column.key === 'code'" class="agri-detail-mono">{{ text || '—' }}</span>
            <b v-else-if="column.key === 'name'">{{ text || '—' }}</b>
            <template v-else-if="column.key === 'type'">{{ orgTypeLabel(text) }}</template>
            <StatusTag v-else-if="column.key === 'verifyStatus'" :status="text" />
            <a-button
              v-else-if="column.key === 'action'"
              size="small"
              type="link"
              @click="app.navigate('org-detail', String(record.id))"
            >
              查看组织
            </a-button>
            <template v-else>{{ text || '—' }}</template>
          </template>
        </a-table>
      </AgriVueDetailSection>
    </template>

    <template v-else-if="activeTab === 'sessions'">
      <AgriVueDetailSection title="活跃 SSO 会话" :flush="true">
        <template #extra>
          <button type="button" class="agri-detail-section-link" @click="loadSessions">刷新会话</button>
        </template>
        <div class="uc-inline-note" style="margin: 14px 20px">
          会话数据与用户端「登录设备」读取同一份 Redis SSO 会话，确保运营排查台数与用户端口径完全一致。
        </div>
        <a-table
          row-key="sessionKey"
          size="small"
          :loading="sessionsLoading"
          :data-source="sessions"
          :pagination="false"
          :locale="{ emptyText: '当前没有活跃会话' }"
          :columns="sessionColumns"
        >
          <template #bodyCell="{ column, text }">
            <b v-if="column.key === 'device'">{{ text || '未知端' }}</b>
            <span v-else-if="column.key === 'ip'" class="agri-detail-mono">{{ text || '—' }}</span>
            <span v-else-if="column.key === 'loginAt'" class="agri-detail-mono">{{ formatMillis(text) }}</span>
            <span v-else-if="column.key === 'userAgent'" class="small muted">{{ String(text || '—').slice(0, 80) }}</span>
          </template>
        </a-table>
      </AgriVueDetailSection>
    </template>

    <template v-else-if="activeTab === 'logs'">
      <AgriVueDetailSection title="最近 20 条操作日志" :flush="true">
        <template #extra>
          <button type="button" class="agri-detail-section-link" @click="app.navigate('device-log')">
            查看全量登录日志 →
          </button>
        </template>
        <a-table
          row-key="id"
          size="small"
          :pagination="false"
          :data-source="data.recentLogs"
          :locale="{ emptyText: '暂无操作流水' }"
          :columns="logColumns"
        >
          <template #bodyCell="{ column, record, text }">
            <span v-if="column.key === 'createdAt'" class="agri-detail-mono">{{ formatTime(text) }}</span>
            <template v-else-if="column.key === 'actionLabel'">{{ text || record.action }}</template>
            <span v-else-if="column.key === 'ip'" class="agri-detail-mono">{{ text || '—' }}</span>
            <StatusTag v-else-if="column.key === 'result'" :status="text" />
            <template v-else>{{ text || '—' }}</template>
          </template>
        </a-table>
      </AgriVueDetailSection>
    </template>

    <template #aside>
      <AgriVueDetailSection title="账号与认证进度">
        <AgriVueDetailTimeline :items="timelineSteps" />
      </AgriVueDetailSection>

      <AgriVueDetailSection title="关联单据与入口">
        <AgriVueDetailRelated :items="relatedDocs" />
      </AgriVueDetailSection>
    </template>
  </AgriVueDetailLayout>

  <a-modal
    :open="Boolean(tempPassword)"
    title="临时密码（仅显示这一次）"
    @cancel="tempPassword = null"
  >
    <template #footer>
      <a-button @click="copyTempPassword">复制</a-button>
      <a-button type="primary" @click="tempPassword = null">我已转告本人</a-button>
    </template>
    <div class="stack" style="margin-top: 12px">
      <div
        style="padding: 14px 16px; border-radius: 10px; background: var(--green-050, #f1fbf5); font-size: 20px; font-weight: 700; letter-spacing: 2px; text-align: center; font-family: ui-monospace, SFMono-Regular, Menlo, monospace"
      >
        {{ tempPassword }}
      </div>
      <div class="small muted" style="line-height: 1.9">
        关掉这个弹窗后就查不到了 —— 系统不保存明文密码。<br />
        该账号的全部会话已被下线，并已收到一条「密码已被重置」的站内信。<br />
        <b>注意</b>：平台没有「首次登录强制改密」的标记位，这个临时密码在用户自行修改前一直有效，
        请通过电话等安全渠道转告本人，并提醒其登录后立即修改。
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  AgriVueDetailInfoGrid,
  AgriVueDetailLayout,
  AgriVueDetailRelated,
  AgriVueDetailSection,
  AgriVueDetailTimeline,
  type DetailInfoGridItem,
  type DetailRelatedDocItem,
  type DetailStatusBadge,
  type DetailTabEntry,
  type DetailTimelineStep,
} from '@agri/shared/vue/detail'
import { useAppStore } from '../app-context'
import { ucApi } from '../api'
import EmptyState from '../components/EmptyState.vue'
import StatusTag from '../components/StatusTag.vue'
import {
  FREEZE_TYPE_LABEL,
  ORG_TYPE_LABEL,
  STATUS_MAP,
  formatMillis,
  formatTime,
  roleText,
} from '../components/ui-constants'
import type { SessionRow, UserDetailData } from '../types'

const props = defineProps<{ id: string }>()
const app = useAppStore()
const data = ref<UserDetailData | null>(null)
const loading = ref(false)
const error = ref('')
const sessions = ref<SessionRow[]>([])
const sessionsLoading = ref(false)
const acting = ref(false)
const tempPassword = ref<string | null>(null)
const activeTab = ref('detail')

const orgColumns = [
  { title: '主体编码', dataIndex: 'code', key: 'code', width: 150 },
  { title: '主体名称', dataIndex: 'name', key: 'name' },
  { title: '类型', dataIndex: 'type', key: 'type', width: 110 },
  { title: '地址', dataIndex: 'address', key: 'address' },
  { title: '认证状态', dataIndex: 'verifyStatus', key: 'verifyStatus', width: 100 },
  { title: '操作', key: 'action', width: 90 },
]

const sessionColumns = [
  { title: '设备', dataIndex: 'device', key: 'device', width: 130 },
  { title: 'IP', dataIndex: 'ip', key: 'ip', width: 140 },
  { title: '登录时间', dataIndex: 'loginAt', key: 'loginAt', width: 160 },
  { title: 'User-Agent', dataIndex: 'userAgent', key: 'userAgent' },
]

const logColumns = [
  { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 160 },
  { title: '动作', dataIndex: 'actionLabel', key: 'actionLabel', width: 150 },
  { title: '对象', dataIndex: 'target', key: 'target', width: 140 },
  { title: '说明', dataIndex: 'detail', key: 'detail' },
  { title: 'IP', dataIndex: 'ip', key: 'ip', width: 140 },
  { title: '结果', dataIndex: 'result', key: 'result', width: 90 },
]

const freezeTypeLabel = (code?: string | null) =>
  (code && FREEZE_TYPE_LABEL[code.toLowerCase()]) || code || '冻结'

const orgTypeLabel = (code?: string | null) =>
  (code && (ORG_TYPE_LABEL[code.toUpperCase()] || ORG_TYPE_LABEL[code])) || code || '—'

const identityStatusLabel = (status?: string | null) => {
  if (!status) return '未实名'
  return STATUS_MAP[status.toLowerCase()]?.label ?? status
}

const accountStatusBadge = computed<DetailStatusBadge>(() => {
  if (data.value?.freeze) return { label: `${freezeTypeLabel(data.value.freeze.freezeType)}中`, tone: 'red' }
  return data.value?.user.status === 1
    ? { label: '账号正常', tone: 'green' }
    : { label: '已冻结', tone: 'red' }
})

const extraStatuses = computed<DetailStatusBadge[]>(() => {
  const d = data.value
  if (!d) return []
  const badges: DetailStatusBadge[] = []
  const idStatus = d.identity?.status?.toLowerCase()
  if (idStatus === 'approved' || idStatus === 'verified') {
    badges.push({ label: '已实名', tone: 'green' })
  } else if (idStatus === 'pending' || idStatus === 'submitted' || idStatus === 'reviewing') {
    badges.push({ label: '实名审核中', tone: 'orange' })
  } else if (idStatus === 'rejected') {
    badges.push({ label: '实名已驳回', tone: 'red' })
  } else {
    badges.push({ label: '未实名', tone: 'gray' })
  }
  if (d.roles[0]) {
    badges.push({ label: roleText(d.roles[0].code), tone: 'blue' })
  }
  return badges
})

const headerMeta = computed(() => {
  const d = data.value
  if (!d) return []
  return [
    { label: '用户编号', value: d.user.id },
    { label: '手机号', value: d.user.phone || '未绑定' },
    { label: '角色数', value: `${d.roles.length} 项` },
    { label: '注册时间', value: formatTime(d.user.createdAt) },
  ]
})

const tabs = computed<DetailTabEntry[]>(() => [
  { key: 'detail', label: '用户详情' },
  { key: 'orgs', label: '所属组织', count: data.value?.orgs.length ?? 0 },
  { key: 'sessions', label: '活跃会话', count: sessions.value.length },
  { key: 'logs', label: '操作日志', count: data.value?.recentLogs.length ?? 0 },
])

const accountItems = computed<DetailInfoGridItem[]>(() => {
  const d = data.value
  if (!d) return []
  return [
    { key: 'username', label: '登录账号', value: d.user.username, mono: true },
    { key: 'userId', label: '用户编号', value: d.user.id, mono: true },
    { key: 'nickname', label: '用户昵称', value: d.user.nickname || '—' },
    { key: 'phone', label: '绑定手机', value: d.user.phone || '未绑定', mono: Boolean(d.user.phone) },
    { key: 'email', label: '联系邮箱', value: d.user.email || '未绑定', mono: Boolean(d.user.email) },
    { key: 'status', label: '账号状态', value: d.user.status === 1 ? '正常' : '已冻结' },
    { key: 'createdAt', label: '注册时间', value: formatTime(d.user.createdAt), mono: true },
    { key: 'updatedAt', label: '最后更新', value: formatTime(d.user.updatedAt), mono: true },
    { key: 'roles', label: '平台角色', value: d.roles.map((r) => roleText(r.code)).join('、') || '—', fullWidth: true },
  ]
})

const identityItems = computed<DetailInfoGridItem[]>(() => {
  const id = data.value?.identity
  if (!id) return []
  return [
    { key: 'realName', label: '真实姓名', value: id.realName || '—' },
    { key: 'idNo', label: '证件号', value: id.idNoMasked || '—', mono: true },
    { key: 'status', label: '审核状态', value: identityStatusLabel(id.status) },
    { key: 'police', label: '公安库比对', value: id.policeVerified ? '已通过' : '未通过 / 未做' },
    { key: 'liveness', label: '活体检测', value: id.livenessVerified ? '已通过' : '未通过 / 未做' },
    { key: 'submitTime', label: '提交时间', value: formatTime(id.submitTime), mono: true },
    { key: 'reviewer', label: '审核人', value: id.reviewerName || '—' },
    { key: 'reviewTime', label: '审核时间', value: formatTime(id.reviewTime), mono: true },
    { key: 'remark', label: '审核意见', value: id.reviewRemark || '—', fullWidth: true },
  ]
})

const timelineSteps = computed<DetailTimelineStep[]>(() => {
  const d = data.value
  if (!d) return []
  const idStatus = d.identity?.status?.toLowerCase()
  const idDone = idStatus === 'approved' || idStatus === 'verified'
  const idRejected = idStatus === 'rejected'
  const hasOrg = d.orgs.length > 0
  return [
    {
      key: 'registered',
      title: '账号已完成注册',
      time: formatTime(d.user.createdAt),
      description: `账号 ${d.user.username}`,
      state: 'done',
    },
    {
      key: 'realname',
      title: idDone ? '实名认证已通过' : idRejected ? '实名认证已驳回' : d.identity ? '实名认证审核中' : '等待实名认证',
      time: formatTime(d.identity?.reviewTime || d.identity?.submitTime),
      description: d.identity?.realName ? `核验人：${d.identity.realName}` : '未提交实名核验资料',
      state: idDone ? 'done' : idRejected ? 'error' : d.identity ? 'current' : 'pending',
    },
    {
      key: 'org',
      title: hasOrg ? `已绑定 ${d.orgs.length} 家经营主体` : '尚未绑定经营主体',
      description: hasOrg ? d.orgs[0].name : '可在组织管理中查看归属关系',
      state: hasOrg ? 'done' : 'pending',
    },
    {
      key: 'security',
      title: d.freeze
        ? `账号${freezeTypeLabel(d.freeze.freezeType)}中`
        : sessions.value.length > 0
          ? `当前在线（${sessions.value.length} 个活跃会话）`
          : '账号状态正常（当前无活跃会话）',
      time: formatTime(d.recentLogs[0]?.createdAt),
      description: d.freeze?.reason || (sessions.value[0] ? `最近登录 IP ${sessions.value[0].ip || '—'}` : '未发现异常风险'),
      state: d.freeze ? 'error' : sessions.value.length > 0 ? 'done' : 'pending',
    },
  ]
})

const relatedDocs = computed<DetailRelatedDocItem[]>(() => {
  const d = data.value
  if (!d) return []
  const firstOrg = d.orgs[0]
  return [
    {
      key: 'org',
      label: '主关联组织',
      code: firstOrg?.code || undefined,
      text: firstOrg ? firstOrg.name : '未绑定组织',
      mono: Boolean(firstOrg?.code),
      clickable: Boolean(firstOrg),
      onClick: () => { if (firstOrg) app.navigate('org-detail', String(firstOrg.id)) },
    },
    {
      key: 'realname',
      label: '实名认证审核',
      text: identityStatusLabel(d.identity?.status),
      mono: false,
      badge: d.identity ? identityStatusLabel(d.identity.status) : '未提交',
      badgeTone: d.identity?.status?.toLowerCase() === 'approved' ? 'green' : d.identity ? 'orange' : 'gray',
      clickable: true,
      onClick: () => app.navigate('realname-audit'),
    },
    {
      key: 'freeze',
      label: '冻结与解封台账',
      text: d.freeze ? `${freezeTypeLabel(d.freeze.freezeType)}中` : '正常无冻结',
      mono: false,
      badge: d.freeze ? '冻结中' : '正常',
      badgeTone: d.freeze ? 'red' : 'green',
      clickable: true,
      onClick: () => app.navigate('account-freeze'),
    },
    {
      key: 'deviceLog',
      label: '设备与登录日志',
      text: '查看历史登录记录',
      mono: false,
      clickable: true,
      onClick: () => app.navigate('device-log'),
    },
  ]
})

function loadDetail() {
  if (!props.id) {
    error.value = '缺少用户 ID'
    return
  }
  loading.value = true
  error.value = ''
  ucApi.userDetail(props.id)
    .then((res) => { data.value = res })
    .catch((reason: Error) => { error.value = reason.message })
    .finally(() => { loading.value = false })
}

function loadSessions() {
  if (!props.id) return
  sessionsLoading.value = true
  ucApi.userSessions(props.id)
    .then((res) => { sessions.value = res })
    .catch(() => { sessions.value = [] })
    .finally(() => { sessionsLoading.value = false })
}

function refreshAll() {
  loadDetail()
  loadSessions()
}

watch(() => props.id, (id) => {
  activeTab.value = 'detail'
  data.value = null
  if (!id) {
    error.value = '缺少用户 ID'
    return
  }
  refreshAll()
}, { immediate: true })

function doForceLogout() {
  acting.value = true
  ucApi.forceLogout(props.id)
    .then((result) => {
      message.success(result.message)
      loadSessions()
    })
    .catch((reason: Error) => message.error(reason.message))
    .finally(() => { acting.value = false })
}

function doResetPassword() {
  acting.value = true
  ucApi.resetPassword(props.id)
    .then((result) => {
      tempPassword.value = result.tempPassword
      loadSessions()
    })
    .catch((reason: Error) => message.error(reason.message))
    .finally(() => { acting.value = false })
}

function copyTempPassword() {
  if (tempPassword.value) {
    void navigator.clipboard?.writeText(tempPassword.value)
    message.success('已复制临时密码')
  }
}

function printPage() {
  window.print()
}
</script>

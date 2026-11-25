<template>
  <div v-if="error" class="page-stack">
    <PageTitle title="用户详情" />
    <ErrorBlock :message="error" @retry="app.navigate('user-list')" />
  </div>
  <div v-else-if="!data" class="page-stack">
    <PageTitle title="用户详情" description="正在加载…" />
  </div>
  <div v-else class="page-stack">
    <PageTitle eyebrow="用户与身份" title="用户详情">
      <template #actions>
        <a-button @click="app.navigate('user-list')">返回列表</a-button>
      </template>
    </PageTitle>

    <section class="surface-card">
      <div class="uc-detail-head">
        <div style="display: flex; gap: 16px; align-items: flex-start">
          <div class="uc-detail-avatar">{{ (data.user.nickname || data.user.username).slice(0, 1) }}</div>
          <div>
            <h2 class="uc-detail-title">{{ data.user.nickname || data.user.username }}</h2>
            <div class="uc-detail-sub">
              账号 {{ data.user.username }} · 手机 {{ data.user.phone || '未绑定' }} · 注册于 {{ formatTime(data.user.createdAt) }}
            </div>
            <div class="tag-row" style="margin-top: 10px">
              <StatusTag :status="data.user.status === 1 ? 'success' : 'frozen'" />
              <a-tag v-for="role in data.roles" :key="role.code" class="soft-tag">{{ roleText(role.code) }}</a-tag>
              <a-tag v-if="data.freeze" class="soft-tag tone-up">{{ data.freeze.freezeType }} 冻结中</a-tag>
            </div>
          </div>
        </div>
        <div style="display: flex; gap: 8px">
          <a-button @click="app.navigate('account-freeze')">{{ data.freeze ? '去解封' : '去冻结' }}</a-button>
          <a-button @click="app.navigate('device-log')">登录日志</a-button>
        </div>
      </div>
    </section>

    <div class="grid-2">
      <section class="surface-card">
        <SectionHeading kicker="实名认证" title="身份核验" />
        <a-descriptions v-if="data.identity" :column="1" size="small" bordered>
          <a-descriptions-item label="真实姓名">{{ data.identity.realName || '—' }}</a-descriptions-item>
          <a-descriptions-item label="证件号（掩码）">{{ data.identity.idNoMasked || '—' }}</a-descriptions-item>
          <a-descriptions-item label="状态"><StatusTag :status="data.identity.status" /></a-descriptions-item>
          <a-descriptions-item label="公安库比对">{{ data.identity.policeVerified ? '已通过' : '未通过 / 未做' }}</a-descriptions-item>
          <a-descriptions-item label="活体检测">{{ data.identity.livenessVerified ? '已通过' : '未通过 / 未做' }}</a-descriptions-item>
          <a-descriptions-item label="提交时间">{{ formatTime(data.identity.submitTime) }}</a-descriptions-item>
          <a-descriptions-item label="审核人">
            {{ data.identity.reviewerName || '—' }}
            <div v-if="data.identity.reviewRemark" class="small muted">意见：{{ data.identity.reviewRemark }}</div>
          </a-descriptions-item>
        </a-descriptions>
        <EmptyState v-else icon="🪪" title="尚未提交实名认证" description="该账号未做过实名核验，无法进行交易与融资。" />
      </section>

      <section class="surface-card">
        <SectionHeading kicker="组织归属" :title="`所属组织（${data.orgs.length}）`" />
        <span v-if="!data.orgs.length" class="small muted">未绑定任何经营主体</span>
        <div class="stack">
          <div v-for="org in data.orgs" :key="String(org.id)" class="row" style="justify-content: space-between">
            <div>
              <b>{{ org.name }}</b>
              <div class="small muted">{{ org.code }} · {{ org.address || '未填写地址' }}</div>
            </div>
            <div style="display: flex; gap: 6px; align-items: center">
              <StatusTag :status="org.verifyStatus" />
              <a-button size="small" type="link" @click="app.navigate('org-detail', String(org.id))">查看</a-button>
            </div>
          </div>
        </div>
      </section>
    </div>

    <section class="surface-card">
      <SectionHeading kicker="账号处置" title="会话与安全操作" />
      <div class="uc-inline-note" style="margin-top: 0; margin-bottom: 14px">
        会话数据与用户端「登录设备」是同一份（都读 Redis 里的 SSO 会话），运营看到的台数
        与用户自己看到的必须一致 —— 否则"用户说三台、运营说一台"没法对账。
      </div>
      <div class="chip-row" style="margin-bottom: 14px">
        <a-button :loading="sessionsLoading" @click="loadSessions">刷新会话</a-button>
        <a-popconfirm
          title="强制该账号下线？"
          description="会清掉全部 SSO 会话并吊销已发出的访问令牌，用户需重新登录。"
          ok-text="确认下线"
          cancel-text="取消"
          @confirm="doForceLogout"
        >
          <a-button danger :disabled="acting">强制下线（{{ sessions.length }} 个会话）</a-button>
        </a-popconfirm>
        <a-popconfirm
          title="重置该账号的登录密码？"
          description="会生成一次性临时密码、吊销全部会话，并给用户发站内信通知。"
          ok-text="确认重置"
          cancel-text="取消"
          @confirm="doResetPassword"
        >
          <a-button :disabled="acting">重置登录密码</a-button>
        </a-popconfirm>
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
          <template v-else-if="column.key === 'ip'">{{ text || '—' }}</template>
          <template v-else-if="column.key === 'loginAt'">{{ formatMillis(text) }}</template>
          <span v-else-if="column.key === 'userAgent'" class="small muted">{{ String(text || '—').slice(0, 64) }}</span>
        </template>
      </a-table>
    </section>

    <section class="surface-card">
      <SectionHeading kicker="操作流水" title="最近 20 条操作" />
      <a-table
        row-key="id"
        size="small"
        :pagination="false"
        :data-source="data.recentLogs"
        :columns="logColumns"
      >
        <template #bodyCell="{ column, record, text }">
          <template v-if="column.key === 'createdAt'">{{ formatTime(text) }}</template>
          <template v-else-if="column.key === 'actionLabel'">{{ text || record.action }}</template>
          <template v-else-if="column.key === 'target' || column.key === 'detail' || column.key === 'ip'">{{ text || '—' }}</template>
          <StatusTag v-else-if="column.key === 'result'" :status="text" />
        </template>
      </a-table>
    </section>

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
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { useAppStore } from '../app-context'
import { ucApi } from '../api'
import EmptyState from '../components/EmptyState.vue'
import ErrorBlock from '../components/ErrorBlock.vue'
import PageTitle from '../components/PageTitle.vue'
import SectionHeading from '../components/SectionHeading.vue'
import StatusTag from '../components/StatusTag.vue'
import { formatMillis, formatTime, roleText } from '../components/ui-constants'
import type { SessionRow, UserDetailData } from '../types'

const props = defineProps<{ id: string }>()
const app = useAppStore()
const data = ref<UserDetailData | null>(null)
const error = ref('')
const sessions = ref<SessionRow[]>([])
const sessionsLoading = ref(false)
const acting = ref(false)
const tempPassword = ref<string | null>(null)

const sessionColumns = [
  { title: '设备', dataIndex: 'device', key: 'device', width: 130 },
  { title: 'IP', dataIndex: 'ip', key: 'ip', width: 140 },
  { title: '登录时间', dataIndex: 'loginAt', key: 'loginAt', width: 160 },
  { title: 'User-Agent', dataIndex: 'userAgent', key: 'userAgent' },
]

const logColumns = [
  { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 160 },
  { title: '动作', dataIndex: 'actionLabel', key: 'actionLabel' },
  { title: '对象', dataIndex: 'target', key: 'target' },
  { title: '说明', dataIndex: 'detail', key: 'detail' },
  { title: 'IP', dataIndex: 'ip', key: 'ip', width: 140 },
  { title: '结果', dataIndex: 'result', key: 'result', width: 90 },
]

function loadSessions() {
  if (!props.id) return
  sessionsLoading.value = true
  ucApi.userSessions(props.id)
    .then((res) => { sessions.value = res })
    .catch(() => { sessions.value = [] })
    .finally(() => { sessionsLoading.value = false })
}

watch(() => props.id, (id) => {
  if (!id) {
    error.value = '缺少用户 ID'
    return
  }
  error.value = ''
  data.value = null
  ucApi.userDetail(id)
    .then((res) => { data.value = res })
    .catch((reason: Error) => { error.value = reason.message })
  loadSessions()
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
</script>

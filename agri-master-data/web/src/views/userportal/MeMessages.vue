<template>
  <div class="mds-page">
    <PageHeader
      title="消息通知"
      subtitle="当前账号的站内信与平台公告：站内信可标已读，公告由平台统一发布。"
      source="用户中心 · 消息中心"
    >
      <template #actions>
        <button class="mds-btn" :disabled="loading" @click="reloadActive">刷新</button>
      </template>
    </PageHeader>

    <NoticeBar tone="info" title="口径：">
      站内信的已读状态由服务端记录；<b>平台公告不记录已读</b>，只展示当前生效（已发布且未到期）的公告。
    </NoticeBar>

    <div class="mds-card">
      <div class="mds-tabs">
        <button
          type="button"
          class="mds-tab"
          :class="{ 'is-active': activeTab === 'message' }"
          @click="switchTab('message')"
        >
          站内信<span class="mds-tab__count">{{ unread }}</span>
        </button>
        <button
          type="button"
          class="mds-tab"
          :class="{ 'is-active': activeTab === 'notice' }"
          @click="switchTab('notice')"
        >
          平台公告<span class="mds-tab__count">{{ announcements.length }}</span>
        </button>
      </div>

      <template v-if="activeTab === 'message'">
        <div class="mds-card-head">
          <div>
            <h2 class="mds-card-title">消息列表</h2>
            <p class="mds-card-sub">共 {{ total }} 条 · 未读 {{ unread }} 条</p>
          </div>
          <button class="mds-btn mds-btn--sm" :disabled="!unread" @click="readVisible">把本页标为已读</button>
        </div>

        <div v-if="loading" class="mds-card-body mds-empty">正在加载消息…</div>
        <div v-else-if="!rows.length" class="mds-card-body">
          <EmptyState icon="🔔" title="还没有消息" description="认证结果、证照到期提醒等消息会出现在这里。" />
        </div>
        <div v-else class="msg-list">
          <button
            v-for="row in rows"
            :key="row.id"
            class="msg-row"
            :class="{ 'is-unread': Number(row.readFlag) === 0 }"
            @click="openMessage(row)"
          >
            <span class="dot" :class="{ 'is-read': Number(row.readFlag) !== 0 }" />
            <span class="msg-main">
              <span class="msg-title">{{ row.title }}</span>
              <span class="msg-content">{{ row.content }}</span>
            </span>
            <span class="msg-time">{{ formatTime(row.createdAt) }}</span>
          </button>
        </div>

        <PagerBar :page="page" :page-size="size" :total="total" @change="changePage" />
      </template>

      <template v-else>
        <div class="mds-card-head">
          <div>
            <h2 class="mds-card-title">平台公告</h2>
            <p class="mds-card-sub">已发布且未到期 · 共 {{ announcements.length }} 条</p>
          </div>
        </div>

        <div v-if="loadingNotice" class="mds-card-body mds-empty">正在加载公告…</div>
        <div v-else-if="!announcements.length" class="mds-card-body">
          <EmptyState icon="📢" title="暂无生效中的公告" description="平台发布公告后会出现在这里（到期或下线的公告不再展示）。" />
        </div>
        <div v-else class="notice-list">
          <button
            v-for="item in announcements"
            :key="item.id"
            class="notice-row"
            @click="selectedNotice = item"
          >
            <StatusTag :text="typeText(item.type)" :tone="typeTone(item.type)" plain />
            <span class="msg-main">
              <span class="msg-title">{{ item.title }}</span>
              <span class="msg-content">{{ item.content }}</span>
            </span>
            <span class="msg-time">{{ formatTime(item.publishTime) }}</span>
          </button>
        </div>
      </template>
    </div>

    <!-- 公告详情 -->
    <div v-if="selectedNotice" class="mds-mask" @click="selectedNotice = null">
      <section class="mds-modal" @click.stop>
        <div class="mds-card-head">
          <div>
            <p class="mds-card-sub">{{ typeText(selectedNotice.type) }} · {{ formatTime(selectedNotice.publishTime) }}</p>
            <h2 class="mds-card-title">{{ selectedNotice.title }}</h2>
          </div>
          <button class="mds-btn" @click="selectedNotice = null">关闭</button>
        </div>
        <div class="mds-card-body">
          <p class="notice-content">{{ selectedNotice.content }}</p>
          <p class="mds-hint" style="margin-top: 14px">
            到期时间：{{ selectedNotice.expireTime ? formatTime(selectedNotice.expireTime) : '长期有效' }}
          </p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { message as toast } from 'ant-design-vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PagerBar from '@/components/ui/PagerBar.vue'
import { useMeStore } from '@/stores/me'
import {
  getMyAnnouncements,
  getMyMessages,
  markMessageRead,
  type AnnouncementRow,
  type MessageRow,
} from '@/utils/me'

const route = useRoute()
const me = useMeStore()
const activeTab = ref<'message' | 'notice'>(route.query.tab === 'notice' ? 'notice' : 'message')

const loading = ref(false)
const rows = ref<MessageRow[]>([])
const page = ref(1)
const size = ref(20)
const total = ref(0)
const unread = ref(0)

const loadingNotice = ref(false)
const announcements = ref<AnnouncementRow[]>([])
const selectedNotice = ref<AnnouncementRow | null>(null)

const formatTime = (value?: string) => (value ? String(value).replace('T', ' ').slice(0, 16) : '—')

const TYPE_TEXT: Record<string, string> = {
  info: '通知公告',
  warning: '重要提醒',
  maintenance: '系统维护',
  emergency: '紧急通知',
}
const TYPE_TONE: Record<string, 'info' | 'warning' | 'purple' | 'danger'> = {
  info: 'info',
  warning: 'warning',
  maintenance: 'purple',
  emergency: 'danger',
}
const typeText = (type?: string) => TYPE_TEXT[type ?? ''] ?? '通知公告'
const typeTone = (type?: string) => TYPE_TONE[type ?? ''] ?? 'info'

async function loadMessages() {
  loading.value = true
  try {
    const response = await getMyMessages(page.value, size.value)
    const data = (response?.data ?? {}) as { records?: MessageRow[]; total?: number | string }
    rows.value = data.records ?? []
    total.value = Number(data.total ?? 0)
    unread.value = rows.value.filter((row) => Number(row.readFlag) === 0).length
    await me.refreshUnread()
  } catch (error) {
    rows.value = []
    total.value = 0
    toast.error(error instanceof Error ? error.message : '加载消息失败')
  } finally {
    loading.value = false
  }
}

async function loadAnnouncements() {
  loadingNotice.value = true
  try {
    const response = await getMyAnnouncements(20)
    announcements.value = (response?.data ?? []) as AnnouncementRow[]
  } catch {
    announcements.value = []
  } finally {
    loadingNotice.value = false
  }
}

function reloadActive() {
  if (activeTab.value === 'message') void loadMessages()
  else void loadAnnouncements()
}

function switchTab(tab: 'message' | 'notice') {
  activeTab.value = tab
  if (tab === 'message' && !rows.value.length) void loadMessages()
  if (tab === 'notice' && !announcements.value.length) void loadAnnouncements()
}

function changePage(next: number) {
  page.value = next
  void loadMessages()
}

async function openMessage(row: MessageRow) {
  if (Number(row.readFlag) === 0) {
    try {
      await markMessageRead(row.id)
      row.readFlag = 1
      unread.value = Math.max(0, unread.value - 1)
      await me.refreshUnread()
    } catch {
      toast.error('标记已读失败')
    }
  }
  window.alert(`${row.title}\n\n${row.content}`)
}

async function readVisible() {
  const targets = rows.value.filter((row) => Number(row.readFlag) === 0)
  for (const row of targets) {
    try {
      await markMessageRead(row.id)
      row.readFlag = 1
    } catch {
      // 单条失败继续处理其余
    }
  }
  unread.value = 0
  await me.refreshUnread()
  toast.success(`已将 ${targets.length} 条标记为已读`)
}

watch(
  () => route.query.tab,
  (tab) => {
    if (tab === 'notice') switchTab('notice')
    if (tab === 'message') switchTab('message')
  },
)

onMounted(() => {
  if (activeTab.value === 'notice') void loadAnnouncements()
  else void loadMessages()
})
</script>

<style scoped>
.msg-list,
.notice-list {
  display: flex;
  flex-direction: column;
}

.msg-row,
.notice-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  padding: 13px 18px;
  border: 0;
  border-bottom: 1px solid var(--mds-line-soft);
  background: none;
  text-align: left;
  cursor: pointer;
}

.msg-row:last-child,
.notice-row:last-child {
  border-bottom: 0;
}

.msg-row:hover,
.notice-row:hover {
  background: #f7fbf9;
}

.msg-row.is-unread .msg-title {
  font-weight: 700;
}

.dot {
  width: 8px;
  height: 8px;
  margin-top: 7px;
  flex: none;
  border-radius: 50%;
  background: var(--mds-brand);
}

.dot.is-read {
  background: transparent;
  border: 1px solid var(--mds-line);
}

.msg-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.msg-title {
  font-size: 13px;
}

.msg-content {
  font-size: 12px;
  color: var(--mds-text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.msg-time {
  flex: none;
  font-family: var(--mds-mono);
  font-size: var(--agri-font-size-micro);
  color: var(--mds-text-3);
}

.notice-content {
  margin: 0;
  font-size: 13px;
  line-height: 1.85;
  white-space: pre-wrap;
  color: var(--mds-text);
}

.mds-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  padding: 20px;
}

.mds-modal {
  width: 680px;
  max-width: 100%;
  max-height: 88vh;
  overflow: auto;
  border-radius: var(--mds-radius);
  background: var(--mds-card);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
}
</style>

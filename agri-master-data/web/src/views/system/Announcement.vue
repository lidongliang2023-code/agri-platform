<template>
  <div class="mds-page">
    <PageHeader
      title="公告管理"
      subtitle="平台公告的起草、发布与下线；发布后的公告面向全平台展示。"
      source="系统配置 · 公告"
    >
      <template #actions>
        <button v-point="'POST /admin/masterdata/announcement'" class="mds-btn mds-btn--primary" @click="openCreate">+ 发布公告</button>
        <button class="mds-btn" :disabled="loading" @click="load">刷新</button>
      </template>
    </PageHeader>

    <NoticeBar tone="info" title="状态口径：">
      草稿 → 发布（记录发布时间与发布人）→ 下线。已发布的公告仍可修改正文，但不会重置发布时间；到期时间留空表示长期有效。
    </NoticeBar>

    <div class="mds-card">
      <div class="mds-filter">
        <input v-model="keyword" class="mds-input" type="search" placeholder="标题 / 正文关键词" @keyup.enter="search" />
        <select v-model="filterStatus" class="mds-select" @change="search">
          <option value="">全部状态</option>
          <option value="draft">草稿</option>
          <option value="published">已发布</option>
          <option value="offline">已下线</option>
        </select>
        <select v-model="filterType" class="mds-select" @change="search">
          <option value="">全部类型</option>
          <option value="info">通知公告</option>
          <option value="warning">重要提醒</option>
          <option value="maintenance">系统维护</option>
          <option value="emergency">紧急通知</option>
        </select>
        <button class="mds-btn mds-btn--primary" @click="search">查询</button>
        <button class="mds-btn" @click="reset">重置</button>
      </div>

      <div class="mds-table-wrap">
        <table class="mds-table announcement-table">
          <thead>
            <tr>
              <th>标题</th>
              <th>类型</th>
              <th>状态</th>
              <th>发布人</th>
              <th>发布时间</th>
              <th>到期时间</th>
              <th class="mds-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="7" class="mds-empty">正在加载公告…</td>
            </tr>
            <tr v-else-if="!rows.length">
              <td colspan="7">
                <EmptyState
                  icon="📢"
                  title="没有符合条件的公告"
                  :description="rows.length === 0 ? '还没有发布过公告；点击右上角「发布公告」起草第一条。' : '调整筛选条件后重试。'"
                />
              </td>
            </tr>
            <tr v-for="row in rows" :key="row.id">
              <td>
                <div class="mds-name">{{ row.title }}</div>
                <div class="mds-hint content-cell" :title="row.content">{{ row.content }}</div>
              </td>
              <td><StatusTag :text="typeText(row.type)" :tone="typeTone(row.type)" plain /></td>
              <td><StatusTag :text="statusText(row.status)" :tone="statusTone(row.status)" /></td>
              <td>{{ row.author || '—' }}</td>
              <td class="mds-muted time-cell">{{ formatTime(row.publishTime) }}</td>
              <td class="mds-muted time-cell">{{ row.expireTime ? formatTime(row.expireTime) : '长期' }}</td>
              <td class="mds-actions">
                <button v-point="'PUT /admin/masterdata/announcement/{id}'" class="mds-btn mds-btn--link" @click="openEdit(row)">编辑</button>
                <button v-point="'PUT /admin/masterdata/announcement/{id}/publish'"
                  v-if="row.status !== 'published'"
                  class="mds-btn mds-btn--link"
                  :disabled="busyId === row.id"
                  @click="publish(row)"
                >发布</button>
                <button v-point="'PUT /admin/masterdata/announcement/{id}/offline'"
                  v-else
                  class="mds-btn mds-btn--link mds-danger"
                  :disabled="busyId === row.id"
                  @click="offline(row)"
                >下线</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <PagerBar :page="page" :page-size="pageSize" :total="total" @change="changePage" @update:page-size="changePageSize" />
    </div>

    <div v-if="showModal" class="mds-mask" @click="closeModal">
      <div class="mds-modal" @click.stop>
        <div class="mds-card-head">
          <h2 class="mds-card-title">{{ editingId ? '编辑公告' : '发布公告' }}</h2>
          <button class="mds-btn mds-btn--link" @click="closeModal">关闭</button>
        </div>
        <div class="mds-card-body">
          <div class="mds-form">
            <label class="mds-field">
              <span class="mds-field__label mds-required">标题</span>
              <input v-model="form.title" class="mds-input" placeholder="如：系统维护通知" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label">类型</span>
              <select v-model="form.type" class="mds-select">
                <option value="info">通知公告</option>
                <option value="warning">重要提醒</option>
                <option value="maintenance">系统维护</option>
                <option value="emergency">紧急通知</option>
              </select>
            </label>
            <label class="mds-field">
              <span class="mds-field__label">到期时间</span>
              <input v-model="form.expireTime" class="mds-input" type="datetime-local" />
            </label>
            <label v-if="!editingId" class="mds-field">
              <span class="mds-field__label">发布方式</span>
              <select v-model="form.publishNow" class="mds-select">
                <option :value="true">立即发布</option>
                <option :value="false">先存草稿</option>
              </select>
            </label>
            <label class="mds-field mds-field--full">
              <span class="mds-field__label mds-required">正文</span>
              <textarea v-model="form.content" class="mds-textarea" style="min-height: 140px" placeholder="公告正文，支持换行" />
            </label>
          </div>
          <div class="mds-form-actions">
            <button class="mds-btn" @click="closeModal">取消</button>
            <button class="mds-btn mds-btn--primary" :disabled="saving" @click="submit">
              {{ saving ? '提交中…' : editingId ? '保存修改' : form.publishNow ? '发布' : '存草稿' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PagerBar from '@/components/ui/PagerBar.vue'
import {
  createAnnouncement,
  getAnnouncementPage,
  offlineAnnouncement,
  publishAnnouncement,
  updateAnnouncement,
} from '@/utils/api'

interface AnnouncementRow {
  id: string
  title: string
  type?: string
  content: string
  status: string
  publishTime?: string
  expireTime?: string | null
  author?: string
}

const rows = ref<AnnouncementRow[]>([])
const loading = ref(false)
const saving = ref(false)
const busyId = ref<string | null>(null)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const keyword = ref('')
const filterStatus = ref('')
const filterType = ref('')
const showModal = ref(false)
const editingId = ref<string | null>(null)

const form = reactive({
  title: '',
  type: 'info',
  content: '',
  expireTime: '',
  publishNow: true,
})

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
const STATUS_TEXT: Record<string, string> = { draft: '草稿', published: '已发布', offline: '已下线' }
const STATUS_TONE: Record<string, 'gray' | 'success' | 'danger'> = {
  draft: 'gray',
  published: 'success',
  offline: 'danger',
}
const typeText = (type?: string) => TYPE_TEXT[type ?? ''] ?? type ?? '—'
const typeTone = (type?: string) => TYPE_TONE[type ?? ''] ?? 'info'
const statusText = (status?: string) => STATUS_TEXT[status ?? ''] ?? status ?? '—'
const statusTone = (status?: string) => STATUS_TONE[status ?? ''] ?? 'gray'
const formatTime = (value?: string | null) => (value ? String(value).replace('T', ' ').slice(0, 16) : '—')

async function load() {
  loading.value = true
  try {
    const response = await getAnnouncementPage({
      pageNum: page.value,
      pageSize: pageSize.value,
      status: filterStatus.value || undefined,
      type: filterType.value || undefined,
      keyword: keyword.value || undefined,
    })
    if (response.code !== 200) throw new Error(response.message || '加载公告失败')
    rows.value = (response.data?.list ?? []) as AnnouncementRow[]
    total.value = Number(response.data?.total ?? 0)
  } catch (error) {
    rows.value = []
    total.value = 0
    message.error(error instanceof Error ? error.message : '加载公告失败')
  } finally {
    loading.value = false
  }
}

function search() {
  page.value = 1
  void load()
}

function reset() {
  keyword.value = ''
  filterStatus.value = ''
  filterType.value = ''
  search()
}

function changePage(next: number) {
  page.value = next
  void load()
}

function changePageSize(size: number) {
  pageSize.value = size
  page.value = 1
  void load()
}

function openCreate() {
  editingId.value = null
  Object.assign(form, { title: '', type: 'info', content: '', expireTime: '', publishNow: true })
  showModal.value = true
}

function openEdit(row: AnnouncementRow) {
  editingId.value = row.id
  Object.assign(form, {
    title: row.title,
    type: row.type ?? 'info',
    content: row.content,
    expireTime: row.expireTime ? String(row.expireTime).replace(' ', 'T').slice(0, 16) : '',
    publishNow: row.status === 'published',
  })
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingId.value = null
}

async function submit() {
  if (!form.title.trim() || !form.content.trim()) {
    message.warning('标题与正文为必填')
    return
  }
  saving.value = true
  const payload = {
    title: form.title.trim(),
    type: form.type,
    content: form.content,
    expireTime: form.expireTime || null,
    publishNow: editingId.value ? undefined : form.publishNow,
  }
  try {
    const response = editingId.value
      ? await updateAnnouncement(editingId.value, payload)
      : await createAnnouncement(payload)
    if (response.code !== 200) throw new Error(response.message || '保存失败')
    message.success(editingId.value ? '公告已更新' : form.publishNow ? '公告已发布' : '草稿已保存')
    closeModal()
    await load()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function publish(row: AnnouncementRow) {
  busyId.value = row.id
  try {
    const response = await publishAnnouncement(row.id)
    if (response.code !== 200) throw new Error(response.message || '发布失败')
    message.success('公告已发布')
    await load()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '发布失败')
  } finally {
    busyId.value = null
  }
}

async function offline(row: AnnouncementRow) {
  if (!window.confirm(`确认下线「${row.title}」？下线后全平台不再展示。`)) return
  busyId.value = row.id
  try {
    const response = await offlineAnnouncement(row.id)
    if (response.code !== 200) throw new Error(response.message || '下线失败')
    message.success('公告已下线')
    await load()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '下线失败')
  } finally {
    busyId.value = null
  }
}

onMounted(load)
</script>

<style scoped>
.announcement-table {
  min-width: 1040px;
}

.content-cell {
  max-width: 420px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time-cell {
  white-space: nowrap;
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
  width: 760px;
  max-width: 100%;
  max-height: 88vh;
  overflow: auto;
  border-radius: var(--mds-radius);
  background: var(--mds-card);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
}
</style>

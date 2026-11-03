<template>
  <div class="mds-page">
    <PageHeader
      title="黑名单管理"
      subtitle="平台级联合惩戒名单：失信用户 / 客户 / 供应商的登记、证据留档与解除。"
      source="主数据 · 平台惩戒"
    >
      <template #actions>
        <button v-point="'POST /admin/masterdata/blacklist'" class="mds-btn mds-btn--primary" @click="openCreate">+ 加入黑名单</button>
        <button class="mds-btn" :disabled="loading" @click="reloadAll">刷新</button>
      </template>
    </PageHeader>

    <NoticeBar tone="warning" title="生效范围：">
      本页维护名单与「是否生效」的判定接口；下游交易 / 金融是否拦截，取决于各自在下单前调用校验。
      到期记录会自动视为失效，无需手工解除。
    </NoticeBar>

    <StatGrid :items="statItems" />

    <div class="mds-card">
      <div class="mds-filter">
        <input v-model="keyword" class="mds-input" type="search" placeholder="对象名称 / ID / 原因" @keyup.enter="search" />
        <select v-model="filterType" class="mds-select" @change="search">
          <option value="">全部对象类型</option>
          <option value="user">个人用户</option>
          <option value="customer">客户</option>
          <option value="supplier">供应商</option>
        </select>
        <select v-model="filterStatus" class="mds-select" @change="search">
          <option value="active">生效中</option>
          <option value="released">已解除</option>
          <option value="">全部状态</option>
        </select>
        <button class="mds-btn mds-btn--primary" @click="search">查询</button>
        <button class="mds-btn" @click="reset">重置</button>
      </div>

      <div class="mds-table-wrap">
        <table class="mds-table blacklist-table">
          <thead>
            <tr>
              <th>对象</th>
              <th>类型</th>
              <th>拉黑原因</th>
              <th>证据 / 依据</th>
              <th>生效时间</th>
              <th>期限</th>
              <th>状态</th>
              <th class="mds-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="8" class="mds-empty">正在加载黑名单…</td>
            </tr>
            <tr v-else-if="!rows.length">
              <td colspan="8">
                <EmptyState
                  icon="⛔"
                  title="没有符合条件的黑名单记录"
                  :description="filterStatus === 'active' ? '当前没有生效中的惩戒记录。' : '调整筛选条件后重试。'"
                />
              </td>
            </tr>
            <tr v-for="row in rows" :key="row.id">
              <td>
                <div class="mds-name">{{ row.targetName }}</div>
                <div class="mds-hint mds-mono">{{ row.targetId || '未关联ID' }}</div>
              </td>
              <td><StatusTag :text="typeText(row.targetType)" :tone="typeTone(row.targetType)" plain /></td>
              <td>{{ row.reason || '—' }}</td>
              <td class="evidence-cell" :title="row.evidence || ''">{{ row.evidence || '—' }}</td>
              <td class="mds-muted time-cell">{{ formatTime(row.startTime) }}</td>
              <td>
                <StatusTag v-if="!row.expireTime" text="永久" tone="danger" plain />
                <span v-else class="mds-muted time-cell">{{ formatTime(row.expireTime) }}</span>
              </td>
              <td>
                <StatusTag
                  :text="row.status === 'active' ? '生效中' : '已解除'"
                  :tone="row.status === 'active' ? 'danger' : 'gray'"
                />
              </td>
              <td class="mds-actions">
                <button
                  v-if="row.status === 'active'"
                  v-point="'PUT /admin/masterdata/blacklist/{id}/release'"
                  class="mds-btn mds-btn--link"
                  :disabled="busyId === row.id"
                  @click="openRelease(row)"
                >解除</button>
                <span v-else class="mds-hint">{{ row.releaseReason || '已解除' }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <PagerBar :page="page" :page-size="pageSize" :total="total" @change="changePage" @update:page-size="changePageSize" />
    </div>

    <!-- 新增 -->
    <div v-if="showCreate" class="mds-mask" @click="showCreate = false">
      <div class="mds-modal" @click.stop>
        <div class="mds-card-head">
          <h2 class="mds-card-title">加入黑名单</h2>
          <button class="mds-btn mds-btn--link" @click="showCreate = false">关闭</button>
        </div>
        <div class="mds-card-body">
          <div class="mds-form">
            <label class="mds-field">
              <span class="mds-field__label mds-required">对象类型</span>
              <select v-model="form.targetType" class="mds-select">
                <option value="customer">客户</option>
                <option value="supplier">供应商</option>
                <option value="user">个人用户</option>
              </select>
            </label>
            <label class="mds-field">
              <span class="mds-field__label">对象 ID</span>
              <input v-model="form.targetId" class="mds-input" placeholder="可选；填了会做重复生效校验" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label mds-required">对象名称</span>
              <input v-model="form.targetName" class="mds-input" placeholder="客户 / 供应商 / 用户名称" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label mds-required">拉黑原因</span>
              <select v-model="form.reason" class="mds-select">
                <option value="严重食品安全事故">严重食品安全事故</option>
                <option value="恶意欠款 / 欺诈">恶意欠款 / 欺诈</option>
                <option value="失信被执行人">失信被执行人</option>
                <option value="资料造假">资料造假</option>
                <option value="恶意投诉">恶意投诉</option>
              </select>
            </label>
            <label class="mds-field">
              <span class="mds-field__label">到期时间</span>
              <input v-model="form.expireTime" class="mds-input" type="datetime-local" />
            </label>
            <label class="mds-field mds-field--full">
              <span class="mds-field__label">证据 / 依据</span>
              <textarea v-model="form.evidence" class="mds-textarea" placeholder="处罚决定书编号、抽检报告、法院文书等" />
            </label>
          </div>
          <div class="mds-form-actions">
            <button class="mds-btn" @click="showCreate = false">取消</button>
            <button class="mds-btn mds-btn--primary" :disabled="saving" @click="submitCreate">
              {{ saving ? '提交中…' : '确认加入' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 解除 -->
    <div v-if="releaseTarget" class="mds-mask" @click="closeRelease">
      <div class="mds-modal mds-modal--sm" @click.stop>
        <div class="mds-card-head">
          <h2 class="mds-card-title">解除黑名单 · {{ releaseTarget.targetName }}</h2>
          <button class="mds-btn mds-btn--link" @click="closeRelease">关闭</button>
        </div>
        <div class="mds-card-body">
          <label class="mds-field">
            <span class="mds-field__label">解除原因</span>
            <textarea v-model="releaseReason" class="mds-textarea" placeholder="如：申诉复核通过 / 惩戒期满 / 已履行义务" />
          </label>
          <div class="mds-form-actions">
            <button class="mds-btn" @click="closeRelease">取消</button>
            <button class="mds-btn mds-btn--primary" :disabled="saving" @click="submitRelease">
              {{ saving ? '提交中…' : '确认解除' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatGrid from '@/components/ui/StatGrid.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PagerBar from '@/components/ui/PagerBar.vue'
import { createBlacklist, getBlacklistPage, releaseBlacklist } from '@/utils/api'

interface BlacklistRow {
  id: string
  targetType: string
  targetId?: string
  targetName: string
  reason?: string
  evidence?: string
  startTime?: string
  expireTime?: string | null
  status: string
  releaseReason?: string
  releaseTime?: string
}

const rows = ref<BlacklistRow[]>([])
const loading = ref(false)
const saving = ref(false)
const busyId = ref<string | null>(null)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const keyword = ref('')
const filterType = ref('')
const filterStatus = ref('active')
const showCreate = ref(false)
const releaseTarget = ref<BlacklistRow | null>(null)
const releaseReason = ref('')

const form = reactive({
  targetType: 'customer',
  targetId: '',
  targetName: '',
  reason: '资料造假',
  evidence: '',
  expireTime: '',
})

const statItems = computed(() => {
  const list = rows.value
  return [
    { label: '本页记录', value: list.length, hint: `共 ${total.value} 条` },
    { label: '生效中', value: list.filter((row) => row.status === 'active').length, tone: 'danger' },
    { label: '已解除', value: list.filter((row) => row.status === 'released').length },
    { label: '永久惩戒', value: list.filter((row) => row.status === 'active' && !row.expireTime).length, tone: 'warning' },
  ]
})

const TYPE_TEXT: Record<string, string> = { user: '个人用户', customer: '客户', supplier: '供应商' }
const TYPE_TONE: Record<string, 'purple' | 'info' | 'cyan'> = { user: 'purple', customer: 'info', supplier: 'cyan' }
const typeText = (type?: string) => TYPE_TEXT[type ?? ''] ?? type ?? '—'
const typeTone = (type?: string) => TYPE_TONE[type ?? ''] ?? 'gray'
const formatTime = (value?: string | null) => (value ? String(value).replace('T', ' ').slice(0, 16) : '—')

async function load() {
  loading.value = true
  try {
    const response = await getBlacklistPage({
      pageNum: page.value,
      pageSize: pageSize.value,
      targetType: filterType.value || undefined,
      status: filterStatus.value || undefined,
      keyword: keyword.value || undefined,
    })
    if (response.code !== 200) throw new Error(response.message || '加载黑名单失败')
    rows.value = (response.data?.list ?? []) as BlacklistRow[]
    total.value = Number(response.data?.total ?? 0)
  } catch (error) {
    rows.value = []
    total.value = 0
    message.error(error instanceof Error ? error.message : '加载黑名单失败')
  } finally {
    loading.value = false
  }
}

function reloadAll() {
  void load()
}

function search() {
  page.value = 1
  void load()
}

function reset() {
  keyword.value = ''
  filterType.value = ''
  filterStatus.value = 'active'
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
  Object.assign(form, { targetType: 'customer', targetId: '', targetName: '', reason: '资料造假', evidence: '', expireTime: '' })
  showCreate.value = true
}

async function submitCreate() {
  if (!form.targetName.trim()) {
    message.warning('请填写对象名称')
    return
  }
  saving.value = true
  try {
    const response = await createBlacklist({
      targetType: form.targetType,
      targetId: form.targetId || null,
      targetName: form.targetName.trim(),
      reason: form.reason,
      evidence: form.evidence,
      expireTime: form.expireTime || null,
    })
    if (response.code !== 200) throw new Error(response.message || '加入失败')
    message.success('已加入黑名单')
    showCreate.value = false
    await load()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加入失败')
  } finally {
    saving.value = false
  }
}

function openRelease(row: BlacklistRow) {
  releaseTarget.value = row
  releaseReason.value = ''
}

function closeRelease() {
  releaseTarget.value = null
}

async function submitRelease() {
  const target = releaseTarget.value
  if (!target) return
  busyId.value = target.id
  saving.value = true
  try {
    const response = await releaseBlacklist(target.id, releaseReason.value || undefined)
    if (response.code !== 200) throw new Error(response.message || '解除失败')
    message.success('已解除')
    closeRelease()
    await load()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '解除失败')
  } finally {
    saving.value = false
    busyId.value = null
  }
}

onMounted(load)
</script>

<style scoped>
.blacklist-table {
  min-width: 1080px;
}

.evidence-cell {
  max-width: 260px;
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
  width: 700px;
  max-width: 100%;
  max-height: 88vh;
  overflow: auto;
  border-radius: var(--mds-radius);
  background: var(--mds-card);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
}

.mds-modal--sm {
  width: 520px;
}
</style>

<template>
  <div class="mds-page">
    <PageHeader
      title="标准与元数据"
      subtitle="字段级格式标准、标准变更审批与元数据目录；审批只留痕，不自动改写目标。"
      source="数据标准 · 格式 / 变更 / 元数据"
    >
      <template #actions>
        <button class="mds-btn" @click="router.push('/datastandard/dict')">数据字典</button>
        <button class="mds-btn" @click="router.push('/datastandard/code-rule')">编码规则</button>
      </template>
    </PageHeader>

    <NoticeBar tone="info" title="审批语义：">
      变更申请通过只记录决策与意见，<b>不会自动改写格式标准</b>；目标调整需申请人按审批意见再走一次编辑。
    </NoticeBar>

    <StatGrid :items="statItems" />

    <div class="mds-card">
      <div class="mds-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          class="mds-tab"
          :class="{ 'is-active': activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}<span class="mds-tab__count">{{ tab.count }}</span>
        </button>
      </div>

      <!-- 格式与校验规则 -->
      <template v-if="activeTab === 'format'">
        <div class="mds-filter">
          <input v-model="formatKeyword" class="mds-input" type="search" placeholder="格式编码 / 名称" />
          <select v-model="formatStatus" class="mds-select">
            <option value="">全部状态</option>
            <option value="DRAFT">草稿</option>
            <option value="PUBLISHED">已发布</option>
            <option value="DISABLED">已停用</option>
          </select>
          <button v-point="'POST /admin/masterdata/standard/format'" class="mds-btn mds-btn--primary mds-btn--sm" @click="openFormatCreate">+ 新增格式</button>
        </div>
        <div class="mds-table-wrap">
          <table class="mds-table standard-table">
            <thead>
              <tr>
                <th>格式编码</th>
                <th>格式名称</th>
                <th>数据类型</th>
                <th>校验规则</th>
                <th class="mds-num">长度范围</th>
                <th>默认值</th>
                <th>状态</th>
                <th class="mds-actions">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="8" class="mds-empty">正在加载格式标准…</td>
              </tr>
              <tr v-else-if="!filteredFormats.length">
                <td colspan="8">
                  <EmptyState title="没有符合条件的格式标准" description="调整筛选条件，或点击右上角新增一条。" />
                </td>
              </tr>
              <tr v-for="item in filteredFormats" :key="item.id">
                <td class="mds-mono">{{ item.formatCode }}</td>
                <td class="mds-name">{{ item.formatName || '—' }}</td>
                <td>{{ item.dataType || '—' }}</td>
                <td class="mds-mono rule-cell" :title="item.validationRule || ''">{{ item.validationRule || '—' }}</td>
                <td class="mds-num">{{ lengthText(item) }}</td>
                <td>{{ item.defaultValue || '—' }}</td>
                <td><StatusTag :text="formatStatusText(item.status)" :tone="formatStatusTone(item.status)" /></td>
                <td class="mds-actions">
                  <button v-point="'PUT /admin/masterdata/standard/format/{id}'" class="mds-btn mds-btn--link" @click="openFormatEdit(item)">编辑</button>
                  <button v-point="'PUT /admin/masterdata/standard/format/{id}/status'"
                    v-if="item.status !== 'PUBLISHED'"
                    class="mds-btn mds-btn--link"
                    :disabled="busyId === item.id"
                    @click="changeFormatStatus(item, 'PUBLISHED')"
                  >发布</button>
                  <button v-point="'PUT /admin/masterdata/standard/format/{id}/status'"
                    v-else
                    class="mds-btn mds-btn--link mds-danger"
                    :disabled="busyId === item.id"
                    @click="changeFormatStatus(item, 'DISABLED')"
                  >停用</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- 标准变更审批 -->
      <template v-else-if="activeTab === 'change'">
        <div class="mds-filter">
          <select v-model="changeStatus" class="mds-select" @change="loadChanges">
            <option value="PENDING">待审批</option>
            <option value="APPROVED">已通过</option>
            <option value="REJECTED">已驳回</option>
            <option value="">全部状态</option>
          </select>
          <span class="mds-hint">共 {{ changeTotal }} 条</span>
          <button v-point="'POST /admin/masterdata/standard/change-approve'" class="mds-btn mds-btn--primary mds-btn--sm" @click="openChangeCreate">+ 新建变更申请</button>
        </div>
        <div class="mds-table-wrap">
          <table class="mds-table standard-table">
            <thead>
              <tr>
                <th>变更类型</th>
                <th>对象</th>
                <th>变更前 → 变更后</th>
                <th>申请人</th>
                <th>申请时间</th>
                <th>状态</th>
                <th class="mds-actions">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!changes.length">
                <td colspan="7"><EmptyState title="没有符合条件的变更申请" description="调整状态筛选，或新建一条变更申请。" /></td>
              </tr>
              <tr v-for="item in changes" :key="item.id">
                <td>{{ item.changeType || '—' }}</td>
                <td class="mds-name">{{ item.formatName || '—' }}</td>
                <td class="rule-cell" :title="`${item.description || ''}`">
                  {{ item.description || '—' }}
                </td>
                <td>{{ item.applicant || '—' }}</td>
                <td class="mds-muted time-cell">{{ formatTime(item.applyTime) }}</td>
                <td><StatusTag :text="changeStatusText(item.status)" :tone="changeStatusTone(item.status)" /></td>
                <td class="mds-actions">
                  <template v-if="item.status === 'PENDING'">
                    <button v-point="'PUT /admin/masterdata/standard/change-approve/{id}'" class="mds-btn mds-btn--link" :disabled="busyId === item.id" @click="decide(item, 'APPROVED')">通过</button>
                    <button class="mds-btn mds-btn--link mds-danger" :disabled="busyId === item.id" @click="decide(item, 'REJECTED')">驳回</button>
                  </template>
                  <span v-else class="mds-hint">{{ item.remark || '—' }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- 元数据目录 -->
      <template v-else>
        <div class="mds-filter">
          <input v-model="metaKeyword" class="mds-input" type="search" placeholder="中文名 / 英文标识" @keyup.enter="loadMetadata" />
          <select v-model="metaType" class="mds-select" @change="loadMetadata">
            <option value="">全部类型</option>
            <option value="BUSINESS">业务元数据</option>
            <option value="TECHNICAL">技术元数据</option>
            <option value="MANAGEMENT">管理元数据</option>
          </select>
          <span class="mds-hint">共 {{ metadata.length }} 条</span>
          <button v-point="'POST /admin/masterdata/standard/metadata'" class="mds-btn mds-btn--primary mds-btn--sm" @click="openMetaCreate">+ 新增元数据</button>
        </div>
        <div class="mds-table-wrap">
          <table class="mds-table standard-table">
            <thead>
              <tr>
                <th>中文名称</th>
                <th>英文标识</th>
                <th>类型</th>
                <th>主题域</th>
                <th>数据类型</th>
                <th>必填</th>
                <th>来源表</th>
                <th>版本</th>
                <th class="mds-actions">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!metadata.length">
                <td colspan="9"><EmptyState title="元数据目录为空" description="新增或导入元数据后，这里会显示字段级目录。" /></td>
              </tr>
              <tr v-for="item in metadata" :key="item.id">
                <td class="mds-name">{{ item.name }}</td>
                <td class="mds-mono">{{ item.nameEn || '—' }}</td>
                <td>{{ metaTypeText(item.metadataType) }}</td>
                <td>{{ item.domainName || '—' }}</td>
                <td class="mds-mono">{{ item.dataType || '—' }}</td>
                <td>{{ item.required || '—' }}</td>
                <td class="mds-mono">{{ item.sourceTable || '—' }}</td>
                <td>{{ item.version || '—' }}</td>
                <td class="mds-actions">
                  <button v-point="'PUT /admin/masterdata/standard/metadata/{id}'" class="mds-btn mds-btn--link" @click="openMetaEdit(item)">编辑</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>

    <!-- 格式弹窗 -->
    <div v-if="formatModal" class="mds-mask" @click="formatModal = false">
      <div class="mds-modal" @click.stop>
        <div class="mds-card-head">
          <h2 class="mds-card-title">{{ formatForm.id ? '编辑格式标准' : '新增格式标准' }}</h2>
          <button class="mds-btn mds-btn--link" @click="formatModal = false">关闭</button>
        </div>
        <div class="mds-card-body">
          <div class="mds-form">
            <label class="mds-field">
              <span class="mds-field__label mds-required">格式编码</span>
              <input v-model="formatForm.formatCode" class="mds-input" :disabled="Boolean(formatForm.id)" placeholder="如 PHONE_CN" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label mds-required">格式名称</span>
              <input v-model="formatForm.formatName" class="mds-input" placeholder="如 中国大陆手机号" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label">数据类型</span>
              <select v-model="formatForm.dataType" class="mds-select">
                <option value="string">字符串</option>
                <option value="number">数字</option>
                <option value="date">日期</option>
                <option value="boolean">布尔</option>
                <option value="enum">枚举</option>
              </select>
            </label>
            <label class="mds-field">
              <span class="mds-field__label">默认值</span>
              <input v-model="formatForm.defaultValue" class="mds-input" placeholder="选填" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label">最小长度</span>
              <input v-model.number="formatForm.minLength" class="mds-input" type="number" min="0" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label">最大长度</span>
              <input v-model.number="formatForm.maxLength" class="mds-input" type="number" min="0" />
            </label>
            <label class="mds-field mds-field--full">
              <span class="mds-field__label">校验规则</span>
              <input v-model="formatForm.validationRule" class="mds-input" placeholder="正则，如 ^1[3-9]\d{9}$" />
            </label>
            <label class="mds-field mds-field--full">
              <span class="mds-field__label">说明</span>
              <textarea v-model="formatForm.description" class="mds-textarea" placeholder="这条标准约束什么字段、取值口径" />
            </label>
          </div>
          <div class="mds-form-actions">
            <button class="mds-btn" @click="formatModal = false">取消</button>
            <button class="mds-btn mds-btn--primary" :disabled="saving" @click="submitFormat">
              {{ saving ? '保存中…' : '保存' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 变更申请弹窗 -->
    <div v-if="changeModal" class="mds-mask" @click="changeModal = false">
      <div class="mds-modal" @click.stop>
        <div class="mds-card-head">
          <h2 class="mds-card-title">新建变更申请</h2>
          <button class="mds-btn mds-btn--link" @click="changeModal = false">关闭</button>
        </div>
        <div class="mds-card-body">
          <div class="mds-form">
            <label class="mds-field">
              <span class="mds-field__label mds-required">目标类型</span>
              <select v-model="changeForm.targetType" class="mds-select">
                <option value="format">格式标准</option>
                <option value="dict">数据字典</option>
                <option value="code_rule">编码规则</option>
              </select>
            </label>
            <label class="mds-field">
              <span class="mds-field__label mds-required">目标名称</span>
              <input v-model="changeForm.targetName" class="mds-input" placeholder="如 手机号格式" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label">变更类型</span>
              <select v-model="changeForm.changeType" class="mds-select">
                <option value="UPDATE">修改</option>
                <option value="CREATE">新增</option>
                <option value="DISABLE">停用</option>
              </select>
            </label>
            <label class="mds-field">
              <span class="mds-field__label">目标 ID</span>
              <input v-model="changeForm.targetId" class="mds-input" placeholder="选填" />
            </label>
            <label class="mds-field mds-field--full">
              <span class="mds-field__label">变更前</span>
              <input v-model="changeForm.beforeValue" class="mds-input" placeholder="选填" />
            </label>
            <label class="mds-field mds-field--full">
              <span class="mds-field__label mds-required">变更后</span>
              <input v-model="changeForm.afterValue" class="mds-input" placeholder="如 maxLength=20" />
            </label>
          </div>
          <div class="mds-form-actions">
            <button class="mds-btn" @click="changeModal = false">取消</button>
            <button class="mds-btn mds-btn--primary" :disabled="saving" @click="submitChange">
              {{ saving ? '提交中…' : '提交申请' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 元数据弹窗 -->
    <div v-if="metaModal" class="mds-mask" @click="metaModal = false">
      <div class="mds-modal" @click.stop>
        <div class="mds-card-head">
          <h2 class="mds-card-title">{{ metaForm.id ? '编辑元数据' : '新增元数据' }}</h2>
          <button class="mds-btn mds-btn--link" @click="metaModal = false">关闭</button>
        </div>
        <div class="mds-card-body">
          <div class="mds-form">
            <label class="mds-field">
              <span class="mds-field__label mds-required">类型</span>
              <select v-model="metaForm.metadataType" class="mds-select">
                <option value="BUSINESS">业务元数据</option>
                <option value="TECHNICAL">技术元数据</option>
                <option value="MANAGEMENT">管理元数据</option>
              </select>
            </label>
            <label class="mds-field">
              <span class="mds-field__label mds-required">中文名称</span>
              <input v-model="metaForm.name" class="mds-input" placeholder="如 用户唯一标识" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label">英文标识</span>
              <input v-model="metaForm.nameEn" class="mds-input" placeholder="如 user_id" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label">主题域</span>
              <input v-model="metaForm.domainName" class="mds-input" placeholder="如 用户主数据" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label">数据类型</span>
              <input v-model="metaForm.dataType" class="mds-input" placeholder="如 varchar(32)" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label">是否必填</span>
              <select v-model="metaForm.required" class="mds-select">
                <option value="是">是</option>
                <option value="条件必填">条件必填</option>
                <option value="系统生成">系统生成</option>
              </select>
            </label>
            <label class="mds-field">
              <span class="mds-field__label">来源表</span>
              <input v-model="metaForm.sourceTable" class="mds-input" placeholder="如 platform_user" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label">版本</span>
              <input v-model="metaForm.version" class="mds-input" placeholder="如 v2.1" />
            </label>
            <label class="mds-field mds-field--full">
              <span class="mds-field__label">说明</span>
              <textarea v-model="metaForm.description" class="mds-textarea" placeholder="口径、取值范围、责任部门" />
            </label>
          </div>
          <div class="mds-form-actions">
            <button class="mds-btn" @click="metaModal = false">取消</button>
            <button class="mds-btn mds-btn--primary" :disabled="saving" @click="submitMeta">
              {{ saving ? '保存中…' : '保存' }}
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
import { useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatGrid from '@/components/ui/StatGrid.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import {
  approveStandardChange,
  createDataFormat,
  createMetadata,
  createStandardChange,
  getChangeApproveList,
  getDataFormatList,
  getMetadataList,
  updateDataFormat,
  updateDataFormatStatus,
  updateMetadata,
} from '@/utils/api'

interface FormatRow {
  id: string
  formatCode: string
  formatName?: string
  dataType?: string
  validationRule?: string
  maxLength?: number
  minLength?: number
  defaultValue?: string
  description?: string
  status?: string
}
interface ChangeRow {
  id: string
  formatName?: string
  changeType?: string
  status?: string
  applicant?: string
  applyTime?: string
  reviewTime?: string
  remark?: string
  description?: string
}
interface MetadataRow {
  id: string
  metadataType: string
  name: string
  nameEn?: string
  domainName?: string
  dataType?: string
  required?: string
  sourceTable?: string
  version?: string
  description?: string
  status?: string
}

const router = useRouter()
const activeTab = ref<'format' | 'change' | 'metadata'>('format')
const loading = ref(false)
const saving = ref(false)
const busyId = ref<string | null>(null)

const formats = ref<FormatRow[]>([])
const changes = ref<ChangeRow[]>([])
const metadata = ref<MetadataRow[]>([])
const changeTotal = ref(0)

const formatKeyword = ref('')
const formatStatus = ref('')
const changeStatus = ref('PENDING')
const metaKeyword = ref('')
const metaType = ref('')

const formatModal = ref(false)
const changeModal = ref(false)
const metaModal = ref(false)

const formatForm = reactive({
  id: null as string | null,
  formatCode: '',
  formatName: '',
  dataType: 'string',
  validationRule: '',
  minLength: null as number | null,
  maxLength: null as number | null,
  defaultValue: '',
  description: '',
})
const changeForm = reactive({
  targetType: 'format',
  targetId: '',
  targetName: '',
  changeType: 'UPDATE',
  beforeValue: '',
  afterValue: '',
})
const metaForm = reactive({
  id: null as string | null,
  metadataType: 'TECHNICAL',
  name: '',
  nameEn: '',
  domainName: '',
  dataType: '',
  required: '是',
  sourceTable: '',
  version: '',
  description: '',
})

const filteredFormats = computed(() => {
  const kw = formatKeyword.value.trim().toLowerCase()
  return formats.value.filter((row) => {
    const matchStatus = !formatStatus.value || row.status === formatStatus.value
    const matchKeyword =
      !kw ||
      String(row.formatCode ?? '').toLowerCase().includes(kw) ||
      String(row.formatName ?? '').toLowerCase().includes(kw)
    return matchStatus && matchKeyword
  })
})

const tabs = computed(() => [
  { key: 'format' as const, label: '格式与校验规则', count: formats.value.length },
  { key: 'change' as const, label: '标准变更审批', count: changeTotal.value },
  { key: 'metadata' as const, label: '元数据目录', count: metadata.value.length },
])

const statItems = computed(() => [
  { label: '格式标准', value: formats.value.length },
  { label: '已发布', value: formats.value.filter((row) => row.status === 'PUBLISHED').length, tone: 'success' },
  { label: '待审变更', value: changeStatus.value === 'PENDING' ? changeTotal.value : '—', tone: 'warning' },
  { label: '元数据条目', value: metadata.value.length, tone: 'brand' },
])

const FORMAT_STATUS_TEXT: Record<string, string> = { DRAFT: '草稿', PUBLISHED: '已发布', DISABLED: '已停用' }
const FORMAT_STATUS_TONE: Record<string, 'gray' | 'success' | 'danger'> = {
  DRAFT: 'gray',
  PUBLISHED: 'success',
  DISABLED: 'danger',
}
const CHANGE_STATUS_TEXT: Record<string, string> = {
  PENDING: '待审批',
  APPROVED: '已通过',
  REJECTED: '已驳回',
}
const CHANGE_STATUS_TONE: Record<string, 'warning' | 'success' | 'danger'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
}
const META_TYPE_TEXT: Record<string, string> = {
  BUSINESS: '业务元数据',
  TECHNICAL: '技术元数据',
  MANAGEMENT: '管理元数据',
}
const formatStatusText = (value?: string) => FORMAT_STATUS_TEXT[value ?? ''] ?? value ?? '—'
const formatStatusTone = (value?: string) => FORMAT_STATUS_TONE[value ?? ''] ?? 'gray'
const changeStatusText = (value?: string) => CHANGE_STATUS_TEXT[value ?? ''] ?? value ?? '—'
const changeStatusTone = (value?: string) => CHANGE_STATUS_TONE[value ?? ''] ?? 'gray'
const metaTypeText = (value?: string) => META_TYPE_TEXT[value ?? ''] ?? value ?? '—'
const formatTime = (value?: string) => (value ? String(value).replace('T', ' ').slice(0, 16) : '—')
const lengthText = (item: FormatRow) => {
  const min = item.minLength ?? null
  const max = item.maxLength ?? null
  if (min === null && max === null) return '—'
  if (min !== null && max !== null) return `${min} ~ ${max}`
  return min !== null ? `≥ ${min}` : `≤ ${max}`
}

async function loadFormats() {
  loading.value = true
  try {
    const response = await getDataFormatList()
    if (response.code !== 200) throw new Error(response.message || '格式标准加载失败')
    formats.value = (response.data ?? []) as FormatRow[]
  } catch (error) {
    formats.value = []
    message.error(error instanceof Error ? error.message : '格式标准加载失败')
  } finally {
    loading.value = false
  }
}

async function loadChanges() {
  try {
    const response = await getChangeApproveList({ pageNum: 1, pageSize: 50, status: changeStatus.value || undefined })
    if (response.code !== 200) throw new Error(response.message || '变更申请加载失败')
    changes.value = (response.data?.list ?? []) as ChangeRow[]
    changeTotal.value = Number(response.data?.total ?? 0)
  } catch {
    changes.value = []
    changeTotal.value = 0
  }
}

async function loadMetadata() {
  try {
    const response = await getMetadataList({
      metadataType: metaType.value || undefined,
      keyword: metaKeyword.value || undefined,
    })
    if (response.code !== 200) throw new Error(response.message || '元数据加载失败')
    metadata.value = (response.data ?? []) as MetadataRow[]
  } catch {
    metadata.value = []
  }
}

function reloadAll() {
  void loadFormats()
  void loadChanges()
  void loadMetadata()
}

function openFormatCreate() {
  Object.assign(formatForm, {
    id: null,
    formatCode: '',
    formatName: '',
    dataType: 'string',
    validationRule: '',
    minLength: null,
    maxLength: null,
    defaultValue: '',
    description: '',
  })
  formatModal.value = true
}

function openFormatEdit(item: FormatRow) {
  Object.assign(formatForm, {
    id: item.id,
    formatCode: item.formatCode,
    formatName: item.formatName ?? '',
    dataType: item.dataType ?? 'string',
    validationRule: item.validationRule ?? '',
    minLength: item.minLength ?? null,
    maxLength: item.maxLength ?? null,
    defaultValue: item.defaultValue ?? '',
    description: item.description ?? '',
  })
  formatModal.value = true
}

async function submitFormat() {
  if (!formatForm.formatCode.trim() || !formatForm.formatName.trim()) {
    message.warning('格式编码与名称为必填')
    return
  }
  saving.value = true
  const payload = {
    formatCode: formatForm.formatCode.trim(),
    formatName: formatForm.formatName.trim(),
    dataType: formatForm.dataType,
    validationRule: formatForm.validationRule,
    minLength: formatForm.minLength,
    maxLength: formatForm.maxLength,
    defaultValue: formatForm.defaultValue,
    description: formatForm.description,
  }
  try {
    const response = formatForm.id
      ? await updateDataFormat(formatForm.id, payload)
      : await createDataFormat(payload)
    if (response.code !== 200) throw new Error(response.message || '保存失败')
    message.success(formatForm.id ? '格式标准已更新' : '已新增（草稿）')
    formatModal.value = false
    await loadFormats()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function changeFormatStatus(item: FormatRow, status: string) {
  busyId.value = item.id
  try {
    const response = await updateDataFormatStatus(item.id, status)
    if (response.code !== 200) throw new Error(response.message || '操作失败')
    message.success(status === 'PUBLISHED' ? '已发布' : '已停用')
    await loadFormats()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '操作失败')
  } finally {
    busyId.value = null
  }
}

function openChangeCreate() {
  Object.assign(changeForm, {
    targetType: 'format',
    targetId: '',
    targetName: '',
    changeType: 'UPDATE',
    beforeValue: '',
    afterValue: '',
  })
  changeModal.value = true
}

async function submitChange() {
  if (!changeForm.targetName.trim() || !changeForm.afterValue.trim()) {
    message.warning('目标名称与变更后内容为必填')
    return
  }
  saving.value = true
  try {
    const response = await createStandardChange({
      targetType: changeForm.targetType,
      targetId: changeForm.targetId || null,
      targetName: changeForm.targetName.trim(),
      changeType: changeForm.changeType,
      beforeValue: changeForm.beforeValue,
      afterValue: changeForm.afterValue,
    })
    if (response.code !== 200) throw new Error(response.message || '提交失败')
    message.success('变更申请已提交')
    changeModal.value = false
    changeStatus.value = 'PENDING'
    await loadChanges()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '提交失败')
  } finally {
    saving.value = false
  }
}

async function decide(item: ChangeRow, status: 'APPROVED' | 'REJECTED') {
  const remark = window.prompt(status === 'APPROVED' ? '审批意见（可选）' : '驳回原因', status === 'APPROVED' ? '同意' : '')
  if (remark === null) return
  busyId.value = item.id
  try {
    const response = await approveStandardChange(item.id, status, remark || undefined)
    if (response.code !== 200) throw new Error(response.message || '审批失败')
    message.success(status === 'APPROVED' ? '已通过' : '已驳回')
    await loadChanges()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '审批失败')
  } finally {
    busyId.value = null
  }
}

function openMetaCreate() {
  Object.assign(metaForm, {
    id: null,
    metadataType: 'TECHNICAL',
    name: '',
    nameEn: '',
    domainName: '',
    dataType: '',
    required: '是',
    sourceTable: '',
    version: '',
    description: '',
  })
  metaModal.value = true
}

function openMetaEdit(item: MetadataRow) {
  Object.assign(metaForm, {
    id: item.id,
    metadataType: item.metadataType,
    name: item.name,
    nameEn: item.nameEn ?? '',
    domainName: item.domainName ?? '',
    dataType: item.dataType ?? '',
    required: item.required ?? '是',
    sourceTable: item.sourceTable ?? '',
    version: item.version ?? '',
    description: item.description ?? '',
  })
  metaModal.value = true
}

async function submitMeta() {
  if (!metaForm.name.trim()) {
    message.warning('中文名称为必填')
    return
  }
  saving.value = true
  const payload = {
    metadataType: metaForm.metadataType,
    name: metaForm.name.trim(),
    nameEn: metaForm.nameEn,
    domainName: metaForm.domainName,
    dataType: metaForm.dataType,
    required: metaForm.required,
    sourceTable: metaForm.sourceTable,
    version: metaForm.version,
    description: metaForm.description,
  }
  try {
    const response = metaForm.id
      ? await updateMetadata(metaForm.id, payload)
      : await createMetadata(payload)
    if (response.code !== 200) throw new Error(response.message || '保存失败')
    message.success(metaForm.id ? '元数据已更新' : '元数据已新增')
    metaModal.value = false
    await loadMetadata()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(reloadAll)
</script>

<style scoped>
.standard-table {
  min-width: 1000px;
}

.rule-cell {
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
  width: 760px;
  max-width: 100%;
  max-height: 88vh;
  overflow: auto;
  border-radius: var(--mds-radius);
  background: var(--mds-card);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
}
</style>

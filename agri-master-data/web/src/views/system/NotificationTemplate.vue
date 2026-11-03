<template>
  <div class="mds-page">
    <PageHeader
      title="通知模板"
      subtitle="站内信 / 短信等通知的模板：标题、正文与可用变量。模板由用户中心统一维护，消息发送时按编码引用。"
      source="用户中心 · 消息模板"
    >
      <template #actions>
        <button class="mds-btn mds-btn--primary" @click="openCreate">+ 新增模板</button>
        <button class="mds-btn" :disabled="loading" @click="loadData">刷新</button>
      </template>
    </PageHeader>

    <NoticeBar tone="info" title="变量写法：">
      正文里用 <code>${变量名}</code> 占位，变量列表以逗号分隔；发送时由调用方传入实际值，缺变量会导致占位原样出现在消息里。
    </NoticeBar>

    <div class="mds-card">
      <div class="mds-filter">
        <input v-model="filterKeyword" class="mds-input" type="search" placeholder="搜索模板标题 / 编码" />
        <select v-model="filterScene" class="mds-select">
          <option value="all">全部场景</option>
          <option v-for="scene in sceneOptions" :key="scene.value" :value="scene.value">{{ scene.label }}</option>
        </select>
        <span class="mds-hint">共 {{ filteredTemplates.length }} / {{ templates.length }} 个模板</span>
      </div>
    </div>

    <div v-if="!filteredTemplates.length" class="mds-card">
      <div class="mds-card-body">
        <EmptyState
          :title="templates.length ? '没有符合条件的模板' : '还没有消息模板'"
          :description="templates.length ? '调整场景或关键字筛选。' : '新增模板后，消息推送才能引用它。'"
        />
      </div>
    </div>

    <div v-else class="template-grid">
      <article
        v-for="template in filteredTemplates"
        :key="template.id"
        class="mds-card template-card"
        :class="{ 'is-disabled': template.status !== 'enabled' }"
      >
        <div class="mds-card-head">
          <div class="template-head">
            <StatusTag :text="sceneLabel(template.scene)" :tone="sceneTone(template.scene)" plain />
            <h2 class="mds-card-title">{{ template.title }}</h2>
            <p class="mds-card-sub">{{ template.code }}</p>
          </div>
          <StatusTag
            :text="template.status === 'enabled' ? '启用' : '停用'"
            :tone="template.status === 'enabled' ? 'success' : 'gray'"
          />
        </div>
        <div class="mds-card-body">
          <div class="preview">{{ template.content || '（正文为空）' }}</div>
          <div class="meta-row">
            <span>渠道：{{ template.channels || '未指定' }}</span>
            <span>变量：{{ template.variables || '无' }}</span>
          </div>
        </div>
        <div class="template-footer">
          <button class="mds-btn mds-btn--sm" @click="editTemplate(template)">编辑</button>
          <button
            class="mds-btn mds-btn--sm"
            :disabled="busyId === template.id"
            @click="toggleTemplate(template)"
          >{{ template.status === 'enabled' ? '停用' : '启用' }}</button>
        </div>
      </article>
    </div>

    <div v-if="showAddModal" class="mds-mask" @click="closeModal">
      <div class="mds-modal" @click.stop>
        <div class="mds-card-head">
          <h2 class="mds-card-title">{{ isEdit ? '编辑模板' : '新增模板' }}</h2>
          <button class="mds-btn mds-btn--link" @click="closeModal">关闭</button>
        </div>
        <div class="mds-card-body">
          <div class="mds-form">
            <label class="mds-field">
              <span class="mds-field__label mds-required">模板编码</span>
              <input v-model="form.code" class="mds-input" :disabled="isEdit" placeholder="如 CERT_AUDIT_PASS" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label mds-required">场景</span>
              <select v-model="form.scene" class="mds-select">
                <option v-for="scene in sceneOptions" :key="scene.value" :value="scene.value">{{ scene.label }}</option>
              </select>
            </label>
            <label class="mds-field">
              <span class="mds-field__label">渠道</span>
              <input v-model="form.channels" class="mds-input" placeholder="如 inbox,sms" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label">状态</span>
              <select v-model="form.status" class="mds-select">
                <option value="enabled">启用</option>
                <option value="disabled">停用</option>
              </select>
            </label>
            <label class="mds-field mds-field--full">
              <span class="mds-field__label mds-required">标题</span>
              <input v-model="form.title" class="mds-input" placeholder="消息标题，可用变量" />
            </label>
            <label class="mds-field mds-field--full">
              <span class="mds-field__label mds-required">正文</span>
              <textarea v-model="form.content" class="mds-textarea" placeholder="支持 ${name} 这类变量占位" />
            </label>
            <label class="mds-field mds-field--full">
              <span class="mds-field__label">可用变量</span>
              <input v-model="form.variables" class="mds-input" placeholder="逗号分隔，如 name,date" />
            </label>
          </div>
          <div class="mds-form-actions">
            <button class="mds-btn" @click="closeModal">取消</button>
            <button class="mds-btn mds-btn--primary" :disabled="saving" @click="saveTemplate">
              {{ saving ? '保存中…' : isEdit ? '保存修改' : '新增模板' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import {
  createMessageTemplate,
  getMessageTemplates,
  updateMessageTemplate,
} from '../../utils/api'

const showAddModal = ref(false)
const isEdit = ref(false)
const filterScene = ref('all')
const filterKeyword = ref('')
const templates = ref([])
const loading = ref(false)
const saving = ref(false)
const busyId = ref(null)

const sceneOptions = [
  { value: 'cert_audit', label: '认证审核' },
  { value: 'cert_expire', label: '证照到期' },
  { value: 'security', label: '安全提醒' },
  { value: 'identity', label: '身份变更' },
  { value: 'privacy', label: '隐私申请' },
]

const form = reactive({
  id: null,
  code: '',
  scene: 'cert_audit',
  channels: 'inbox',
  title: '',
  content: '',
  variables: '',
  status: 'enabled',
})

const sceneLabel = (value) => sceneOptions.find((item) => item.value === value)?.label ?? value ?? '—'
const SCENE_TONE = {
  cert_audit: 'info',
  cert_expire: 'warning',
  security: 'danger',
  identity: 'purple',
  privacy: 'cyan',
}
const sceneTone = (value) => SCENE_TONE[value] ?? 'gray'

const filteredTemplates = computed(() =>
  templates.value.filter((template) => {
    const matchScene = filterScene.value === 'all' || template.scene === filterScene.value
    const kw = filterKeyword.value.trim().toLowerCase()
    const matchKeyword =
      !kw ||
      String(template.title ?? '').toLowerCase().includes(kw) ||
      String(template.code ?? '').toLowerCase().includes(kw)
    return matchScene && matchKeyword
  }),
)

const loadData = async () => {
  loading.value = true
  try {
    const response = await getMessageTemplates()
    if (response.code !== 200) throw new Error(response.message || '加载消息模板失败')
    templates.value = (response.data ?? []).map((row) => ({
      id: row.id,
      code: row.code,
      scene: row.scene,
      channels: row.channels,
      title: row.title,
      content: row.content,
      variables: row.variables,
      status: row.status || 'enabled',
    }))
  } catch (error) {
    templates.value = []
    message.error(error instanceof Error ? error.message : '加载消息模板失败')
  } finally {
    loading.value = false
  }
}

const openCreate = () => {
  Object.assign(form, {
    id: null,
    code: '',
    scene: 'cert_audit',
    channels: 'inbox',
    title: '',
    content: '',
    variables: '',
    status: 'enabled',
  })
  isEdit.value = false
  showAddModal.value = true
}

const editTemplate = (template) => {
  isEdit.value = true
  Object.assign(form, {
    id: template.id,
    code: template.code ?? '',
    scene: template.scene ?? 'cert_audit',
    channels: template.channels ?? '',
    title: template.title ?? '',
    content: template.content ?? '',
    variables: template.variables ?? '',
    status: template.status ?? 'enabled',
  })
  showAddModal.value = true
}

const closeModal = () => {
  showAddModal.value = false
  isEdit.value = false
}

const toggleTemplate = async (template) => {
  const nextStatus = template.status === 'enabled' ? 'disabled' : 'enabled'
  busyId.value = template.id
  try {
    // PUT 是全量：必须把原有字段一起带上，否则会被覆盖成 null
    const response = await updateMessageTemplate(template.id, {
      code: template.code,
      scene: template.scene,
      channels: template.channels,
      title: template.title,
      content: template.content,
      variables: template.variables,
      status: nextStatus,
    })
    if (response.code !== 200) throw new Error(response.message || '操作失败')
    message.success(`模板已${nextStatus === 'enabled' ? '启用' : '停用'}`)
    await loadData()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '操作失败')
  } finally {
    busyId.value = null
  }
}

const saveTemplate = async () => {
  if (!form.code.trim() || !form.title.trim() || !form.content.trim()) {
    message.warning('模板编码、标题与正文为必填')
    return
  }
  saving.value = true
  const payload = {
    code: form.code.trim(),
    scene: form.scene,
    channels: form.channels,
    title: form.title.trim(),
    content: form.content,
    variables: form.variables,
    status: form.status,
  }
  try {
    const response = isEdit.value
      ? await updateMessageTemplate(form.id, payload)
      : await createMessageTemplate(payload)
    if (response.code !== 200) throw new Error(response.message || '保存失败')
    message.success(isEdit.value ? '模板已更新' : '模板已新增')
    closeModal()
    await loadData()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 16px;
}

.template-card {
  margin-bottom: 0;
  display: flex;
  flex-direction: column;
}

.template-card.is-disabled {
  opacity: 0.72;
}

.template-head {
  min-width: 0;
}

.template-head .mds-card-title {
  margin-top: 6px;
}

.preview {
  padding: 12px 14px;
  border-radius: 8px;
  background: #f7faf8;
  color: var(--mds-text-2);
  font-family: var(--mds-mono);
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  min-height: 64px;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  margin-top: 10px;
  font-size: 12px;
  color: var(--mds-text-3);
}

.template-footer {
  display: flex;
  gap: 8px;
  padding: 10px 16px;
  border-top: 1px solid var(--mds-line-soft);
  background: #fcfdfc;
}

.template-footer .mds-btn {
  flex: 1;
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
  width: 720px;
  max-width: 100%;
  max-height: 88vh;
  overflow: auto;
  border-radius: var(--mds-radius);
  background: var(--mds-card);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
}
</style>

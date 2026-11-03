<template>
  <div class="mds-page">
    <PageHeader
      title="参数配置"
      subtitle="平台运行参数与配置项：编码、分组、类型与值；停用的参数不会被执行侧读取。"
      source="系统配置 · 参数"
    >
      <template #actions>
        <button v-point="'POST /admin/masterdata/config'" class="mds-btn mds-btn--primary" @click="openCreate">+ 新增参数</button>
        <button class="mds-btn" :disabled="loading" @click="loadData">刷新</button>
      </template>
    </PageHeader>

    <div class="mds-card">
      <div class="mds-filter">
        <input v-model="filterKeyword" class="mds-input" type="search" placeholder="搜索参数编码 / 名称" />
        <select v-model="filterGroup" class="mds-select">
          <option value="all">全部分组</option>
          <option v-for="group in paramGroups" :key="group" :value="group">{{ group }}</option>
        </select>
        <span class="mds-hint">共 {{ filteredParams.length }} / {{ params.length }} 条</span>
      </div>

      <div class="mds-table-wrap">
        <table class="mds-table param-table">
          <thead>
            <tr>
              <th>参数编码</th>
              <th>参数名称</th>
              <th>分组</th>
              <th>参数值</th>
              <th>类型</th>
              <th>状态</th>
              <th>描述</th>
              <th class="mds-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="8" class="mds-empty">正在加载系统配置…</td>
            </tr>
            <tr v-else-if="!filteredParams.length">
              <td colspan="8">
                <EmptyState
                  :title="params.length ? '没有符合条件的参数' : '还没有系统参数'"
                  :description="params.length ? '调整分组或关键字筛选。' : '新增参数后，执行侧才能读取到配置。'"
                />
              </td>
            </tr>
            <tr v-for="param in filteredParams" :key="param.id">
              <td class="mds-mono">{{ param.code }}</td>
              <td class="mds-name">{{ param.name }}</td>
              <td><StatusTag v-if="param.group" :text="param.group" tone="info" plain /><span v-else class="mds-muted">—</span></td>
              <td class="value-cell" :title="param.value">{{ param.value }}</td>
              <td><StatusTag :text="typeText(param.type)" tone="purple" plain /></td>
              <td>
                <StatusTag
                  :text="param.enabled ? '启用' : '禁用'"
                  :tone="param.enabled ? 'success' : 'gray'"
                />
              </td>
              <td class="desc-cell" :title="param.description">{{ param.description || '—' }}</td>
              <td class="mds-actions">
                <button v-point="'PUT /admin/masterdata/config/{id}'" class="mds-btn mds-btn--link" @click="editParam(param)">编辑</button>
                <button class="mds-btn mds-btn--link" :disabled="busyId === param.id" @click="toggleParam(param)">
                  {{ param.enabled ? '禁用' : '启用' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="showAddModal" class="mds-mask" @click="closeModal">
      <div class="mds-modal" @click.stop>
        <div class="mds-card-head">
          <h2 class="mds-card-title">{{ isEdit ? '编辑参数' : '新增参数' }}</h2>
          <button class="mds-btn mds-btn--link" @click="closeModal">关闭</button>
        </div>
        <div class="mds-card-body">
          <div class="mds-form">
            <label class="mds-field">
              <span class="mds-field__label mds-required">参数编码</span>
              <input v-model="form.code" class="mds-input" :disabled="isEdit" placeholder="如 quality.rule.enabled" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label mds-required">参数名称</span>
              <input v-model="form.name" class="mds-input" placeholder="如 质量规则开关" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label">参数分组</span>
              <select v-model="form.group" class="mds-select">
                <option value="">未分组</option>
                <option v-for="group in paramGroups" :key="group" :value="group">{{ group }}</option>
              </select>
            </label>
            <label class="mds-field">
              <span class="mds-field__label mds-required">数据类型</span>
              <select v-model="form.type" class="mds-select">
                <option value="string">字符串</option>
                <option value="number">数字</option>
                <option value="boolean">布尔值</option>
                <option value="json">JSON</option>
              </select>
            </label>
            <label class="mds-field mds-field--full">
              <span class="mds-field__label mds-required">参数值</span>
              <textarea v-model="form.value" class="mds-textarea" :placeholder="form.type === 'json' ? '{&quot;key&quot;: &quot;value&quot;}' : '参数值'" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label">是否启用</span>
              <select v-model="form.enabled" class="mds-select">
                <option :value="true">启用</option>
                <option :value="false">禁用</option>
              </select>
            </label>
            <label class="mds-field mds-field--full">
              <span class="mds-field__label">描述</span>
              <textarea v-model="form.description" class="mds-textarea" placeholder="这个参数影响什么、改动要注意什么" />
            </label>
          </div>
          <div class="mds-form-actions">
            <button class="mds-btn" @click="closeModal">取消</button>
            <button class="mds-btn mds-btn--primary" :disabled="saving" @click="saveParam">
              {{ saving ? '保存中…' : isEdit ? '保存修改' : '新增参数' }}
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
import EmptyState from '@/components/ui/EmptyState.vue'
import { createSystemConfig, getSystemConfigList, updateSystemConfig } from '../../utils/api'

const showAddModal = ref(false)
const isEdit = ref(false)
const filterGroup = ref('all')
const filterKeyword = ref('')
const params = ref([])
const loading = ref(false)
const saving = ref(false)
const busyId = ref(null)

const form = reactive({
  id: null,
  code: '',
  name: '',
  group: '',
  type: 'string',
  value: '',
  enabled: true,
  description: '',
})

/** 分组从数据里推导：写死的下拉永远漏掉后端新增的分组 */
const paramGroups = computed(() => {
  const groups = new Set()
  params.value.forEach((param) => {
    if (param.group) groups.add(param.group)
  })
  return Array.from(groups)
})

const filteredParams = computed(() =>
  params.value.filter((param) => {
    const matchGroup = filterGroup.value === 'all' || param.group === filterGroup.value
    const kw = filterKeyword.value.trim().toLowerCase()
    const matchKeyword =
      !kw ||
      String(param.code ?? '').toLowerCase().includes(kw) ||
      String(param.name ?? '').toLowerCase().includes(kw)
    return matchGroup && matchKeyword
  }),
)

const TYPE_TEXT = { string: '字符串', number: '数字', boolean: '布尔', json: 'JSON' }
const typeText = (type) => TYPE_TEXT[type] ?? type ?? '—'

/** 接口字段 → 页面字段（configKey/configName/… vs code/name/…），映射只在这一处做 */
const toRow = (row) => ({
  id: row.id,
  code: row.configKey,
  name: row.configName,
  group: row.groupName,
  type: row.configType || 'string',
  value: row.configValue,
  enabled: Number(row.status) === 1,
  description: row.description,
})

const loadData = async () => {
  loading.value = true
  try {
    const response = await getSystemConfigList()
    if (response.code !== 200) throw new Error(response.message || '加载系统配置失败')
    params.value = (response.data ?? []).map(toRow)
  } catch (error) {
    params.value = []
    message.error(error instanceof Error ? error.message : '加载系统配置失败')
  } finally {
    loading.value = false
  }
}

const openCreate = () => {
  Object.assign(form, { id: null, code: '', name: '', group: '', type: 'string', value: '', enabled: true, description: '' })
  isEdit.value = false
  showAddModal.value = true
}

const editParam = (param) => {
  isEdit.value = true
  Object.assign(form, {
    id: param.id,
    code: param.code ?? '',
    name: param.name ?? '',
    group: param.group ?? '',
    type: param.type ?? 'string',
    value: param.value ?? '',
    enabled: Boolean(param.enabled),
    description: param.description ?? '',
  })
  showAddModal.value = true
}

const closeModal = () => {
  showAddModal.value = false
  isEdit.value = false
}

const toggleParam = async (param) => {
  const nextStatus = param.enabled ? 0 : 1
  busyId.value = param.id
  try {
    // 只提交 status：接口侧「只覆盖本次传了的字段」，不会被清空其它列
    const response = await updateSystemConfig(param.id, { status: nextStatus })
    if (response.code !== 200) throw new Error(response.message || '操作失败')
    message.success(`参数「${param.name}」已${nextStatus === 1 ? '启用' : '禁用'}`)
    await loadData()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '操作失败')
  } finally {
    busyId.value = null
  }
}

const saveParam = async () => {
  if (!form.code.trim() || !form.name.trim() || !String(form.value).trim()) {
    message.warning('参数编码、名称与参数值为必填')
    return
  }
  saving.value = true
  const payload = {
    configKey: form.code.trim(),
    configName: form.name.trim(),
    groupName: form.group,
    configType: form.type,
    configValue: form.value,
    description: form.description,
    status: form.enabled ? 1 : 0,
  }
  try {
    const response = isEdit.value
      ? await updateSystemConfig(form.id, payload)
      : await createSystemConfig(payload)
    if (response.code !== 200) throw new Error(response.message || '保存失败')
    message.success(isEdit.value ? '参数已更新' : '参数已新增')
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
.param-table {
  min-width: 1080px;
}

.value-cell,
.desc-cell {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
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
  width: 680px;
  max-width: 100%;
  max-height: 88vh;
  overflow: auto;
  border-radius: var(--mds-radius);
  background: var(--mds-card);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
}
</style>

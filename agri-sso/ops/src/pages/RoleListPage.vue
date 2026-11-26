<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="角色权限"
      title="角色管理"
      description="平台级角色的名称、成员、授权与启停。组织级角色归主数据域，不在此处维护"
    />

    <div class="grid-3">
      <div class="stat-tile">
        <span class="stat-label">角色总数</span>
        <b class="stat-value">{{ roles.length }}<small>个</small></b>
        <span class="stat-note">平台级角色</span>
      </div>
      <div class="stat-tile">
        <span class="stat-label">启用中</span>
        <b class="stat-value">{{ enabledCount }}<small>个</small></b>
        <span class="stat-note">参与授权判定</span>
      </div>
      <div class="stat-tile">
        <span class="stat-label">已停用</span>
        <b class="stat-value">{{ roles.length - enabledCount }}<small>个</small></b>
        <span class="stat-note">保留配置但不生效</span>
      </div>
    </div>

    <ErrorBlock v-if="error" :message="error" @retry="loadRoles" />

    <AgriAntdvListTable
      v-else
      :columns="columns"
      :data="filtered"
      row-key="id"
      :loading="loading"
      client-pagination
      :page="pageNum"
      :page-size="pageSize"
      total-unit="个角色"
      column-settings-storage-key="uc-ops:roles"
      @page-change="handlePageChange"
      @refresh="loadRoles"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="2" :loading="loading" @search="submitSearch" @reset="clearFilters">
          <div class="agri-vue-filter-field">
            <label>关键字</label>
            <a-input
              v-model:value="draft"
              allow-clear
              placeholder="搜角色编码 / 名称 / 说明"
              @press-enter="submitSearch"
            />
          </div>
          <div class="agri-vue-filter-field">
            <label>启用状态</label>
            <a-select
              v-model:value="statusFilter"
              :options="statusOptions"
              @change="pageNum = 1"
            />
          </div>
        </AgriVueFilterBar>
      </template>

      <template #toolbar-left>
        <a-button type="primary" @click="openCreate">新建角色</a-button>
      </template>

      <template #cell-name="{ value, record }">
        <div>
          <b>{{ value || roleText(String(record.code ?? '')) }}</b>
          <div class="small muted">{{ record.code }}</div>
        </div>
      </template>
      <template #cell-level>
        <a-tag class="soft-tag">平台级</a-tag>
      </template>
      <template #cell-memberCount="{ value }">{{ value ? `${value} 人` : '0 人' }}</template>
      <template #cell-permCount="{ record }">{{ permCountText(String(record.permissions ?? '')) }}</template>
      <template #cell-permissions="{ value }">
        <a-tag v-if="parsePermissions(String(value ?? '')).includes('*')" class="soft-tag tone-green">全部权限</a-tag>
        <span v-else-if="!parsePermissions(String(value ?? '')).length" class="small muted">未配置</span>
        <a-popover
          v-else
          trigger="click"
          placement="topLeft"
          :title="`全部权限（${parsePermissions(String(value ?? '')).length} 项）`"
        >
          <template #content>
            <div class="tag-row" style="max-width: 360px; max-height: 260px; overflow: auto">
              <a-tag v-for="code in parsePermissions(String(value ?? ''))" :key="code" class="soft-tag">
                {{ permissionLabel(code) }}
              </a-tag>
            </div>
          </template>
          <div
            class="tag-row"
            style="cursor: pointer"
            :title="parsePermissions(String(value ?? '')).map(permissionLabel).join('、')"
          >
            <a-tag v-for="code in parsePermissions(String(value ?? '')).slice(0, 3)" :key="code" class="soft-tag">
              {{ permissionLabel(code) }}
            </a-tag>
            <a-tag v-if="parsePermissions(String(value ?? '')).length > 3" class="soft-tag">
              等 {{ parsePermissions(String(value ?? '')).length }} 项
            </a-tag>
          </div>
        </a-popover>
      </template>
      <template #cell-status="{ value }">
        <a-tag v-if="value === 'disabled'" class="soft-tag">已停用</a-tag>
        <a-tag v-else class="soft-tag tone-green">启用中</a-tag>
      </template>
      <template #cell-updatedAt="{ value, record }">
        {{ formatTime(String(value ?? record.createdAt ?? '')) }}
      </template>
      <template #cell-action="{ record }">
        <AgriVueRowActions :actions="rowActions(record as RoleRecord)" />
      </template>
    </AgriAntdvListTable>

    <a-modal
      :open="Boolean(modalMode)"
      :title="modalMode === 'edit' ? '编辑角色' : '新建角色'"
      :ok-text="modalMode === 'edit' ? '保存' : '创建'"
      :confirm-loading="submitting"
      destroy-on-close
      @cancel="modalMode = null"
      @ok="submitForm"
    >
      <a-form ref="formRef" :model="formModel" layout="vertical">
        <a-form-item
          name="code"
          label="角色编码"
          :rules="[
            { required: true, message: '请输入角色编码' },
            { pattern: /^[A-Za-z][A-Za-z0-9_-]{1,63}$/, message: '以字母开头，仅允许字母、数字、下划线、短横线，2-64 位' },
          ]"
          :extra="modalMode === 'edit' ? '编码是权限与绑定的业务主键，创建后不可修改' : '创建后不可修改，建议用大写常量，如 FARM_OPERATOR'"
        >
          <a-input v-model:value="formModel.code" :disabled="modalMode === 'edit'" :maxlength="64" placeholder="例如 FARM_OPERATOR" />
        </a-form-item>
        <a-form-item
          name="name"
          label="角色名称"
          :rules="[{ required: true, message: '请输入角色名称' }, { max: 128, message: '不超过 128 字' }]"
        >
          <a-input v-model:value="formModel.name" :maxlength="128" placeholder="例如 农场运营员" />
        </a-form-item>
        <a-form-item name="description" label="角色说明" :rules="[{ max: 255, message: '不超过 255 字' }]">
          <a-textarea v-model:value="formModel.description" :rows="3" :maxlength="255" placeholder="这个角色负责什么、给谁用" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      :open="Boolean(detail)"
      :title="detail ? `角色详情 · ${detail.name || roleText(detail.code)}` : '角色详情'"
      :width="720"
      @cancel="detail = null"
    >
      <template #footer>
        <a-space>
          <a-button @click="detail = null">关闭</a-button>
          <a-button v-if="detail" type="primary" @click="goPermMatrix">配置权限</a-button>
        </a-space>
      </template>
      <div v-if="detail" class="stack">
        <a-descriptions :column="2" size="small" bordered>
          <a-descriptions-item label="角色名称">{{ detail.name || roleText(detail.code) }}</a-descriptions-item>
          <a-descriptions-item label="角色编码">{{ detail.code }}</a-descriptions-item>
          <a-descriptions-item label="适用层级">平台级</a-descriptions-item>
          <a-descriptions-item label="状态">{{ (detail.status || 'enabled') === 'disabled' ? '已停用' : '启用中' }}</a-descriptions-item>
          <a-descriptions-item label="成员数">{{ detail.memberCount ?? 0 }} 人</a-descriptions-item>
          <a-descriptions-item label="更新时间">{{ formatTime(detail.updatedAt ?? detail.createdAt) }}</a-descriptions-item>
          <a-descriptions-item label="角色说明" :span="2">{{ detail.description || '—' }}</a-descriptions-item>
        </a-descriptions>
        <SectionHeading kicker="已分配权限" :title="`${detailPermissions.length} 项`" />
        <div v-if="!detailPermissions.length" class="small muted">尚未配置权限</div>
        <div v-else class="tag-row">
          <a-tag v-for="code in detailPermissions" :key="code" class="soft-tag">{{ permissionLabel(code) }}</a-tag>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Modal, message, type FormInstance } from 'ant-design-vue'
import {
  AgriAntdvListTable,
  AgriVueFilterBar,
  AgriVueRowActions,
  type VueListColumn,
  type VueRowActionItem,
} from '@agri/shared/vue/antdv'
import { useAppStore } from '../app-context'
import { ucApi } from '../api'
import ErrorBlock from '../components/ErrorBlock.vue'
import PageTitle from '../components/PageTitle.vue'
import SectionHeading from '../components/SectionHeading.vue'
import { formatTime, roleText } from '../components/ui-constants'
import type { RoleRecord } from '../types'
import { parsePermissions, permissionLabel } from './role-utils'

const app = useAppStore()
const roles = ref<RoleRecord[]>([])
const keyword = ref('')
const draft = ref('')
const statusFilter = ref('')
const pageNum = ref(1)
const pageSize = ref(20)
const loading = ref(true)
const error = ref('')

const modalMode = ref<'create' | 'edit' | null>(null)
const editingRole = ref<RoleRecord | null>(null)
const submitting = ref(false)
const detail = ref<RoleRecord | null>(null)
const detailPermissions = ref<string[]>([])
const formRef = ref<FormInstance>()

const formModel = reactive({
  code: '',
  name: '',
  description: '',
})

const statusOptions = [
  { label: '全部状态', value: '' },
  { label: '启用中', value: 'enabled' },
  { label: '已停用', value: 'disabled' },
]

const columns: VueListColumn[] = [
  { key: 'name', prop: 'name', label: '角色名称 / 编码', minWidth: 200 },
  { key: 'level', label: '适用层级', width: 110 },
  { key: 'memberCount', prop: 'memberCount', label: '成员数', width: 90 },
  { key: 'permCount', label: '权限', width: 90 },
  { key: 'permissions', prop: 'permissions', label: '权限预览', minWidth: 220 },
  { key: 'status', prop: 'status', label: '状态', width: 100 },
  { key: 'updatedAt', prop: 'updatedAt', label: '更新时间', width: 160 },
  { key: 'action', label: '操作', width: 150, fixed: 'right' },
]

function loadRoles() {
  loading.value = true
  error.value = ''
  ucApi.roles()
    .then((res) => { roles.value = res })
    .catch((reason: Error) => { error.value = reason.message })
    .finally(() => { loading.value = false })
}

onMounted(loadRoles)

const filtered = computed(() =>
  roles.value.filter((role) => {
    if (statusFilter.value && (role.status || 'enabled') !== statusFilter.value) return false
    if (!keyword.value) return true
    const text = `${role.code} ${role.name} ${role.description ?? ''}`.toLowerCase()
    return text.includes(keyword.value.toLowerCase())
  }),
)

const enabledCount = computed(() => roles.value.filter((role) => (role.status || 'enabled') === 'enabled').length)

function permCountText(raw: string): string {
  const list = parsePermissions(raw)
  return list.includes('*') ? '全部' : `${list.length} 项`
}

function submitSearch() {
  keyword.value = draft.value.trim()
  pageNum.value = 1
}

function clearFilters() {
  draft.value = ''
  keyword.value = ''
  statusFilter.value = ''
  pageNum.value = 1
}

function handlePageChange(next: number, nextSize: number) {
  pageSize.value = nextSize
  pageNum.value = next
}

function rowActions(role: RoleRecord): VueRowActionItem[] {
  return [
    {
      key: 'perm',
      label: '配置权限',
      onClick: () => app.navigate('perm-matrix', undefined, { code: role.code }),
    },
    { key: 'detail', label: '详情', onClick: () => openDetail(role) },
    { key: 'edit', label: '编辑', onClick: () => openEdit(role) },
    {
      key: 'toggle',
      label: (role.status || 'enabled') === 'disabled' ? '启用' : '停用',
      onClick: () => void toggleStatus(role),
    },
    {
      key: 'delete',
      label: '删除',
      danger: true,
      onClick: () => confirmRemove(role),
    },
  ]
}

function confirmRemove(role: RoleRecord) {
  Modal.confirm({
    title: '删除角色',
    content: '删除后该角色的权限配置一并失效，且无法恢复。',
    okText: '确认删除',
    cancelText: '取消',
    okButtonProps: { danger: true },
    onOk: () => removeRole(role),
  })
}

function openCreate() {
  editingRole.value = null
  formModel.code = ''
  formModel.name = ''
  formModel.description = ''
  modalMode.value = 'create'
}

function openEdit(role: RoleRecord) {
  editingRole.value = role
  formModel.code = role.code
  formModel.name = role.name || roleText(role.code)
  formModel.description = role.description ?? ''
  modalMode.value = 'edit'
}

async function submitForm() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  const code = formModel.code.trim()
  const name = formModel.name.trim()
  if (modalMode.value === 'create' && roles.value.some((role) => role.code.toLowerCase() === code.toLowerCase())) {
    message.error('角色编码已存在，请换一个')
    return
  }
  submitting.value = true
  try {
    if (modalMode.value === 'edit' && editingRole.value) {
      await ucApi.updateRole(editingRole.value.code, { name, description: formModel.description.trim() })
      message.success('角色已更新')
    } else {
      await ucApi.createRole({ code, name, description: formModel.description.trim() || undefined })
      message.success('角色已创建，可以继续配置权限')
    }
    modalMode.value = null
    loadRoles()
  } catch (reason) {
    message.error((reason as Error).message)
  } finally {
    submitting.value = false
  }
}

async function toggleStatus(role: RoleRecord) {
  const next = (role.status || 'enabled') === 'disabled' ? 'enabled' : 'disabled'
  try {
    await ucApi.updateRole(role.code, { status: next })
    message.success(next === 'enabled' ? '角色已启用' : '角色已停用')
    loadRoles()
  } catch (reason) {
    message.error((reason as Error).message)
  }
}

async function removeRole(role: RoleRecord) {
  try {
    await ucApi.deleteRole(role.code)
    message.success('角色已删除')
    loadRoles()
  } catch (reason) {
    message.error((reason as Error).message)
  }
}

function openDetail(role: RoleRecord) {
  detail.value = role
  detailPermissions.value = []
  ucApi.rolePermissions(role.code)
    .then((res) => { detailPermissions.value = res })
    .catch((reason: Error) => message.error(reason.message))
}

function goPermMatrix() {
  if (!detail.value) return
  const code = detail.value.code
  detail.value = null
  app.navigate('perm-matrix', undefined, { code })
}
</script>

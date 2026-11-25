<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="角色权限"
      title="角色管理"
      description="平台级角色的名称、成员、授权与启停。组织级角色归主数据域，不在此处维护"
    >
      <template #actions>
        <a-button type="primary" @click="openCreate">新建角色</a-button>
      </template>
    </PageTitle>

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

    <section class="surface-card list-card">
      <div class="list-toolbar">
        <a-input
          v-model:value="draft"
          placeholder="搜角色编码 / 名称 / 说明"
          style="width: 260px"
          @press-enter="submitSearch"
        />
        <a-button type="primary" @click="submitSearch">搜索</a-button>
        <a-select
          :value="statusFilter"
          style="width: 140px"
          :options="statusOptions"
          @change="(val: string) => { statusFilter = val; pageNum = 1 }"
        />
        <a-button v-if="keyword || statusFilter" type="link" @click="clearFilters">清空筛选</a-button>
      </div>

      <ErrorBlock v-if="error" :message="error" @retry="loadRoles" />
      <a-table
        v-else
        class="agri-list-table"
        row-key="id"
        size="middle"
        :loading="loading"
        :columns="columns"
        :data-source="paged"
        :scroll="{ x: 1180 }"
        :pagination="{
          current: pageNum,
          pageSize,
          total: filtered.length,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (count: number) => `共 ${count} 个角色`,
          onChange: handlePageChange,
        }"
      >
        <template #bodyCell="{ column, record, text }">
          <div v-if="column.key === 'name'">
            <b>{{ text || roleText(record.code) }}</b>
            <div class="small muted">{{ record.code }}</div>
          </div>
          <a-tag v-else-if="column.key === 'level'" class="soft-tag">平台级</a-tag>
          <template v-else-if="column.key === 'memberCount'">{{ text ? `${text} 人` : '0 人' }}</template>
          <template v-else-if="column.key === 'permCount'">{{ permCountText(record.permissions) }}</template>
          <template v-else-if="column.key === 'permissions'">
            <a-tag v-if="parsePermissions(text).includes('*')" class="soft-tag tone-green">全部权限</a-tag>
            <span v-else-if="!parsePermissions(text).length" class="small muted">未配置</span>
            <a-popover
              v-else
              trigger="click"
              placement="topLeft"
              :title="`全部权限（${parsePermissions(text).length} 项）`"
            >
              <template #content>
                <div class="tag-row" style="max-width: 360px; max-height: 260px; overflow: auto">
                  <a-tag v-for="code in parsePermissions(text)" :key="code" class="soft-tag">{{ permissionLabel(code) }}</a-tag>
                </div>
              </template>
              <div class="tag-row" style="cursor: pointer" :title="parsePermissions(text).map(permissionLabel).join('、')">
                <a-tag v-for="code in parsePermissions(text).slice(0, 3)" :key="code" class="soft-tag">{{ permissionLabel(code) }}</a-tag>
                <a-tag v-if="parsePermissions(text).length > 3" class="soft-tag">等 {{ parsePermissions(text).length }} 项</a-tag>
              </div>
            </a-popover>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag v-if="text === 'disabled'" class="soft-tag">已停用</a-tag>
            <a-tag v-else class="soft-tag tone-green">启用中</a-tag>
          </template>
          <template v-else-if="column.key === 'updatedAt'">{{ formatTime(text ?? record.createdAt) }}</template>
          <a-space v-else-if="column.key === 'action'" :size="4" wrap>
            <a-button size="small" type="primary" ghost @click="app.navigate('perm-matrix', undefined, { code: record.code })">
              配置权限
            </a-button>
            <a-button size="small" type="link" @click="openDetail(record as RoleRecord)">详情</a-button>
            <a-button size="small" type="link" @click="openEdit(record as RoleRecord)">编辑</a-button>
            <a-button size="small" type="link" @click="toggleStatus(record as RoleRecord)">
              {{ (record.status || 'enabled') === 'disabled' ? '启用' : '停用' }}
            </a-button>
            <a-popconfirm
              title="删除角色"
              description="删除后该角色的权限配置一并失效，且无法恢复。"
              ok-text="确认删除"
              cancel-text="取消"
              :ok-button-props="{ danger: true }"
              @confirm="removeRole(record as RoleRecord)"
            >
              <a-button size="small" type="link" danger>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </a-table>
    </section>

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
import { message, type FormInstance } from 'ant-design-vue'
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

const columns = [
  { title: '角色名称 / 编码', dataIndex: 'name', key: 'name' },
  { title: '适用层级', key: 'level', width: 110 },
  { title: '成员数', dataIndex: 'memberCount', key: 'memberCount', width: 90 },
  { title: '权限', key: 'permCount', width: 90 },
  { title: '权限预览', dataIndex: 'permissions', key: 'permissions' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
  { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 150 },
  { title: '操作', key: 'action', width: 220 },
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
const paged = computed(() => filtered.value.slice((pageNum.value - 1) * pageSize.value, pageNum.value * pageSize.value))

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
  if (nextSize && nextSize !== pageSize.value) {
    pageSize.value = nextSize
    pageNum.value = 1
  } else {
    pageNum.value = next
  }
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

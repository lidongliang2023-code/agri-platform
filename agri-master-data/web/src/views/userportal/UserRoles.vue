<template>
  <div class="mds-page">
    <PageHeader
      title="角色与权限"
      subtitle="本主体可见的角色：平台共享角色（功能权限由平台维护）与本主体自定义角色。"
      source="主数据 · 我的主体"
    >
      <template #actions>
        <button class="mds-btn" :disabled="loading" @click="load">刷新</button>
        <button v-point="'POST /api/user/roles'" class="mds-btn mds-btn--primary" @click="openCreate">+ 新增角色</button>
      </template>
    </PageHeader>

    <NoticeBar tone="info" title="口径：">
      系统预置角色的功能权限全平台共享，租户内通常只能调整数据范围；自定义角色按主体隔离。
      角色的权限点配置在运营端「角色与权限点」维护。
    </NoticeBar>

    <StatGrid :items="statItems" />

    <div class="mds-card">
      <div class="mds-table-wrap">
        <table class="mds-table">
          <thead>
            <tr>
              <th>角色名称</th>
              <th>角色编码</th>
              <th>类型</th>
              <th>数据范围</th>
              <th class="mds-num">级别</th>
              <th>状态</th>
              <th class="mds-center">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading"><td colspan="6" class="mds-empty">正在加载角色…</td></tr>
            <tr v-else-if="!rows.length">
              <td colspan="6">
                <EmptyState
                  icon="🔑"
                  title="当前主体还没有可用角色"
                  description="平台角色目录为空或均未对租户开放；角色由运营端维护。"
                />
              </td>
            </tr>
            <tr v-for="row in rows" :key="row.id">
              <td class="mds-name">{{ row.roleName || '—' }}</td>
              <td class="mds-mono">{{ row.roleCode || '—' }}</td>
              <td>
                <StatusTag
                  :text="row.tenantId ? '本主体自定义' : '平台共享'"
                  :tone="row.tenantId ? 'brand' : 'info'"
                  plain
                />
              </td>
              <td>{{ scopeText(row.dataScope) }}</td>
              <td class="mds-num">{{ row.roleLevel ?? '—' }}</td>
              <td>
                <StatusTag
                  :text="Number(row.status) === 1 ? '启用' : '停用'"
                  :tone="Number(row.status) === 1 ? 'success' : 'gray'"
                />
              </td>
              <td class="mds-center">
                <button
                  v-if="roleEditable(row)"
                  v-point="'PUT /api/user/roles/{id}'"
                  class="org-link"
                  @click="openEdit(row)"
                >
                  编辑
                </button>
                <!-- 隐藏的原因要分开说：内置/共享是角色本身不可改，缺权限点是这个账号没被授权 -->
                <span v-if="roleEditable(row) && !points.can('PUT /api/user/roles/{id}')" class="mds-hint">未授权该操作</span>
                <span v-if="!roleEditable(row)" class="mds-hint">内置/共享</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <!-- 新增 / 编辑角色 -->
    <div v-if="dialogOpen" class="mds-mask" @click.self="dialogOpen = false">
      <div class="mds-dialog">
        <div class="mds-dialog__head">
          <h3>{{ editingId ? '编辑角色' : '新增角色' }}</h3>
          <button class="mds-dialog__close" @click="dialogOpen = false">×</button>
        </div>
        <div class="mds-dialog__body">
          <label class="mds-field">
            角色名称 <span class="mds-required">*</span>
            <input v-model="form.roleName" class="mds-input" placeholder="如：仓储管理员" />
          </label>
          <label v-if="!editingId" class="mds-field">
            角色编码
            <input v-model="form.roleCode" class="mds-input" placeholder="留空自动生成（如 ROLE2001-01）" />
          </label>
          <label class="mds-field">
            数据范围
            <select v-model="form.dataScope" class="mds-select">
              <option value="self">仅本人</option>
              <option value="dept">本部门</option>
              <option value="org">本组织</option>
              <option value="all">本主体全部</option>
            </select>
          </label>
          <label class="mds-field">
            角色说明
            <textarea v-model="form.description" class="mds-input" rows="2" placeholder="选填" />
          </label>
          <p v-if="dialogError" class="mds-dialog__error">{{ dialogError }}</p>
          <p class="mds-dialog__tip">
            只能维护本主体自建的角色；平台共享角色（如超级管理员）不在此处修改。
          </p>
        </div>
        <div class="mds-dialog__foot">
          <button class="mds-btn" :disabled="saving" @click="dialogOpen = false">取消</button>
          <button class="mds-btn mds-btn--primary" :disabled="saving" @click="submit">
            {{ saving ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatGrid from '@/components/ui/StatGrid.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { userGet, userPost, userPut } from '@/utils/userApi'
import { useMeStore } from '@/stores/me'
import { usePointStore } from '@/stores/points'

interface RoleRow {
  id?: string
  roleCode?: string
  roleName?: string
  roleType?: string
  roleLevel?: number
  dataScope?: string
  status?: number
  isSystem?: number
  tenantId?: string
}

const me = useMeStore()
const points = usePointStore()

/** 角色本身能不能改（内置与平台共享角色只读）；"这个账号有没有被授权改"由 v-point 与下面的占位文案负责。 */
const roleEditable = (row: RoleRow) => Number(row.isSystem) !== 1 && Boolean(row.tenantId)

/* ---------- 新增 / 编辑角色 ---------- */
const dialogOpen = ref(false)
const editingId = ref('')
const saving = ref(false)
const dialogError = ref('')
const emptyForm = () => ({ roleName: '', roleCode: '', dataScope: 'self', description: '' })
const form = ref(emptyForm())

function openCreate() {
  editingId.value = ''
  form.value = emptyForm()
  dialogError.value = ''
  dialogOpen.value = true
}

function openEdit(row: RoleRow) {
  editingId.value = String(row.id)
  form.value = {
    roleName: row.roleName ?? '',
    roleCode: row.roleCode ?? '',
    dataScope: row.dataScope ?? 'self',
    description: '',
  }
  dialogError.value = ''
  dialogOpen.value = true
}

async function submit() {
  if (!form.value.roleName.trim()) {
    dialogError.value = '请填写角色名称'
    return
  }
  saving.value = true
  dialogError.value = ''
  try {
    const res = editingId.value
      ? await userPut(`/api/user/roles/${editingId.value}`, {
          roleName: form.value.roleName,
          dataScope: form.value.dataScope,
          description: form.value.description,
        })
      : await userPost('/api/user/roles', form.value)
    if (res.code !== 200) throw new Error(res.message || '保存失败')
    dialogOpen.value = false
    await load()
  } catch (e) {
    dialogError.value = (e as Error).message || '保存失败'
  } finally {
    saving.value = false
  }
}
const rows = ref<RoleRow[]>([])
const loading = ref(false)

const SCOPE_TEXT: Record<string, string> = {
  ALL: '全部',
  TENANT: '本主体',
  ORG: '本组织',
  DEPT: '本部门',
  OWNER: '本人',
  SELF: '本人',
}
const scopeText = (scope?: string) => SCOPE_TEXT[(scope ?? '').toUpperCase()] ?? scope ?? '—'

const statItems = computed(() => [
  { label: '角色总数', value: rows.value.length },
  { label: '平台共享', value: rows.value.filter((row) => !row.tenantId).length, tone: 'brand' },
  { label: '本主体自定义', value: rows.value.filter((row) => Boolean(row.tenantId)).length },
  { label: '启用中', value: rows.value.filter((row) => Number(row.status) === 1).length, tone: 'success' },
])

async function load() {
  loading.value = true
  try {
    await me.load()
    const response = await userGet<RoleRow[]>('/api/user/roles')
    rows.value = response.data ?? []
  } catch {
    rows.value = []
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

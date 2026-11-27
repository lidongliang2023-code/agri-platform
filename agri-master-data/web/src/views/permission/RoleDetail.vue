<template>
  <div v-if="loadError" class="agri-detail-page">
    <div class="mds-detail-state is-error">
      <p>{{ loadError }}</p>
      <div style="margin-top: 12px; display: flex; justify-content: center; gap: 8px">
        <a-button @click="goBack">返回角色列表</a-button>
        <a-button type="primary" @click="loadDetail">重新加载</a-button>
      </div>
    </div>
  </div>
  <div v-else-if="!roleData" class="agri-detail-page">
    <div class="mds-detail-state">正在加载角色详情…</div>
  </div>
  <AgriVueDetailLayout
    v-else
    :code="roleData.roleCode || `ROLE-${route.params.id}`"
    :title="value(roleData.roleName)"
    :status="statusBadge"
    :extra-statuses="extraStatuses"
    :meta="headerMeta"
    :tabs="tabs"
    v-model:active-tab="activeTab"
    back-label="返回角色列表"
    @back="goBack"
  >
    <template #actions>
      <a-button @click="printPage">打印</a-button>
      <a-button :loading="loading" @click="loadDetail">刷新</a-button>
      <a-button v-if="roleData.editable" @click="goMatrix">权限矩阵</a-button>
      <a-button
        v-if="roleData.editable && isEnabled"
        v-point="'PUT /admin/masterdata/permission/role/{id}/status'"
        danger
        :loading="statusUpdating"
        @click="toggleStatus"
      >
        停用角色
      </a-button>
      <a-button
        v-else-if="roleData.editable"
        v-point="'PUT /admin/masterdata/permission/role/{id}/status'"
        :loading="statusUpdating"
        @click="toggleStatus"
      >
        启用角色
      </a-button>
      <a-button
        v-point="'PUT /admin/masterdata/permission/role/{id}'"
        type="primary"
        :disabled="!roleData.editable"
        @click="editRole"
      >
        编辑角色
      </a-button>
    </template>

    <template v-if="roleData.isSystem || roleData.legacy" #banner>
      <NoticeBar tone="warning" :title="roleData.isSystem ? '系统内置角色 · 只读：' : '历史主体角色 · 只读：'">
        {{ roleData.isSystem
          ? '系统内置角色承担平台基础权限，不允许在运营端修改、停用或删除。'
          : '该角色仍使用旧主体编码，未关联统一经营主体。为避免错误授权，运营端仅允许查看。' }}
      </NoticeBar>
    </template>

    <template v-if="activeTab === 'detail'">
      <AgriVueDetailSection title="角色档案">
        <template #extra>
          <span class="detail-section-hint">排序 {{ roleData.roleSort ?? 0 }}</span>
        </template>
        <MdsDetailInfoGrid :items="profileItems" />
      </AgriVueDetailSection>

      <AgriVueDetailSection title="归属与数据范围">
        <MdsDetailInfoGrid :items="scopeItems" />
      </AgriVueDetailSection>

      <AgriVueDetailSection title="成员与权限绑定概览">
        <template #extra>
          <button type="button" class="detail-section-link" @click="activeTab = 'permissions'">
            查看权限配置 →
          </button>
        </template>
        <div class="detail-kpi-strip">
          <div class="detail-kpi-cell">
            <span>绑定成员</span>
            <strong>{{ roleData.userCount ?? 0 }}</strong>
            <small>使用该角色的账号数</small>
          </div>
          <div class="detail-kpi-cell">
            <span>菜单权限</span>
            <strong>{{ roleData.menuCount ?? 0 }}</strong>
            <small>已授权功能菜单</small>
          </div>
          <div class="detail-kpi-cell">
            <span>接口权限</span>
            <strong>{{ roleData.permissionCount ?? 0 }}</strong>
            <small>已授权后端接口点</small>
          </div>
        </div>
      </AgriVueDetailSection>
    </template>

    <template v-else-if="activeTab === 'permissions'">
      <AgriVueDetailSection title="数据访问边界">
        <MdsDetailInfoGrid :items="dataScopeDetailItems" />
      </AgriVueDetailSection>

      <AgriVueDetailSection title="权限配置状态" :flush="true">
        <template #extra>
          <button v-if="roleData.editable" type="button" class="detail-section-link" @click="goMatrix">
            前往权限矩阵配置 →
          </button>
        </template>
        <div class="mds-detail-table-wrap">
          <table class="mds-detail-table">
            <thead>
              <tr>
                <th>权限维度</th>
                <th class="is-num">已绑定数量</th>
                <th>配置状态</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>菜单权限</td>
                <td class="is-num">{{ menuCountNum }}</td>
                <td>
                  <span class="agri-detail-status-pill" :class="menuCountNum > 0 ? 'is-green' : 'is-orange'">
                    {{ menuCountNum > 0 ? '已配置' : '未配置' }}
                  </span>
                </td>
                <td>控制侧栏菜单与页面访问入口</td>
              </tr>
              <tr>
                <td>接口权限点</td>
                <td class="is-num">{{ permissionCountNum }}</td>
                <td>
                  <span class="agri-detail-status-pill" :class="permissionCountNum > 0 ? 'is-green' : 'is-orange'">
                    {{ permissionCountNum > 0 ? '已配置' : '未配置' }}
                  </span>
                </td>
                <td>控制按钮显隐与写接口鉴权</td>
              </tr>
              <tr>
                <td>绑定成员</td>
                <td class="is-num">{{ userCountNum }}</td>
                <td>
                  <span class="agri-detail-status-pill" :class="userCountNum > 0 ? 'is-blue' : 'is-gray'">
                    {{ userCountNum > 0 ? '使用中' : '暂无成员' }}
                  </span>
                </td>
                <td>关联当前角色的成员账号总数</td>
              </tr>
            </tbody>
          </table>
        </div>
      </AgriVueDetailSection>
    </template>

    <template v-else-if="activeTab === 'notes'">
      <AgriVueDetailSection title="角色说明与运营备注">
        <MdsDetailInfoGrid :items="noteItems" />
      </AgriVueDetailSection>
    </template>

    <template #aside>
      <AgriVueDetailSection title="角色配置进度">
        <AgriVueDetailTimeline :items="timelineSteps" />
      </AgriVueDetailSection>

      <AgriVueDetailSection title="关联范围与入口">
        <AgriVueDetailRelated :items="relatedDocs" />
      </AgriVueDetailSection>
    </template>
  </AgriVueDetailLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  AgriVueDetailLayout,
  AgriVueDetailRelated,
  AgriVueDetailSection,
  AgriVueDetailTimeline,
  type DetailRelatedDocItem,
  type DetailStatusBadge,
  type DetailTabEntry,
  type DetailTimelineStep,
} from '@agri/shared/vue/detail'
import MdsDetailInfoGrid, { type MdsDetailInfoItem } from '@/components/ui/MdsDetailInfoGrid.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import { getRoleDetail, updateRoleStatus } from '../../utils/api'

interface RoleDetailModel {
  id: number | string
  roleName?: string
  roleCode?: string
  roleKey?: string
  roleType?: string
  roleSort?: number
  status?: number
  editable?: boolean
  isSystem?: boolean
  legacy?: boolean
  ownershipType?: string
  ownershipLabel?: string
  tenantId?: number | string
  tenantName?: string
  dataScope?: string
  dataScopeName?: string
  userCount?: number
  menuCount?: number
  permissionCount?: number
  description?: string
  remark?: string
  createBy?: string
  createTime?: string
  updateTime?: string
}

const route = useRoute()
const router = useRouter()
const roleData = ref<RoleDetailModel | null>(null)
const loading = ref(false)
const loadError = ref('')
const statusUpdating = ref(false)
const activeTab = ref('detail')

const isEnabled = computed(() => Number(roleData.value?.status) === 1)
const menuCountNum = computed(() => Number(roleData.value?.menuCount ?? 0) || 0)
const permissionCountNum = computed(() => Number(roleData.value?.permissionCount ?? 0) || 0)
const userCountNum = computed(() => Number(roleData.value?.userCount ?? 0) || 0)
const totalPermissions = computed(() => menuCountNum.value + permissionCountNum.value)

const scopeDescription = computed(() => ({
  ALL: '可访问平台或主体范围内的全部业务数据。',
  TENANT: '仅访问所属经营主体范围内的数据。',
  ORG: '仅访问成员所属组织及其下级组织的数据。',
  DEPT: '仅访问成员所在部门的数据。',
  OWNER: '仅访问本人创建或负责的数据。',
}[roleData.value?.dataScope || ''] || '尚未设置数据范围。'))

const statusBadge = computed<DetailStatusBadge>(() => ({
  label: isEnabled.value ? '启用' : '停用',
  tone: isEnabled.value ? 'green' : 'gray',
}))

const extraStatuses = computed<DetailStatusBadge[]>(() => {
  const d = roleData.value
  if (!d) return []
  return [
    { label: d.roleType === 'system' ? '系统角色' : '自定义角色', tone: d.roleType === 'system' ? 'orange' : 'blue' },
    { label: d.ownershipLabel || (d.ownershipType === 'PLATFORM' ? '平台公共' : '主体角色'), tone: d.legacy ? 'gray' : 'green' },
  ]
})

const headerMeta = computed(() => {
  const d = roleData.value
  if (!d) return []
  return [
    { label: '角色标识', value: d.roleKey || '未设置' },
    { label: '归属范围', value: d.tenantName || '平台公共' },
    { label: '数据范围', value: d.dataScopeName || d.dataScope || '未设置' },
    { label: '创建时间', value: formatDateTime(d.createTime) },
  ]
})

const tabs = computed<DetailTabEntry[]>(() => [
  { key: 'detail', label: '角色详情' },
  { key: 'permissions', label: '权限与范围', count: totalPermissions.value },
  { key: 'notes', label: '说明与备注' },
])

const profileItems = computed<MdsDetailInfoItem[]>(() => {
  const d = roleData.value
  if (!d) return []
  return [
    { key: 'roleName', label: '角色名称', value: d.roleName },
    { key: 'roleCode', label: '角色编码', value: d.roleCode, mono: true },
    { key: 'roleKey', label: '角色标识', value: d.roleKey, mono: true },
    { key: 'roleType', label: '角色类型', value: d.roleType === 'system' ? '系统角色' : '自定义角色' },
    { key: 'status', label: '角色状态', value: isEnabled.value ? '启用' : '停用' },
    { key: 'roleSort', label: '显示排序', value: String(d.roleSort ?? 0), mono: true },
    { key: 'createBy', label: '创建人', value: d.createBy },
    { key: 'createTime', label: '创建时间', value: formatDateTime(d.createTime), mono: true },
    { key: 'updateTime', label: '最后更新', value: formatDateTime(d.updateTime), mono: true },
  ]
})

const scopeItems = computed<MdsDetailInfoItem[]>(() => {
  const d = roleData.value
  if (!d) return []
  const note = d.ownershipType === 'PLATFORM'
    ? '平台公共角色可被符合条件的经营主体引用。'
    : d.legacy
      ? '历史主体编码尚未迁移，当前不可继续授权。'
      : '主体角色只在所属主体内生效，日常维护应通过个人中心完成。'
  return [
    { key: 'owner', label: '归属主体', value: d.tenantName || '平台公共' },
    { key: 'ownership', label: '归属类别', value: d.ownershipLabel || d.ownershipType },
    { key: 'dataScope', label: '数据范围', value: `${d.dataScopeName || '未设置'}（${d.dataScope || '—'}）` },
    { key: 'tenantId', label: '主体编号', value: d.tenantId ? String(d.tenantId) : '平台公共', mono: Boolean(d.tenantId) },
    { key: 'scopeNote', label: '归属说明', value: note, fullWidth: true },
  ]
})

const dataScopeDetailItems = computed<MdsDetailInfoItem[]>(() => {
  const d = roleData.value
  if (!d) return []
  return [
    { key: 'code', label: '范围编码', value: d.dataScope || '—', mono: true },
    { key: 'name', label: '范围名称', value: d.dataScopeName || '未设置' },
    { key: 'desc', label: '访问规则', value: scopeDescription.value, fullWidth: true },
  ]
})

const noteItems = computed<MdsDetailInfoItem[]>(() => {
  const d = roleData.value
  if (!d) return []
  return [
    { key: 'description', label: '角色说明', value: value(d.description, '未填写角色说明'), fullWidth: true },
    { key: 'remark', label: '运营备注', value: value(d.remark, '未填写运营备注'), fullWidth: true },
  ]
})

const timelineSteps = computed<DetailTimelineStep[]>(() => {
  const d = roleData.value
  if (!d) return []
  const hasPerm = totalPermissions.value > 0
  const hasUsers = userCountNum.value > 0
  return [
    {
      key: 'created',
      title: '角色已创建',
      time: formatDateTime(d.createTime),
      description: `${d.roleType === 'system' ? '系统内置' : '自定义角色'} · ${d.roleCode || ''}`,
      state: 'done',
    },
    {
      key: 'scope',
      title: d.dataScope ? `已配置数据范围（${d.dataScopeName || d.dataScope}）` : '待设置数据范围',
      description: scopeDescription.value,
      state: d.dataScope ? 'done' : 'current',
    },
    {
      key: 'perm',
      title: hasPerm ? `已分配 ${totalPermissions.value} 项权限` : '尚未绑定权限点',
      description: hasPerm ? `菜单 ${d.menuCount ?? 0} 个 · 接口 ${d.permissionCount ?? 0} 个` : '可前往角色权限矩阵分配权限',
      state: hasPerm ? 'done' : 'current',
    },
    {
      key: 'active',
      title: !isEnabled.value ? '角色已停用' : hasUsers ? `生效使用中（${d.userCount} 名成员）` : '已启用（待分配成员）',
      time: formatDateTime(d.updateTime),
      state: !isEnabled.value ? 'error' : hasUsers ? 'done' : 'pending',
    },
  ]
})

const relatedDocs = computed<DetailRelatedDocItem[]>(() => {
  const d = roleData.value
  if (!d) return []
  return [
    {
      key: 'matrix',
      label: '角色权限矩阵',
      text: '查看权限分配',
      mono: false,
      badge: totalPermissions.value > 0 ? '已配置' : '未配置',
      badgeTone: totalPermissions.value > 0 ? 'green' : 'orange',
      clickable: true,
      onClick: goMatrix,
    },
    {
      key: 'subject',
      label: '归属经营主体',
      text: d.tenantName || '平台公共',
      mono: false,
      clickable: Boolean(d.tenantId && !d.legacy && d.ownershipType !== 'PLATFORM'),
      onClick: () => { if (d.tenantId) void router.push(`/subject/detail/${d.tenantId}`) },
    },
    {
      key: 'anomaly',
      label: '异常权限检测',
      text: '前往巡检',
      mono: false,
      clickable: true,
      onClick: () => void router.push('/permission/anomaly'),
    },
    {
      key: 'audit',
      label: '操作审计日志',
      text: '查看变更记录',
      mono: false,
      clickable: true,
      onClick: () => void router.push('/permission/log'),
    },
  ]
})

const loadDetail = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const response = await getRoleDetail(String(route.params.id))
    if (response.code !== 200) throw new Error(response.message || '角色详情加载失败')
    roleData.value = response.data as RoleDetailModel
  } catch (error) {
    roleData.value = null
    loadError.value = error instanceof Error ? error.message : '角色详情加载失败'
  } finally {
    loading.value = false
  }
}

const toggleStatus = async () => {
  if (!roleData.value?.editable) return
  const next = roleData.value.status === 1 ? 0 : 1
  if (!confirm(`确定要${next === 1 ? '启用' : '停用'}“${roleData.value.roleName}”吗？`)) return
  statusUpdating.value = true
  try {
    const response = await updateRoleStatus(roleData.value.id, next)
    if (response.code !== 200) throw new Error(response.message || '状态更新失败')
    message.success(next === 1 ? '角色已启用' : '角色已停用')
    await loadDetail()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '状态更新失败')
  } finally {
    statusUpdating.value = false
  }
}

const goBack = () => void router.push('/permission/role')
const goMatrix = () => void router.push('/permission/matrix')
const editRole = () => {
  if (roleData.value?.editable) void router.push(`/permission/role/${roleData.value.id}/edit`)
}
const printPage = () => window.print()

const value = (input: unknown, fallback = '—') => (input === null || input === undefined || input === '' ? fallback : String(input))
const formatDateTime = (input?: string) => (input ? String(input).replace('T', ' ').slice(0, 16) : '—')

watch(() => route.params.id, () => {
  activeTab.value = 'detail'
  void loadDetail()
})

onMounted(loadDetail)
</script>

<style scoped>
.detail-section-hint {
  color: #68776e;
  font-size: 12px;
}
</style>

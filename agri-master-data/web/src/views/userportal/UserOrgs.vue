<template>
  <div class="mds-page">
    <PageHeader
      title="组织架构"
      subtitle="本主体下的组织节点：企业、合作社、农场与部门。数据按主体隔离，只显示当前主体。"
      source="主数据 · 我的主体"
    >
      <template #actions>
        <button class="mds-btn" :disabled="loading" @click="load">刷新</button>
        <button v-point="'POST /api/user/orgs'" class="mds-btn mds-btn--primary" @click="openCreate">+ 新增组织</button>
      </template>
    </PageHeader>

    <NoticeBar tone="info" title="当前口径：">
      组织数据按主体 <code>{{ merchantId }}</code> 过滤，由后端用请求头 <code>X-Agri-Merchant</code> 校验归属后写入租户上下文。
    </NoticeBar>

    <StatGrid :items="statItems" />

    <div v-if="error" class="mds-card"><NoticeBar tone="danger" title="加载失败：">{{ error }}</NoticeBar></div>

    <div class="mds-card">
      <div class="mds-card-head">
        <div>
          <h2 class="mds-card-title">组织节点</h2>
          <p class="mds-card-sub">按层级缩进展示；父节点缺失时按一级处理</p>
        </div>
        <span class="mds-tag mds-tag--plain">{{ flat.length }} 个</span>
      </div>

      <div class="mds-table-wrap">
        <table class="mds-table">
          <thead>
            <tr>
              <th>组织名称</th>
              <th>编码</th>
              <th>类型</th>
              <th>负责人</th>
              <th>联系电话</th>
              <th>状态</th>
              <th class="mds-center">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="7" class="mds-empty">正在加载组织…</td>
            </tr>
            <tr v-else-if="!flat.length">
              <td colspan="7">
                <EmptyState
                  icon="🏢"
                  title="当前主体还没有组织档案"
                  description="主数据里没有属于该主体的组织节点。可以到运营端开通 / 同步组织，或联系平台管理员初始化。"
                />
              </td>
            </tr>
            <tr v-for="org in flat" :key="org.id">
              <td>
                <span class="mds-name" :style="{ paddingLeft: `${org.depth * 18}px` }">{{ org.orgName || '—' }}</span>
              </td>
              <td class="mds-mono">{{ org.orgCode || '—' }}</td>
              <td><StatusTag :text="typeText(org.orgType)" :tone="typeTone(org.orgType)" plain /></td>
              <td>{{ org.contactPerson || '—' }}</td>
              <td class="mds-mono">{{ org.contactPhone || '—' }}</td>
              <td>
                <StatusTag :text="Number(org.status) === 1 ? '启用' : '停用'" :tone="Number(org.status) === 1 ? 'success' : 'gray'" />
              </td>
              <td class="mds-center">
                <button v-point="'PUT /api/user/orgs/{id}'" class="org-link" @click="openEdit(org)">编辑</button>
                <span v-if="!points.can('PUT /api/user/orgs/{id}')" class="mds-hint">未授权该操作</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <!-- 新增 / 编辑组织 -->
    <div v-if="dialogOpen" class="mds-mask" @click.self="dialogOpen = false">
      <div class="mds-dialog">
        <div class="mds-dialog__head">
          <h3>{{ editingId ? '编辑组织' : '新增组织' }}</h3>
          <button class="mds-dialog__close" @click="dialogOpen = false">×</button>
        </div>
        <div class="mds-dialog__body">
          <label class="mds-field">
            组织名称 <span class="mds-required">*</span>
            <input v-model="form.orgName" class="mds-input" placeholder="如：绿源冷链物流有限公司" />
          </label>
          <label class="mds-field">
            组织类型
            <select v-model="form.orgType" class="mds-select">
              <option value="ENTERPRISE">企业</option>
              <option value="COOPERATIVE">合作社</option>
              <option value="FARM">家庭农场</option>
            </select>
          </label>
          <label v-if="!editingId" class="mds-field">
            上级组织
            <select v-model="form.parentId" class="mds-select">
              <option value="">作为一级组织</option>
              <option v-for="org in flat" :key="org.id" :value="String(org.id)">{{ org.orgName }}</option>
            </select>
          </label>
          <label class="mds-field">
            联系人
            <input v-model="form.contactPerson" class="mds-input" placeholder="选填" />
          </label>
          <label class="mds-field">
            联系电话
            <input v-model="form.contactPhone" class="mds-input" placeholder="选填" />
          </label>
          <p v-if="dialogError" class="mds-dialog__error">{{ dialogError }}</p>
          <p v-if="!editingId" class="mds-dialog__tip">
            组织编码、层级与路径由服务端生成，不需要手工填写。
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

interface OrgRow {
  id: number | string
  orgCode?: string
  orgName?: string
  orgType?: string
  parentId?: number | string | null
  orgLevel?: number
  contactPerson?: string
  contactPhone?: string
  status?: number
}
interface OrgNode extends OrgRow {
  depth: number
}

const me = useMeStore()
const points = usePointStore()

/* ---------- 新增 / 编辑组织 ---------- */
const dialogOpen = ref(false)
const editingId = ref('')
const saving = ref(false)
const dialogError = ref('')
const emptyForm = () => ({ orgName: '', orgType: 'ENTERPRISE', parentId: '', contactPerson: '', contactPhone: '' })
const form = ref(emptyForm())

function openCreate() {
  editingId.value = ''
  form.value = emptyForm()
  dialogError.value = ''
  dialogOpen.value = true
}

function openEdit(row: OrgRow) {
  editingId.value = String(row.id)
  form.value = {
    orgName: row.orgName ?? '',
    orgType: row.orgType ?? 'ENTERPRISE',
    parentId: '',
    contactPerson: row.contactPerson ?? '',
    contactPhone: row.contactPhone ?? '',
  }
  dialogError.value = ''
  dialogOpen.value = true
}

async function submit() {
  if (!form.value.orgName.trim()) {
    dialogError.value = '请填写组织名称'
    return
  }
  saving.value = true
  dialogError.value = ''
  try {
    const res = editingId.value
      ? await userPut(`/api/user/orgs/${editingId.value}`, {
          orgName: form.value.orgName,
          orgType: form.value.orgType,
          contactPerson: form.value.contactPerson,
          contactPhone: form.value.contactPhone,
        })
      : await userPost('/api/user/orgs', form.value)
    if (res.code !== 200) throw new Error(res.message || '保存失败')
    dialogOpen.value = false
    await load()
  } catch (e) {
    dialogError.value = (e as Error).message || '保存失败'
  } finally {
    saving.value = false
  }
}
const loading = ref(false)
const error = ref('')
const rows = ref<OrgRow[]>([])

const merchantId = computed(() => me.current?.merchantId ?? '—')

const TYPE_TEXT: Record<string, string> = {
  ENTERPRISE: '企业',
  COOPERATIVE: '合作社',
  FARM: '农场/基地',
  DEPARTMENT: '部门',
  TEAM: '团队',
  PRODUCTION_UNIT: '生产单位',
}
const TYPE_TONE: Record<string, 'info' | 'cyan' | 'brand' | 'purple' | 'warning'> = {
  ENTERPRISE: 'info',
  COOPERATIVE: 'cyan',
  FARM: 'brand',
  DEPARTMENT: 'info',
  TEAM: 'purple',
  PRODUCTION_UNIT: 'warning',
}
const typeText = (type?: string) => TYPE_TEXT[type ?? ''] ?? type ?? '未分类'
const typeTone = (type?: string) => TYPE_TONE[type ?? ''] ?? 'gray'

/** 平铺 → 树（父节点缺失时当根）；再压平成带 depth 的列表，便于缩进渲染 */
const flat = computed<OrgNode[]>(() => {
  const byParent = new Map<string, OrgRow[]>()
  const ids = new Set(rows.value.map((row) => String(row.id)))
  rows.value.forEach((row) => {
    const parent = row.parentId && ids.has(String(row.parentId)) ? String(row.parentId) : '__root__'
    if (!byParent.has(parent)) byParent.set(parent, [])
    byParent.get(parent)!.push(row)
  })
  const out: OrgNode[] = []
  const walk = (parent: string, depth: number) => {
    ;(byParent.get(parent) ?? []).forEach((row) => {
      out.push({ ...row, depth })
      walk(String(row.id), depth + 1)
    })
  }
  walk('__root__', 0)
  // 有环或孤儿时兜底：没被走到的行按一级补上，避免"数据存在但页面看不到"
  const seen = new Set(out.map((row) => String(row.id)))
  rows.value.forEach((row) => {
    if (!seen.has(String(row.id))) out.push({ ...row, depth: 0 })
  })
  return out
})

const statItems = computed(() => {
  const list = rows.value
  return [
    { label: '组织总数', value: list.length },
    { label: '企业', value: list.filter((row) => row.orgType === 'ENTERPRISE').length },
    { label: '合作社', value: list.filter((row) => row.orgType === 'COOPERATIVE').length },
    { label: '农场 / 基地', value: list.filter((row) => row.orgType === 'FARM').length, tone: 'brand' },
  ]
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    await me.load()
    const response = await userGet<OrgRow[]>('/api/user/orgs')
    if (response.code !== 200) throw new Error(response.message || '组织加载失败')
    rows.value = response.data ?? []
  } catch (err) {
    rows.value = []
    error.value = err instanceof Error ? err.message : '组织加载失败'
  } finally {
    loading.value = false
  }
}

// 权限点清单由 main.ts 在启动续签后读一次，页面只管读结果（v-point 与这里的占位判断都用它）
onMounted(load)
</script>

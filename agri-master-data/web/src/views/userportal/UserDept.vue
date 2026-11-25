<template>
  <div class="mds-page">
    <PageHeader
      title="部门与岗位"
      subtitle="本主体内部的组织部门树与岗位编制；部门决定数据权限范围，岗位决定成员任职归属。"
      source="主数据 · 我的主体"
    >
      
    </PageHeader>

    <NoticeBar tone="info" title="查看口径：">
      部门与岗位按当前主体过滤；切换到别的组织时，部门列表会随之刷新。新增 / 调整请联系主体管理员或运营端。
    </NoticeBar>

    <div class="mds-card">
      

      <AgriVueTable
        :columns="listColumns1"
        :data="depts"
        row-key="id"
        :loading="loading"
        loading-text="正在加载部门…"
        column-settings-storage-key="mds:cols:user-dept-1"
        client-pagination
        @refresh="loadDepts"
      >
        <template #filter>
          <AgriVueFilterBar :field-count="1" :loading="loading" @search="loadDepts" @reset="resetListFilter1">
            <div class="agri-vue-filter-field">
              <label>组织</label>
              <select v-model="orgId" class="mds-select" @change="loadDepts">
                        <option value="">全部组织</option>
                        <option v-for="org in orgs" :key="org.id" :value="String(org.id)">{{ org.orgName }}</option>
                      </select>
            </div>
          </AgriVueFilterBar>
        </template>
        <template #toolbar-left>
          <button v-point="'POST /api/user/depts'" class="mds-btn" @click="openDeptCreate">+ 新增部门</button>
          <button v-point="'POST /api/user/positions'" class="mds-btn mds-btn--primary" @click="openPosCreate">+ 新增岗位</button>
        </template>
        <template #empty>
          <EmptyState
                            icon="🗂️"
                            title="当前主体还没有部门"
                            :description="orgs.length ? '该主体下暂无部门档案；部门由主体管理员维护。' : '先有组织节点，才有其下的部门与岗位。'"
                          />
        </template>
        <template #cell-deptName="{ row: dept }">
          <div class="mds-name">
            {{ dept.deptName || '—' }}
          </div>
        </template>
        <template #cell-status="{ row: dept }">
          <StatusTag :text="dept.status === '1' || dept.status === 'ACTIVE' ? '启用' : '停用'" :tone="dept.status === '1' || dept.status === 'ACTIVE' ? 'success' : 'gray'" />
        </template>
        <template #cell-actions="{ row: dept }">
          <MdsRowActions
            :actions="[
              { key: '1', label: &quot;岗位&quot;, onClick: () => openPositions(dept) },
            ]"
          />
        </template>
      </AgriVueTable>
    </div>

    <div v-if="currentDept" class="mds-card" style="margin-bottom: 0">
      <div class="mds-card-head">
        <div>
          <h2 class="mds-card-title">{{ currentDept.deptName }} · 岗位编制</h2>
          <p class="mds-card-sub">共 {{ positions.length }} 个岗位</p>
        </div>
        <button class="mds-btn" @click="currentDept = null">收起</button>
      </div>
      <AgriVueTable
        :columns="listColumns2"
        :data="positions"
        row-key="id"
        column-settings-storage-key="mds:cols:user-dept-2"
        client-pagination
        @refresh="() => currentDept &amp;&amp; openPositions(currentDept)"
      >
        <template #empty>
          <EmptyState title="该部门还没有岗位" description="岗位由主体管理员在部门内维护。" />
        </template>
        <template #cell-positionName="{ row: position }">
          <div class="mds-name">
            {{ position.positionName || '—' }}
          </div>
        </template>
        <template #cell-positionDesc="{ row: position }">
          <div class="mds-muted">
            {{ position.positionDesc || '—' }}
          </div>
        </template>
        <template #cell-status="{ row: position }">
          <StatusTag :text="position.status === '1' || position.status === 'ACTIVE' ? '启用' : '停用'" :tone="position.status === '1' || position.status === 'ACTIVE' ? 'success' : 'gray'" />
        </template>
      </AgriVueTable>
    </div>
    <!-- 新增部门 -->
    <div v-if="deptDialog" class="mds-mask" @click.self="deptDialog = false">
      <div class="mds-dialog">
        <div class="mds-dialog__head">
          <h3>新增部门</h3>
          <button class="mds-dialog__close" @click="deptDialog = false">×</button>
        </div>
        <div class="mds-dialog__body">
          <label class="mds-field">
            部门名称 <span class="mds-required">*</span>
            <input v-model="deptForm.deptName" class="mds-input" placeholder="如：质量管理部" />
          </label>
          <label class="mds-field">
            所属组织 <span class="mds-required">*</span>
            <select v-model="deptForm.orgId" class="mds-select">
              <option value="">请选择组织</option>
              <option v-for="org in orgs" :key="org.id" :value="String(org.id)">{{ org.orgName }}</option>
            </select>
          </label>
          <label class="mds-field">
            负责人
            <input v-model="deptForm.deptManager" class="mds-input" placeholder="选填" />
          </label>
          <label class="mds-field">
            联系电话
            <input v-model="deptForm.contactPhone" class="mds-input" placeholder="选填" />
          </label>
          <p v-if="dialogError" class="mds-dialog__error">{{ dialogError }}</p>
          <p class="mds-dialog__tip">部门编码由服务端生成。</p>
        </div>
        <div class="mds-dialog__foot">
          <button class="mds-btn" :disabled="saving" @click="deptDialog = false">取消</button>
          <button class="mds-btn mds-btn--primary" :disabled="saving" @click="submitDept">
            {{ saving ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 新增岗位 -->
    <div v-if="posDialog" class="mds-mask" @click.self="posDialog = false">
      <div class="mds-dialog">
        <div class="mds-dialog__head">
          <h3>新增岗位</h3>
          <button class="mds-dialog__close" @click="posDialog = false">×</button>
        </div>
        <div class="mds-dialog__body">
          <label class="mds-field">
            岗位名称 <span class="mds-required">*</span>
            <input v-model="posForm.positionName" class="mds-input" placeholder="如：质检主管" />
          </label>
          <label class="mds-field">
            所属部门 <span class="mds-required">*</span>
            <select v-model="posForm.deptId" class="mds-select">
              <option value="">请选择部门</option>
              <option v-for="dept in depts" :key="dept.id" :value="String(dept.id)">{{ dept.deptName }}</option>
            </select>
          </label>
          <label class="mds-field">
            岗位级别
            <input v-model.number="posForm.positionLevel" class="mds-input" type="number" min="1" max="9" />
          </label>
          <label class="mds-field">
            职责说明
            <textarea v-model="posForm.positionDesc" class="mds-input" rows="2" placeholder="选填" />
          </label>
          <p v-if="dialogError" class="mds-dialog__error">{{ dialogError }}</p>
          <p class="mds-dialog__tip">岗位编码由服务端生成。</p>
        </div>
        <div class="mds-dialog__foot">
          <button class="mds-btn" :disabled="saving" @click="posDialog = false">取消</button>
          <button class="mds-btn mds-btn--primary" :disabled="saving" @click="submitPosition">
            {{ saving ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AgriVueTable, AgriVueFilterBar, type VueListColumn } from '@agri/shared/vue/list'
import MdsRowActions from '@/components/ui/MdsRowActions.vue'
import { onMounted, ref } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { userGet, userPost } from '@/utils/userApi'
import { useMeStore } from '@/stores/me'

interface OrgOption { id: string; orgName?: string }
interface DeptRow {
  id: string
  deptCode?: string
  deptName?: string
  manager?: string
  contactPhone?: string
  deptCount?: number
  status?: string
  orgId?: string
}
interface PositionRow {
  id: string
  positionCode?: string
  positionName?: string
  positionLevel?: number
  positionDesc?: string
  incumbentCount?: number
  status?: string
}

const me = useMeStore()

/* ---------- 新增部门 / 岗位 ---------- */
const deptDialog = ref(false)
const posDialog = ref(false)
const saving = ref(false)
const dialogError = ref('')
const deptForm = ref({ deptName: '', orgId: '', deptManager: '', contactPhone: '' })
const posForm = ref({ positionName: '', deptId: '', positionLevel: 1, positionDesc: '' })

function openDeptCreate() {
  deptForm.value = { deptName: '', orgId: orgId.value || String(orgs.value[0]?.id ?? ''), deptManager: '', contactPhone: '' }
  dialogError.value = ''
  deptDialog.value = true
}

function openPosCreate() {
  posForm.value = {
    positionName: '',
    deptId: String(currentDept.value?.id ?? depts.value[0]?.id ?? ''),
    positionLevel: 1,
    positionDesc: '',
  }
  dialogError.value = ''
  posDialog.value = true
}

async function submitDept() {
  if (!deptForm.value.deptName.trim()) { dialogError.value = '请填写部门名称'; return }
  if (!deptForm.value.orgId) { dialogError.value = '请选择所属组织'; return }
  saving.value = true
  dialogError.value = ''
  try {
    const res = await userPost('/api/user/depts', deptForm.value)
    if (res.code !== 200) throw new Error(res.message || '保存失败')
    deptDialog.value = false
    await loadDepts()
  } catch (e) {
    dialogError.value = (e as Error).message || '保存失败'
  } finally {
    saving.value = false
  }
}

async function submitPosition() {
  if (!posForm.value.positionName.trim()) { dialogError.value = '请填写岗位名称'; return }
  if (!posForm.value.deptId) { dialogError.value = '请选择所属部门'; return }
  saving.value = true
  dialogError.value = ''
  try {
    const res = await userPost('/api/user/positions', posForm.value)
    if (res.code !== 200) throw new Error(res.message || '保存失败')
    posDialog.value = false
    const target = depts.value.find((d) => String(d.id) === posForm.value.deptId)
    if (target) await openPositions(target)
  } catch (e) {
    dialogError.value = (e as Error).message || '保存失败'
  } finally {
    saving.value = false
  }
}
const orgs = ref<OrgOption[]>([])
const depts = ref<DeptRow[]>([])
const positions = ref<PositionRow[]>([])
const currentDept = ref<DeptRow | null>(null)
const orgId = ref('')
const loading = ref(false)

async function loadOrgs() {
  try {
    const response = await userGet<Array<{ id: string; orgName?: string }>>('/api/user/orgs')
    orgs.value = (response.data ?? []).map((org) => ({ id: String(org.id), orgName: org.orgName }))
  } catch {
    orgs.value = []
  }
}

async function loadDepts() {
  loading.value = true
  try {
    await me.load()
    const response = await userGet<DeptRow[]>('/api/user/depts', { orgId: orgId.value || undefined })
    depts.value = response.data ?? []
    currentDept.value = null
  } catch {
    depts.value = []
  } finally {
    loading.value = false
  }
}

async function openPositions(dept: DeptRow) {
  currentDept.value = dept
  positions.value = []
  try {
    const response = await userGet<PositionRow[]>('/api/user/positions', { deptId: dept.id })
    positions.value = response.data ?? []
  } catch {
    positions.value = []
  }
}

onMounted(async () => {
  await Promise.all([loadOrgs(), loadDepts()])
})

const listColumns1: VueListColumn[] = [
  { prop: 'deptName', label: '部门名称', minWidth: 174, locked: true },
  { prop: 'deptCode', label: '部门编码', width: 142, kind: 'code' },
  { prop: 'manager', label: '负责人', width: 128 },
  { prop: 'contactPhone', label: '联系电话', width: 142, kind: 'code' },
  { prop: 'deptCount', label: '人数', width: 104, kind: 'number' },
  { prop: 'status', label: '状态', width: 104, kind: 'status', ellipsis: false },
  { key: 'actions', label: '操作', width: 138, kind: 'action', ellipsis: false },
]

const listColumns2: VueListColumn[] = [
  { prop: 'positionCode', label: '岗位编码', minWidth: 142, locked: true, kind: 'code' },
  { prop: 'positionName', label: '岗位名称', width: 128 },
  { prop: 'positionLevel', label: '级别', width: 104, kind: 'number' },
  { prop: 'positionDesc', label: '职责', width: 128 },
  { prop: 'incumbentCount', label: '在岗', width: 104, kind: 'number' },
  { prop: 'status', label: '状态', width: 104, kind: 'status', ellipsis: false },
]

function resetListFilter1() {
  orgId.value = ""
  void loadDepts()
}
</script>

<style scoped>
.dept-table { min-width: 880px; }
</style>

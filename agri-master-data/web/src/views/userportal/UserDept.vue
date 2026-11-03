<template>
  <div class="mds-page">
    <PageHeader
      title="部门与岗位"
      subtitle="本主体内部的组织部门树与岗位编制；部门决定数据权限范围，岗位决定成员任职归属。"
      source="主数据 · 我的主体"
    >
      <template #actions>
        <button class="mds-btn" :disabled="loading" @click="loadDepts">刷新</button>
        <button v-point="'POST /api/user/depts'" class="mds-btn" @click="openDeptCreate">+ 新增部门</button>
        <button v-point="'POST /api/user/positions'" class="mds-btn mds-btn--primary" @click="openPosCreate">+ 新增岗位</button>
      </template>
    </PageHeader>

    <NoticeBar tone="info" title="查看口径：">
      部门与岗位按当前主体过滤；切换到别的组织时，部门列表会随之刷新。新增 / 调整请联系主体管理员或运营端。
    </NoticeBar>

    <div class="mds-card">
      <div class="mds-filter">
        <select v-model="orgId" class="mds-select" style="min-width: 260px" @change="loadDepts">
          <option value="">全部组织</option>
          <option v-for="org in orgs" :key="org.id" :value="String(org.id)">{{ org.orgName }}</option>
        </select>
        <span class="mds-hint">共 {{ depts.length }} 个部门</span>
      </div>

      <div class="mds-table-wrap">
        <table class="mds-table dept-table">
          <thead>
            <tr>
              <th>部门名称</th>
              <th>部门编码</th>
              <th>负责人</th>
              <th>联系电话</th>
              <th class="mds-num">人数</th>
              <th>状态</th>
              <th class="mds-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading"><td colspan="7" class="mds-empty">正在加载部门…</td></tr>
            <tr v-else-if="!depts.length">
              <td colspan="7">
                <EmptyState
                  icon="🗂️"
                  title="当前主体还没有部门"
                  :description="orgs.length ? '该主体下暂无部门档案；部门由主体管理员维护。' : '先有组织节点，才有其下的部门与岗位。'"
                />
              </td>
            </tr>
            <tr v-for="dept in depts" :key="dept.id">
              <td class="mds-name">{{ dept.deptName || '—' }}</td>
              <td class="mds-mono">{{ dept.deptCode || '—' }}</td>
              <td>{{ dept.manager || '—' }}</td>
              <td class="mds-mono">{{ dept.contactPhone || '—' }}</td>
              <td class="mds-num">{{ dept.deptCount ?? '—' }}</td>
              <td><StatusTag :text="dept.status === '1' || dept.status === 'ACTIVE' ? '启用' : '停用'" :tone="dept.status === '1' || dept.status === 'ACTIVE' ? 'success' : 'gray'" /></td>
              <td class="mds-actions">
                <button class="mds-btn mds-btn--link" @click="openPositions(dept)">岗位</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="currentDept" class="mds-card" style="margin-bottom: 0">
      <div class="mds-card-head">
        <div>
          <h2 class="mds-card-title">{{ currentDept.deptName }} · 岗位编制</h2>
          <p class="mds-card-sub">共 {{ positions.length }} 个岗位</p>
        </div>
        <button class="mds-btn" @click="currentDept = null">收起</button>
      </div>
      <div class="mds-table-wrap">
        <table class="mds-table">
          <thead>
            <tr>
              <th>岗位编码</th>
              <th>岗位名称</th>
              <th class="mds-num">级别</th>
              <th>职责</th>
              <th class="mds-num">在岗</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!positions.length">
              <td colspan="6"><EmptyState title="该部门还没有岗位" description="岗位由主体管理员在部门内维护。" /></td>
            </tr>
            <tr v-for="position in positions" :key="position.id">
              <td class="mds-mono">{{ position.positionCode || '—' }}</td>
              <td class="mds-name">{{ position.positionName || '—' }}</td>
              <td class="mds-num">{{ position.positionLevel ?? '—' }}</td>
              <td class="mds-muted">{{ position.positionDesc || '—' }}</td>
              <td class="mds-num">{{ position.incumbentCount ?? '—' }}</td>
              <td><StatusTag :text="position.status === '1' || position.status === 'ACTIVE' ? '启用' : '停用'" :tone="position.status === '1' || position.status === 'ACTIVE' ? 'success' : 'gray'" /></td>
            </tr>
          </tbody>
        </table>
      </div>
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
</script>

<style scoped>
.dept-table { min-width: 880px; }
</style>

<template>
  <div class="role-edit">
    <header class="page-header">
      <button class="back-btn" @click="goBack">← 返回{{ isEdit ? '角色详情' : '角色列表' }}</button>
      <div>
        <h1>{{ isEdit ? '编辑角色' : '新增角色' }}</h1>
        <p>{{ isEdit ? '维护角色标识、数据范围和使用状态；角色归属创建后不可变更。' : '创建平台公共角色，或为指定经营主体建立应急角色。' }}</p>
      </div>
    </header>

    <div v-if="loadError" class="state-card error">
      <strong>无法编辑该角色</strong>
      <p>{{ loadError }}</p>
      <button class="plain-btn" @click="goBack">返回角色详情</button>
    </div>
    <div v-else-if="loading" class="state-card">正在加载角色资料…</div>

    <form v-else class="edit-layout" @submit.prevent="save">
      <div class="form-column">
        <section class="form-card">
          <div class="card-head">
            <div>
              <h2>基本信息</h2>
              <p>角色编码创建后不可修改，角色标识用于程序权限判断。</p>
            </div>
            <span class="mode-badge">运营应急维护</span>
          </div>
          <div class="form-grid">
            <label class="form-field">
              <span>角色名称 *</span>
              <input v-model.trim="form.roleName" type="text" maxlength="50" placeholder="例如：区域数据审核员" />
            </label>
            <label class="form-field">
              <span>角色编码 *</span>
              <input v-model.trim="form.roleCode" type="text" maxlength="64" :disabled="isEdit || saving" placeholder="例如：REGION_AUDITOR" />
            </label>
            <label class="form-field">
              <span>角色标识 *</span>
              <input v-model.trim="form.roleKey" type="text" maxlength="100" placeholder="例如：regionAuditor" />
            </label>
            <label class="form-field">
              <span>显示排序</span>
              <input v-model.number="form.roleSort" type="number" min="0" step="1" />
            </label>
          </div>
        </section>

        <section class="form-card">
          <div class="card-head">
            <div>
              <h2>角色归属</h2>
              <p>平台公共角色跨主体复用；主体角色只能在所属主体内使用。</p>
            </div>
          </div>
          <div class="form-grid">
            <label class="form-field wide-field">
              <span>所属主体</span>
              <select v-model="form.tenantId" :disabled="isEdit || saving" @change="handleOwnershipChange">
                <option value="">平台公共角色</option>
                <option v-for="subject in subjects" :key="subject.id" :value="String(subject.id)">
                  {{ subject.tenantName }}（{{ subjectTypeText(subject.tenantType) }}）
                </option>
              </select>
            </label>
            <label class="form-field">
              <span>角色类型</span>
              <input :value="form.tenantId ? '主体自定义角色' : '平台自定义角色'" type="text" disabled />
            </label>
            <label class="form-field">
              <span>角色状态</span>
              <select v-model.number="form.status">
                <option :value="1">启用</option>
                <option :value="0">停用</option>
              </select>
            </label>
          </div>
        </section>

        <section class="form-card">
          <div class="card-head">
            <div>
              <h2>数据范围</h2>
              <p>数据范围限定角色能够查看的业务数据边界。</p>
            </div>
          </div>
          <div class="scope-grid">
            <button
              v-for="scope in DATA_SCOPES"
              :key="scope.value"
              type="button"
              class="scope-card"
              :class="{ active: form.dataScope === scope.value }"
              @click="form.dataScope = scope.value"
            >
              <strong>{{ scope.label }}</strong>
              <span>{{ scope.description }}</span>
            </button>
          </div>
        </section>

        <section class="form-card">
          <div class="card-head">
            <div>
              <h2>说明与备注</h2>
              <p>说明会展示在角色列表，备注用于运营内部留档。</p>
            </div>
          </div>
          <div class="form-grid">
            <label class="form-field wide-field">
              <span>角色说明</span>
              <textarea v-model.trim="form.description" rows="3" maxlength="500" placeholder="描述角色职责和适用场景"></textarea>
            </label>
            <label class="form-field wide-field">
              <span>运营备注</span>
              <textarea v-model.trim="form.remark" rows="3" maxlength="500" placeholder="可填写应急创建原因、审批单号等"></textarea>
            </label>
          </div>
        </section>
      </div>

      <aside class="side-column">
        <section class="form-card ownership-card">
          <div class="ownership-icon">{{ form.tenantId ? '主' : '台' }}</div>
          <h2>{{ ownerName }}</h2>
          <p>{{ form.tenantId ? '主体角色只在当前经营主体内生效。' : '平台公共角色可供多个经营主体引用。' }}</p>
          <dl>
            <div><dt>归属类型</dt><dd>{{ form.tenantId ? '经营主体' : '平台公共' }}</dd></div>
            <div><dt>数据范围</dt><dd>{{ selectedScope?.label }}</dd></div>
            <div><dt>角色编码</dt><dd>{{ form.roleCode || '保存时填写' }}</dd></div>
          </dl>
        </section>

        <section class="form-card policy-card">
          <h2>规则校验</h2>
          <ul>
            <li>系统内置角色只允许查看。</li>
            <li>角色创建后不能更换所属主体。</li>
            <li>角色编码和角色标识必须全局唯一。</li>
            <li>已绑定成员的角色不能直接删除。</li>
          </ul>
        </section>

        <section class="form-card permission-card">
          <h2>权限配置说明</h2>
          <p>当前权限目录尚无有效菜单或权限点数据，本页只维护角色主体、数据范围和状态。权限点配置接入后，可在角色详情中查看分配结果。</p>
          <div class="permission-count">
            <span>菜单权限</span><strong>{{ roleData?.menuCount ?? 0 }}</strong>
            <span>接口权限</span><strong>{{ roleData?.permissionCount ?? 0 }}</strong>
          </div>
        </section>

        <section class="form-card submit-card">
          <p v-if="saveError" class="save-error">{{ saveError }}</p>
          <button
            class="save-btn"
            type="submit"
            :disabled="saving"
            v-point="isEdit ? 'PUT /admin/masterdata/permission/role/{id}' : 'POST /admin/masterdata/permission/role'"
          >
            {{ saving ? '保存中…' : (isEdit ? '保存角色修改' : '创建角色') }}
          </button>
          <button class="cancel-btn" type="button" :disabled="saving" @click="goBack">取消</button>
        </section>
      </aside>
    </form>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { createRole, getRoleDetail, getTenantList, updateRole } from '../../utils/api'

const DATA_SCOPES = [
  { value: 'ALL', label: '全部数据', description: '可查看平台或主体范围内的全部业务数据' },
  { value: 'TENANT', label: '主体全部数据', description: '限定当前经营主体内的全部数据' },
  { value: 'ORG', label: '本组织数据', description: '仅查看成员所属组织及其下级数据' },
  { value: 'DEPT', label: '本部门数据', description: '仅查看所在部门的数据' },
  { value: 'OWNER', label: '本人数据', description: '仅查看本人创建或负责的数据' },
]

const route = useRoute()
const router = useRouter()
const isEdit = computed(() => Boolean(route.params.id))
const loading = ref(true)
const saving = ref(false)
const loadError = ref('')
const saveError = ref('')
const subjects = ref([])
const roleData = ref(null)

const form = reactive({
  tenantId: '',
  roleCode: '',
  roleName: '',
  roleKey: '',
  roleSort: 0,
  dataScope: 'ALL',
  status: 1,
  description: '',
  remark: '',
})

const ownerName = computed(() => {
  if (!form.tenantId) return '平台公共角色'
  return subjects.value.find((item) => String(item.id) === String(form.tenantId))?.tenantName || '指定经营主体'
})
const selectedScope = computed(() => DATA_SCOPES.find((item) => item.value === form.dataScope))
const subjectTypeText = (type) => type === 'INDIVIDUAL' || type === 'personal' ? '个人主体' : '企业主体'

const loadSubjects = async () => {
  const response = await getTenantList({ pageNum: 1, pageSize: 500, tenantStatus: 'ACTIVE' })
  if (response.code !== 200) throw new Error(response.message || '经营主体加载失败')
  subjects.value = response.data?.list ?? []
}

const loadRole = async () => {
  const response = await getRoleDetail(route.params.id)
  if (response.code !== 200 || !response.data) throw new Error(response.message || '角色资料加载失败')
  const data = response.data
  if (data.isSystem) throw new Error('系统内置角色只允许查看，不能编辑。')
  if (!data.editable) throw new Error(data.legacy ? '历史角色未关联统一经营主体，只允许查看。' : '当前主体不可用，角色只允许查看。')
  roleData.value = data
  Object.assign(form, {
    tenantId: data.tenantId ? String(data.tenantId) : '',
    roleCode: data.roleCode || '',
    roleName: data.roleName || '',
    roleKey: data.roleKey || '',
    roleSort: Number(data.roleSort ?? 0),
    dataScope: data.dataScope || 'ALL',
    status: Number(data.status) === 0 ? 0 : 1,
    description: data.description || '',
    remark: data.remark || '',
  })
}

const handleOwnershipChange = () => {
  if (!form.tenantId && form.dataScope === 'TENANT') form.dataScope = 'ALL'
}

const validate = () => {
  if (!form.roleName) return '角色名称不能为空'
  if (!/^[A-Za-z0-9_-]{2,64}$/.test(form.roleCode)) return '角色编码应为 2-64 位字母、数字、下划线或中划线'
  if (!/^[A-Za-z][A-Za-z0-9:_-]{1,99}$/.test(form.roleKey)) return '角色标识格式不正确'
  if (!selectedScope.value) return '请选择数据范围'
  return ''
}

const save = async () => {
  saveError.value = validate()
  if (saveError.value) return
  saving.value = true
  try {
    const payload = {
      tenantId: form.tenantId || null,
      roleCode: form.roleCode,
      roleName: form.roleName,
      roleKey: form.roleKey,
      roleSort: Number(form.roleSort) || 0,
      dataScope: form.dataScope,
      status: Number(form.status),
      description: form.description || null,
      remark: form.remark || null,
    }
    const response = isEdit.value
      ? await updateRole(route.params.id, payload)
      : await createRole(payload)
    if (response.code !== 200) throw new Error(response.message || '保存失败')
    message.success(isEdit.value ? '角色修改已保存' : '角色创建成功')
    const id = isEdit.value ? route.params.id : response.data
    await router.replace(id ? `/permission/role/${id}` : '/permission/role')
  } catch (error) {
    saveError.value = error instanceof Error ? error.message : '保存失败'
  } finally {
    saving.value = false
  }
}

const goBack = () => {
  if (isEdit.value) router.push(`/permission/role/${route.params.id}`)
  else router.push('/permission/role')
}

onMounted(async () => {
  loading.value = true
  loadError.value = ''
  try {
    await loadSubjects()
    if (isEdit.value) {
      await loadRole()
    } else {
      const requested = String(route.query.tenantId || '')
      form.tenantId = subjects.value.some((item) => String(item.id) === requested) ? requested : ''
      form.dataScope = form.tenantId ? 'TENANT' : 'ALL'
    }
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '页面加载失败'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.role-edit { padding:20px; color:#1f2937; }
.page-header { display:flex; align-items:center; gap:18px; margin-bottom:18px; }
.page-header > div { flex:1; }
.page-header h1 { margin:0 0 5px; font-size:24px; }
.page-header p { margin:0; color:#6b7280; }
.back-btn { height:36px; padding:0 14px; border:1px solid #d1d5db; border-radius:8px; background:#fff; color:#4b5563; cursor:pointer; }
.state-card,.form-card { border-radius:11px; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.06); }
.state-card { padding:40px; text-align:center; color:#6b7280; }
.state-card.error { color:#b91c1c; background:#fef2f2; }
.state-card p { margin:8px 0 14px; }
.plain-btn { padding:8px 14px; border:1px solid #fecaca; border-radius:7px; background:#fff; color:#b91c1c; cursor:pointer; }
.edit-layout { display:grid; grid-template-columns:minmax(0,1.5fr) minmax(300px,.5fr); gap:14px; align-items:start; }
.form-column,.side-column { display:flex; flex-direction:column; gap:14px; }
.form-card { padding:18px; }
.card-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:16px; }
.card-head h2,.ownership-card h2,.policy-card h2,.permission-card h2 { margin:0; font-size:16px; }
.card-head p { margin:5px 0 0; color:#94a3b8; font-size:12px; line-height:1.5; }
.mode-badge { padding:4px 9px; border-radius:999px; background:#ecfdf5; color:#047857; font-size: var(--agri-font-size-micro); white-space:nowrap; }
.form-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
.form-field { display:flex; flex-direction:column; gap:6px; color:#64748b; font-size:12.5px; }
.form-field input,.form-field select,.form-field textarea { width:100%; min-height:38px; padding:8px 10px; border:1px solid #d1d5db; border-radius:8px; background:#fff; color:#1f2937; outline:none; box-sizing:border-box; }
.form-field textarea { resize:vertical; }
.form-field input:focus,.form-field select:focus,.form-field textarea:focus { border-color:#10b981; box-shadow:0 0 0 3px rgba(16,185,129,.1); }
.form-field input:disabled,.form-field select:disabled { background:#f8fafc; color:#64748b; }
.wide-field { grid-column:1 / -1; }
.scope-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
.scope-card { display:flex; flex-direction:column; gap:5px; padding:13px; border:1px solid #e5e7eb; border-radius:9px; background:#fff; text-align:left; cursor:pointer; }
.scope-card:hover { border-color:#6ee7b7; background:#f0fdf4; }
.scope-card.active { border-color:#10b981; background:#ecfdf5; box-shadow:0 0 0 2px rgba(16,185,129,.1); }
.scope-card strong { color:#1f2937; font-size:13px; }
.scope-card span { color:#94a3b8; font-size: var(--agri-font-size-micro); line-height:1.5; }
.ownership-card { position:relative; overflow:hidden; }
.ownership-card::after { content:''; position:absolute; right:-32px; top:-40px; width:130px; height:130px; border-radius:50%; background:#ecfdf5; }
.ownership-icon { position:relative; z-index:1; width:46px; height:46px; display:grid; place-items:center; margin-bottom:12px; border-radius:12px; background:#d1fae5; color:#047857; font-size:19px; font-weight:700; }
.ownership-card h2,.ownership-card p { position:relative; z-index:1; }
.ownership-card p { margin:6px 0 14px; color:#6b7280; font-size:12px; }
.ownership-card dl { position:relative; z-index:1; margin:0; }
.ownership-card dl > div { display:flex; justify-content:space-between; gap:12px; padding:9px 0; border-bottom:1px solid #edf0f2; }
.ownership-card dt { color:#94a3b8; font-size:12px; }
.ownership-card dd { margin:0; color:#334155; font-size:12.5px; text-align:right; word-break:break-all; }
.policy-card ul { margin:12px 0 0; padding-left:18px; color:#64748b; font-size:12px; line-height:1.9; }
.permission-card p { margin:10px 0 13px; color:#64748b; font-size:12px; line-height:1.65; }
.permission-count { display:grid; grid-template-columns:1fr auto; gap:8px; padding:10px; border-radius:8px; background:#f8fafc; color:#64748b; font-size:12px; }
.permission-count strong { color:#1f3b2a; }
.save-error { margin:0 0 10px; padding:10px; border-radius:8px; background:#fef2f2; color:#b91c1c; font-size:12.5px; }
.save-btn,.cancel-btn { width:100%; height:38px; border-radius:8px; cursor:pointer; }
.save-btn { border:0; background:#10b981; color:#fff; }
.cancel-btn { margin-top:9px; border:1px solid #d1d5db; background:#fff; color:#4b5563; }
.save-btn:disabled,.cancel-btn:disabled { opacity:.55; cursor:wait; }
@media(max-width:900px){.edit-layout{grid-template-columns:1fr}}
@media(max-width:650px){.page-header{align-items:flex-start;flex-wrap:wrap}.form-grid,.scope-grid{grid-template-columns:1fr}.wide-field{grid-column:auto}}
</style>

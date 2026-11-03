<template>
  <div class="org-edit">
    <header class="page-header">
      <button class="back-btn" @click="goBack">← 返回{{ isEdit ? '组织详情' : '组织列表' }}</button>
      <div>
        <h1>{{ isEdit ? '编辑组织' : '新增组织' }}</h1>
        <p>{{ isEdit ? '维护组织档案和上下级关系，组织不能跨经营主体移动。' : '在当前经营主体内创建部门、团队、生产单位或农场基地。' }}</p>
      </div>
    </header>

    <div v-if="loadError" class="state-card error">
      <strong>无法加载组织资料</strong>
      <p>{{ loadError }}</p>
      <button v-if="loadError.includes('历史')" class="plain-btn" @click="goBack">返回组织详情</button>
    </div>
    <div v-else-if="loading" class="state-card">正在加载组织资料…</div>

    <form v-else class="edit-layout" @submit.prevent="save">
      <div class="form-column">
        <section class="form-card">
          <div class="card-head">
            <div>
              <h2>组织归属</h2>
              <p>归属主体创建后不可变更，上级组织必须属于同一主体。</p>
            </div>
            <span class="mode-badge">运营应急维护</span>
          </div>
          <div class="form-grid">
            <label class="form-field">
              <span>所属经营主体 *</span>
              <select
                v-model="form.tenantId"
                :disabled="isEdit || saving"
                @change="handleSubjectChange"
              >
                <option value="">请选择企业或个人主体</option>
                <option v-for="subject in subjects" :key="subject.id" :value="String(subject.id)">
                  {{ subject.tenantName }}（{{ subjectTypeText(subject.tenantType) }}）
                </option>
              </select>
            </label>
            <label class="form-field">
              <span>上级组织</span>
              <select v-model="form.parentId" :disabled="!form.tenantId || saving">
                <option value="0">无上级，作为一级组织</option>
                <option v-for="option in parentOptions" :key="option.id" :value="String(option.id)">
                  {{ '　'.repeat(option.depth) }}{{ option.orgName }}（{{ option.orgCode }}）
                </option>
              </select>
              <small>层级和完整路径由系统自动计算。</small>
            </label>
            <label class="form-field">
              <span>组织编码</span>
              <input
                v-model.trim="form.orgCode"
                type="text"
                maxlength="64"
                :disabled="isEdit || saving"
                placeholder="留空由系统自动生成"
              />
              <small>仅支持字母、数字、下划线和中划线。</small>
            </label>
            <label class="form-field">
              <span>组织名称 *</span>
              <input v-model.trim="form.orgName" type="text" maxlength="128" placeholder="例如：华东生产运营中心" />
            </label>
          </div>
        </section>

        <section class="form-card">
          <div class="card-head">
            <div>
              <h2>组织类型与负责人</h2>
              <p>组织认证不属于组织档案，统一由经营主体认证流程管理。</p>
            </div>
          </div>
          <div class="form-grid">
            <label class="form-field">
              <span>组织类型 *</span>
              <select v-model="form.orgType">
                <option value="DEPARTMENT">部门</option>
                <option value="TEAM">团队</option>
                <option value="PRODUCTION_UNIT">生产单位</option>
                <option value="FARM">农场 / 基地</option>
              </select>
            </label>
            <label class="form-field">
              <span>组织状态</span>
              <select v-model.number="form.status">
                <option :value="1">启用</option>
                <option :value="0">停用</option>
              </select>
            </label>
            <label class="form-field">
              <span>负责人</span>
              <input v-model.trim="form.contactPerson" type="text" maxlength="64" placeholder="请输入组织负责人姓名" />
            </label>
            <label class="form-field">
              <span>联系电话</span>
              <input v-model.trim="form.contactPhone" type="tel" maxlength="32" placeholder="请输入手机号或固定电话" />
            </label>
          </div>
        </section>

        <section class="form-card">
          <div class="card-head">
            <div>
              <h2>办公或生产地址</h2>
              <p>地址用于组织资源归属和跨主体核查。</p>
            </div>
          </div>
          <div class="form-grid three-columns">
            <label class="form-field">
              <span>省份</span>
              <input v-model.trim="form.province" type="text" maxlength="64" placeholder="省 / 自治区 / 直辖市" />
            </label>
            <label class="form-field">
              <span>城市</span>
              <input v-model.trim="form.city" type="text" maxlength="64" placeholder="市 / 州" />
            </label>
            <label class="form-field">
              <span>区县</span>
              <input v-model.trim="form.district" type="text" maxlength="64" placeholder="区 / 县" />
            </label>
            <label class="form-field wide-field">
              <span>详细地址</span>
              <input v-model.trim="form.address" type="text" maxlength="500" placeholder="请输入街道、园区、门牌号等信息" />
            </label>
            <label class="form-field wide-field">
              <span>备注</span>
              <textarea v-model.trim="form.remark" maxlength="500" rows="3" placeholder="可填写组织职责、生产范围或运维说明"></textarea>
            </label>
          </div>
        </section>
      </div>

      <aside class="side-column">
        <section class="form-card context-card">
          <div class="context-icon">组</div>
          <h2>{{ subject?.tenantName || '未选择经营主体' }}</h2>
          <p>{{ subject ? `${subjectTypeText(subject.tenantType)} · ${subject.tenantCode || '未生成编码'}` : '选择主体后可在其内部维护组织。' }}</p>
          <dl>
            <div><dt>维护方式</dt><dd>{{ isEdit ? '编辑现有组织' : '新增下级组织' }}</dd></div>
            <div><dt>上级组织</dt><dd>{{ selectedParentName }}</dd></div>
            <div><dt>组织代码</dt><dd>{{ form.orgCode || '保存时自动生成' }}</dd></div>
          </dl>
        </section>

        <section class="form-card policy-card">
          <h2>规则校验</h2>
          <ul>
            <li>组织创建后不能移动到其他经营主体。</li>
            <li>不能选择当前组织的下级作为上级。</li>
            <li>有子组织时不能直接删除。</li>
            <li>主体停用后，其组织不允许新增或调整。</li>
          </ul>
        </section>

        <section class="form-card submit-card">
          <p v-if="saveError" class="save-error">{{ saveError }}</p>
          <button v-point="isEdit ? 'PUT /admin/masterdata/org/{id}' : 'POST /admin/masterdata/org'" class="save-btn" type="submit" :disabled="saving">
            {{ saving ? '保存中…' : (isEdit ? '保存组织修改' : '创建组织') }}
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
import {
  createOrg,
  getOrgDetail,
  getOrgTree,
  getTenantList,
  updateOrg,
} from '../../utils/api'

const route = useRoute()
const router = useRouter()
const isEdit = computed(() => Boolean(route.params.id))
const loading = ref(true)
const saving = ref(false)
const loadError = ref('')
const saveError = ref('')
const subjects = ref([])
const parentTree = ref([])

const form = reactive({
  tenantId: '',
  orgCode: '',
  orgName: '',
  orgType: 'DEPARTMENT',
  parentId: '0',
  contactPerson: '',
  contactPhone: '',
  province: '',
  city: '',
  district: '',
  address: '',
  status: 1,
  remark: '',
})

const subject = computed(() =>
  subjects.value.find((item) => String(item.id) === String(form.tenantId))
)
const subjectTypeText = (type) => type === 'INDIVIDUAL' || type === 'personal' ? '个人主体' : '企业主体'

const flattenOptions = (nodes, depth = 0, excluded = new Set(), out = []) => {
  nodes.forEach((node) => {
    const currentId = String(node.id)
    if (excluded.has(currentId)) {
      ;(node.children ?? []).forEach((child) => collectIds(child, excluded))
      return
    }
    out.push({ ...node, depth })
    flattenOptions(node.children ?? [], depth + 1, excluded, out)
  })
  return out
}

const collectIds = (node, ids) => {
  ids.add(String(node.id))
  ;(node.children ?? []).forEach((child) => collectIds(child, ids))
}

const excludedParentIds = computed(() => {
  const excluded = new Set()
  if (!isEdit.value) return excluded
  const currentId = String(route.params.id)
  const find = (nodes) => nodes.forEach((node) => {
    if (String(node.id) === currentId) collectIds(node, excluded)
    else find(node.children ?? [])
  })
  find(parentTree.value)
  return excluded
})

const parentOptions = computed(() => flattenOptions(parentTree.value, 0, excludedParentIds.value))
const selectedParentName = computed(() => {
  if (String(form.parentId) === '0') return '一级组织'
  return parentOptions.value.find((item) => String(item.id) === String(form.parentId))?.orgName || '上级组织'
})

const loadSubjects = async () => {
  const response = await getTenantList({ pageNum: 1, pageSize: 500, tenantStatus: 'ACTIVE' })
  if (response.code !== 200) throw new Error(response.message || '经营主体加载失败')
  subjects.value = response.data?.list ?? []
}

const loadParents = async () => {
  if (!form.tenantId) {
    parentTree.value = []
    form.parentId = '0'
    return
  }
  const response = await getOrgTree(form.tenantId)
  if (response.code !== 200) throw new Error(response.message || '组织层级加载失败')
  parentTree.value = response.data ?? []
  if (form.parentId !== '0'
      && !parentOptions.value.some((item) => String(item.id) === String(form.parentId))) {
    form.parentId = '0'
  }
}

const loadDetail = async () => {
  const response = await getOrgDetail(route.params.id)
  if (response.code !== 200 || !response.data) {
    throw new Error(response.message || '组织资料加载失败')
  }
  const data = response.data
  if (data.legacy) {
    throw new Error('该组织属于未迁移的历史数据，未关联统一经营主体，只允许查看。')
  }
  Object.assign(form, {
    tenantId: String(data.tenantId || ''),
    orgCode: data.orgCode || '',
    orgName: data.orgName || '',
    orgType: data.orgType || 'DEPARTMENT',
    parentId: String(data.parentId || '0'),
    contactPerson: data.contactPerson || '',
    contactPhone: data.contactPhone || data.contactMobile || '',
    province: data.province || '',
    city: data.city || '',
    district: data.district || '',
    address: data.address || '',
    status: Number(data.status) === 0 ? 0 : 1,
    remark: data.remark || '',
  })
}

const handleSubjectChange = async () => {
  form.parentId = '0'
  try {
    await loadParents()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '组织层级加载失败')
  }
}

const validate = () => {
  if (!form.tenantId) return '请选择企业或个人主体'
  if (!form.orgName) return '组织名称不能为空'
  if (!form.orgType) return '请选择组织类型'
  if (form.contactPhone && !/^(1[3-9]\d{9}|0\d{2,3}-?\d{7,8})$/.test(form.contactPhone)) {
    return '联系电话格式不正确'
  }
  if (form.parentId !== '0' && String(form.parentId) === String(route.params.id)) {
    return '组织不能选择自己作为上级'
  }
  return ''
}

const save = async () => {
  saveError.value = validate()
  if (saveError.value) return
  saving.value = true
  try {
    const payload = {
      tenantId: form.tenantId,
      orgCode: form.orgCode || null,
      orgName: form.orgName,
      orgType: form.orgType,
      parentId: Number(form.parentId) || 0,
      contactPerson: form.contactPerson || null,
      contactPhone: form.contactPhone || null,
      province: form.province || null,
      city: form.city || null,
      district: form.district || null,
      address: form.address || null,
      status: Number(form.status),
      remark: form.remark || null,
    }
    const response = isEdit.value
      ? await updateOrg(route.params.id, payload)
      : await createOrg(payload)
    if (response.code !== 200) throw new Error(response.message || '保存失败')
    message.success(isEdit.value ? '组织修改已保存' : '组织创建成功')
    const id = isEdit.value ? route.params.id : response.data
    await router.replace(id ? `/org/detail/${id}` : '/org/list')
  } catch (error) {
    saveError.value = error instanceof Error ? error.message : '保存失败'
  } finally {
    saving.value = false
  }
}

const goBack = () => {
  if (isEdit.value) router.push(`/org/detail/${route.params.id}`)
  else router.push({ path: '/org/list', query: form.tenantId ? { tenantId: form.tenantId } : {} })
}

onMounted(async () => {
  loading.value = true
  loadError.value = ''
  try {
    await loadSubjects()
    if (isEdit.value) {
      await loadDetail()
    } else {
      const requested = String(route.query.tenantId || '')
      form.tenantId = subjects.value.some((item) => String(item.id) === requested)
        ? requested
        : String(subjects.value[0]?.id || '')
    }
    await loadParents()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '页面加载失败'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.org-edit { padding:20px; color:#1f2937; }
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
.card-head h2,.context-card h2,.policy-card h2 { margin:0; font-size:16px; }
.card-head p { margin:5px 0 0; color:#94a3b8; font-size:12px; line-height:1.5; }
.mode-badge { padding:4px 9px; border-radius:999px; background:#ecfdf5; color:#047857; font-size: var(--agri-font-size-micro); white-space:nowrap; }
.form-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
.form-grid.three-columns { grid-template-columns:repeat(3,minmax(0,1fr)); }
.form-field { display:flex; flex-direction:column; gap:6px; color:#64748b; font-size:12.5px; }
.form-field input,.form-field select,.form-field textarea { width:100%; min-height:38px; padding:8px 10px; border:1px solid #d1d5db; border-radius:8px; background:#fff; color:#1f2937; outline:none; box-sizing:border-box; }
.form-field textarea { resize:vertical; }
.form-field input:focus,.form-field select:focus,.form-field textarea:focus { border-color:#10b981; box-shadow:0 0 0 3px rgba(16,185,129,.1); }
.form-field input:disabled,.form-field select:disabled { background:#f8fafc; color:#64748b; cursor:not-allowed; }
.form-field small { color:#9ca3af; font-size: var(--agri-font-size-micro); }
.wide-field { grid-column:1 / -1; }
.context-card { position:relative; overflow:hidden; }
.context-card::after { content:''; position:absolute; right:-32px; top:-40px; width:130px; height:130px; border-radius:50%; background:#ecfdf5; }
.context-icon { position:relative; z-index:1; width:46px; height:46px; display:grid; place-items:center; margin-bottom:12px; border-radius:12px; background:#d1fae5; color:#047857; font-size:19px; font-weight:700; }
.context-card h2,.context-card p { position:relative; z-index:1; }
.context-card p { margin:6px 0 14px; color:#6b7280; font-size:12px; }
.context-card dl { position:relative; z-index:1; margin:0; }
.context-card dl > div { display:flex; justify-content:space-between; gap:12px; padding:9px 0; border-bottom:1px solid #edf0f2; }
.context-card dt { color:#94a3b8; font-size:12px; }
.context-card dd { margin:0; color:#334155; font-size:12.5px; text-align:right; word-break:break-all; }
.policy-card ul { margin:12px 0 0; padding-left:18px; color:#64748b; font-size:12px; line-height:1.9; }
.save-error { margin:0 0 10px; padding:10px; border-radius:8px; background:#fef2f2; color:#b91c1c; font-size:12.5px; }
.save-btn,.cancel-btn { width:100%; height:38px; border-radius:8px; cursor:pointer; }
.save-btn { border:0; background:#10b981; color:#fff; }
.cancel-btn { margin-top:9px; border:1px solid #d1d5db; background:#fff; color:#4b5563; }
.save-btn:disabled,.cancel-btn:disabled { opacity:.55; cursor:wait; }
@media(max-width:900px){.edit-layout{grid-template-columns:1fr}}
@media(max-width:650px){.page-header{align-items:flex-start;flex-wrap:wrap}.form-grid,.form-grid.three-columns{grid-template-columns:1fr}.wide-field{grid-column:auto}}
</style>

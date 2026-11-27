<template>
  <div class="org-detail">
    <header class="page-header">
      <button class="back-btn" @click="goBack">← 返回组织列表</button>
      <div>
        <h1>组织详情</h1>
        <p>查看组织档案、上下级关系和负责人信息。</p>
      </div>
      <div v-if="orgData" class="header-actions">
        <button v-point="'PUT /admin/masterdata/org/{id}/status'" class="status-btn" :disabled="orgData.legacy || statusUpdating" @click="toggleStatus">
          {{ Number(orgData.status) === 1 ? '停用组织' : '启用组织' }}
        </button>
        <button class="edit-btn" :disabled="orgData.legacy" @click="editOrg">编辑组织</button>
      </div>
    </header>

    <div v-if="loadError" class="state-card error">{{ loadError }}</div>
    <div v-else-if="!orgData" class="state-card">正在加载组织详情…</div>

    <template v-else>
      <section v-if="orgData.legacy" class="legacy-notice">
        <strong>历史组织数据 · 只读</strong>
        <p>该组织仍使用旧租户编码（{{ orgData.tenantId }}），未关联统一企业或个人主体。为避免错误绑定，运营端仅允许查看；请由主体管理员重新建立组织，或另行执行历史数据迁移。</p>
      </section>

      <section class="identity-card">
        <div class="identity-main">
          <span class="identity-icon">{{ typeIcon }}</span>
          <div>
            <div class="identity-title">
              <h2>{{ orgData.orgName }}</h2>
              <span class="type-badge" :class="typeClass">{{ orgTypeText }}</span>
              <span v-if="orgData.legacy" class="legacy-badge">历史只读</span>
            </div>
            <p>{{ orgData.orgCode }}</p>
          </div>
        </div>
        <div class="identity-status">
          <span class="status-badge" :class="Number(orgData.status) === 1 ? 'active' : 'inactive'">
            {{ Number(orgData.status) === 1 ? '启用' : '停用' }}
          </span>
          <span class="status-badge" :class="orgData.subjectLinked ? 'linked' : 'legacy'">
            {{ orgData.subjectLinked ? '统一主体组织' : '历史组织' }}
          </span>
        </div>
      </section>

      <div class="content-grid">
        <section class="detail-card">
          <div class="card-head">
            <div>
              <h3>基本档案</h3>
              <p>组织自身的业务属性，不包含企业认证信息。</p>
            </div>
            <span>第 {{ orgData.orgLevel || 1 }} 级组织</span>
          </div>
          <div class="info-grid">
            <div><label>组织名称</label><strong>{{ value(orgData.orgName) }}</strong></div>
            <div><label>组织编码</label><strong class="mono">{{ value(orgData.orgCode) }}</strong></div>
            <div><label>组织类型</label><strong>{{ orgTypeText }}</strong></div>
            <div><label>组织状态</label><strong>{{ Number(orgData.status) === 1 ? '启用' : '停用' }}</strong></div>
            <div><label>上级组织</label><strong>{{ value(orgData.parentName, '一级组织') }}</strong></div>
            <div><label>子组织数量</label><strong>{{ orgData.childCount ?? orgData.children?.length ?? 0 }}</strong></div>
            <div class="wide-field"><label>组织路径</label><strong class="mono">{{ value(orgData.orgPath) }}</strong></div>
            <div><label>创建时间</label><strong>{{ formatDateTime(orgData.createTime) }}</strong></div>
            <div><label>最后更新</label><strong>{{ formatDateTime(orgData.updateTime) }}</strong></div>
            <div><label>创建人</label><strong>{{ value(orgData.createBy) }}</strong></div>
          </div>
        </section>

        <section class="detail-card">
          <div class="card-head">
            <div>
              <h3>所属经营主体</h3>
              <p>组织只能归属于一个统一经营主体。</p>
            </div>
          </div>
          <div class="subject-card">
            <span class="subject-icon">{{ orgData.subjectLinked ? '企' : '史' }}</span>
            <div>
              <strong>{{ orgData.tenantName || '未匹配经营主体' }}</strong>
              <p class="mono">{{ orgData.tenantId || '未登记' }}</p>
            </div>
          </div>
          <div class="subject-note" :class="{ warning: orgData.legacy }">
            {{ orgData.legacy
              ? '该组织未关联统一主体，运营端不提供编辑、启停和删除。'
              : '主体认证和资质材料请在“企业与个人主体”中查看，组织本身不再维护认证状态。' }}
          </div>
          <button v-if="!orgData.legacy" class="subject-link" @click="viewSubject">
            查看主体档案 →
          </button>
        </section>
      </div>

      <div class="content-grid contact-grid">
        <section class="detail-card">
          <div class="card-head">
            <div>
              <h3>负责人信息</h3>
              <p>用于组织业务联系和运营核查。</p>
            </div>
          </div>
          <div class="info-grid compact-grid">
            <div><label>负责人</label><strong>{{ value(orgData.contactPerson) }}</strong></div>
            <div><label>联系电话</label><strong>{{ value(orgData.contactPhone || orgData.contactMobile) }}</strong></div>
          </div>
        </section>

        <section class="detail-card">
          <div class="card-head">
            <div>
              <h3>地址信息</h3>
              <p>办公、生产或基地所在地址。</p>
            </div>
          </div>
          <div class="info-grid compact-grid">
            <div><label>省份</label><strong>{{ value(orgData.province) }}</strong></div>
            <div><label>城市</label><strong>{{ value(orgData.city) }}</strong></div>
            <div><label>区县</label><strong>{{ value(orgData.district) }}</strong></div>
            <div class="wide-field"><label>详细地址</label><strong>{{ value(orgData.address) }}</strong></div>
          </div>
        </section>
      </div>

      <section class="detail-card">
        <div class="card-head">
          <div>
            <h3>直接下级组织</h3>
            <p>仅展示当前组织的下一级；完整层级可在组织列表的“层级”视图中查看。</p>
          </div>
          <span>{{ orgData.childCount ?? orgData.children?.length ?? 0 }} 个</span>
        </div>
        <div v-if="orgData.children?.length" class="children-grid">
          <button
            v-for="child in orgData.children"
            :key="child.id"
            class="child-card"
            @click="viewChild(child.id)"
          >
            <span class="child-type">{{ resolveOrgTypeText(child) }}</span>
            <strong>{{ child.orgName }}</strong>
            <small>{{ child.orgCode }}</small>
            <em>{{ Number(child.status) === 1 ? '启用' : '停用' }}</em>
          </button>
        </div>
        <p v-else class="empty-tip">暂无下级组织。</p>
      </section>

      <section class="detail-card governance-card">
        <div>
          <h3>运营端职责说明</h3>
          <p>组织属于主体内部经营数据。日常维护建议由经营主体负责人或主体管理员完成；运营端主要用于跨主体核查、异常组织处置和应急数据修正。</p>
        </div>
        <span>监管与应急维护</span>
      </section>

      <section v-if="orgData.remark" class="detail-card">
        <div class="card-head"><div><h3>备注</h3></div></div>
        <p class="remark-text">{{ orgData.remark }}</p>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { getOrgDetail, updateOrgStatus } from '../../utils/api'

const route = useRoute()
const router = useRouter()
const orgData = ref(null)
const loadError = ref('')
const statusUpdating = ref(false)

const ORG_TYPE_MAP = {
  ENTERPRISE: '企业组织',
  COOPERATIVE: '合作社',
  DEPARTMENT: '部门',
  TEAM: '团队',
  PRODUCTION_UNIT: '生产单位',
  FARM: '农场/基地',
}
const typeText = (type) => ORG_TYPE_MAP[String(type || '').toUpperCase()] || '未分类'
const resolveOrgTypeText = (item) => {
  if (!item) return '未分类'
  const mapped = ORG_TYPE_MAP[String(item.orgType || '').toUpperCase()]
  if (mapped) return mapped
  const rawName = String(item.orgTypeName || '').trim()
  if (rawName && rawName.toUpperCase() !== String(item.orgType || '').toUpperCase()) return rawName
  return '未分类'
}
const orgTypeText = computed(() => resolveOrgTypeText(orgData.value))
const typeClass = computed(() => String(orgData.value?.orgType || '').toLowerCase())
const typeIcon = computed(() => ({
  ENTERPRISE: '企',
  COOPERATIVE: '社',
  DEPARTMENT: '部',
  TEAM: '队',
  PRODUCTION_UNIT: '产',
  FARM: '田',
}[String(orgData.value?.orgType || '').toUpperCase()] || '组'))

const loadDetail = async () => {
  loadError.value = ''
  try {
    const response = await getOrgDetail(route.params.id)
    if (response.code !== 200) throw new Error(response.message || '组织详情加载失败')
    orgData.value = response.data
  } catch (error) {
    orgData.value = null
    loadError.value = error instanceof Error ? error.message : '组织详情加载失败'
  }
}

const toggleStatus = async () => {
  if (!orgData.value || orgData.value.legacy) return
  const next = Number(orgData.value.status) === 1 ? 0 : 1
  if (!confirm(`确定要${next === 1 ? '启用' : '停用'}“${orgData.value.orgName}”吗？`)) return
  statusUpdating.value = true
  try {
    const response = await updateOrgStatus(orgData.value.id, next)
    if (response.code !== 200) throw new Error(response.message || '状态更新失败')
    message.success(next === 1 ? '组织已启用' : '组织已停用')
    await loadDetail()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '状态更新失败')
  } finally {
    statusUpdating.value = false
  }
}

const goBack = () => router.push({
  path: '/org/list',
  query: orgData.value?.tenantId ? { tenantId: orgData.value.tenantId } : {},
})
const editOrg = () => {
  if (orgData.value?.legacy) return
  router.push(`/org/edit/${route.params.id}`)
}
const viewSubject = () => {
  if (orgData.value?.tenantId) router.push(`/subject/detail/${orgData.value.tenantId}`)
}
const viewChild = (id) => router.push(`/org/detail/${id}`)
const value = (input, fallback = '—') => input === null || input === undefined || input === '' ? fallback : input
const formatDateTime = (input) => input ? String(input).replace('T', ' ').slice(0, 16) : '—'

onMounted(loadDetail)
</script>

<style scoped>
.org-detail { padding:0; color:var(--pc-text,#1a1a1a); }
.page-header { display:flex; align-items:center; gap:16px; margin-bottom:20px; }
.page-header > div:not(.header-actions) { flex:1; min-width:0; }
.page-header h1 { margin:0 0 4px; font-size:24px; line-height:1.35; color:var(--pc-text,#1a1a1a); }
.page-header p { margin:0; color:var(--pc-secondary,#595959); font-size:14px; }
.header-actions { display:flex; gap:8px; }
.back-btn,.status-btn,.edit-btn,.subject-link { height:32px; padding:0 16px; border-radius:4px; font-size:14px; font-weight:500; cursor:pointer; }
.back-btn,.status-btn { border:1px solid var(--pc-border,#e8e8e8); background:#fff; color:var(--pc-text,#1a1a1a); }
.back-btn:hover,.status-btn:hover:not(:disabled) { border-color:var(--pc-brand,#2d8f4e); color:var(--pc-brand,#2d8f4e); }
.edit-btn { border:1px solid var(--pc-brand,#2d8f4e); background:var(--pc-brand,#2d8f4e); color:#fff; }
.edit-btn:hover:not(:disabled) { border-color:var(--pc-hover,#247a3f); background:var(--pc-hover,#247a3f); }
.header-actions button:disabled { opacity:.45; cursor:not-allowed; }
.state-card,.identity-card,.detail-card { border:1px solid var(--pc-border,#e8e8e8); border-radius:8px; background:#fff; box-shadow:none; }
.state-card { padding:40px; text-align:center; color:var(--pc-secondary,#595959); }
.state-card.error { color:#b71c1c; background:#ffebee; border-color:#ffcdd2; }
.legacy-notice { padding:14px 16px; margin-bottom:16px; border:1px solid var(--pc-border,#e8e8e8); border-left:4px solid var(--pc-muted,#8c8c8c); border-radius:8px; background:#fff; }
.legacy-notice strong { color:var(--pc-text,#1a1a1a); font-size:14px; }
.legacy-notice p { margin:4px 0 0; color:var(--pc-secondary,#595959); font-size:13px; line-height:1.6; }
.identity-card { display:flex; justify-content:space-between; align-items:center; gap:16px; padding:20px 24px; margin-bottom:16px; }
.identity-main { display:flex; align-items:center; gap:14px; }
.identity-icon { width:48px; height:48px; display:grid; place-items:center; border-radius:8px; background:var(--pc-light,#e8f5e9); color:var(--pc-active,#1b6332); font-size:18px; font-weight:600; }
.identity-title { display:flex; align-items:center; flex-wrap:wrap; gap:8px; }
.identity-title h2 { margin:0; font-size:20px; color:var(--pc-text,#1a1a1a); }
.identity-main p { margin:4px 0 0; color:var(--pc-secondary,#595959); font-family:var(--pc-mono,ui-monospace,Consolas,monospace); font-size:12px; }
.identity-status { display:flex; gap:8px; }
.type-badge,.status-badge,.legacy-badge { display:inline-block; padding:3px 10px; border-radius:4px; font-size:12px; font-weight:500; }
.type-badge.enterprise,.type-badge.department { background:#e3f2fd; color:#1565c0; }
.type-badge.cooperative { background:#e0f7fa; color:#00695c; }
.type-badge.team { background:#f3e5f5; color:#6a1b9a; }
.type-badge.production_unit { background:#fff3e0; color:#8f4500; }
.type-badge.farm { background:var(--pc-light,#e8f5e9); color:var(--pc-active,#1b6332); }
.status-badge.active,.status-badge.linked { background:var(--pc-light,#e8f5e9); color:var(--pc-active,#1b6332); }
.status-badge.inactive { background:var(--pc-bg,#f5f6fa); color:var(--pc-secondary,#595959); }
.status-badge.legacy,.legacy-badge { background:var(--pc-bg,#f5f6fa); color:var(--pc-secondary,#595959); }
.content-grid { display:grid; grid-template-columns:1.4fr .6fr; gap:16px; margin-bottom:16px; }
.contact-grid { grid-template-columns:1fr 1fr; }
.detail-card { padding:24px; margin-bottom:16px; }
.content-grid .detail-card { margin-bottom:0; }
.card-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:16px; }
.card-head h3,.governance-card h3 { margin:0; font-size:18px; color:var(--pc-text,#1a1a1a); }
.card-head p { margin:4px 0 0; color:var(--pc-secondary,#595959); font-size:12px; }
.card-head > span { color:var(--pc-secondary,#595959); font-size:12px; }
.info-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
.compact-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
.info-grid > div { padding:12px 14px; border:1px solid var(--pc-line,#f0f0f0); border-radius:6px; background:var(--pc-bg,#f5f6fa); }
.info-grid label { display:block; margin-bottom:4px; color:var(--pc-secondary,#595959); font-size:12px; }
.info-grid strong { color:var(--pc-text,#1a1a1a); font-size:14px; font-weight:500; word-break:break-all; }
.wide-field { grid-column:span 2; }
.mono { font-family:var(--pc-mono,ui-monospace,SFMono-Regular,Consolas,monospace) !important; font-size:13px !important; }
.subject-card { display:flex; align-items:center; gap:12px; padding:14px; border:1px solid var(--pc-line,#f0f0f0); border-radius:6px; background:var(--pc-bg,#f5f6fa); }
.subject-icon { width:38px; height:38px; display:grid; place-items:center; flex:0 0 auto; border-radius:6px; background:var(--pc-light,#e8f5e9); color:var(--pc-active,#1b6332); font-weight:600; }
.subject-card strong { font-size:14px; color:var(--pc-text,#1a1a1a); }
.subject-card p { margin:4px 0 0; color:var(--pc-secondary,#595959); font-family:var(--pc-mono,ui-monospace,Consolas,monospace); font-size:12px; word-break:break-all; }
.subject-note { margin-top:12px; padding:10px 12px; border-radius:6px; background:var(--pc-light,#e8f5e9); color:var(--pc-active,#1b6332); font-size:12px; line-height:1.6; }
.subject-note.warning { background:var(--pc-bg,#f5f6fa); color:var(--pc-secondary,#595959); }
.subject-link { height:32px; margin-top:12px; border:1px solid var(--pc-brand,#2d8f4e); background:#fff; color:var(--pc-brand,#2d8f4e); font-size:13px; }
.subject-link:hover { background:var(--pc-light,#e8f5e9); }
.children-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
.child-card { display:flex; flex-direction:column; align-items:flex-start; gap:5px; padding:14px; border:1px solid var(--pc-border,#e8e8e8); border-radius:8px; background:#fff; text-align:left; cursor:pointer; }
.child-card:hover { border-color:var(--pc-brand,#2d8f4e); background:#f0f9f1; }
.child-card .child-type { color:var(--pc-active,#1b6332); font-size:12px; }
.child-card strong { color:var(--pc-text,#1a1a1a); font-size:14px; }
.child-card small { color:var(--pc-secondary,#595959); font-family:var(--pc-mono,ui-monospace,Consolas,monospace); font-size:12px; }
.child-card em { margin-top:2px; color:var(--pc-secondary,#595959); font-size:12px; font-style:normal; }
.empty-tip { margin:0; padding:24px; border-radius:6px; background:var(--pc-bg,#f5f6fa); text-align:center; color:var(--pc-secondary,#595959); font-size:13px; }
.governance-card { display:flex; align-items:flex-start; justify-content:space-between; gap:24px; border-left:4px solid var(--pc-brand,#2d8f4e); }
.governance-card p { margin:6px 0 0; color:var(--pc-secondary,#595959); font-size:13px; line-height:1.6; }
.governance-card > span { flex:0 0 auto; padding:4px 10px; border-radius:4px; background:var(--pc-light,#e8f5e9); color:var(--pc-active,#1b6332); font-size:12px; font-weight:500; }
.remark-text { margin:0; padding:14px; border-radius:6px; background:var(--pc-bg,#f5f6fa); color:var(--pc-text,#1a1a1a); font-size:13px; line-height:1.7; white-space:pre-wrap; }
@media(max-width:1000px){.content-grid,.contact-grid{grid-template-columns:1fr}.info-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.children-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:650px){.page-header{align-items:flex-start;flex-wrap:wrap}.header-actions{width:100%}.identity-card,.governance-card{align-items:flex-start;flex-direction:column}.info-grid,.compact-grid,.children-grid{grid-template-columns:1fr}.wide-field{grid-column:auto}}
</style>

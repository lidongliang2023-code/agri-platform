<template>
  <div class="role-detail">
    <header class="page-header">
      <button class="back-btn" @click="goBack">← 返回角色列表</button>
      <div>
        <h1>角色详情</h1>
        <p>查看角色归属、数据范围、成员使用和权限配置状态。</p>
      </div>
      <div v-if="roleData" class="header-actions">
        <button class="status-btn" v-point="'PUT /admin/masterdata/permission/role/{id}/status'" :disabled="!roleData.editable || statusUpdating" @click="toggleStatus">
          {{ roleData.status === 1 ? '停用角色' : '启用角色' }}
        </button>
        <button class="edit-btn" v-point="'PUT /admin/masterdata/permission/role/{id}'" :disabled="!roleData.editable" @click="editRole">编辑角色</button>
      </div>
    </header>

    <div v-if="loadError" class="state-card error">{{ loadError }}</div>
    <div v-else-if="!roleData" class="state-card">正在加载角色详情…</div>

    <template v-else>
      <section v-if="roleData.isSystem || roleData.legacy" class="readonly-notice">
        <strong>{{ roleData.isSystem ? '系统内置角色 · 只读' : '历史主体角色 · 只读' }}</strong>
        <p>{{ roleData.isSystem
          ? '系统内置角色承担平台基础权限，不允许在运营端修改、停用或删除。'
          : '该角色仍使用旧主体编码，未关联统一经营主体。为避免错误授权，运营端仅允许查看。' }}</p>
      </section>

      <section class="identity-card">
        <div class="identity-main">
          <span class="identity-icon">{{ roleData.roleType === 'system' ? '系' : '角' }}</span>
          <div>
            <div class="identity-title">
              <h2>{{ roleData.roleName }}</h2>
              <span class="type-badge" :class="roleData.roleType">{{ roleData.roleType === 'system' ? '系统角色' : '自定义角色' }}</span>
              <span class="ownership-badge" :class="ownershipClass">{{ roleData.ownershipLabel }}</span>
            </div>
            <p>{{ roleData.roleCode }} · {{ roleData.roleKey || '未设置角色标识' }}</p>
          </div>
        </div>
        <span class="status-badge" :class="roleData.status === 1 ? 'active' : 'inactive'">
          {{ roleData.status === 1 ? '启用' : '停用' }}
        </span>
      </section>

      <div class="content-grid">
        <section class="detail-card">
          <div class="card-head">
            <div>
              <h3>角色档案</h3>
              <p>角色基础资料与程序权限标识。</p>
            </div>
            <span>排序 {{ roleData.roleSort ?? 0 }}</span>
          </div>
          <div class="info-grid">
            <div><label>角色名称</label><strong>{{ value(roleData.roleName) }}</strong></div>
            <div><label>角色编码</label><strong class="mono">{{ value(roleData.roleCode) }}</strong></div>
            <div><label>角色标识</label><strong class="mono">{{ value(roleData.roleKey) }}</strong></div>
            <div><label>角色类型</label><strong>{{ roleData.roleType === 'system' ? '系统角色' : '自定义角色' }}</strong></div>
            <div><label>角色状态</label><strong>{{ roleData.status === 1 ? '启用' : '停用' }}</strong></div>
            <div><label>显示排序</label><strong>{{ roleData.roleSort ?? 0 }}</strong></div>
            <div><label>创建人</label><strong>{{ value(roleData.createBy) }}</strong></div>
            <div><label>创建时间</label><strong>{{ formatDateTime(roleData.createTime) }}</strong></div>
            <div><label>最后更新</label><strong>{{ formatDateTime(roleData.updateTime) }}</strong></div>
          </div>
        </section>

        <section class="detail-card">
          <div class="card-head">
            <div>
              <h3>角色归属</h3>
              <p>角色可属于平台公共范围或单一经营主体。</p>
            </div>
          </div>
          <div class="owner-card">
            <span class="owner-icon">{{ roleData.ownershipType === 'PLATFORM' ? '台' : '主' }}</span>
            <div>
              <strong>{{ roleData.tenantName || '平台公共' }}</strong>
              <p>{{ roleData.ownershipLabel }}</p>
              <small v-if="roleData.tenantId" class="mono">{{ roleData.tenantId }}</small>
            </div>
          </div>
          <div class="owner-note" :class="{ warning: roleData.legacy }">
            {{ roleData.ownershipType === 'PLATFORM'
              ? '平台公共角色可被符合条件的经营主体引用。'
              : roleData.legacy
                ? '历史主体编码尚未迁移，当前不可继续授权。'
                : '主体角色只在所属主体内生效，日常维护应通过个人中心完成。' }}
          </div>
        </section>
      </div>

      <div class="content-grid">
        <section class="detail-card">
          <div class="card-head">
            <div><h3>数据范围</h3><p>角色可访问业务数据的边界。</p></div>
          </div>
          <div class="scope-display">
            <span>{{ roleData.dataScope || '—' }}</span>
            <div>
              <strong>{{ roleData.dataScopeName || '未设置' }}</strong>
              <p>{{ scopeDescription }}</p>
            </div>
          </div>
        </section>

        <section class="detail-card">
          <div class="card-head">
            <div><h3>使用情况</h3><p>角色成员与权限资源绑定数量。</p></div>
          </div>
          <div class="usage-grid">
            <div><span>绑定成员</span><strong>{{ roleData.userCount ?? 0 }}</strong></div>
            <div><span>菜单权限</span><strong>{{ roleData.menuCount ?? 0 }}</strong></div>
            <div><span>接口权限</span><strong>{{ roleData.permissionCount ?? 0 }}</strong></div>
          </div>
        </section>
      </div>

      <section class="detail-card">
        <div class="card-head">
          <div><h3>角色说明</h3><p>角色职责、适用场景和运营备注。</p></div>
        </div>
        <div class="text-grid">
          <div><label>角色说明</label><p>{{ value(roleData.description, '未填写角色说明') }}</p></div>
          <div><label>运营备注</label><p>{{ value(roleData.remark, '未填写运营备注') }}</p></div>
        </div>
      </section>

      <section class="detail-card permission-status">
        <div>
          <h3>权限配置状态</h3>
          <p v-if="(roleData.menuCount ?? 0) === 0 && (roleData.permissionCount ?? 0) === 0">
            <template v-if="roleData.editable">该角色还没有绑定任何权限点，可到「角色权限矩阵」开启编辑授权后按单元格分配。</template>
            <template v-else>该角色没有绑定权限点，且只读角色不允许在运营端修改授权。</template>
          </p>
          <p v-else>
            已关联 {{ roleData.menuCount ?? 0 }} 个菜单和 {{ roleData.permissionCount ?? 0 }} 个接口权限点。
          </p>
        </div>
        <div class="permission-actions">
          <button v-if="roleData.editable" class="edit-btn" type="button" @click="goMatrix">去矩阵配置</button>
          <span>{{ (roleData.menuCount ?? 0) + (roleData.permissionCount ?? 0) > 0 ? '已配置' : '未配置' }}</span>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { getRoleDetail, updateRoleStatus } from '../../utils/api'

const route = useRoute()
const router = useRouter()
const roleData = ref(null)
const loadError = ref('')
const statusUpdating = ref(false)
const ownershipClass = computed(() => String(roleData.value?.ownershipType || '').toLowerCase())
const scopeDescription = computed(() => ({
  ALL: '可访问平台或主体范围内的全部业务数据。',
  TENANT: '仅访问所属经营主体范围内的数据。',
  ORG: '仅访问成员所属组织及其下级组织的数据。',
  DEPT: '仅访问成员所在部门的数据。',
  OWNER: '仅访问本人创建或负责的数据。',
}[roleData.value?.dataScope] || '尚未设置数据范围。'))

const loadDetail = async () => {
  loadError.value = ''
  try {
    const response = await getRoleDetail(route.params.id)
    if (response.code !== 200) throw new Error(response.message || '角色详情加载失败')
    roleData.value = response.data
  } catch (error) {
    roleData.value = null
    loadError.value = error instanceof Error ? error.message : '角色详情加载失败'
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

const goBack = () => router.push('/permission/role')
const goMatrix = () => router.push('/permission/matrix')
const editRole = () => roleData.value?.editable && router.push(`/permission/role/${roleData.value.id}/edit`)
const value = (input, fallback = '—') => input === null || input === undefined || input === '' ? fallback : input
const formatDateTime = (input) => input ? String(input).replace('T', ' ').slice(0, 16) : '—'

onMounted(loadDetail)
</script>

<style scoped>
.role-detail { padding:0; color:var(--pc-text,#1a1a1a); }
.page-header { display:flex; align-items:center; gap:16px; margin-bottom:20px; }
.page-header > div:not(.header-actions) { flex:1; min-width:0; }
.page-header h1 { margin:0 0 4px; font-size:24px; line-height:1.35; color:var(--pc-text,#1a1a1a); }
.page-header p { margin:0; color:var(--pc-secondary,#595959); font-size:14px; }
.header-actions { display:flex; gap:8px; }
.back-btn,.status-btn,.edit-btn { height:32px; padding:0 16px; border-radius:4px; font-size:14px; font-weight:500; cursor:pointer; }
.back-btn,.status-btn { border:1px solid var(--pc-border,#e8e8e8); background:#fff; color:var(--pc-text,#1a1a1a); }
.back-btn:hover,.status-btn:hover:not(:disabled) { border-color:var(--pc-brand,#2d8f4e); color:var(--pc-brand,#2d8f4e); }
.edit-btn { border:1px solid var(--pc-brand,#2d8f4e); background:var(--pc-brand,#2d8f4e); color:#fff; }
.edit-btn:hover:not(:disabled) { border-color:var(--pc-hover,#247a3f); background:var(--pc-hover,#247a3f); }
.header-actions button:disabled { opacity:.45; cursor:not-allowed; }
.state-card,.identity-card,.detail-card { border:1px solid var(--pc-border,#e8e8e8); border-radius:8px; background:#fff; box-shadow:none; }
.state-card { padding:40px; text-align:center; color:var(--pc-secondary,#595959); }
.state-card.error { color:#b71c1c; background:#ffebee; border-color:#ffcdd2; }
.readonly-notice { padding:14px 16px; margin-bottom:16px; border:1px solid var(--pc-border,#e8e8e8); border-left:4px solid var(--pc-muted,#8c8c8c); border-radius:8px; background:#fff; }
.readonly-notice strong { color:var(--pc-text,#1a1a1a); font-size:14px; }
.readonly-notice p { margin:4px 0 0; color:var(--pc-secondary,#595959); font-size:13px; line-height:1.6; }
.identity-card { display:flex; justify-content:space-between; align-items:center; gap:16px; padding:20px 24px; margin-bottom:16px; }
.identity-main { display:flex; align-items:center; gap:14px; }
.identity-icon { width:48px; height:48px; display:grid; place-items:center; border-radius:8px; background:var(--pc-light,#e8f5e9); color:var(--pc-active,#1b6332); font-size:18px; font-weight:600; }
.identity-title { display:flex; align-items:center; flex-wrap:wrap; gap:8px; }
.identity-title h2 { margin:0; font-size:20px; color:var(--pc-text,#1a1a1a); }
.identity-main p { margin:4px 0 0; color:var(--pc-secondary,#595959); font-family:var(--pc-mono,ui-monospace,Consolas,monospace); font-size:12px; }
.type-badge,.status-badge,.ownership-badge { display:inline-block; padding:3px 10px; border-radius:4px; font-size:12px; font-weight:500; }
.type-badge.system { background:#fff3e0; color:#8f4500; }
.type-badge.custom { background:#f3e5f5; color:#6a1b9a; }
.ownership-badge.platform { background:#e3f2fd; color:#1565c0; }
.ownership-badge.subject { background:var(--pc-light,#e8f5e9); color:var(--pc-active,#1b6332); }
.ownership-badge.legacy { background:var(--pc-bg,#f5f6fa); color:var(--pc-secondary,#595959); }
.status-badge.active { background:var(--pc-light,#e8f5e9); color:var(--pc-active,#1b6332); }
.status-badge.inactive { background:var(--pc-bg,#f5f6fa); color:var(--pc-secondary,#595959); }
.content-grid { display:grid; grid-template-columns:1.35fr .65fr; gap:16px; margin-bottom:16px; }
.detail-card { padding:24px; margin-bottom:16px; }
.content-grid .detail-card { margin-bottom:0; }
.card-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:16px; }
.card-head h3,.permission-status h3 { margin:0; font-size:18px; color:var(--pc-text,#1a1a1a); }
.card-head p { margin:4px 0 0; color:var(--pc-secondary,#595959); font-size:12px; }
.card-head > span { color:var(--pc-secondary,#595959); font-size:12px; }
.info-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
.info-grid > div { padding:12px 14px; border:1px solid var(--pc-line,#f0f0f0); border-radius:6px; background:var(--pc-bg,#f5f6fa); }
.info-grid label,.text-grid label { display:block; margin-bottom:4px; color:var(--pc-secondary,#595959); font-size:12px; }
.info-grid strong { color:var(--pc-text,#1a1a1a); font-size:14px; font-weight:500; word-break:break-all; }
.mono { font-family:var(--pc-mono,ui-monospace,SFMono-Regular,Consolas,monospace) !important; font-size:13px !important; }
.owner-card { display:flex; align-items:center; gap:12px; padding:14px; border:1px solid var(--pc-line,#f0f0f0); border-radius:6px; background:var(--pc-bg,#f5f6fa); }
.owner-icon { width:38px; height:38px; display:grid; place-items:center; flex:0 0 auto; border-radius:6px; background:var(--pc-light,#e8f5e9); color:var(--pc-active,#1b6332); font-weight:600; }
.owner-card strong { font-size:14px; color:var(--pc-text,#1a1a1a); }
.owner-card p { margin:4px 0; color:var(--pc-secondary,#595959); font-size:12px; }
.owner-card small { color:var(--pc-secondary,#595959); font-size:12px; word-break:break-all; }
.owner-note { margin-top:12px; padding:10px 12px; border-radius:6px; background:var(--pc-light,#e8f5e9); color:var(--pc-active,#1b6332); font-size:12px; line-height:1.6; }
.owner-note.warning { background:var(--pc-bg,#f5f6fa); color:var(--pc-secondary,#595959); }
.scope-display { display:flex; align-items:center; gap:14px; padding:14px; border:1px solid #c8e6c9; border-radius:6px; background:var(--pc-light,#e8f5e9); }
.scope-display > span { min-width:76px; padding:6px 10px; border-radius:4px; background:var(--pc-brand,#2d8f4e); color:#fff; font-family:var(--pc-mono,ui-monospace,Consolas,monospace); font-size:12px; text-align:center; }
.scope-display strong { font-size:14px; color:var(--pc-active,#1b6332); }
.scope-display p { margin:4px 0 0; color:var(--pc-secondary,#595959); font-size:13px; }
.usage-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
.usage-grid div { padding:12px 14px; border:1px solid var(--pc-line,#f0f0f0); border-radius:6px; background:var(--pc-bg,#f5f6fa); }
.usage-grid span,.usage-grid strong { display:block; }
.usage-grid span { color:var(--pc-secondary,#595959); font-size:12px; }
.usage-grid strong { margin-top:6px; color:var(--pc-text,#1a1a1a); font-size:18px; font-variant-numeric:tabular-nums; }
.text-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.text-grid > div { padding:14px; border:1px solid var(--pc-line,#f0f0f0); border-radius:6px; background:var(--pc-bg,#f5f6fa); }
.text-grid p { margin:0; color:var(--pc-text,#1a1a1a); font-size:13px; line-height:1.7; white-space:pre-wrap; }
.permission-status { display:flex; align-items:flex-start; justify-content:space-between; gap:24px; border-left:4px solid var(--pc-brand,#2d8f4e); }
.permission-status p { margin:6px 0 0; color:var(--pc-secondary,#595959); font-size:13px; line-height:1.6; }
.permission-status > span { flex:0 0 auto; padding:4px 10px; border-radius:4px; background:var(--pc-light,#e8f5e9); color:var(--pc-active,#1b6332); font-size:12px; font-weight:500; }
.permission-actions { display:flex; align-items:center; gap:10px; flex:0 0 auto; }
.permission-actions span { padding:4px 10px; border-radius:4px; background:var(--pc-light,#e8f5e9); color:var(--pc-active,#1b6332); font-size:12px; font-weight:500; }
@media(max-width:1000px){.content-grid{grid-template-columns:1fr}.info-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:650px){.page-header{align-items:flex-start;flex-wrap:wrap}.header-actions{width:100%}.identity-card,.permission-status{align-items:flex-start;flex-direction:column}.info-grid,.usage-grid,.text-grid{grid-template-columns:1fr}}
</style>

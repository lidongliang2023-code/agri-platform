<template>
  <div class="subject-list">
    <div class="page-header">
      <div>
        <h1>企业与个人主体</h1>
        <p>统一管理已注册的企业主体和个人主体。主体由统一认证中心注册产生。</p>
      </div>
      <span class="source-tag">统一认证 · 经营主体主档</span>
    </div>

    <div class="search-bar">
      <input
        v-model="searchForm.keyword"
        type="text"
        class="search-input"
        placeholder="搜索主体名称 / 编码 / 联系人"
        @keyup.enter="handleSearch"
      />
      <select v-model="searchForm.tenantType" class="filter-select">
        <option value="">全部主体类型</option>
        <option value="ENTERPRISE">企业主体</option>
        <option value="INDIVIDUAL">个人主体</option>
      </select>
      <select v-model="searchForm.status" class="filter-select">
        <option value="">全部状态</option>
        <option value="ACTIVE">启用</option>
        <option value="INACTIVE">停用</option>
      </select>
      <button class="search-btn" @click="handleSearch">查询</button>
    </div>

    <div class="table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>主体类型</th>
            <th>主体名称</th>
            <th>主体编码</th>
            <th>所属行业 / 经营类型</th>
            <th>联系人</th>
            <th>联系电话</th>
            <th>认证状态</th>
            <th>主体状态</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="10" class="empty-cell">正在加载经营主体…</td>
          </tr>
          <tr v-else-if="subjects.length === 0">
            <td colspan="10" class="empty-cell">暂无符合条件的经营主体</td>
          </tr>
          <tr v-for="subject in subjects" :key="subject.id">
            <td>
              <span class="type-badge" :class="subject.tenantType === 'INDIVIDUAL' ? 'personal' : 'enterprise'">
                {{ subjectTypeText(subject.tenantType) }}
              </span>
            </td>
            <td class="name-cell">{{ subject.tenantName }}</td>
            <td>{{ subject.tenantCode }}</td>
            <td>{{ subject.industry || subject.businessType || '—' }}</td>
            <td>{{ subject.contactPerson || '—' }}</td>
            <td>{{ subject.contactPhone || '—' }}</td>
            <td>{{ verifyText(subject.verifyStatus) }}</td>
            <td>
              <span class="status-badge" :class="isEnabled(subject) ? 'active' : 'inactive'">
                {{ isEnabled(subject) ? '启用' : '停用' }}
              </span>
            </td>
            <td>{{ formatDate(subject.createTime) }}</td>
            <td class="action-cell">
              <button class="action-btn view" @click="viewSubject(subject)">查看</button>
              <button class="action-btn edit" @click="editSubject(subject)">编辑</button>
              <button
                class="action-btn"
                :class="isEnabled(subject) ? 'disable' : 'enable'"
                @click="toggleStatus(subject)"
              >
                {{ isEnabled(subject) ? '停用' : '启用' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="pagination">
        <span class="page-info">共 {{ totalCount }} 个经营主体</span>
        <button class="page-btn" :disabled="currentPage === 1" @click="changePage(-1)">上一页</button>
        <span class="page-info">第 {{ currentPage }} / {{ totalPages }} 页</span>
        <button class="page-btn" :disabled="currentPage >= totalPages" @click="changePage(1)">下一页</button>
      </div>
    </div>

    <div v-if="editOpen" class="modal-overlay" @click="editOpen = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>编辑经营主体</h3>
          <button class="close-btn" @click="editOpen = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>主体名称 *</label>
            <input v-model="form.tenantName" type="text" class="form-input" />
          </div>
          <div class="form-group">
            <label>主体编码</label>
            <input :value="form.tenantCode" type="text" class="form-input" disabled />
          </div>
          <div class="form-group">
            <label>联系人</label>
            <input v-model="form.contactName" type="text" class="form-input" />
          </div>
          <div class="form-group">
            <label>联系电话</label>
            <input v-model="form.contactPhone" type="text" class="form-input" />
          </div>
          <p class="form-tip">主体类型、主体编码来自注册身份，不允许在这里改写。</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="editOpen = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="saveSubject">
            {{ saving ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="detailOpen" class="modal-overlay" @click="detailOpen = false">
      <div class="modal-content detail-modal" @click.stop>
        <div class="modal-header">
          <h3>主体详情</h3>
          <button class="close-btn" @click="detailOpen = false">×</button>
        </div>
        <div v-if="selected" class="modal-body detail-grid">
          <div><span>主体类型</span><strong>{{ subjectTypeText(selected.tenantType) }}</strong></div>
          <div><span>主体名称</span><strong>{{ selected.tenantName }}</strong></div>
          <div><span>主体编码</span><strong>{{ selected.tenantCode }}</strong></div>
          <div><span>行业 / 经营类型</span><strong>{{ selected.industry || selected.businessType || '—' }}</strong></div>
          <div><span>联系人</span><strong>{{ selected.contactPerson || '—' }}</strong></div>
          <div><span>联系电话</span><strong>{{ selected.contactPhone || '—' }}</strong></div>
          <div><span>认证状态</span><strong>{{ verifyText(selected.verifyStatus) }}</strong></div>
          <div><span>主体状态</span><strong>{{ isEnabled(selected) ? '启用' : '停用' }}</strong></div>
          <div><span>创建时间</span><strong>{{ formatDate(selected.createdAt || selected.createTime) }}</strong></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" @click="detailOpen = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { getTenantList, updateTenant, updateTenantStatus } from '../../utils/api'

const searchForm = reactive({ keyword: '', tenantType: '', status: '' })
const subjects = ref([])
const loading = ref(false)
const saving = ref(false)
const currentPage = ref(1)
const pageSize = 20
const totalCount = ref(0)
const totalPages = ref(1)

const editOpen = ref(false)
const detailOpen = ref(false)
const selected = ref(null)
const form = reactive({ id: '', tenantName: '', tenantCode: '', contactName: '', contactPhone: '' })

const messageOf = (response, fallback) => response?.message || fallback

const loadSubjects = async () => {
  loading.value = true
  try {
    const response = await getTenantList({
      pageNum: currentPage.value,
      pageSize,
      keyword: searchForm.keyword || undefined,
      tenantType: searchForm.tenantType || undefined,
      tenantStatus: searchForm.status || undefined,
    })
    if (response.code !== 200) {
      throw new Error(messageOf(response, '经营主体加载失败'))
    }
    subjects.value = response.data?.list ?? []
    totalCount.value = Number(response.data?.total ?? subjects.value.length)
    totalPages.value = Math.max(1, Math.ceil(totalCount.value / pageSize))
  } catch (error) {
    subjects.value = []
    totalCount.value = 0
    totalPages.value = 1
    message.error(error instanceof Error ? error.message : '经营主体加载失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  currentPage.value = 1
  void loadSubjects()
}

const changePage = (delta) => {
  const next = currentPage.value + delta
  if (next < 1 || next > totalPages.value) return
  currentPage.value = next
  void loadSubjects()
}

const isEnabled = (subject) => Number(subject?.status) === 1
const subjectTypeText = (type) => type === 'INDIVIDUAL' ? '个人主体' : '企业主体'
const verifyText = (status) => ({
  approved: '已认证',
  pending: '审核中',
  rejected: '已驳回',
  unverified: '未认证',
}[status] || '未认证')

const editSubject = (subject) => {
  Object.assign(form, {
    id: subject.id,
    tenantName: subject.tenantName,
    tenantCode: subject.tenantCode,
    contactName: subject.contactPerson || '',
    contactPhone: subject.contactPhone || '',
  })
  editOpen.value = true
}

const saveSubject = async () => {
  if (!form.tenantName.trim()) {
    message.warning('主体名称不能为空')
    return
  }
  saving.value = true
  try {
    const response = await updateTenant(form.id, {
      tenantName: form.tenantName,
      contactName: form.contactName,
      contactPerson: form.contactName,
      contactPhone: form.contactPhone,
    })
    if (response.code !== 200) throw new Error(messageOf(response, '保存失败'))
    message.success('经营主体资料已更新')
    editOpen.value = false
    await loadSubjects()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

const toggleStatus = async (subject) => {
  try {
    const response = await updateTenantStatus(subject.id, isEnabled(subject) ? 0 : 1)
    if (response.code !== 200) throw new Error(messageOf(response, '状态更新失败'))
    message.success(isEnabled(subject) ? '主体已停用' : '主体已启用')
    await loadSubjects()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '状态更新失败')
  }
}

const viewSubject = (subject) => {
  selected.value = subject
  detailOpen.value = true
}

const formatDate = (value) => value ? String(value).replace('T', ' ').slice(0, 16) : '—'

onMounted(loadSubjects)
</script>

<style scoped>
.subject-list { padding: 20px; }
.page-header { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:20px; }
.page-header h1 { margin:0 0 6px; font-size:24px; color:#1f2937; }
.page-header p { margin:0; color:#6b7280; }
.source-tag { padding:7px 12px; border-radius:999px; background:#ecfdf5; color:#047857; font-size:12px; white-space:nowrap; }
.search-bar { display:flex; flex-wrap:wrap; gap:10px; padding:16px; margin-bottom:16px; border-radius:10px; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.06); }
.search-input { min-width:300px; flex:1; height:38px; padding:0 12px; border:1px solid #d1d5db; border-radius:8px; }
.filter-select { height:38px; min-width:145px; padding:0 10px; border:1px solid #d1d5db; border-radius:8px; background:#fff; }
.search-btn { height:38px; padding:0 20px; border:0; border-radius:8px; background:#10b981; color:#fff; cursor:pointer; }
.table-card { overflow:auto; border-radius:10px; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.06); }
.data-table { width:100%; min-width:1250px; border-collapse:collapse; }
.data-table th,.data-table td { padding:12px 14px; border-bottom:1px solid #edf0f2; text-align:left; }
.data-table th { background:#f8fafc; color:#4b5563; font-weight:600; }
.name-cell { font-weight:600; color:#1f2937; }
.empty-cell { padding:40px !important; text-align:center !important; color:#9ca3af !important; }
.type-badge,.status-badge { display:inline-block; padding:3px 9px; border-radius:999px; font-size:12px; }
.type-badge.enterprise { background:#ecfdf5; color:#047857; }
.type-badge.personal { background:#eff6ff; color:#1d4ed8; }
.status-badge.active { background:#ecfdf5; color:#047857; }
.status-badge.inactive { background:#f3f4f6; color:#6b7280; }
.action-cell { white-space:nowrap; }
.action-btn { margin-right:6px; padding:4px 8px; border:0; border-radius:6px; background:#f3f4f6; cursor:pointer; }
.action-btn.view { color:#0369a1; background:#e0f2fe; }
.action-btn.edit { color:#047857; background:#ecfdf5; }
.action-btn.disable { color:#b91c1c; background:#fef2f2; }
.action-btn.enable { color:#047857; background:#ecfdf5; }
.pagination { display:flex; justify-content:flex-end; align-items:center; gap:10px; padding:16px; }
.page-btn { padding:6px 12px; border:1px solid #d1d5db; border-radius:6px; background:#fff; cursor:pointer; }
.page-btn:disabled { opacity:.45; cursor:not-allowed; }
.page-info { color:#6b7280; font-size:13px; }
.modal-overlay { position:fixed; inset:0; z-index:1000; display:flex; align-items:center; justify-content:center; background:rgba(17,24,39,.45); }
.modal-content { width:min(560px,92vw); border-radius:12px; background:#fff; box-shadow:0 24px 60px rgba(0,0,0,.18); }
.modal-header,.modal-footer { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid #edf0f2; }
.modal-footer { justify-content:flex-end; gap:10px; border-top:1px solid #edf0f2; border-bottom:0; }
.modal-header h3 { margin:0; }
.close-btn { border:0; background:transparent; font-size:24px; cursor:pointer; }
.modal-body { padding:20px; }
.form-group { margin-bottom:14px; }
.form-group label { display:block; margin-bottom:6px; color:#4b5563; }
.form-input { width:100%; height:38px; padding:0 10px; border:1px solid #d1d5db; border-radius:8px; }
.form-input:disabled { background:#f9fafb; }
.form-tip { color:#9ca3af; font-size:12px; }
.btn { height:36px; padding:0 16px; border-radius:8px; border:0; cursor:pointer; }
.btn-cancel { background:#f3f4f6; }
.btn-primary { background:#10b981; color:#fff; }
.btn:disabled { opacity:.55; cursor:not-allowed; }
.detail-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
.detail-grid div { padding:10px; border-radius:8px; background:#f8fafc; }
.detail-grid span { display:block; margin-bottom:4px; color:#9ca3af; font-size:12px; }
.detail-grid strong { color:#1f2937; word-break:break-all; }
@media(max-width:760px){ .page-header{flex-direction:column}.search-input{min-width:100%}.detail-grid{grid-template-columns:1fr} }
</style>

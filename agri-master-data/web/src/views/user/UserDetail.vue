<template>
  <div class="user-detail">
    <header class="page-head">
      <button class="back" @click="goBack">← 返回用户列表</button>
      <div>
        <h1>统一用户详情</h1>
        <p>账号资料来自统一认证中心，主体成员关系来自平台用户与经营主体绑定。</p>
      </div>
      <button v-point="'PUT /admin/masterdata/user/{id}/status'" v-if="userData" class="status-action" :class="isActive ? 'disable' : 'enable'" @click="toggleStatus">
        {{ isActive ? '停用账号' : '启用账号' }}
      </button>
    </header>

    <div v-if="loading" class="state">正在加载统一用户…</div>
    <div v-else-if="loadError" class="state error">{{ loadError }}</div>
    <template v-else-if="userData">
      <section class="hero">
        <div class="identity">
          <span class="avatar">{{ (userData.nickName || userData.username || '用').slice(0, 1) }}</span>
          <div>
            <h2>{{ userData.nickName || userData.username }}</h2>
            <p>{{ userData.username }} · {{ userData.id }}</p>
          </div>
        </div>
        <span class="status-badge" :class="isActive ? 'active' : 'inactive'">{{ isActive ? '账号正常' : '账号已停用' }}</span>
      </section>

      <section class="summary-grid">
        <div><span>绑定主体</span><strong>{{ userData.memberships?.length || 0 }}</strong></div>
        <div><span>企业主体</span><strong>{{ enterpriseCount }}</strong></div>
        <div><span>个人主体</span><strong>{{ personalCount }}</strong></div>
        <div><span>待认证</span><strong>{{ pendingCount }}</strong></div>
      </section>

      <section class="card">
        <div class="card-head"><h2>账号资料</h2><span>只读来自统一认证</span></div>
        <div class="info-grid">
          <div><label>统一账号</label><strong>{{ value(userData.username) }}</strong></div>
          <div><label>昵称</label><strong>{{ value(userData.nickName) }}</strong></div>
          <div><label>手机号</label><strong>{{ value(userData.phone) }}</strong></div>
          <div><label>邮箱</label><strong>{{ value(userData.email) }}</strong></div>
          <div><label>账号状态</label><strong>{{ isActive ? '正常' : '已停用' }}</strong></div>
          <div><label>创建时间</label><strong>{{ formatDate(userData.createTime) }}</strong></div>
          <div><label>更新时间</label><strong>{{ formatDate(userData.updateTime) }}</strong></div>
          <div><label>用户标识</label><strong>{{ value(userData.id) }}</strong></div>
        </div>
        <p class="note">账号资料和密码在个人中心维护；本页仅执行账号启停和查看主体关系。</p>
      </section>

      <section class="card">
        <div class="card-head">
          <div><h2>经营主体与成员角色</h2><p>一个统一账号可以同时加入多家经营主体。</p></div>
        </div>
        <div v-if="!userData.memberships?.length" class="empty">
          该账号尚未绑定经营主体，可在个人中心创建或加入企业、个人主体。
        </div>
        <div v-else class="membership-grid">
          <article v-for="item in userData.memberships" :key="item.bindingId" class="membership-card">
            <div class="membership-head">
              <span class="subject-icon">{{ item.memberType === 'personal' ? '👤' : '🏢' }}</span>
              <div>
                <h3>{{ item.subjectName || item.subjectId }}</h3>
                <p>主体 ID：{{ item.subjectId }}</p>
              </div>
              <span class="status-badge" :class="verifyClass(item.verifyStatus)">{{ verifyText(item.verifyStatus) }}</span>
            </div>
            <div class="membership-meta">
              <div><span>主体类型</span><strong>{{ memberTypeText(item.memberType) }}</strong></div>
              <div><span>主体内角色</span><strong>{{ roleText(item.roleInMerchant) }}</strong></div>
              <div><span>绑定状态</span><strong>{{ item.status === 1 ? '有效' : '停用' }}</strong></div>
            </div>
            <router-link :to="`/subject/detail/${item.subjectId}`" class="subject-link">查看主体资料 →</router-link>
          </article>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2>数据说明</h2></div>
        <div class="note-grid">
          <div><label>用户主档</label><span>platform_user</span></div>
          <div><label>成员关系</label><span>platform_user_merchant</span></div>
          <div><label>主体资料</label><span>platform_merchant</span></div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { changeStatus, getUserDetail } from '../../utils/api'

const route = useRoute()
const router = useRouter()
const userData = ref(null)
const loading = ref(false)
const loadError = ref('')
const isActive = computed(() => Number(userData.value?.status) === 1)
const enterpriseCount = computed(() => userData.value?.memberships?.filter(item => item.memberType === 'enterprise').length || 0)
const personalCount = computed(() => userData.value?.memberships?.filter(item => item.memberType === 'personal').length || 0)
const pendingCount = computed(() => userData.value?.memberships?.filter(item => item.verifyStatus === 'pending').length || 0)

const loadDetail = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const response = await getUserDetail(route.params.id)
    if (response.code !== 200) throw new Error(response.message || '统一用户详情加载失败')
    userData.value = response.data
  } catch (error) {
    userData.value = null
    loadError.value = error instanceof Error ? error.message : '统一用户详情加载失败'
  } finally {
    loading.value = false
  }
}

const toggleStatus = async () => {
  const next = isActive.value ? 0 : 1
  try {
    const response = await changeStatus(userData.value.id, next)
    if (response.code !== 200) throw new Error(response.message || '账号状态更新失败')
    message.success(next === 1 ? '账号已启用' : '账号已停用')
    await loadDetail()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '账号状态更新失败')
  }
}

const goBack = () => router.push('/user/list')
const value = (input) => input === null || input === undefined || input === '' ? '—' : input
const formatDate = (input) => input ? String(input).replace('T', ' ').slice(0, 16) : '—'
const memberTypeText = (type) => ({ enterprise: '企业主体', personal: '个人主体' }[type] || '主体类型待补充')
const roleText = (role) => ({ owner: '负责人', buyer: '采购', seller: '销售', finance: '财务' }[role] || role || '成员')
const verifyText = (status) => ({ approved: '已认证', pending: '审核中', rejected: '已驳回', unverified: '未认证' }[status] || '未认证')
const verifyClass = (status) => ({ approved: 'active', pending: 'pending', rejected: 'rejected', unverified: 'inactive' }[status] || 'inactive')

onMounted(loadDetail)
</script>

<style scoped>
.user-detail { padding:20px; color:#1f2937; }
.page-head { display:flex; align-items:center; gap:18px; margin-bottom:18px; }
.page-head > div { flex:1; }
.page-head h1 { margin:0 0 5px; font-size:24px; }
.page-head p { margin:0; color:#6b7280; }
.back,.status-action { height:36px; padding:0 14px; border-radius:8px; cursor:pointer; }
.back { border:1px solid #d1d5db; background:#fff; color:#4b5563; }
.status-action { border:0; color:#fff; }
.status-action.disable { background:#dc2626; }
.status-action.enable { background:#10b981; }
.state,.hero,.card { border-radius:11px; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.06); }
.state { padding:40px; text-align:center; color:#6b7280; }
.state.error { color:#b91c1c; background:#fef2f2; }
.hero { display:flex; justify-content:space-between; align-items:center; gap:18px; padding:20px; margin-bottom:14px; }
.identity { display:flex; align-items:center; gap:14px; }
.avatar { width:52px; height:52px; display:grid; place-items:center; border-radius:50%; background:linear-gradient(135deg,#10b981,#0ea5e9); color:#fff; font-size:18px; font-weight:700; }
.hero h2 { margin:0; font-size:21px; }
.hero p { margin:5px 0 0; color:#94a3b8; font-family:ui-monospace,Consolas,monospace; font-size: var(--agri-font-size-micro); }
.summary-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:11px; margin-bottom:14px; }
.summary-grid div { padding:14px; border:1px solid #e3eae5; border-radius:9px; background:#fff; }
.summary-grid span,.summary-grid strong { display:block; }
.summary-grid span { color:#94a3b8; font-size: var(--agri-font-size-micro); }
.summary-grid strong { margin-top:5px; color:#0f6740; font-size:21px; }
.card { padding:18px; margin-bottom:14px; }
.card-head { display:flex; justify-content:space-between; gap:12px; margin-bottom:14px; }
.card-head h2 { margin:0; font-size:16px; }
.card-head p,.card-head > span { margin:4px 0 0; color:#94a3b8; font-size: var(--agri-font-size-micro); }
.info-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }
.info-grid div { padding:11px; border-radius:8px; background:#f8fafc; }
.info-grid label { display:block; margin-bottom:5px; color:#94a3b8; font-size: var(--agri-font-size-micro); }
.info-grid strong { color:#334155; font-size:12.5px; word-break:break-all; }
.note { margin:13px 0 0; padding:10px; border-radius:8px; background:#f8fafc; color:#64748b; font-size: var(--agri-font-size-micro); }
.membership-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:11px; }
.membership-card { padding:14px; border:1px solid #e5e7eb; border-radius:9px; }
.membership-head { display:flex; align-items:flex-start; gap:10px; }
.membership-head > div { flex:1; }
.subject-icon { width:34px; height:34px; display:grid; place-items:center; flex:none; border-radius:8px; background:#ecfdf5; }
.membership-head h3 { margin:0; font-size:14px; }
.membership-head p { margin:4px 0 0; color:#94a3b8; font-family:ui-monospace,Consolas,monospace; font-size: var(--agri-font-size-micro); }
.membership-meta { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:7px; margin:12px 0; }
.membership-meta div { padding:8px; border-radius:7px; background:#f8fafc; }
.membership-meta span,.membership-meta strong { display:block; }
.membership-meta span { color:#94a3b8; font-size: var(--agri-font-size-micro); }
.membership-meta strong { margin-top:4px; color:#334155; font-size:12px; }
.subject-link { color:#047857; text-decoration:none; font-size: var(--agri-font-size-micro); }
.status-badge { display:inline-block; padding:4px 9px; border-radius:999px; font-size: var(--agri-font-size-micro); white-space:nowrap; }
.status-badge.active { background:#ecfdf5; color:#047857; }
.status-badge.pending { background:#fffbeb; color:#b45309; }
.status-badge.rejected { background:#fef2f2; color:#b91c1c; }
.status-badge.inactive { background:#f3f4f6; color:#6b7280; }
.empty { padding:28px; border-radius:8px; background:#f8fafc; text-align:center; color:#94a3b8; }
.note-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:9px; }
.note-grid div { padding:10px; border-radius:8px; background:#f8fafc; }
.note-grid label,.note-grid span { display:block; }
.note-grid label { color:#94a3b8; font-size: var(--agri-font-size-micro); }
.note-grid span { margin-top:4px; color:#475569; font-family:ui-monospace,Consolas,monospace; font-size: var(--agri-font-size-micro); }
@media(max-width:950px){.info-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.membership-grid{grid-template-columns:1fr}}
@media(max-width:650px){.page-head,.hero{flex-wrap:wrap}.summary-grid,.info-grid,.note-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:480px){.summary-grid,.info-grid,.note-grid,.membership-meta{grid-template-columns:1fr}}
</style>

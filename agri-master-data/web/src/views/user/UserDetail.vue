<template>
  <div class="user-detail">
    <header class="page-head">
      <button type="button" class="back" @click="goBack">← 返回用户列表</button>
      <div>
        <h1>统一用户详情</h1>
        <p>账号资料来自统一认证中心，主体成员关系来自平台用户与经营主体绑定；账号启停与实名审核由用户中心运营端办理。</p>
      </div>
      <div class="head-actions">
        <span class="readonly-source">只读 · 统一认证用户主档</span>
        <button type="button" class="uc-link-btn" @click="openUserCenter">前往用户中心 · 用户管理</button>
      </div>
    </header>

    <NoticeBar tone="info" title="只读视图：">
      本页已移除「停用 / 启用账号」操作 —— 账号启停、密码重置与实名审核统一由用户中心运营端办理，避免同一账号在两处产生状态冲突。
    </NoticeBar>

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
        <p class="note">本页仅提供账号资料与主体绑定关系的只读查询；账号启停、冻结解冻及实名审核请前往用户中心运营端办理，个人资料与密码由用户本人在个人中心维护。</p>
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
import NoticeBar from '@/components/ui/NoticeBar.vue'
import { getUserDetail } from '../../utils/api'

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

const openUserCenter = () => {
  window.open(`${window.location.protocol}//${window.location.hostname}:8115/user-center-ops/`, '_blank', 'noopener')
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
.user-detail { padding:0; color:var(--pc-text,#1a1a1a); }
.page-head { display:flex; align-items:center; flex-wrap:wrap; gap:16px; margin-bottom:20px; }
.page-head > div { flex:1; min-width:0; }
.page-head h1 { margin:0 0 4px; font-size:24px; line-height:1.35; color:var(--pc-text,#1a1a1a); }
.page-head p { margin:0; color:var(--pc-secondary,#595959); font-size:14px; }
.head-actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; flex:none; }
.readonly-source { display:inline-flex; align-items:center; height:24px; padding:0 10px; border-radius:12px; background:var(--pc-light,#e8f5e9); color:var(--pc-active,#1b6332); font-size:12px; font-weight:500; white-space:nowrap; }
.back,.uc-link-btn { height:32px; padding:0 16px; border-radius:4px; font-size:14px; font-weight:500; cursor:pointer; }
.back,.uc-link-btn { border:1px solid var(--pc-border,#e8e8e8); background:#fff; color:var(--pc-text,#1a1a1a); }
.back:hover,.uc-link-btn:hover { border-color:var(--pc-brand,#2d8f4e); color:var(--pc-brand,#2d8f4e); }
.state,.hero,.card { border:1px solid var(--pc-border,#e8e8e8); border-radius:8px; background:#fff; box-shadow:none; }
.state { padding:40px; text-align:center; color:var(--pc-secondary,#595959); }
.state.error { color:#b71c1c; background:#ffebee; border-color:#ffcdd2; }
.hero { display:flex; justify-content:space-between; align-items:center; gap:16px; padding:20px 24px; margin-bottom:16px; }
.identity { display:flex; align-items:center; gap:14px; }
.avatar { width:48px; height:48px; display:grid; place-items:center; border-radius:8px; background:var(--pc-light,#e8f5e9); color:var(--pc-active,#1b6332); font-size:18px; font-weight:600; }
.hero h2 { margin:0; font-size:20px; color:var(--pc-text,#1a1a1a); }
.hero p { margin:4px 0 0; color:var(--pc-secondary,#595959); font-family:var(--pc-mono,ui-monospace,Consolas,monospace); font-size:12px; }
.summary-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:16px; }
.summary-grid div { padding:16px 20px; border:1px solid var(--pc-border,#e8e8e8); border-radius:8px; background:#fff; }
.summary-grid span,.summary-grid strong { display:block; }
.summary-grid span { color:var(--pc-secondary,#595959); font-size:12px; }
.summary-grid strong { margin-top:6px; color:var(--pc-text,#1a1a1a); font-size:22px; font-variant-numeric:tabular-nums; }
.card { padding:24px; margin-bottom:16px; }
.card-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:16px; }
.card-head h2 { margin:0; font-size:18px; color:var(--pc-text,#1a1a1a); }
.card-head p,.card-head > span { margin:4px 0 0; color:var(--pc-secondary,#595959); font-size:12px; }
.info-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
.info-grid div { padding:12px 14px; border:1px solid var(--pc-line,#f0f0f0); border-radius:6px; background:var(--pc-bg,#f5f6fa); }
.info-grid label { display:block; margin-bottom:4px; color:var(--pc-secondary,#595959); font-size:12px; }
.info-grid strong { color:var(--pc-text,#1a1a1a); font-size:14px; font-weight:500; word-break:break-all; }
.note { margin:14px 0 0; padding:10px 12px; border-radius:6px; background:var(--pc-bg,#f5f6fa); color:var(--pc-secondary,#595959); font-size:12px; }
.membership-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
.membership-card { padding:16px; border:1px solid var(--pc-border,#e8e8e8); border-radius:8px; background:#fff; }
.membership-head { display:flex; align-items:flex-start; gap:10px; }
.membership-head > div { flex:1; min-width:0; }
.subject-icon { width:36px; height:36px; display:grid; place-items:center; flex:none; border-radius:6px; background:var(--pc-light,#e8f5e9); }
.membership-head h3 { margin:0; font-size:14px; color:var(--pc-text,#1a1a1a); }
.membership-head p { margin:4px 0 0; color:var(--pc-secondary,#595959); font-family:var(--pc-mono,ui-monospace,Consolas,monospace); font-size:12px; }
.membership-meta { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; margin:12px 0; }
.membership-meta div { padding:8px 10px; border:1px solid var(--pc-line,#f0f0f0); border-radius:6px; background:var(--pc-bg,#f5f6fa); }
.membership-meta span,.membership-meta strong { display:block; }
.membership-meta span { color:var(--pc-secondary,#595959); font-size:12px; }
.membership-meta strong { margin-top:4px; color:var(--pc-text,#1a1a1a); font-size:13px; font-weight:500; }
.subject-link { color:var(--pc-active,#1b6332); text-decoration:none; font-size:13px; }
.subject-link:hover { text-decoration:underline; }
.status-badge { display:inline-block; padding:3px 10px; border-radius:4px; font-size:12px; font-weight:500; white-space:nowrap; }
.status-badge.active { background:var(--pc-light,#e8f5e9); color:var(--pc-active,#1b6332); }
.status-badge.pending { background:#fff3e0; color:#8f4500; }
.status-badge.rejected { background:#ffebee; color:#b71c1c; }
.status-badge.inactive { background:var(--pc-bg,#f5f6fa); color:var(--pc-secondary,#595959); }
.empty { padding:24px; border-radius:6px; background:var(--pc-bg,#f5f6fa); text-align:center; color:var(--pc-secondary,#595959); font-size:13px; }
.note-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
.note-grid div { padding:10px 12px; border:1px solid var(--pc-line,#f0f0f0); border-radius:6px; background:var(--pc-bg,#f5f6fa); }
.note-grid label,.note-grid span { display:block; }
.note-grid label { color:var(--pc-secondary,#595959); font-size:12px; }
.note-grid span { margin-top:4px; color:var(--pc-text,#1a1a1a); font-family:var(--pc-mono,ui-monospace,Consolas,monospace); font-size:12px; }
@media(max-width:950px){.info-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.membership-grid{grid-template-columns:1fr}}
@media(max-width:650px){.page-head,.hero{flex-wrap:wrap}.summary-grid,.info-grid,.note-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:480px){.summary-grid,.info-grid,.note-grid,.membership-meta{grid-template-columns:1fr}}
</style>

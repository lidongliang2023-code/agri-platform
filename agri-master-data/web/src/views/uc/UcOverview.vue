<template>
  <div class="mds-page">
    <PageHeader
      title="用户中心总览"
      subtitle="平台账号 · 身份 · 认证的一屏视图（数据实时来自 core-platform）。"
      source="只读 · 用户中心主责"
    >
      <template #actions>
        <button class="mds-btn" @click="openUserCenter">前往用户中心运营端</button>
        <button class="mds-btn" :disabled="loading" @click="loadData">刷新</button>
      </template>
    </PageHeader>

    <NoticeBar tone="info" title="只读视图：">
      账号、实名与身份审核的主责方是用户中心运营端；本页只做跨模块核对，所有审核动作请到用户中心办理。
    </NoticeBar>

    <div class="audit-kpis">
      <div class="audit-kpi">
        <span>认证申请总数</span>
        <strong>{{ counts.total }}</strong>
        <small>企业资质 + 个人实名</small>
      </div>
      <div class="audit-kpi tech">
        <span>待审核</span>
        <strong>{{ counts.pending }}</strong>
        <small>需要运营处理</small>
      </div>
      <div class="audit-kpi">
        <span>企业待审</span>
        <strong>{{ counts.enterprisePending }}</strong>
        <small>经营主体资质</small>
      </div>
      <div class="audit-kpi">
        <span>个人待审</span>
        <strong>{{ counts.personalPending }}</strong>
        <small>个人实名认证</small>
      </div>
      <div class="audit-kpi green">
        <span>已通过</span>
        <strong>{{ counts.approved }}</strong>
        <small>累计通过</small>
      </div>
      <div class="audit-kpi">
        <span>草稿（未提交）</span>
        <strong>{{ counts.draft }}</strong>
        <small>填了一半，不占待办</small>
      </div>
      <div class="audit-kpi red">
        <span>已驳回</span>
        <strong>{{ counts.rejected }}</strong>
        <small>累计驳回</small>
      </div>
    </div>

    <div class="uc-panels">
      <section class="uc-panel">
        <header>
          <h2>待办</h2>
          <small>按提交时间倒序，最多 5 条</small>
        </header>
        <p v-if="loading" class="uc-empty">正在加载…</p>
        <p v-else-if="pendingRows.length === 0" class="uc-empty">没有待审核的认证申请</p>
        <ul v-else class="uc-todo">
          <li v-for="row in pendingRows" :key="row.key">
            <span class="uc-todo-type">{{ row.type === 'enterprise' ? '企业' : '个人' }}</span>
            <span class="uc-todo-name">{{ row.name }}</span>
            <span class="uc-todo-time">{{ row.submitTime }}</span>
          </li>
        </ul>
        <button class="search-btn" @click="go('/user/audit')">去认证审核 →</button>
      </section>

      <section class="uc-panel">
        <header>
          <h2>快捷入口</h2>
          <small>用户中心运营端已上线的页面</small>
        </header>
        <ul class="uc-links">
          <li v-for="link in links" :key="link.path" @click="go(link.path)">
            <strong>{{ link.label }}</strong>
            <small>{{ link.desc }}</small>
          </li>
        </ul>
      </section>
    </div>

    <p class="uc-foot">
      说明：认证审核数据由 <code>/api/v1/admin/merchant-certifications</code> 与
      <code>/api/v1/admin/user-identities</code> 实时聚合，不在前端留存副本。
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import '@/styles/admin-page.css'
import { getMerchantCertifications, getUserIdentities } from '@/utils/certification'

interface Row {
  key: string
  type: 'enterprise' | 'personal'
  name: string
  status: string
  submitTime: string
}

const router = useRouter()
const loading = ref(false)
const rows = ref<Row[]>([])

/**
 * 统一状态口径：approved / rejected / pending / draft。
 *
 * <p>两侧的原始值不一样：企业用 {@code certStatus}（draft/pending/approved/rejected），
 * 个人用 {@code status}（draft/pending/verified/rejected）。不归一的话，
 * 个人的 {@code verified} 会被漏掉、企业的字段名还会读错。</p>
 */
function normalizeStatus(raw: unknown): string {
  const text = String(raw ?? '').toLowerCase()
  if (text === 'verified' || text === 'approved') return 'approved'
  if (text === 'rejected') return 'rejected'
  if (text === 'pending') return 'pending'
  if (text === 'draft') return 'draft'
  return text || 'unknown'
}

/** core-platform 成功码是 0；同时兼容 200，避免被不同模块的约定绊倒 */
const isOk = (res: any): boolean => res?.code === 0 || res?.code === 200

const counts = computed(() => {
  const list = rows.value
  // 只统计**已提交**的申请：draft 是"填了一半还没提交"，把它算进待审会让运营
  // 以为有一堆活等着干（实测库里 draft 就有 11 条）
  const pending = list.filter((r) => r.status === 'pending')
  return {
    total: list.length,
    pending: pending.length,
    enterprisePending: pending.filter((r) => r.type === 'enterprise').length,
    personalPending: pending.filter((r) => r.type === 'personal').length,
    approved: list.filter((r) => r.status === 'approved').length,
    rejected: list.filter((r) => r.status === 'rejected').length,
    draft: list.filter((r) => r.status === 'draft').length,
  }
})

const pendingRows = computed(() =>
  rows.value.filter((r) => r.status === 'pending').slice(0, 5),
)

const links = [
  { path: '/user/audit', label: '认证审核', desc: '企业与个人实名认证统一审核' },
  { path: '/user/list', label: '用户列表', desc: '平台账号查询与管理' },
  { path: '/org/list', label: '主体内组织', desc: '经营主体的成员与结构' },
  { path: '/permission/role', label: '角色管理', desc: '平台角色与权限分配' },
]

function go(path: string): void {
  void router.push(path)
}

function openUserCenter(): void {
  window.open(`${window.location.protocol}//${window.location.hostname}:8115/user-center-ops/`, '_blank', 'noopener')
}

/**
 * 拉取两类认证申请并合并。
 *
 * 两个接口都不支持服务端状态筛选，所以按页拉取后在本地聚合 ——
 * 这与「认证审核」页的取数口径保持一致，避免两页数字对不上。
 */
async function loadData(): Promise<void> {
  loading.value = true
  try {
    const [enterprise, personal] = await Promise.all([
      getMerchantCertifications({ pageNum: 1, pageSize: 200 }),
      getUserIdentities({ pageNum: 1, pageSize: 200 }),
    ])
    const list: Row[] = []
    if (isOk(enterprise)) {
      for (const item of enterprise.data?.records ?? []) {
        list.push({
          key: `e-${item.id}`,
          type: 'enterprise',
          name: item.merchantName ?? item.companyName ?? `主体 ${item.merchantId ?? item.id}`,
          // 企业认证的状态列叫 certStatus，不是 status —— 读错字段会让企业侧全部落进"其他"
          status: normalizeStatus(item.certStatus),
          submitTime: String(item.submitTime ?? item.createdAt ?? ''),
        })
      }
    }
    if (isOk(personal)) {
      for (const item of personal.data?.records ?? []) {
        list.push({
          key: `p-${item.id}`,
          type: 'personal',
          name: item.realName ?? `身份 ${item.identityNo ?? item.id}`,
          // 个人实名的终态叫 verified，不是 approved
          status: normalizeStatus(item.status),
          submitTime: String(item.submitTime ?? ''),
        })
      }
    }
    list.sort((a, b) => b.submitTime.localeCompare(a.submitTime))
    rows.value = list
    if (!isOk(enterprise) || !isOk(personal)) {
      message.warning('部分认证数据加载失败，请检查 core-platform')
    }
  } catch {
    message.error('加载用户中心数据失败（请检查 core-platform 是否在运行）')
    rows.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.uc-overview { padding: 0 0 32px; }
.uc-panels { display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; margin-top: 16px; }
@media (max-width: 1100px) { .uc-panels { grid-template-columns: 1fr; } }
.uc-panel { border: 1px solid #e6ede9; border-radius: 12px; background: #fff; padding: 16px 18px; }
.uc-panel header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px; }
.uc-panel h2 { margin: 0; font-size: 15px; color: #1f3a2c; }
.uc-panel header small { color: #84938a; font-size: var(--agri-font-size-micro); }
.uc-empty { margin: 0 0 12px; color: #9aa8a0; font-size: 12px; }
.uc-todo { list-style: none; margin: 0 0 12px; padding: 0; display: grid; gap: 8px; }
.uc-todo li { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 9px; background: #fafcfb; font-size: 12px; }
.uc-todo-type { padding: 1px 7px; border-radius: 999px; background: #e9f6ef; color: #12764a; font-size: var(--agri-font-size-micro); }
.uc-todo-name { flex: 1; color: #2b4034; }
.uc-todo-time { color: #9aa8a0; font-size: var(--agri-font-size-micro); }
.uc-links { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.uc-links li { padding: 10px 12px; border: 1px solid #eef3f0; border-radius: 10px; cursor: pointer; transition: border-color .15s ease, background .15s ease; }
.uc-links li:hover { border-color: #b9dfc9; background: #f7fcf9; }
.uc-links strong { display: block; color: #1f3a2c; font-size: 12.5px; }
.uc-links small { color: #84938a; font-size: var(--agri-font-size-micro); }
.uc-foot { margin-top: 16px; color: #9aa8a0; font-size: var(--agri-font-size-micro); }
.uc-foot code { background: #f4f7f5; padding: 1px 4px; border-radius: 4px; }
</style>

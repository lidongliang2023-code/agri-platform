<template>
  <div class="user-layout">
    <aside class="user-sidebar">
      <div class="logo-section">
        <BrandMark :size="34" />
        <div class="logo-text">
          <h1>丰链云</h1>
          <p>主数据 · 企业端</p>
        </div>
      </div>

      <div class="tenant-box">
        <span class="tenant-label">当前主体</span>
        <strong>{{ me.current?.merchantName || '未绑定经营主体' }}</strong>
        <small v-if="me.current">
          {{ me.current.merchantId }} · {{ roleText(me.current.roleInMerchant) }} ·
          {{ verifyText(me.current.verifyStatus) }}
        </small>
        <small v-else>账号尚未加入任何经营主体</small>
      </div>

      <nav class="user-nav">
        <div v-for="group in menuGroups" :key="group.key" class="nav-group">
          <div class="group-title">
            <span class="group-icon"><MenuIcon :name="group.icon" /></span>
            {{ group.label }}
          </div>
          <ul>
            <li v-for="item in group.items" :key="item.path" :class="{ active: isActive(item.path) }">
              <router-link :to="item.path" :title="item.label">
                {{ item.label }}
                <span v-if="item.pending" class="pending-mark">待接入</span>
              </router-link>
            </li>
          </ul>
        </div>
      </nav>

      <div class="sidebar-foot">企业端 · V1.0</div>
    </aside>

    <main class="user-main">
      <header class="user-topbar">
        <div class="topbar-left">
          <div class="breadcrumb">
            <span>{{ currentGroup }}</span><b>/</b><strong>{{ currentLabel }}</strong>
          </div>
        </div>
        <div class="topbar-right">
          <a class="ops-link" :href="opsEntry">运营端</a>
          <button class="icon-btn" :title="`未读消息 ${me.unread} 条`" @click="router.push('/user/messages')">
            🔔<span v-if="me.unread > 0" class="badge">{{ me.unread > 99 ? '99+' : me.unread }}</span>
          </button>
          <div class="user-chip">
            <span class="avatar">{{ initial }}</span>
            <div>
              <strong>{{ userInfo.nickname || userInfo.username || '用户' }}</strong>
              <small>{{ userInfo.roles?.join(' / ') || '未分配角色' }}</small>
            </div>
          </div>
          <button class="logout-btn" :disabled="loggingOut" @click="handleLogout">
            {{ loggingOut ? '退出中…' : '退出登录' }}
          </button>
        </div>
      </header>

      <div class="user-content">
        <PointHiddenNotice />
        <router-view />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BrandMark from '@/components/BrandMark.vue'
import MenuIcon from '@/components/MenuIcon.vue'
import PointHiddenNotice from '@/components/ui/PointHiddenNotice.vue'
import { useSessionStore } from '@/stores/session'
import { useMeStore } from '@/stores/me'
import { revokePlatformSession, ssoLogoutUrl } from '@/utils/sso'

interface MenuItem {
  path: string
  label: string
  pending?: boolean
}
interface MenuGroup {
  key: string
  label: string
  icon: string
  items: MenuItem[]
}

/** 与《主数据管理模块_用户端原型 v1》的 5 组 / 21 项一致 */
const menuGroups: MenuGroup[] = [
  {
    key: 'overview',
    label: '概览',
    icon: 'dashboard',
    items: [{ path: '/user/workbench', label: '企业工作台' }],
  },
  {
    key: 'org',
    label: '组织与成员',
    icon: 'org',
    items: [
      { path: '/user/org-tree', label: '组织架构' },
      { path: '/user/dept', label: '部门与岗位' },
      { path: '/user/members', label: '成员账号' },
      { path: '/user/invite', label: '邀请成员' },
      { path: '/user/roles', label: '角色与权限' },
    ],
  },
  {
    key: 'archive',
    label: '业务档案',
    icon: 'product',
    items: [
      { path: '/user/categories', label: '我的品类' },
      { path: '/user/products', label: '商品 SPU 与 SKU' },
      { path: '/user/attr-templates', label: '属性模板' },
      { path: '/user/customers', label: '客户档案' },
      { path: '/user/suppliers', label: '供应商档案' },
      { path: '/user/partner-graph', label: '伙伴关系图' },
    ],
  },
  {
    key: 'tenant',
    label: '租户与审计',
    icon: 'subject',
    items: [
      { path: '/user/tenant', label: '租户与套餐' },
      { path: '/user/operation-log', label: '操作记录' },
    ],
  },
  {
    key: 'related',
    label: '关联系统',
    icon: 'user',
    items: [
      { path: '/user/identity', label: '我的身份' },
      { path: '/user/realname', label: '实名认证' },
      { path: '/user/qualification', label: '资质证照' },
      { path: '/user/profile', label: '资料与安全' },
      { path: '/user/messages', label: '消息通知' },
      { path: '/user/boundary', label: '模块边界' },
    ],
  },
]

const router = useRouter()
const route = useRoute()
const session = useSessionStore()
const me = useMeStore()
const loggingOut = ref(false)

const userInfo = computed(() => session.user ?? { username: '', nickname: '', roles: [] })
const initial = computed(() => (userInfo.value.nickname || userInfo.value.username || '用').slice(0, 1))
const opsEntry = `${window.location.protocol}//${window.location.hostname}:8080/dashboard`

const ROLE_TEXT: Record<string, string> = { owner: '负责人', admin: '管理员', member: '成员', finance: '财务' }
const roleText = (code?: string) => ROLE_TEXT[code ?? ''] ?? code ?? '成员'
const VERIFY_TEXT: Record<string, string> = {
  approved: '已认证',
  verified: '已认证',
  pending: '认证中',
  rejected: '已驳回',
  unverified: '未认证',
}
const verifyText = (status?: string) => VERIFY_TEXT[status ?? ''] ?? status ?? '未认证'

function isActive(path: string) {
  return route.path === path
}

const currentItem = computed(() => {
  for (const group of menuGroups) {
    const hit = group.items.find((item) => item.path === route.path)
    if (hit) return { group: group.label, item: hit.label }
  }
  return { group: '企业端', item: '页面' }
})
const currentGroup = computed(() => currentItem.value.group)
const currentLabel = computed(() => currentItem.value.item)

async function handleLogout() {
  if (loggingOut.value) return
  loggingOut.value = true
  session.markForcedLogout()
  await revokePlatformSession()
  session.clear()
  window.location.assign(ssoLogoutUrl())
}

watch(
  () => route.path,
  () => {
    void me.refreshUnread()
  },
)

onMounted(() => {
  void me.load()
})
</script>

<style scoped>
.user-layout {
  display: flex;
  min-height: 100vh;
  background: var(--mds-bg, #f5f7fa);
}

.user-sidebar {
  width: 232px;
  flex: none;
  display: flex;
  flex-direction: column;
  position: fixed;
  inset: 0 auto 0 0;
  background: #062b1c;
  color: #fff;
  overflow: hidden;
}

.logo-section {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.logo-text h1 {
  margin: 0;
  font-size: 17px;
  font-weight: 800;
  letter-spacing: 0.3px;
}

.logo-text p {
  margin: 2px 0 0;
  font-size: var(--agri-font-size-micro);
  opacity: 0.55;
  letter-spacing: 2px;
}

.tenant-box {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
}

.tenant-label {
  display: block;
  font-size: var(--agri-font-size-micro);
  color: rgba(255, 255, 255, 0.45);
}

.tenant-box strong {
  display: block;
  margin: 4px 0 3px;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tenant-box small {
  display: block;
  font-size: var(--agri-font-size-micro);
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.5;
}

.user-nav {
  flex: 1;
  padding: 8px 8px 12px;
  overflow-y: auto;
}

.user-nav::-webkit-scrollbar {
  width: 6px;
}

.user-nav::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.18);
  border-radius: 3px;
}

.nav-group + .nav-group {
  margin-top: 4px;
}

.group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px 5px;
  color: rgba(255, 255, 255, 0.5);
  font-size: var(--agri-font-size-micro);
  font-weight: 600;
}

.group-icon {
  display: inline-flex;
  color: rgba(255, 255, 255, 0.4);
}

.user-nav ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.user-nav li a {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px 8px 34px;
  border-left: 3px solid transparent;
  color: rgba(255, 255, 255, 0.66);
  font-size: 12.5px;
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-nav li a:hover {
  background: rgba(19, 160, 90, 0.16);
  color: #fff;
}

.user-nav li.active a {
  border-left-color: #7fe0ae;
  background: rgba(19, 160, 90, 0.24);
  color: #fff;
  font-weight: 600;
}

.pending-mark {
  flex: none;
  padding: 0 4px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.55);
  font-size: var(--agri-font-size-micro);
  line-height: 15px;
}

.sidebar-foot {
  flex: none;
  padding: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.3);
  font-size: var(--agri-font-size-micro);
  text-align: center;
}

.user-main {
  flex: 1;
  min-width: 0;
  margin-left: 232px;
  display: flex;
  flex-direction: column;
}

.user-topbar {
  height: 60px;
  padding: 0 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: #fff;
  border-bottom: 1px solid #e3eae5;
  position: sticky;
  top: 0;
  z-index: 99;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #6b7c72;
  font-size: 13px;
  white-space: nowrap;
}

.breadcrumb b {
  color: #bac6be;
  font-weight: 400;
}

.breadcrumb strong {
  color: #0b1a12;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ops-link {
  padding: 5px 12px;
  border: 1px solid #e3eae5;
  border-radius: 999px;
  color: #12764a;
  font-size: 12px;
  text-decoration: none;
}

.ops-link:hover {
  background: #eef6f1;
}

.icon-btn {
  position: relative;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 8px;
  background: #f4f7f5;
  font-size: 15px;
  cursor: pointer;
}

.badge {
  position: absolute;
  top: 1px;
  right: 0;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: #c62828;
  color: #fff;
  font-size: var(--agri-font-size-micro);
  line-height: 16px;
  text-align: center;
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 8px;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #159a5e, #0ea5e9);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}

.user-chip strong {
  display: block;
  font-size: 12.5px;
  color: #33453b;
}

.user-chip small {
  display: block;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--agri-font-size-micro);
  color: #93a29a;
}

.logout-btn {
  height: 32px;
  padding: 0 12px;
  border: 1px solid #d1d5db;
  border-radius: 7px;
  background: #fff;
  color: #4b5563;
  font-size: 12.5px;
  cursor: pointer;
  white-space: nowrap;
}

.logout-btn:hover:not(:disabled) {
  border-color: #10b981;
  color: #047857;
  background: #ecfdf5;
}

.logout-btn:disabled {
  opacity: 0.55;
  cursor: wait;
}

.user-content {
  flex: 1;
  padding: 18px 22px 34px;
}

@media (max-width: 1024px) {
  .user-sidebar {
    width: 64px;
  }

  .logo-text,
  .tenant-box,
  .group-title,
  .pending-mark,
  .sidebar-foot {
    display: none;
  }

  .user-nav li a {
    padding: 10px 0;
    justify-content: center;
    font-size: 0;
  }

  .user-main {
    margin-left: 64px;
  }
}

@media (max-width: 760px) {
  .user-content {
    padding: 14px;
  }

  .user-chip div,
  .ops-link {
    display: none;
  }
}
</style>

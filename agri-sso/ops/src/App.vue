<template>
  <a-config-provider :locale="zhCN" :theme="theme">
    <UnifiedSsoGate
      client-id="user-center-ops"
      :landing-path="landingPath"
      :required-permissions="['uc:admin']"
    >
      <AppShell>
        <UserListPage v-if="app.page === 'user-list'" />
        <UserDetailPage v-else-if="app.page === 'user-detail'" :id="app.id ?? ''" />
        <IdentityPage v-else-if="app.page === 'user-identity'" />
        <AuditWorkbench v-else-if="app.page === 'audit-workbench'" />
        <IdentityAuditPage v-else-if="app.page === 'identity-audit'" />
        <RealnameAuditPage v-else-if="app.page === 'realname-audit'" />
        <QualificationAuditPage v-else-if="app.page === 'qualification-audit'" />
        <OrgListPage v-else-if="app.page === 'org-list'" />
        <OrgDetailPage v-else-if="app.page === 'org-detail'" :id="app.id ?? ''" />
        <OrgAuditPage v-else-if="app.page === 'org-audit'" />
        <RoleListPage v-else-if="app.page === 'role-list'" />
        <PermMatrixPage v-else-if="app.page === 'perm-matrix'" :code="app.query.get('code') ?? undefined" />
        <AuthAppPage v-else-if="app.page === 'auth-app'" />
        <AuthRecordPage v-else-if="app.page === 'auth-record'" />
        <MessagePushPage v-else-if="app.page === 'message-push'" />
        <MessageTemplatePage v-else-if="app.page === 'message-template'" />
        <SecurityRiskPage v-else-if="app.page === 'security-risk'" />
        <DeviceLogPage v-else-if="app.page === 'device-log'" />
        <AccountFreezePage v-else-if="app.page === 'account-freeze'" />
        <PrivacyRequestPage v-else-if="app.page === 'privacy-request'" />
        <FeedbackPage v-else-if="app.page === 'feedback-manage'" />
        <StatsPage v-else-if="app.page === 'stats'" />
        <HealthMonitorPage v-else-if="app.page === 'health-monitor'" />
        <ConfigPage v-else-if="app.page === 'config'" />
        <AuditLogPage v-else-if="app.page === 'audit-log'" />
        <DashboardPage v-else />
      </AppShell>
    </UnifiedSsoGate>
  </a-config-provider>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import { useAppStore } from './app-context'
import UnifiedSsoGate from './components/UnifiedSsoGate.vue'
import AppShell from './components/AppShell.vue'
import DashboardPage from './pages/DashboardPage.vue'
import UserListPage from './pages/UserListPage.vue'
import UserDetailPage from './pages/UserDetailPage.vue'
import IdentityPage from './pages/IdentityPage.vue'
import AuditWorkbench from './pages/AuditWorkbench.vue'
import IdentityAuditPage from './pages/IdentityAuditPage.vue'
import RealnameAuditPage from './pages/RealnameAuditPage.vue'
import QualificationAuditPage from './pages/QualificationAuditPage.vue'
import OrgListPage from './pages/OrgListPage.vue'
import OrgDetailPage from './pages/OrgDetailPage.vue'
import OrgAuditPage from './pages/OrgAuditPage.vue'
import RoleListPage from './pages/RoleListPage.vue'
import PermMatrixPage from './pages/PermMatrixPage.vue'
import AuthAppPage from './pages/AuthAppPage.vue'
import AuthRecordPage from './pages/AuthRecordPage.vue'
import MessagePushPage from './pages/MessagePushPage.vue'
import MessageTemplatePage from './pages/MessageTemplatePage.vue'
import SecurityRiskPage from './pages/SecurityRiskPage.vue'
import DeviceLogPage from './pages/DeviceLogPage.vue'
import AccountFreezePage from './pages/AccountFreezePage.vue'
import PrivacyRequestPage from './pages/PrivacyRequestPage.vue'
import FeedbackPage from './pages/FeedbackPage.vue'
import StatsPage from './pages/StatsPage.vue'
import HealthMonitorPage from './pages/HealthMonitorPage.vue'
import ConfigPage from './pages/ConfigPage.vue'
import AuditLogPage from './pages/AuditLogPage.vue'

const landingPath = window.location.port === '5200' ? '/user-center-ops/#/dashboard' : '/user-center-ops/#/dashboard'
const app = useAppStore()

function handleHashChange() {
  app.syncFromWindow()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => window.addEventListener('hashchange', handleHashChange))
onUnmounted(() => window.removeEventListener('hashchange', handleHashChange))

const theme = {
  token: {
    colorPrimary: '#2d8f4e',
    colorLink: '#2d8f4e',
    colorLinkHover: '#247a3f',
    colorSuccess: '#2d8f4e',
    colorWarning: '#d88718',
    colorError: '#c94b4b',
    colorText: '#0b1a12',
    colorTextSecondary: '#6b7c72',
    colorBorder: '#e1e9e3',
    colorBorderSecondary: '#edf2ee',
    colorBgLayout: '#f5f6fa',
    colorBgContainer: '#ffffff',
    borderRadius: 6,
    controlHeight: 36,
    fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
    boxShadowSecondary: '0 4px 16px rgba(0, 0, 0, .12)',
  },
  components: {
    Button: { borderRadius: 4, primaryShadow: 'none', fontWeight: 500 },
    Input: { activeBorderColor: '#2d8f4e', hoverBorderColor: '#247a3f' },
    Select: { optionSelectedBg: '#e8f5e9' },
    Modal: { borderRadiusLG: 12, titleFontSize: 20 },
    Table: { headerBg: '#fafafa', headerColor: '#595959', borderColor: '#f0f0f0', rowHoverBg: '#f0f9f1' },
  },
}
</script>

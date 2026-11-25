<template><a-config-provider :locale="zhCN" :theme="theme"><UnifiedSsoGate client-id="info-ops" :landing-path="landingPath" :required-permissions="['info:admin']"><AppShell><component :is="activeComponent" :key="app.page"/></AppShell></UnifiedSsoGate></a-config-provider></template><script setup lang="ts">
import {computed,onMounted,onBeforeUnmount} from 'vue';import zhCN from 'ant-design-vue/es/locale/zh_CN';import AppShell from './components/AppShell.vue';import UnifiedSsoGate from './components/UnifiedSsoGate.vue';import {useApp} from './app-context';import {GreenSupplyOpsPage} from './pages/GreenSupplyOpsPage'
import {CloudFactoriesPage} from './pages/CloudFactoriesPage'
import {DashboardPage} from './pages/DashboardPage'
import {ContentsPage} from './pages/ContentsPage'
import {ChannelsPage} from './pages/ChannelsPage'
import {CoursesPage} from './pages/CoursesPage'
import {QuotesPage} from './pages/QuotesPage'
import {SupplyDemandsPage} from './pages/SupplyDemandsPage'
import {RecommendPage} from './pages/RecommendPage'
import {AiPage} from './pages/AiPage'
import {ReportsPage} from './pages/ReportsPage'
import {ExpertsPage} from './pages/ExpertsPage'
import {AttestationsPage} from './pages/AttestationsPage'
import {StatsPage} from './pages/StatsPage'
import {AuditLogsPage} from './pages/AuditLogsPage'
const pages={'green-supply':GreenSupplyOpsPage,'cloud-factories':CloudFactoriesPage,'contents':ContentsPage,'channels':ChannelsPage,'courses':CoursesPage,'quotes':QuotesPage,'supply-demands':SupplyDemandsPage,'recommend':RecommendPage,'ai':AiPage,'reports':ReportsPage,'experts':ExpertsPage,'attestations':AttestationsPage,'stats':StatsPage,'audit-logs':AuditLogsPage};const app=useApp();const activeComponent=computed(()=>pages[app.page as keyof typeof pages]??DashboardPage);const landingPath=window.location.port==='5198'?'/#/dashboard':'/info-ops/#/dashboard';const theme={token: {
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
};onMounted(()=>window.addEventListener('hashchange',app.syncFromWindow));onBeforeUnmount(()=>window.removeEventListener('hashchange',app.syncFromWindow));</script>

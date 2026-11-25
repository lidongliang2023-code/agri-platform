<template><a-config-provider :locale="zhCN" :theme="theme"><UnifiedSsoGate client-id="info" :landing-path="landingPath" :required-permissions="['info:read']"><AppShell><component :is="activeComponent" :key="app.page"/></AppShell></UnifiedSsoGate></a-config-provider></template><script setup lang="ts">
import {computed,onMounted,onBeforeUnmount} from 'vue';import zhCN from 'ant-design-vue/es/locale/zh_CN';import AppShell from './components/AppShell.vue';import UnifiedSsoGate from './components/UnifiedSsoGate.vue';import {useApp} from './app-context';import {HomePage} from './pages/Home'
import {MarketPage} from './pages/MarketPage'
import {MarketDetailPage} from './pages/MarketDetailPage'
import {ComparePage} from './pages/ComparePage'
import {IndicesPage} from './pages/IndicesPage'
import {ForecastPage} from './pages/ForecastPage'
import {NewsPage} from './pages/NewsPage'
import {NewsDetailPage} from './pages/NewsDetailPage'
import {SearchPage} from './pages/SearchPage'
import {SupplyDemandPage} from './pages/SupplyDemandPage'
import {SupplyDemandDetailPage} from './pages/SupplyDemandDetailPage'
import {SupplyDemandPublishPage} from './pages/SupplyDemandPublishPage'
import {MatchPage} from './pages/MatchPage'
import {AiQaPage} from './pages/AiQaPage'
import {PestPage} from './pages/PestPage'
import {ExpertPage} from './pages/ExpertPage'
import {TrainingPage} from './pages/TrainingPage'
import {KnowledgePage} from './pages/KnowledgePage'
import {ReportsPage} from './pages/ReportsPage'
import {AttestPage} from './pages/AttestPage'
import {AlertsPage} from './pages/AlertsPage'
import {FavoritesPage} from './pages/FavoritesPage'
import {ExpertCertPage} from './pages/ExpertCertPage'
const pages={'market':MarketPage,'market-detail':MarketDetailPage,'compare':ComparePage,'indices':IndicesPage,'forecast':ForecastPage,'news':NewsPage,'news-detail':NewsDetailPage,'search':SearchPage,'sd':SupplyDemandPage,'sd-detail':SupplyDemandDetailPage,'sd-publish':SupplyDemandPublishPage,'sd-match':MatchPage,'ai-qa':AiQaPage,'pest':PestPage,'expert':ExpertPage,'training':TrainingPage,'knowledge':KnowledgePage,'reports':ReportsPage,'attest':AttestPage,'alerts':AlertsPage,'favorites':FavoritesPage,'expert-cert':ExpertCertPage};const app=useApp();const activeComponent=computed(()=>pages[app.page as keyof typeof pages]??HomePage);const landingPath=window.location.port==='5197'?'/#/home':'/info/#/home';const theme={token: {
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
          Button: {
            borderRadius: 4,
            primaryShadow: 'none',
            fontWeight: 500,
          },
          Input: {
            activeBorderColor: '#2d8f4e',
            hoverBorderColor: '#247a3f',
          },
          Select: {
            optionSelectedBg: '#e8f5e9',
          },
          Modal: {
            borderRadiusLG: 12,
            titleFontSize: 20,
          },
          Table: {
            headerBg: '#fafafa',
            headerColor: '#595959',
            borderColor: '#f0f0f0',
            rowHoverBg: '#f0f9f1',
          },
        },};onMounted(()=>window.addEventListener('hashchange',app.syncFromWindow));onBeforeUnmount(()=>window.removeEventListener('hashchange',app.syncFromWindow));</script>
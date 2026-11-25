<template><div class="app-shell" :class="{'sidebar-collapsed':collapsed}"><aside class="app-sidebar" :class="{'mobile-open':mobileOpen}"><button class="app-brand" @click="app.navigate('dashboard')"><img class="app-brand-mark" :src="base+'fengchain.svg'" alt="丰链云"/><span v-if="showCopy" class="app-brand-copy"><b>丰链云</b><small>FENGCHAIN · AGRI</small></span></button><div class="sidebar-groups"><section v-for="group in MENU" :key="group.title" class="sidebar-group"><button v-for="item in group.items" :key="item.key" :class="{on:app.page===item.key}" :title="collapsed?item.label:undefined" @click="app.navigate(item.key)"><span class="sidebar-icon"><component :is="item.icon"/></span><span v-if="showCopy">{{item.label}}</span><i v-if="showCopy && item.key==='contents' && pending>0">{{pending}}</i></button></section></div><SidebarUserCard :name="displayName" role="资讯运营" :collapsed="!showCopy" switch-label="切换身份（资讯用户端）" :switch-url="switchUrl" @logout="logoutUnified('info-ops')"/></aside><button v-if="mobileOpen" class="mobile-overlay" aria-label="关闭菜单" @click="mobileOpen=false"/><div class="app-main"><AgriVueTopHeader header-class="app-header" left-class="header-left" right-class="header-right" :collapsed="collapsed" :mobile="isMobile" :mobile-open="mobileOpen" :breadcrumbs="['信息资讯 · 运营端',activeLabel]" @toggle-collapse="toggle"><template #right><button class="header-link" @click="app.navigate('contents')">待审核 {{pending}}</button><button class="header-link" @click="app.navigate('audit-logs')">审计日志</button><a-dropdown placement="bottomRight"><button class="user-chip"><a-avatar :size="32" class="user-avatar">{{displayName.slice(0,1)}}</a-avatar><span><b>{{displayName}}</b><small>统一账号 · 信息资讯</small></span></button><template #overlay><a-menu><a-menu-item v-for="item in userMenu" :key="item.key" @click="app.navigate(item.key)">{{item.label}}</a-menu-item><a-menu-item key="logout" @click="logoutUnified('info-ops')">退出统一登录</a-menu-item></a-menu></template></a-dropdown></template></AgriVueTopHeader><AgriVueWorkspaceTabs :active-key="tabKey" :active-label="app.id===undefined?activeLabel:activeLabel+' · '+app.id" :active-path="app.hash.replace(/^#\/?/,'')" home-key="dashboard" :home-label="TITLES.dashboard" storage-key="agri-info-ops:workspace-tabs" @navigate="app.navigatePath"/><main class="app-content"><slot/></main><footer class="app-footer">© 2026 农业产业互联网平台 · 丰链云信息资讯运营端</footer></div></div></template>
<script setup lang="ts">
import {computed,ref,watch,onMounted,onBeforeUnmount,type Component} from 'vue'
import {
  AuditOutlined,
  BarChartOutlined,
  ClusterOutlined,
  DashboardOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  FundOutlined,
  NotificationOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SolutionOutlined,
  TeamOutlined,
  UserOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons-vue'
import type {OpsPageKey} from '../types'
import {useApp} from '../app-context'
import {opsApi,setOperator} from '../api'
import {ucSession,logoutUnified} from '../sso'
import SidebarUserCard from './SidebarUserCard.vue'
import {AgriVueTopHeader,AgriVueWorkspaceTabs} from '@agri/shared/vue/workspace'
type MenuItem={key:OpsPageKey;label:string;icon:Component};type MenuGroup={title:string;items:MenuItem[]}
const MENU: MenuGroup[] = [
  { title: '总览', items: [{ key: 'dashboard', label: '运营大盘', icon: DashboardOutlined }] },
  {
    title: '内容运营',
    items: [
      { key: 'green-supply', label: '绿色供应链', icon: ClusterOutlined },
      { key: 'cloud-factories', label: 'VR 云工厂', icon: VideoCameraOutlined },
      { key: 'contents', label: '内容审核', icon: FileTextOutlined },
      { key: 'courses', label: '培训课程', icon: VideoCameraOutlined },
      { key: 'channels', label: '栏目与作者', icon: ClusterOutlined },
      { key: 'recommend', label: '推荐与推送', icon: NotificationOutlined },
    ],
  },
  {
    title: '行情运营',
    items: [{ key: 'quotes', label: '行情与采集', icon: FundOutlined }],
  },
  {
    title: '交易信息',
    items: [{ key: 'supply-demands', label: '供需审核', icon: SolutionOutlined }],
  },
  {
    title: 'AI 与知识',
    items: [{ key: 'ai', label: 'AI 知识库', icon: RobotOutlined }],
  },
  {
    title: '服务与合规',
    items: [
      { key: 'reports', label: '报告审核', icon: BarChartOutlined },
      { key: 'experts', label: '专家审核', icon: TeamOutlined },
      { key: 'attestations', label: '存证管理', icon: SafetyCertificateOutlined },
    ],
  },
  {
    title: '数据与审计',
    items: [
      { key: 'stats', label: '统计报表', icon: FileProtectOutlined },
      { key: 'audit-logs', label: '操作审计', icon: AuditOutlined },
    ],
  },
]

const TITLES: Record<OpsPageKey, string> = {
  'green-supply': '绿色供应链',
  'cloud-factories': 'VR 云工厂',
  dashboard: '运营大盘',
  contents: '内容审核',
  courses: '培训课程',
  channels: '栏目与作者',
  quotes: '行情与采集',
  'supply-demands': '供需审核',
  recommend: '推荐与推送',
  ai: 'AI 知识库',
  reports: '报告审核',
  experts: '专家审核',
  attestations: '存证管理',
  stats: '统计报表',
  'audit-logs': '操作审计',
}


const app=useApp(),base=import.meta.env.BASE_URL,collapsed=ref(window.innerWidth<1280),isMobile=ref(window.innerWidth<1024),mobileOpen=ref(false),pending=ref(0),keyword=ref('')
const switchUrl=window.location.protocol+'//'+window.location.hostname+':8104/info/'
const displayName=computed(()=>ucSession.user?.nickname||ucSession.user?.username||'平台用户'),showCopy=computed(()=>!collapsed.value||mobileOpen.value),activeLabel=computed(()=>TITLES[app.page]),tabKey=computed(()=>app.id===undefined?app.page:app.page+'/'+app.id)
const userMenu: Array<{key:OpsPageKey;label:string}>=[{key:'stats',label:'统计报表'},{key:'audit-logs',label:'操作审计'}]
watch(displayName,n=>setOperator(n),{immediate:true})
watch(()=>app.page,()=>{mobileOpen.value=false;opsApi.dashboard().then(d=>pending.value=Number(d.cards.find(c=>c.label.includes('待审核'))?.value??0)).catch(()=>undefined)},{immediate:true})
function toggle(){if(isMobile.value)mobileOpen.value=!mobileOpen.value;else collapsed.value=!collapsed.value}
function resize(){isMobile.value=window.innerWidth<1024;if(!isMobile.value)mobileOpen.value=false}
onMounted(()=>window.addEventListener('resize',resize));onBeforeUnmount(()=>window.removeEventListener('resize',resize))
</script>
<template><div class="app-shell" :class="{'sidebar-collapsed':collapsed}"><aside class="app-sidebar" :class="{'mobile-open':mobileOpen}"><button class="app-brand" @click="app.navigate('home')"><img class="app-brand-mark" :src="base+'fengchain.svg'" alt="丰链云"/><span v-if="showCopy" class="app-brand-copy"><b>丰链云</b><small>FENGCHAIN · AGRI</small></span></button><div class="sidebar-groups"><section v-for="group in MENU" :key="group.title" class="sidebar-group"><button v-for="item in group.items" :key="item.key" :class="{on:app.page===item.key}" :title="collapsed?item.label:undefined" @click="app.navigate(item.key)"><span class="sidebar-icon"><component :is="item.icon"/></span><span v-if="showCopy">{{item.label}}</span><i v-if="showCopy && item.key==='alerts' && pending>0">{{pending}}</i></button></section></div><SidebarUserCard :name="displayName" role="信息资讯用户" :collapsed="!showCopy" switch-label="切换身份（资讯运营端）" :switch-url="switchUrl" @logout="logoutUnified('info')"/></aside><button v-if="mobileOpen" class="mobile-overlay" aria-label="关闭菜单" @click="mobileOpen=false"/><div class="app-main"><AgriVueTopHeader header-class="app-header" left-class="header-left" right-class="header-right" :collapsed="collapsed" :mobile="isMobile" :mobile-open="mobileOpen" :breadcrumbs="['信息资讯',activeLabel]" @toggle-collapse="toggle"><template #center><form class="global-search" @submit.prevent="app.openSearch(keyword.trim())"><SearchOutlined/><input v-model="keyword" placeholder="搜索品种行情、资讯、农技知识或供需信息" aria-label="搜索信息资讯"/><kbd>搜索</kbd></form></template><template #right><button class="header-link" @click="app.navigate('ai-qa')">✦ AI 问答</button><button class="header-icon" aria-label="预警消息" @click="app.navigate('alerts')"><a-badge :count="pending" size="small"><AlertOutlined/></a-badge></button><button class="header-icon" aria-label="我的收藏" @click="app.navigate('favorites')"><StarOutlined/></button><a-dropdown placement="bottomRight"><button class="user-chip"><a-avatar :size="32" class="user-avatar">{{displayName.slice(0,1)}}</a-avatar><span><b>{{displayName}}</b><small>统一账号 · 信息资讯</small></span></button><template #overlay><a-menu><a-menu-item v-for="item in userMenu" :key="item.key" @click="app.navigate(item.key)">{{item.label}}</a-menu-item><a-menu-item key="logout" @click="logoutUnified('info')">退出统一登录</a-menu-item></a-menu></template></a-dropdown></template></AgriVueTopHeader><AgriVueWorkspaceTabs :active-key="tabKey" :active-label="app.id===undefined?activeLabel:activeLabel+' · '+app.id" :active-path="app.hash.replace(/^#\/?/,'')" home-key="home" :home-label="TITLES.home" storage-key="agri-info:workspace-tabs" @navigate="app.navigatePath"/><main class="app-content"><slot/></main><footer class="app-footer">© 2026 农业产业互联网平台 · 丰链云信息资讯</footer></div></div></template>
<script setup lang="ts">
import {computed,ref,watch,onMounted,onBeforeUnmount,type Component} from 'vue'
import {
  AlertOutlined,
  BarChartOutlined,
  BookOutlined,
  CameraOutlined,
  CompassOutlined,
  CrownOutlined,
  DashboardOutlined,
  FileTextOutlined,
  FireOutlined,
  FundOutlined,
  LineChartOutlined,
  MessageOutlined,
  NotificationOutlined,
  RobotOutlined,
  SearchOutlined,
  StarOutlined,
  SwapOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  UserOutlined,
} from '@ant-design/icons-vue'
import type {PageKey} from '../types'
import {useApp} from '../app-context'
import {infoApi,setCurrentUser} from '../api'
import {ucSession,logoutUnified} from '../sso'
import SidebarUserCard from './SidebarUserCard.vue'
import {AgriVueTopHeader,AgriVueWorkspaceTabs} from '@agri/shared/vue/workspace'
type MenuItem={key:PageKey;label:string;icon:Component};type MenuGroup={title:string;items:MenuItem[]}
const MENU: MenuGroup[] = [
  { title: '工作台', items: [{ key: 'home', label: '资讯工作台', icon: DashboardOutlined }] },
  {
    title: '行情服务',
    items: [
      { key: 'market', label: '行情中心', icon: FundOutlined },
      { key: 'indices', label: '价格指数', icon: LineChartOutlined },
      { key: 'forecast', label: 'AI 供需预测', icon: ThunderboltOutlined },
      { key: 'compare', label: '多品种比价', icon: SwapOutlined },
    ],
  },
  {
    title: '资讯内容',
    items: [
      { key: 'news', label: '资讯频道', icon: FileTextOutlined },
      { key: 'search', label: '搜索与发现', icon: SearchOutlined },
    ],
  },
  {
    title: '供需大厅',
    items: [
      { key: 'sd', label: '供需信息大厅', icon: CompassOutlined },
      { key: 'sd-publish', label: '发布供需信息', icon: NotificationOutlined },
      { key: 'sd-match', label: 'AI 智能匹配', icon: FireOutlined },
    ],
  },
  {
    title: 'AI 农技',
    items: [
      { key: 'ai-qa', label: 'AI 问答助手', icon: RobotOutlined },
      { key: 'pest', label: '拍照识病虫', icon: CameraOutlined },
      { key: 'expert', label: '专家问答社区', icon: TeamOutlined },
    ],
  },
  {
    title: '学习培训',
    items: [
      { key: 'training', label: '培训学院', icon: BookOutlined },
      { key: 'knowledge', label: '农技知识库', icon: TrophyOutlined },
    ],
  },
  {
    title: '数据服务',
    items: [
      { key: 'reports', label: '数据报告', icon: BarChartOutlined },
      { key: 'attest', label: '内容存证', icon: CrownOutlined },
      { key: 'favorites', label: '我的收藏', icon: StarOutlined },
    ],
  },
  {
    title: '我的',
    items: [
      { key: 'alerts', label: '预警与订阅', icon: AlertOutlined },
      { key: 'expert-cert', label: '专家认证', icon: MessageOutlined },
    ],
  },
]

const TITLES: Record<PageKey, string> = {
  home: '资讯工作台',
  market: '行情中心',
  'market-detail': '品种行情详情',
  compare: '多品种比价',
  indices: '价格指数',
  forecast: 'AI 供需预测',
  news: '资讯频道',
  'news-detail': '资讯详情',
  search: '搜索与发现',
  sd: '供需信息大厅',
  'sd-detail': '供需信息详情',
  'sd-publish': '发布供需信息',
  'sd-match': 'AI 智能匹配',
  'ai-qa': 'AI 问答助手',
  pest: '拍照识病虫',
  expert: '专家问答社区',
  training: '培训学院',
  knowledge: '农技知识库',
  reports: '数据报告',
  attest: '内容存证',
  alerts: '预警与订阅',
  favorites: '我的收藏',
  'expert-cert': '专家认证',
}



const app=useApp(),base=import.meta.env.BASE_URL,collapsed=ref(window.innerWidth<1280),isMobile=ref(window.innerWidth<1024),mobileOpen=ref(false),pending=ref(0),keyword=ref('')
const switchUrl=window.location.protocol+'//'+window.location.hostname+':8113/info-ops/'
const displayName=computed(()=>ucSession.user?.nickname||ucSession.user?.username||'平台用户'),showCopy=computed(()=>!collapsed.value||mobileOpen.value),activeLabel=computed(()=>TITLES[app.page]),tabKey=computed(()=>app.id===undefined?app.page:app.page+'/'+app.id)
const userMenu: Array<{key:PageKey;label:string}>=[{key:'favorites',label:'我的收藏'},{key:'alerts',label:'预警与订阅'},{key:'expert-cert',label:'专家认证'}]
watch(displayName,n=>setCurrentUser(n),{immediate:true})
watch(()=>app.page,()=>{mobileOpen.value=false;infoApi.alertMessages().then(d=>pending.value=d.unread).catch(()=>undefined)},{immediate:true})
function toggle(){if(isMobile.value)mobileOpen.value=!mobileOpen.value;else collapsed.value=!collapsed.value}
function resize(){isMobile.value=window.innerWidth<1024;if(!isMobile.value)mobileOpen.value=false}
onMounted(()=>window.addEventListener('resize',resize));onBeforeUnmount(()=>window.removeEventListener('resize',resize))
</script>
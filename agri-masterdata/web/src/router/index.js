import { createRouter, createWebHistory } from 'vue-router'
import Login from '../views/Login.vue'
import Layout from '../components/Layout.vue'
import Dashboard from '../views/Dashboard.vue'
import TenantList from '../views/tenant/TenantList.vue'
import TenantDetail from '../views/tenant/TenantDetail.vue'
import TenantQuota from '../views/tenant/TenantQuota.vue'
import TenantPackage from '../views/tenant/TenantPackage.vue'
import TenantStatistics from '../views/tenant/TenantStatistics.vue'
import UserList from '../views/user/UserList.vue'
import UserDetail from '../views/user/UserDetail.vue'
import UserAudit from '../views/user/UserAudit.vue'

import OrgList from '../views/org/OrgList.vue'
import OrgDetail from '../views/org/OrgDetail.vue'
import RoleList from '../views/permission/RoleList.vue'
import PermissionLog from '../views/permission/PermissionLog.vue'
import DictList from '../views/datastandard/DictList.vue'
import CodeRuleList from '../views/datastandard/CodeRuleList.vue'
import QualityList from '../views/quality/QualityList.vue'
import QualityRule from '../views/quality/QualityRule.vue'
import QualityTask from '../views/quality/QualityTask.vue'
import QualityIssue from '../views/quality/QualityIssue.vue'
import QualityDashboard from '../views/quality/QualityDashboard.vue'
import DistributionList from '../views/distribution/DistributionList.vue'
import ProductList from '../views/product/ProductList.vue'
import CustomerList from '../views/customer/CustomerList.vue'
import SupplierList from '../views/customer/SupplierList.vue'
import SystemParams from '../views/system/SystemParams.vue'
import NotificationTemplate from '../views/system/NotificationTemplate.vue'
import Announcement from '../views/system/Announcement.vue'
import RegionList from '../views/system/RegionList.vue'
import UserLayout from '../components/UserLayout.vue'
import UserLogin from '../views/userportal/UserLogin.vue'
import UserHome from '../views/userportal/UserHome.vue'
import UserDataQuery from '../views/userportal/UserDataQuery.vue'
import UserReport from '../views/userportal/UserReport.vue'
import UserHelp from '../views/userportal/UserHelp.vue'
import UserProfile from '../views/userportal/UserProfile.vue'
import UserSettings from '../views/userportal/UserSettings.vue'

const routes = [
  { path: '/login', name: 'Login', component: Login },
  { path: '/user/login', name: 'UserLogin', component: UserLogin },
  {
    path: '/',
    name: 'Layout',
    component: Layout,
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', name: 'Dashboard', component: Dashboard },
      { path: 'tenant/list', name: 'TenantList', component: TenantList },
      { path: 'tenant/detail/:id', name: 'TenantDetail', component: TenantDetail },
      { path: 'tenant/quota', name: 'TenantQuota', component: TenantQuota },
      { path: 'tenant/package', name: 'TenantPackage', component: TenantPackage },
      { path: 'tenant/statistics', name: 'TenantStatistics', component: TenantStatistics },
      { path: 'user/list', name: 'UserList', component: UserList },
      { path: 'user/detail/:id', name: 'UserDetail', component: UserDetail },
      { path: 'user/audit', name: 'UserAudit', component: UserAudit },
      { path: 'org/list', name: 'OrgList', component: OrgList },
      { path: 'org/detail/:id', name: 'OrgDetail', component: OrgDetail },
      { path: 'permission/role', name: 'RoleList', component: RoleList },
      { path: 'permission/log', name: 'PermissionLog', component: PermissionLog },
      { path: 'datastandard/dict', name: 'DictList', component: DictList },
      { path: 'datastandard/code-rule', name: 'CodeRuleList', component: CodeRuleList },
      { path: 'quality/list', name: 'QualityList', component: QualityList },
      { path: 'quality/rule', name: 'QualityRule', component: QualityRule },
      { path: 'quality/task', name: 'QualityTask', component: QualityTask },
      { path: 'quality/issue', name: 'QualityIssue', component: QualityIssue },
      { path: 'quality/dashboard', name: 'QualityDashboard', component: QualityDashboard },
      { path: 'distribution/list', name: 'DistributionList', component: DistributionList },
      { path: 'product/list', name: 'ProductList', component: ProductList },
      { path: 'customer/list', name: 'CustomerList', component: CustomerList },
      { path: 'supplier/list', name: 'SupplierList', component: SupplierList },
      { path: 'system/params', name: 'SystemParams', component: SystemParams },
      { path: 'system/template', name: 'NotificationTemplate', component: NotificationTemplate },
      { path: 'system/announcement', name: 'Announcement', component: Announcement },
      { path: 'system/region', name: 'RegionList', component: RegionList }
        ]
      },
  {
    path: '/user',
    name: 'UserLayout',
    component: UserLayout,
    redirect: '/user/home',
    children: [
      { path: 'home', name: 'UserHome', component: UserHome },
      { path: 'data', name: 'UserDataQuery', component: UserDataQuery },
      { path: 'report', name: 'UserReport', component: UserReport },
      { path: 'help', name: 'UserHelp', component: UserHelp },
      { path: 'profile', name: 'UserProfile', component: UserProfile },
      { path: 'settings', name: 'UserSettings', component: UserSettings }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  const userType = localStorage.getItem('userType')
  
  console.log('Router guard - to.path:', to.path)
  console.log('Router guard - token exists:', !!token)
  console.log('Router guard - userType:', userType)
  
  if (to.path === '/user/login') {
    if (token && userType === 'user') {
      next('/user/home')
    } else {
      next()
    }
  } else if (to.path === '/login') {
    if (token && userType !== 'user') {
      next('/dashboard')
    } else {
      next()
    }
  } else if (to.path.startsWith('/user/')) {
    if (!token) {
      next('/user/login')
    } else {
      next()
    }
  } else {
    if (to.path !== '/login' && !token) {
      next('/login')
    } else {
      next()
    }
  }
})

export default router

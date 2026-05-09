import { createRouter, createWebHistory } from 'vue-router'
import Login from '../views/Login.vue'
import Layout from '../components/Layout.vue'
import Dashboard from '../views/Dashboard.vue'
import TenantList from '../views/tenant/TenantList.vue'
import TenantDetail from '../views/tenant/TenantDetail.vue'
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
import DistributionList from '../views/distribution/DistributionList.vue'
import ProductList from '../views/product/ProductList.vue'
import CustomerList from '../views/customer/CustomerList.vue'
import SupplierList from '../views/customer/SupplierList.vue'

const routes = [
  { path: '/login', name: 'Login', component: Login },
  {
    path: '/',
    name: 'Layout',
    component: Layout,
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', name: 'Dashboard', component: Dashboard },
      { path: 'tenant/list', name: 'TenantList', component: TenantList },
      { path: 'tenant/detail/:id', name: 'TenantDetail', component: TenantDetail },
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
      { path: 'distribution/list', name: 'DistributionList', component: DistributionList },
      { path: 'product/list', name: 'ProductList', component: ProductList },
      { path: 'customer/list', name: 'CustomerList', component: CustomerList },
      { path: 'supplier/list', name: 'SupplierList', component: SupplierList }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  if (to.path !== '/login' && !token) {
    console.log('No token found, redirecting to login')
    next('/login')
  } else {
    next()
  }
})

export default router

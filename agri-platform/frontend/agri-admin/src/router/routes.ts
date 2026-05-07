import { Routes } from '@/types/routes';

export const systemRoutes: Routes = [
  {
    path: '/system',
    name: 'SystemManagement',
    icon: 'SettingOutlined',
    children: [
      {
        path: '/system/user',
        name: 'UserManagement',
        component: () => import('@/pages/system/user'),
        meta: { title: '用户管理', permission: 'system:user:list' },
      },
      {
        path: '/system/role',
        name: 'RoleManagement',
        component: () => import('@/pages/system/role'),
        meta: { title: '角色管理', permission: 'system:role:list' },
      },
      {
        path: '/system/menu',
        name: 'MenuManagement',
        component: () => import('@/pages/system/menu'),
        meta: { title: '菜单管理', permission: 'system:menu:list' },
      },
      {
        path: '/system/organization',
        name: 'OrganizationManagement',
        component: () => import('@/pages/system/organization'),
        meta: { title: '组织管理', permission: 'system:org:list' },
      },
    ],
  },
];

export const productRoutes: Routes = [
  {
    path: '/product',
    name: 'ProductManagement',
    icon: 'AppstoreOutlined',
    children: [
      {
        path: '/product/list',
        name: 'ProductList',
        component: () => import('@/pages/product/product-list'),
        meta: { title: '商品列表', permission: 'product:list' },
      },
      {
        path: '/product/category',
        name: 'ProductCategory',
        component: () => import('@/pages/product/category'),
        meta: { title: '商品分类', permission: 'product:category:list' },
      },
    ],
  },
];

export const customerRoutes: Routes = [
  {
    path: '/customer',
    name: 'CustomerManagement',
    icon: 'TeamOutlined',
    children: [
      {
        path: '/customer/list',
        name: 'CustomerList',
        component: () => import('@/pages/customer/list'),
        meta: { title: '客户列表', permission: 'customer:list' },
      },
    ],
  },
];

export const supplierRoutes: Routes = [
  {
    path: '/supplier',
    name: 'SupplierManagement',
    icon: 'ShopOutlined',
    children: [
      {
        path: '/supplier/list',
        name: 'SupplierList',
        component: () => import('@/pages/supplier/list'),
        meta: { title: '供应商列表', permission: 'supplier:list' },
      },
    ],
  },
];

export const dictRoutes: Routes = [
  {
    path: '/dict',
    name: 'DictManagement',
    icon: 'BookOutlined',
    children: [
      {
        path: '/dict/list',
        name: 'DictList',
        component: () => import('@/pages/dictionary/list'),
        meta: { title: '字典管理', permission: 'dict:list' },
      },
    ],
  },
];

export const dashboardRoutes: Routes = [
  {
    path: '/dashboard',
    name: 'Dashboard',
    icon: 'HomeOutlined',
    children: [
      {
        path: '/dashboard/index',
        name: 'DashboardIndex',
        component: () => import('@/pages/dashboard'),
        meta: { title: '工作台', hidden: false },
      },
    ],
  },
];

export const allRoutes: Routes = [
  ...dashboardRoutes,
  ...systemRoutes,
  ...productRoutes,
  ...customerRoutes,
  ...supplierRoutes,
  ...dictRoutes,
];

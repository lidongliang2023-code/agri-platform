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

export const iotRoutes: Routes = [
  {
    path: '/iot',
    name: 'IoTManagement',
    icon: 'DashboardOutlined',
    children: [
      {
        path: '/iot/device',
        name: 'DeviceManagement',
        component: () => import('@/pages/iot/device'),
        meta: { title: '设备管理', permission: 'iot:device:list' },
      },
      {
        path: '/iot/device-type',
        name: 'DeviceTypeManagement',
        component: () => import('@/pages/iot/device-type'),
        meta: { title: '设备类型', permission: 'iot:device:type:list' },
      },
      {
        path: '/iot/data',
        name: 'DataMonitor',
        component: () => import('@/pages/iot/data'),
        meta: { title: '数据监测', permission: 'iot:data:list' },
      },
      {
        path: '/iot/alert',
        name: 'AlertManagement',
        component: () => import('@/pages/iot/alert'),
        meta: { title: '预警管理', permission: 'iot:alert:list' },
      },
      {
        path: '/iot/control',
        name: 'ControlManagement',
        component: () => import('@/pages/iot/control'),
        meta: { title: '远程控制', permission: 'iot:control:list' },
      },
      {
        path: '/iot/scene',
        name: 'SceneManagement',
        component: () => import('@/pages/iot/scene'),
        meta: { title: '场景模式', permission: 'iot:scene:list' },
      },
      {
        path: '/iot/automation',
        name: 'AutomationManagement',
        component: () => import('@/pages/iot/automation'),
        meta: { title: '自动化规则', permission: 'iot:automation:list' },
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
  ...iotRoutes,
  ...productRoutes,
  ...customerRoutes,
  ...supplierRoutes,
  ...dictRoutes,
];

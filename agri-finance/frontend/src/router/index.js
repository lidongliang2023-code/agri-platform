import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/borrower/home' },
  
  {
    path: '/borrower',
    component: () => import('../layout/BorrowerLayout.vue'),
    children: [
      { path: '', redirect: '/borrower/home' },
      {
        path: 'home',
        component: () => import('../views/borrower/Home.vue'),
        meta: { title: '融资工作台', eyebrow: '工作台概览' },
      },
      {
        path: 'products',
        component: () => import('../views/borrower/LoanProducts.vue'),
        meta: { title: '融资产品', eyebrow: '产品中心' },
      },
      {
        path: 'credit',
        component: () => import('../views/borrower/CreditCenter.vue'),
        meta: { title: '信用中心', eyebrow: '信用评估' },
      },
      {
        path: 'loan-apply',
        component: () => import('../views/borrower/LoanApply.vue'),
        meta: { title: '发起融资申请', eyebrow: '融资申请' },
      },
      {
        path: 'loan-management',
        component: () => import('../views/borrower/LoanManagement.vue'),
        meta: { title: '我的借款', eyebrow: '借款管理' },
      },
      {
        path: 'pledge',
        component: () => import('../views/borrower/PledgeManagement.vue'),
        meta: { title: '仓单与质押', eyebrow: '质押管理' },
      },
      {
        path: 'repayment',
        component: () => import('../views/borrower/RepaymentCenter.vue'),
        meta: { title: '还款中心', eyebrow: '还款管理' },
      },
      {
        path: 'contracts',
        component: () => import('../views/borrower/Contracts.vue'),
        meta: { title: '融资合同', eyebrow: '合同管理' },
      },
      {
        path: 'message',
        component: () => import('../views/borrower/MessageNotification.vue'),
        meta: { title: '消息通知', eyebrow: '业务消息' },
      },
    ],
  },

  // 旧版产品详情入口统一回到新的融资产品中心。
  { path: '/borrower/credit-report', redirect: '/borrower/credit' },
  { path: '/borrower/credit-profile', redirect: '/borrower/credit' },
  { path: '/borrower/loan-product-buy', redirect: '/borrower/products' },
  { path: '/borrower/loan-product-sell', redirect: '/borrower/products' },
  { path: '/borrower/loan-product-machine', redirect: '/borrower/products' },
  { path: '/borrower/loan-product-data', redirect: '/borrower/products' },
  
  {
    path: '/fund',
    component: () => import('../layout/OperationsLayout.vue'),
    children: [
      { path: '', redirect: '/fund/workbench' },
      { path: 'workbench', component: () => import('../views/fund/Workbench.vue'), meta: { title: '资金工作台' } },
      { path: 'asset-market', component: () => import('../views/fund/AssetMarket.vue'), meta: { title: '资产市场' } },
      { path: 'approval', component: () => import('../views/fund/ApprovalManagement.vue'), meta: { title: '审批管理' } },
      { path: 'my-investment', component: () => import('../views/fund/MyInvestment.vue'), meta: { title: '我的投资' } },
      { path: 'product-config', component: () => import('../views/fund/ProductConfig.vue'), meta: { title: '产品配置' } },
      { path: 'risk-strategy', component: () => import('../views/fund/RiskStrategy.vue'), meta: { title: '风控策略' } },
      { path: 'report', component: () => import('../views/shared/OpsReport.vue'), meta: { title: '数据报表' } },
    ],
  },
  { path: '/fund/asset-detail', redirect: '/fund/asset-market' },
  
  {
    path: '/admin',
    component: () => import('../layout/OperationsLayout.vue'),
    children: [
      { path: '', redirect: '/admin/workbench' },
      { path: 'workbench', component: () => import('../views/admin/Workbench.vue'), meta: { title: '运营工作台' } },
      { path: 'approval', component: () => import('../views/fund/ApprovalManagement.vue'), meta: { title: '借款审批' } },
      { path: 'overdue', component: () => import('../views/admin/OverdueManagement.vue'), meta: { title: '逾期管理' } },
      { path: 'credit-management', component: () => import('../views/admin/CreditManagement.vue'), meta: { title: '信用查询' } },
      { path: 'pledge', component: () => import('../views/admin/PledgeManagement.vue'), meta: { title: '质押与仓单' } },
      { path: 'blacklist', component: () => import('../views/admin/BlacklistManagement.vue'), meta: { title: '黑名单管理' } },
      { path: 'risk', component: () => import('../views/fund/RiskStrategy.vue'), meta: { title: '风险规则' } },
      { path: 'report', component: () => import('../views/shared/OpsReport.vue'), meta: { title: '报表中心' } },
    ],
  },
  { path: '/admin/data-overview', redirect: '/admin/workbench' },
  { path: '/admin/approval-detail', redirect: '/admin/approval' },
  { path: '/admin/message-center', redirect: '/admin/workbench' },
  { path: '/admin/data-monitor', redirect: '/admin/workbench' },
  { path: '/admin/warrant', redirect: '/admin/pledge' },
  { path: '/admin/post-loan', redirect: '/admin/workbench' }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router

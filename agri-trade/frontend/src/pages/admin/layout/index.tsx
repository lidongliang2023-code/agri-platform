import { useEffect, useState } from 'react'
import { Button, ConfigProvider, Layout, Menu, Result, Spin } from 'antd'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { getMyPermissions, hasPermission, type MyPermission } from '@/api/permission'
import { BrandMark } from '@/components/BrandMark'
import {
  AppstoreOutlined, AuditOutlined, FileSearchOutlined, SwapOutlined, TeamOutlined, RollbackOutlined,
  SafetyCertificateOutlined, ApartmentOutlined, AccountBookOutlined, SafetyOutlined, AppstoreAddOutlined,
  SettingOutlined, AlertOutlined, BarChartOutlined, BankOutlined, FileTextOutlined,
  CarOutlined
} from '@ant-design/icons'
import './admin-layout.css'

const { Sider, Header, Content } = Layout

const MENU_LABELS: Record<string, string> = {
  '/admin/trade/dashboard': '交易大盘',
  '/admin/trade/product': '货源审核',
  '/admin/trade/refund': '退款审核',
  '/admin/trade/order': '订单监管',
  '/admin/trade/settlement': '结算与分账',
  '/admin/trade/dispute': '纠纷仲裁',
  '/admin/trade/credit': '信用管理',
  '/admin/trade/compensation': '赔付执行',
  '/admin/trade/bindings': '用户-主体绑定',
  '/admin/trade/config': '系统配置',
  '/admin/trade/risk': '风控管理',
  '/admin/trade/report': '报表',
  '/admin/trade/guarantee': '保证金管理',
  '/admin/trade/contract-template': '合同模板',
  '/admin/trade/carrier': '承运商管理'
}

const adminTheme = {
  token: {
    colorPrimary: '#12764a',
    colorLink: '#0e5233',
    colorSuccess: '#159a5e',
    colorBgLayout: '#f4f7f5',
    borderRadius: 10
  },
  components: {
    Menu: {
      darkItemBg: '#0a3a25',
      darkSubMenuItemBg: '#06281a',
      darkItemSelectedBg: '#12764a',
      darkItemColor: 'rgba(255,255,255,.76)',
      darkItemHoverBg: 'rgba(255,255,255,.08)',
      darkItemSelectedColor: '#fff'
    },
    Card: {
      borderRadiusLG: 12
    },
    Table: {
      headerBg: '#f4f7f5',
      headerColor: '#4b5d53',
      rowHoverBg: '#f1fbf5'
    }
  }
}

/**
 * 运营端布局。
 *
 * <p>与用户端共用同一个应用、同一次 SSO 登录（平台是统一认证，运营端不必再登录一次），
 * 但**菜单与页面集合完全分开**：运营端管全平台数据，用户端只能看自己的。</p>
 */
export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  /**
   * 运营端入口守卫。
   *
   * <p>服务端已经按 RBAC 拦住 /api/trade/admin/** 与所有 @OperatorOnly 接口，
   * 这里只是不让人进来对着一屏 403 发懵 —— 没权限就直接说清楚。
   * 解析失败（认证中心不可达）时按"无权限"处理，与服务端 fail-closed 一致。</p>
   */
  const [perm, setPerm] = useState<MyPermission | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyPermissions()
      .then((res: { code: number; data?: MyPermission }) => setPerm(res?.code === 0 ? res.data ?? null : null))
      .catch(() => setPerm(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <ConfigProvider theme={adminTheme}>
        <div className="admin-loading"><Spin /></div>
      </ConfigProvider>
    )
  }

  if (!hasPermission(perm ?? undefined, 'trade:read')) {
    return (
      <ConfigProvider theme={adminTheme}>
        <div className="admin-shell">
          <Result
            status="403"
            title="无权访问运营端"
            subTitle="运营端需要平台运营权限（trade:read）。当前账号没有该权限，请用运营账号登录，或联系平台运营开通。"
            extra={
              <Button type="primary" onClick={() => navigate('/')}>
                返回用户端
              </Button>
            }
          />
        </div>
      </ConfigProvider>
    )
  }

  return (
    <ConfigProvider theme={adminTheme}>
    <Layout className="admin-shell">
      <Sider width={224} className="admin-side">
        <div className="admin-brand">
          <span className="admin-brand-logo"><BrandMark size={34} /></span>
          <span className="admin-brand-text">丰链云<small>OPS CENTER</small></span>
        </div>
        <div className="admin-side-title">平台运营中心</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={['audit-center']}
          className="admin-menu"
          onClick={({ key }) => {
            if (key === 'external-catalog') {
              window.location.href = `${window.location.protocol}//${window.location.hostname}:8080/product/catalog`
              return
            }
            navigate(key)
          }}
          items={[
            { key: '/admin/trade/dashboard', icon: <AppstoreOutlined />, label: '交易大盘' },
            {
              key: 'audit-center',
              icon: <AuditOutlined />,
              label: '审核中心',
              children: [
                { key: '/admin/trade/product', icon: <AuditOutlined />, label: '货源审核' },
                { key: '/admin/trade/refund', icon: <RollbackOutlined />, label: '退款审核' },
              ],
            },
            { key: '/admin/trade/order', icon: <FileSearchOutlined />, label: '订单监管' },
            { key: '/admin/trade/settlement', icon: <AccountBookOutlined />, label: '结算与分账' },
            { key: 'external-catalog', icon: <AppstoreAddOutlined />, label: '商品与分类（主数据）' },
            { key: '/admin/trade/dispute', icon: <TeamOutlined />, label: '纠纷仲裁' },
            { key: '/admin/trade/credit', icon: <SafetyOutlined />, label: '信用管理' },
            { key: '/admin/trade/compensation', icon: <SafetyCertificateOutlined />, label: '赔付执行' },
            // 平台级功能：数据与接口都归 core-platform（不在交易库里），
            // 它决定"谁能看到哪些数据"，所以单独放在交易监管各项之后。
            // 将来若有独立的平台管理端，这一项整体迁过去即可。
            { key: '/admin/trade/bindings', icon: <ApartmentOutlined />, label: '用户-主体绑定' },
            { key: '/admin/trade/config', icon: <SettingOutlined />, label: '系统配置' },
            { key: '/admin/trade/risk', icon: <AlertOutlined />, label: '风控管理' },
            { key: '/admin/trade/report', icon: <BarChartOutlined />, label: '报表' },
            { key: '/admin/trade/guarantee', icon: <BankOutlined />, label: '保证金管理' },
            { key: '/admin/trade/contract-template', icon: <FileTextOutlined />, label: '合同模板' },
            { key: '/admin/trade/carrier', icon: <CarOutlined />, label: '承运商管理' }
          ]}
        />
        <div className="admin-side-foot">平台运营 · 审核与交易监管</div>
      </Sider>
      <Layout>
        <Header className="admin-header">
          <div className="admin-crumb">
            <span>平台运营中心</span><b>/</b><strong>{MENU_LABELS[location.pathname] ?? '运营中心'}</strong>
          </div>
          <div className="admin-header-right">
            <div className="admin-role-switch">
              <span className="on">运营中心</span>
              <a onClick={() => navigate('/')}><SwapOutlined /> 用户端</a>
            </div>
            <span className="admin-avatar">运</span>
            <span className="admin-user">平台运营</span>
          </div>
        </Header>
        <Content className="admin-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
    </ConfigProvider>
  )
}

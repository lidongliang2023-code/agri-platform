import { useEffect, useState } from 'react'
import { Button, Layout, Menu, Result, Spin, Typography } from 'antd'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { getMyPermissions, hasPermission, type MyPermission } from '@/api/permission'
import {
  AppstoreOutlined, AuditOutlined, FileSearchOutlined, SwapOutlined, TeamOutlined, RollbackOutlined,
  SafetyCertificateOutlined, ApartmentOutlined, AccountBookOutlined, SafetyOutlined, AppstoreAddOutlined,
  IdcardOutlined, SettingOutlined, AlertOutlined, BarChartOutlined, BankOutlined, FileTextOutlined,
  CarOutlined
} from '@ant-design/icons'

const { Sider, Header, Content } = Layout

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
      <div style={{ padding: 80, textAlign: 'center' }}>
        <Spin />
      </div>
    )
  }

  if (!hasPermission(perm ?? undefined, 'trade:read')) {
    return (
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
    )
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={200} style={{ background: '#0f2547' }}>
        <div style={{ padding: '20px 16px', color: '#fff' }}>
          <Typography.Text style={{ color: '#fff', fontWeight: 600 }}>交易监管后台</Typography.Text>
          <div style={{ color: '#7f9cc4', fontSize: 12, marginTop: 4 }}>农业产业互联网平台</div>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          style={{ background: '#0f2547' }}
          onClick={({ key }) => navigate(key)}
          items={[
            { key: '/admin/trade/dashboard', icon: <AppstoreOutlined />, label: '交易大盘' },
            { key: '/admin/trade/product', icon: <AuditOutlined />, label: '货源审核' },
            { key: '/admin/trade/order', icon: <FileSearchOutlined />, label: '订单监管' },
            { key: '/admin/trade/settlement', icon: <AccountBookOutlined />, label: '结算与分账' },
            { key: '/admin/trade/catalog', icon: <AppstoreAddOutlined />, label: '商品与品类' },
            { key: '/admin/trade/dispute', icon: <TeamOutlined />, label: '纠纷仲裁' },
            { key: '/admin/trade/refund', icon: <RollbackOutlined />, label: '退款审核' },
            { key: '/admin/trade/credit', icon: <SafetyOutlined />, label: '信用管理' },
            { key: '/admin/trade/compensation', icon: <SafetyCertificateOutlined />, label: '赔付执行' },
            // 平台级功能：数据与接口都归 core-platform（不在交易库里），
            // 它决定"谁能看到哪些数据"，所以单独放在交易监管各项之后。
            // 将来若有独立的平台管理端，这一项整体迁过去即可。
            { key: '/admin/trade/bindings', icon: <ApartmentOutlined />, label: '用户-主体绑定' },
            { key: '/admin/trade/certification-review', icon: <IdcardOutlined />, label: '认证审核' },
            { key: '/admin/trade/config', icon: <SettingOutlined />, label: '系统配置' },
            { key: '/admin/trade/risk', icon: <AlertOutlined />, label: '风控管理' },
            { key: '/admin/trade/report', icon: <BarChartOutlined />, label: '报表' },
            { key: '/admin/trade/guarantee', icon: <BankOutlined />, label: '保证金管理' },
            { key: '/admin/trade/contract-template', icon: <FileTextOutlined />, label: '合同模板' },
            { key: '/admin/trade/carrier', icon: <CarOutlined />, label: '承运商管理' }
          ]}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingInline: 24
          }}
        >
          <Typography.Text strong>交易撮合 · 运营端</Typography.Text>
          <a onClick={() => navigate('/')}>
            <SwapOutlined /> 切到用户端
          </a>
        </Header>
        <Content style={{ background: '#f5f7fa' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

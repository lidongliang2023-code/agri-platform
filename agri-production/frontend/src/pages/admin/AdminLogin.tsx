/**
 * 运营端登录页（独立）
 *
 * 路由：`/admin/login`
 *
 * 依据 V2.0 第 2.3 节 D1「九大子系统独立应用、独立登录页」：先按端拆出独立登录页，
 * 原 `/login` 保留为「按端分流」入口（见 router/index.tsx）。
 *
 * 设计边界（沿用原登录页的既定纪律）：
 *   - 独立全屏页，不挂 UserLayout / AdminLayout，不进业务分组与页面条数统计；
 *   - 快捷入口只**填入表单**，不伪造登录：提交仍真实调用 `POST /api/v1/auth/login`，以服务端令牌为准；
 *   - 登录逻辑复用 `@/api/auth` 的 login / persistSession / resolveHomePath，本页不复制逻辑。
 */
import { useEffect, useMemo, useState } from 'react'
import { App, Button, Card, Form, Input, InputNumber, Space, Typography } from 'antd'
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '@/store/auth'
import {
  ADMIN_HOME_PATH,
  ADMIN_LOGIN_PATH,
  login as loginApi,
  persistSession,
  resolveHomePath,
} from '@/api/auth'

/** 登录表单字段 */
interface LoginFormValues {
  /** 用户名 */
  username: string
  /** 密码 */
  password: string
  /** 市场 ID */
  marketId: number
}

/** 快捷测试账号（本地联调用；真实账号，非 mock） */
interface QuickAccount {
  /** 唯一键 */
  key: string
  /** 展示名 */
  title: string
  /** 账号说明 */
  desc: string
  /** 用户名 */
  username: string
  /** 密码 */
  password: string
  /** 市场 ID */
  marketId: number
}

/** 运营端只保留运营账号一个快捷入口（用户端账号请走 /production/login） */
const QUICK_ACCOUNTS: QuickAccount[] = [
  {
    key: 'ops',
    title: '运营端管理员',
    desc: 'admin / Admin@123',
    username: 'admin',
    password: 'Admin@123',
    marketId: 1,
  },
]

/**
 * 运营端登录页
 *
 * @returns 登录页组件
 */
export default function AdminLogin(): JSX.Element {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [form] = Form.useForm<LoginFormValues>()
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [errorText, setErrorText] = useState<string>('')

  const token = useAuthStore((state) => state.token)
  const roles = useAuthStore((state) => state.roles)

  /** 已登录时的落地页 */
  const homePath = useMemo(() => resolveHomePath(roles), [roles])

  // 已登录：直接放行，避免停留在登录页
  useEffect(() => {
    if (token) {
      navigate(homePath || ADMIN_HOME_PATH, { replace: true })
    }
  }, [token, homePath, navigate])

  /**
   * 一键填入测试账号（只填表单，不发起登录）。
   *
   * @param account 快捷账号
   */
  const fillAccount = (account: QuickAccount): void => {
    form.setFieldsValue({
      username: account.username,
      password: account.password,
      marketId: account.marketId,
    })
    setErrorText('')
  }

  /**
   * 提交登录：真实调用后端认证接口，以服务端返回为准。
   *
   * @param values 表单值
   */
  const handleSubmit = async (values: LoginFormValues): Promise<void> => {
    setSubmitting(true)
    setErrorText('')
    try {
      const result = await loginApi({
        username: values.username.trim(),
        password: values.password,
        marketId: values.marketId,
      })
      persistSession(result, values.marketId)
      const target = resolveHomePath(result.user?.roles ?? [])
      const nickname = result.user?.nickname || result.user?.username || ''
      message.success(`登录成功，欢迎${nickname ? ` ${nickname}` : ''}`)
      navigate(target || ADMIN_HOME_PATH, { replace: true })
    } catch (error: unknown) {
      setErrorText(error instanceof Error ? error.message : '登录失败，请检查账号与密码')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'linear-gradient(135deg, #e8f0fb 0%, #f5f7fa 55%, #eaf6ee 100%)',
      }}
    >
      <Card
        style={{ width: 420, maxWidth: '100%', boxShadow: '0 8px 32px rgba(22,119,255,0.14)' }}
        styles={{ body: { padding: 32 } }}
      >
        <Space direction="vertical" size={4} style={{ width: '100%', marginBottom: 20 }}>
          <Typography.Title level={3} style={{ margin: 0 }}>
            农业生产运营管理平台
          </Typography.Title>
          <Typography.Text type="secondary">平台运营人员入口</Typography.Text>
        </Space>

        <Space direction="vertical" size={8} style={{ width: '100%', marginBottom: 16 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            联调快捷入口（一键填入，提交后仍走真实认证接口）
          </Typography.Text>
          {QUICK_ACCOUNTS.map((account) => (
            <Button key={account.key} block onClick={() => fillAccount(account)}>
              {account.title} · {account.desc}
            </Button>
          ))}
        </Space>

        <Form
          form={form}
          layout="vertical"
          initialValues={{ marketId: 1 }}
          onFinish={(values) => {
            void handleSubmit(values)
          }}
        >
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="请输入用户名" autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" autoComplete="current-password" />
          </Form.Item>
          <Form.Item name="marketId" label="市场 ID" rules={[{ required: true, message: '请输入市场 ID' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          {errorText ? (
            <Typography.Text type="danger" style={{ display: 'block', marginBottom: 12 }}>
              {errorText}
            </Typography.Text>
          ) : null}
          <Button type="primary" htmlType="submit" block loading={submitting}>
            登 录
          </Button>
        </Form>

        <Typography.Text type="secondary" style={{ display: 'block', marginTop: 12, fontSize: 12 }}>
          这是运营端独立登录页（{ADMIN_LOGIN_PATH}）；农场主 / 农技员请从用户端入口登录。
        </Typography.Text>
      </Card>
    </div>
  )
}

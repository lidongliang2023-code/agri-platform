/**
 * 登录页
 *
 * 路由：`/login`
 *
 * 设计边界（按 team-lead 裁决）：
 *   - 位于 `src/pages/` 根下，**不进任何业务分组**，也不进 96 页统计；
 *   - 不挂在 UserLayout / AdminLayout 之下，是独立的全屏页面；
 *   - 登录后按角色落地：运营端角色进 `/admin/production/dashboard`，
 *     其余（农户等）进 `/production/dashboard`；
 *   - 访问令牌 / 刷新令牌 / 过期时间 / 角色 / 市场统一写入 zustand
 *     （`src/store/auth.ts`，持久化到 localStorage），刷新页面自动恢复；
 *   - 令牌临近过期时由 `src/api/auth.ts` 的请求拦截器用刷新令牌静默续期；
 *     若仍收到 401，由 `@/utils/request` 清空登录态并跳回 `/login`。
 *
 * 快捷入口仅用于本地联调：一键填入测试账号，不做任何本地伪造登录——
 * 提交后仍然真实调用 `POST /api/v1/auth/login`，以服务端返回的令牌为准。
 */
import { useEffect, useMemo, useState } from 'react'
import { App, Button, Card, Divider, Form, Input, InputNumber, Space, Tag, Typography } from 'antd'
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '@/store/auth'
import {
  ADMIN_HOME_PATH,
  USER_HOME_PATH,
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
  /** 落地页 */
  home: string
  /** 标签颜色 */
  color: string
}

/** 两个快捷入口：运营端管理员 / 用户端农户 */
const QUICK_ACCOUNTS: QuickAccount[] = [
  {
    key: 'ops',
    title: '运营端管理员',
    desc: 'admin / Admin@123',
    username: 'admin',
    password: 'Admin@123',
    marketId: 1,
    home: ADMIN_HOME_PATH,
    color: 'blue',
  },
  {
    key: 'farmer',
    title: '用户端农户',
    desc: 'farmer / Farmer@123',
    username: 'farmer',
    password: 'Farmer@123',
    marketId: 1,
    home: USER_HOME_PATH,
    color: 'green',
  },
]

/**
 * 登录页
 *
 * @returns 登录页组件
 */
export default function Login(): JSX.Element {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [form] = Form.useForm<LoginFormValues>()
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [errorText, setErrorText] = useState<string>('')

  const token = useAuthStore((state) => state.token)
  const roles = useAuthStore((state) => state.roles)

  /** 已登录时的落地页 */
  const homePath = useMemo(() => resolveHomePath(roles), [roles])

  // 已登录：直接放行到对应首页，避免停留在登录页
  useEffect(() => {
    if (token) {
      navigate(homePath, { replace: true })
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
      navigate(target, { replace: true })
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : '登录失败，请检查账号与密码'
      setErrorText(reason)
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
        background: 'linear-gradient(135deg, #eaf6ee 0%, #f5f7fa 55%, #e8f0fb 100%)',
      }}
    >
      <Card
        style={{ width: 420, maxWidth: '100%', boxShadow: '0 8px 32px rgba(19,160,90,0.12)' }}
        styles={{ body: { padding: 32 } }}
      >
        <Space direction="vertical" size={4} style={{ width: '100%', marginBottom: 20 }}>
          <Typography.Title level={3} style={{ margin: 0 }}>
            农业生产管理系统
          </Typography.Title>
          <Typography.Text type="secondary">
            请使用运营端 / 用户端账号登录
          </Typography.Text>
        </Space>

        <Space direction="vertical" size={8} style={{ width: '100%', marginBottom: 16 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            联调快捷入口（一键填入，提交后仍走真实认证接口）
          </Typography.Text>
          <Space size={8} wrap>
            {QUICK_ACCOUNTS.map((account) => (
              <Button key={account.key} size="small" onClick={() => fillAccount(account)}>
                <Tag color={account.color} style={{ marginInlineEnd: 6 }}>
                  {account.title}
                </Tag>
                {account.desc}
              </Button>
            ))}
          </Space>
        </Space>

        <Divider style={{ margin: '4px 0 20px' }} />

        <Form<LoginFormValues>
          form={form}
          layout="vertical"
          requiredMark={false}
          initialValues={{ username: '', password: '', marketId: 1 }}
          onFinish={handleSubmit}
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              size="large"
              prefix={<UserOutlined />}
              placeholder="请输入用户名"
              autoComplete="username"
              allowClear
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              size="large"
              prefix={<LockOutlined />}
              placeholder="请输入密码"
              autoComplete="current-password"
              allowClear
            />
          </Form.Item>

          <Form.Item
            name="marketId"
            label="市场 ID"
            rules={[{ required: true, message: '请输入市场 ID' }]}
          >
            <InputNumber size="large" min={1} style={{ width: '100%' }} placeholder="默认 1" />
          </Form.Item>

          {errorText ? (
            <Typography.Paragraph type="danger" style={{ marginBottom: 12 }}>
              {errorText}
            </Typography.Paragraph>
          ) : null}

          <Button type="primary" size="large" htmlType="submit" block loading={submitting}>
            登录
          </Button>
        </Form>

        <Divider style={{ margin: '20px 0 12px' }} />

        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
          接口前缀 <Typography.Text code>/api</Typography.Text> 由 Vite 代理到{' '}
          <Typography.Text code>http://localhost:8080</Typography.Text>；若登录失败请先确认
          core-platform 实例已在该端口启动。
        </Typography.Paragraph>
      </Card>
    </div>
  )
}

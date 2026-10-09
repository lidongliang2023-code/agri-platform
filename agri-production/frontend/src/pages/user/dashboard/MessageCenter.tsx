/**
 * 页面名称：消息中心
 * 路由路径：/production/messages
 * 所属模块：首页看板
 * PRD 序号：PRD 6.1 #3
 *
 * 页面用途（PRD）：站内消息列表、已读管理、消息跳转。
 * 左侧为消息分类（全部 / 未读 / 系统 / 任务 / 告警 / 审批），右侧为消息列表，
 * 支持单条标记已读、一键全部已读、删除，点击消息跳转对应业务页。
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  App as AntdApp,
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Input,
  List,
  Row,
  Skeleton,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  BellOutlined,
  CheckOutlined,
  DeleteOutlined,
  MailOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { deleteMessage as deleteMessageApi } from '@/api'
import { fetchMessages, markAllMessagesRead, markMessageRead } from '@/api/production-view'
import { messageTypeMeta } from '@/utils/production-adapter'
import type { MessageItem } from '@/types'

/** 消息分类标识 */
type CategoryKey = 'all' | 'unread' | '1' | '2' | '3' | '4'

/** 分类项 */
interface CategoryItem {
  /** 分类 key */
  key: CategoryKey
  /** 展示名称 */
  label: string
  /** 图标 */
  icon: JSX.Element
  /** 对应消息类型（all/unread 为空） */
  messageType?: number
}

/**
 * 消息中心
 * @returns 页面内容
 */
export default function MessageCenter(): JSX.Element {
  const navigate = useNavigate()
  const { message, modal } = AntdApp.useApp()
  const queryClient = useQueryClient()
  const [category, setCategory] = useState<CategoryKey>('all')
  const [keyword, setKeyword] = useState<string>('')

  const listQuery = useQuery({
    queryKey: ['message-list'],
    queryFn: () => fetchMessages({ pageNum: 1, pageSize: 100 }),
  })

  const messages = listQuery.data?.list ?? []

  /**
   * 失效并重载消息列表
   * @returns void
   */
  async function invalidate(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: ['message-list'] })
  }

  const readMutation = useMutation({
    mutationFn: (messageId: string) => markMessageRead(messageId),
    onSuccess: () => {
      message.success('已标记为已读')
      void invalidate()
    },
    onError: (error: Error) => message.error(error.message || '标记已读失败'),
  })

  const readAllMutation = useMutation({
    mutationFn: (messageIds: string[]) => markAllMessagesRead(messageIds),
    onSuccess: (count: number) => {
      message.success(`已标记 ${count} 条消息为已读`)
      void invalidate()
    },
    onError: (error: Error) => message.error(error.message || '操作失败'),
  })

  const deleteMutation = useMutation({
    mutationFn: (messageId: string) => deleteMessageApi(messageId),
    onSuccess: () => {
      message.success('消息已删除')
      void invalidate()
    },
    onError: (error: Error) => message.error(error.message || '删除失败'),
  })

  /** 分类列表 */
  const categories = useMemo<CategoryItem[]>(
    () => [
      { key: 'all', label: '全部消息', icon: <MailOutlined /> },
      { key: 'unread', label: '未读消息', icon: <BellOutlined /> },
      { key: '1', label: '系统通知', icon: <span>⚙️</span>, messageType: 1 },
      { key: '2', label: '任务提醒', icon: <span>📋</span>, messageType: 2 },
      { key: '3', label: '告警通知', icon: <span>⚠️</span>, messageType: 3 },
      { key: '4', label: '审批通知', icon: <span>✅</span>, messageType: 4 },
    ],
    [],
  )

  /** 当前筛选后的消息列表 */
  const filteredMessages = useMemo(() => {
    return messages.filter((item) => {
      if (category === 'unread' && item.isRead) return false
      if (category !== 'all' && category !== 'unread' && String(item.messageType) !== category) {
        return false
      }
      if (keyword.trim()) {
        const text = `${item.title}${item.content}`
        if (!text.toLowerCase().includes(keyword.trim().toLowerCase())) return false
      }
      return true
    })
  }, [category, keyword, messages])

  const unreadTotal = messages.filter((item) => !item.isRead).length

  /**
   * 计算分类上的角标数量
   * @param item 分类项
   * @returns 数量
   */
  function categoryCount(item: CategoryItem): number {
    if (item.key === 'all') return messages.length
    if (item.key === 'unread') return unreadTotal
    return messages.filter(
      (msg) => !msg.isRead && String(msg.messageType) === item.key,
    ).length
  }

  /**
   * 解析消息跳转路径
   * @param item 消息
   * @returns 跳转路径
   */
  function resolveLink(item: MessageItem): string {
    if (item.linkPath) return item.linkPath
    switch (item.messageType) {
      case 2:
        return item.bizId ? `/production/tasks/${item.bizId}` : '/production/tasks'
      case 3:
        return '/production/alerts'
      case 4:
        return '/production/analytics/reports'
      default:
        return '/production/dashboard'
    }
  }

  /**
   * 点击消息：标记已读并跳转业务页
   * @param item 消息
   * @returns void
   */
  function handleOpen(item: MessageItem): void {
    if (!item.isRead) {
      readMutation.mutate(item.messageId)
    }
    navigate(resolveLink(item))
  }

  /**
   * 二次确认删除
   * @param item 消息
   * @returns void
   */
  function handleDelete(item: MessageItem): void {
    modal.confirm({
      title: '删除消息',
      content: `确认删除「${item.title}」？删除后不可恢复。`,
      okText: '确认删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => deleteMutation.mutateAsync(item.messageId),
    })
  }

  /**
   * 二次确认一键全部已读
   * @returns void
   */
  function handleReadAll(): void {
    if (unreadTotal === 0) {
      message.info('当前没有未读消息')
      return
    }
    modal.confirm({
      title: '全部标记为已读',
      content: `确认将 ${unreadTotal} 条未读消息标记为已读？`,
      okText: '确认',
      cancelText: '取消',
      onOk: () =>
        readAllMutation.mutateAsync(
          messages.filter((item) => !item.isRead).map((item) => item.messageId),
        ),
    })
  }

  return (
    <Card
      title={
        <Space>
          <BellOutlined style={{ color: '#13a05a' }} />
          <span>消息中心</span>
          <Badge count={unreadTotal} />
        </Space>
      }
      extra={
        <Space>
          <Input.Search
            allowClear
            placeholder="搜索标题 / 内容"
            style={{ width: 220 }}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <Button icon={<CheckOutlined />} onClick={handleReadAll}>
            全部已读
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => void listQuery.refetch()}>
            刷新
          </Button>
        </Space>
      }
    >
      <Row gutter={16}>
        <Col xs={24} md={6} lg={5}>
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            {categories.map((item) => (
              <Button
                key={item.key}
                block
                type={category === item.key ? 'primary' : 'text'}
                style={{ textAlign: 'left', height: 40 }}
                onClick={() => setCategory(item.key)}
              >
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Space size={8}>
                    {item.icon}
                    <span>{item.label}</span>
                  </Space>
                  <Badge
                    count={categoryCount(item)}
                    color={category === item.key ? '#ffffff' : '#d9d9d9'}
                    showZero
                  />
                </Space>
              </Button>
            ))}
          </Space>
        </Col>

        <Col xs={24} md={18} lg={19}>
          {listQuery.isLoading ? (
            <Skeleton active paragraph={{ rows: 8 }} />
          ) : filteredMessages.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该分类下暂无消息" />
          ) : (
            <List
              itemLayout="vertical"
              dataSource={filteredMessages}
              rowKey="messageId"
              pagination={{ pageSize: 8, size: 'small' }}
              renderItem={(item) => {
                const meta = messageTypeMeta(item.messageType)
                return (
                  <List.Item
                    style={{
                      backgroundColor: item.isRead ? 'transparent' : '#f6ffed',
                      paddingInline: 12,
                      borderRadius: 6,
                    }}
                    actions={[
                      <Button
                        key="open"
                        type="link"
                        size="small"
                        onClick={() => handleOpen(item)}
                      >
                        查看业务详情 →
                      </Button>,
                      item.isRead ? null : (
                        <Button
                          key="read"
                          type="link"
                          size="small"
                          loading={readMutation.isPending}
                          onClick={() => readMutation.mutate(item.messageId)}
                        >
                          标记已读
                        </Button>
                      ),
                      <Button
                        key="delete"
                        type="link"
                        size="small"
                        danger
                        onClick={() => handleDelete(item)}
                      >
                        <DeleteOutlined /> 删除
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        <Tooltip title={meta.label}>
                          <span style={{ fontSize: 20 }}>{meta.icon}</span>
                        </Tooltip>
                      }
                      title={
                        <Space size={8} wrap>
                          {item.isRead ? (
                            <Badge status="default" />
                          ) : (
                            <Badge status="processing" color="#13a05a" />
                          )}
                          <Typography.Text strong={!item.isRead}>{item.title}</Typography.Text>
                          <Tag color={meta.color}>{meta.label}</Tag>
                          {item.isRead ? null : <Tag color="green">未读</Tag>}
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size={2} style={{ width: '100%' }}>
                          <Typography.Text type="secondary">{item.content}</Typography.Text>
                          <Space size={12} wrap>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              接收时间：{item.createdAt || '-'}
                            </Typography.Text>
                            {item.readAt ? (
                              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                已读时间：{item.readAt}
                              </Typography.Text>
                            ) : null}
                            {item.bizId ? (
                              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                业务单号：{item.bizId}
                              </Typography.Text>
                            ) : null}
                          </Space>
                        </Space>
                      }
                    />
                  </List.Item>
                )
              }}
            />
          )}
        </Col>
      </Row>
    </Card>
  )
}

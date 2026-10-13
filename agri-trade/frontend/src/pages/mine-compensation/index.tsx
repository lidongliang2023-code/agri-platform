import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Row, Space, Statistic, Table, Tag, message } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { getMyCompensations, type CompensationVO } from '@/api/compensation'
import { getMyMerchants } from '@/api/identity'

const STATUS: Record<string, { text: string; color: string }> = {
  pending: { text: '待审核', color: 'warning' },
  approved: { text: '已核准待打款', color: 'processing' },
  rejected: { text: '已驳回', color: 'error' },
  paid: { text: '已到账', color: 'success' }
}

/** 赔付类型（库里存的是英文枚举）。 */
const TYPE: Record<string, string> = {
  delay: '交付延误',
  quality: '质量不符',
  quantity: '数量短缺',
  price: '价格争议',
  dispute: '纠纷裁定',
  other: '其他'
}

/**
 * 我的获赔（商家侧）。
 *
 * <p>赔付打款之后，受损方此前**没有任何地方能看到这笔钱** —— 服务层的
 * getByRecipient 一直存在，但既没有接口也没有页面，商家只能等运营口头告知。
 * 这一页把"该收多少、到没到账"讲清楚；范围由服务端按登录令牌绑定的主体推导。</p>
 */
export default function MyCompensation() {
  const [rows, setRows] = useState<CompensationVO[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getMyCompensations()
      if (res?.code === 200) {
        setRows(res.data ?? [])
      } else {
        message.error(res?.message ?? '加载获赔记录失败')
      }
    } catch {
      message.error('加载获赔记录失败（请检查后端是否在运行）')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // 把"没绑主体"和"确实没有获赔"分开显示，避免一张说不清的空表
  const { data: merchantData } = useQuery({ queryKey: ['my-merchants'], queryFn: getMyMerchants })
  const merchants = merchantData?.code === 200 ? merchantData.data ?? [] : null

  const totalPaid = rows
    .filter((r) => r.compensationStatus === 'paid')
    .reduce((sum, r) => sum + Number(r.compensationAmount ?? 0), 0)
  const openCount = rows.filter((r) => r.compensationStatus === 'pending' || r.compensationStatus === 'approved').length

  return (
    <div>
      {merchants?.length === 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="当前账号还没有绑定经营主体"
          description="因此看不到任何获赔记录。请运营在「用户-主体绑定」里为你绑定经营主体后重试。"
        />
      )}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card>
            <Statistic title="已到账赔付" value={totalPaid} precision={2} prefix="¥" />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="在办赔付（待审 + 待打款）" value={openCount} suffix="笔" />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="赔付单总数" value={rows.length} suffix="笔" />
          </Card>
        </Col>
      </Row>

      <Card
        title="我的获赔"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          scroll={{ x: 1300 }}
          pagination={{ pageSize: 10 }}
          columns={[
            { title: '赔付单号', dataIndex: 'compensationNo', width: 180 },
            { title: '关联订单', dataIndex: 'orderNo', width: 170, render: (v: string) => v ?? '—' },
            {
              title: '赔付类型',
              dataIndex: 'compensationType',
              width: 120,
              render: (v: string) => (v ? TYPE[v] ?? v : '—')
            },
            {
              title: '赔付金额',
              dataIndex: 'compensationAmount',
              width: 140,
              align: 'right' as const,
              render: (v: number) => (v == null ? '—' : `¥${v}`)
            },
            {
              title: '状态',
              dataIndex: 'compensationStatus',
              width: 130,
              render: (v: string) => {
                const hit = STATUS[v] ?? { text: v, color: 'default' }
                return <Tag color={hit.color}>{hit.text}</Tag>
              }
            },
            { title: '赔付事由', dataIndex: 'compensationReason', ellipsis: true, render: (v: string) => v ?? '—' },
            { title: '到账时间', dataIndex: 'payTime', width: 170, render: (v: string) => v ?? '—' },
            { title: '打款流水号', dataIndex: 'transactionId', width: 220, render: (v: string) => v ?? '—' },
            { title: '发起时间', dataIndex: 'createTime', width: 170 }
          ]}
        />
      </Card>
    </div>
  )
}

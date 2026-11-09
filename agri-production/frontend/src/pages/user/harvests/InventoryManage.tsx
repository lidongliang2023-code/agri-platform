import Card from '@/components/SectionCard'
import './harvests.css'
import ProTable from '@/components/ProductionTable'
/**
 * 页面名称：库存管理
 * 路由路径：/production/harvests/inventory
 * 所属模块：采收与库存管理
 * 原型 pageId：P16 inventory
 *
 * 还原要点：
 * - 标题「🏪 库存管理」+ 新增库存按钮
 * - 筛选器：全部仓库 / 全部品类 / 全部状态
 * - 告警条：库存不足与临期预警汇总
 * - 表格列：库存编号 | 品名 | 仓库 | 当前库存 | 安全库存 | 批次 | 入库日期 | 保质期至 | 状态 | 操作
 * - 状态标签：正常 / 预警 / 不足 / 临期
 * - 出入库操作：入库、出库、损耗登记、冻结 / 解冻（HARV-05 / HARV-06 / HARV-09）
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import PageContainer from '@/components/ProductionPageContainer'
import type { ProColumns } from '@ant-design/pro-components'
import {
  Alert,
  Button,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
  message,
} from 'antd'
import { LockOutlined, PlusOutlined, WarningOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import useAuthStore from '@/store/auth'
import { loadInventoryPages, quantitySummary, requireInventorySource } from './inventoryHelpers'
import { MetricText } from '@/components'
import {
  inboundInventory,
  outboundInventory,
  queryInventory,
  registerLoss,
  toggleInventoryFreeze,
} from '@/api/harvests'
import type { InventoryRecord } from '@/types'
import {
  INVENTORY_HEALTH_META,
  INVENTORY_HEALTH_OPTIONS,
  LOSS_REASON_OPTIONS,
  WAREHOUSE_OPTIONS,
  resolveInventoryHealth,
} from '@/types'

/** 列表筛选条件 */
interface InventoryFilters {
  /** 仓库名称 */
  warehouseName?: string
  keyword?: string
  batchNo?: string
  /** 品类 */
  category?: string
  /** 库存健康状态 */
  healthStatus?: string
}

/** 出入库操作类型 */
type StockAction = 'in' | 'out' | 'loss'

/** 出入库弹窗表单值 */
interface StockFormValues {
  /** 变动数量 */
  quantity?: number
  /** 关联单据号（出库） */
  orderNo?: string
  /** 损耗原因（损耗登记） */
  reason?: string
  /** 备注 */
  remark?: string
}

/**
 * 库存管理页面
 *
 * 业务职责：成品库存台账，支持预警提示、条件筛选、出入库与损耗登记、冻结解冻。
 *
 * @returns 页面内容
 */
export default function InventoryManage(): JSX.Element {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const subjectId = useAuthStore((state) => state.userInfo?.tenantId)
  const operatorName = useAuthStore((state) => state.userInfo?.realName || state.userInfo?.username)

  const [pageNum, setPageNum] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)
  const [filters, setFilters] = useState<InventoryFilters>({})
  const [filterForm] = Form.useForm<InventoryFilters>()

  const [action, setAction] = useState<StockAction | null>(null)
  const [actionTarget, setActionTarget] = useState<InventoryRecord | null>(null)
  const [stockForm] = Form.useForm<StockFormValues>()

  useEffect(() => { setPageNum(1); closeAction() }, [subjectId])

  /** 库存列表：接口范围为当前经营主体，不依赖顶部农场。 */
  const listQuery = useQuery({
    queryKey: ['production-inventory', 'list', subjectId, filters],
    enabled: Boolean(subjectId),
    queryFn: () => loadInventoryPages((pageNum) => queryInventory({ ...filters, pageNum, pageSize: 200 })),
  })

  /** 统一失效刷新 */
  const invalidateInventory = (): Promise<void> =>
    Promise.all([queryClient.invalidateQueries({ queryKey: ['production-inventory'] }), queryClient.invalidateQueries({ queryKey: ['production-harvests'] })]).then(() => undefined)

  /** 入库 */
  const inboundMutation = useMutation({
    mutationFn: (payload: { inventoryId: string; batchId: string; quantity: number; remark?: string; warehouseName?: string }) =>
      inboundInventory(payload.batchId, {
        quantity: payload.quantity,
        remark: payload.remark,
        operatorName,
        warehouseName: payload.warehouseName,
      }),
    onSuccess: () => {
      message.success('入库成功，库存流水已生成')
      closeAction()
      void invalidateInventory()
    },
    onError: (error) => message.error(error.message || '入库失败，请稍后重试', 6),
  })

  /** 出库 */
  const outboundMutation = useMutation({
    mutationFn: (payload: { inventoryId: string; batchId: string; quantity: number; orderNo?: string; remark?: string }) =>
      outboundInventory(payload.batchId, payload),
    onSuccess: () => {
      message.success('出库成功，库存流水已生成')
      closeAction()
      void invalidateInventory()
    },
    onError: (error) => message.error(error.message || '出库失败，请稍后重试', 6),
  })

  /** 损耗登记 */
  const lossMutation = useMutation({
    mutationFn: (payload: { inventoryId: string; batchId: string; quantity: number; reason: string; remark?: string }) =>
      registerLoss({ ...payload, operatorName }),
    onSuccess: () => {
      message.success('损耗登记成功')
      closeAction()
      void invalidateInventory()
    },
    onError: (error) => message.error(error.message || '损耗登记失败，请稍后重试', 6),
  })

  /** 冻结 / 解冻 */
  const freezeMutation = useMutation({
    mutationFn: async (payload: { inventoryId: string; batchId: string; frozen: boolean }) => {
      const record = rows.find((row) => String(row.inventoryId) === String(payload.inventoryId))
      if (!record) throw new Error('库存记录已变化，请刷新')
      await requireInventorySource(record)
      return toggleInventoryFreeze(payload.batchId, payload.frozen, payload.inventoryId)
    },
    onSuccess: (_result, payload) => {
      message.success(payload.frozen ? '库存已冻结' : '库存已解冻')
      void invalidateInventory()
    },
    onError: (error) => message.error(error.message || '操作失败，请稍后重试', 6),
  })

  /** 关闭出入库弹窗 */
  const closeAction = (): void => {
    setAction(null)
    setActionTarget(null)
    stockForm.resetFields()
  }

  /** 打开出入库弹窗 */
  const openAction = (type: StockAction, record: InventoryRecord): void => {
    if (inboundMutation.isPending || outboundMutation.isPending || lossMutation.isPending) return
    setAction(type)
    setActionTarget(record)
    stockForm.resetFields()
  }

  /** 提交出入库 */
  const handleStockSubmit = (): void => {
    if (!actionTarget || !action) return
    stockForm.validateFields().then(async (values) => {
      if (subjectId !== useAuthStore.getState().userInfo?.tenantId) throw new Error('经营主体已切换，请重新操作')
      if (action !== 'in') await requireInventorySource(actionTarget)
      const quantity = values.quantity ?? 0
      if (quantity <= 0) {
        message.warning('变动数量必须大于 0')
        return
      }
      if (action === 'out' && quantity > Math.max(0, actionTarget.currentQty - (actionTarget.frozenQty ?? 0))) {
        message.warning(`出库数量不能超过当前库存 ${actionTarget.currentQty}${actionTarget.unit}`)
        return
      }
      if (action === 'loss' && quantity > Math.max(0, actionTarget.currentQty - (actionTarget.frozenQty ?? 0))) {
        message.warning(`损耗数量不能超过当前库存 ${actionTarget.currentQty}${actionTarget.unit}`)
        return
      }
      if (action === 'in') {
        inboundMutation.mutate({
          inventoryId: String(actionTarget.inventoryId),
          batchId: actionTarget.batchId,
          quantity,
          remark: values.remark,
          warehouseName: actionTarget.warehouseName,
        })
      } else if (action === 'out') {
        outboundMutation.mutate({
          inventoryId: String(actionTarget.inventoryId),
          batchId: actionTarget.batchId,
          quantity,
          orderNo: values.orderNo,
          remark: values.remark,
        })
      } else {
        lossMutation.mutate({
          inventoryId: String(actionTarget.inventoryId),
          batchId: actionTarget.batchId,
          quantity,
          reason: values.reason ?? '其他',
          remark: values.remark,
        })
      }
    }).catch((error) => { if (!error?.errorFields) message.error(error.message || '请检查表单') })
  }

  const rows = useMemo<InventoryRecord[]>(() => listQuery.data ?? [], [listQuery.data])

  /**
   * 健康状态兜底计算：后端未返回 healthStatus 时按安全库存 / 保质期推导。
   *
   * 后端没有给出 currentQty 时不做任何推导（禁止拿 0 或随机数顶替），
   * 直接归入 normal —— 该行的数量列会显示「— / 未接入」。
   */
  const healthOf = (record: InventoryRecord): string => {
    if (record.healthStatus) return record.healthStatus
    if (typeof record.currentQty !== 'number') return 'normal'
    return resolveInventoryHealth(record.currentQty, record.safeQty ?? 0, record.expireDate)
  }

  /** 告警列表：不足与临期库存 */
  const warnings = useMemo(
    () =>
      rows.filter((item) => {
        const health = healthOf(item)
        return health === 'shortage' || health === 'expiring'
      }),
    [rows],
  )

  /**
   * 统计概览。
   *
   * 后端未返回数量字段时不补 0、不估算：整列都拿不到数量时统计值显示为「—」，
   * 只有部分行缺失时才对已有值求和（并在页面提示存在未接入字段）。
   */
  const overview = useMemo(() => {
    const known = rows.filter((item) => typeof item.currentQty === 'number')
    return {
      totalQty: quantitySummary(rows, 'currentQty'),
      frozenQty: quantitySummary(rows, 'frozenQty'),
      lossQty: quantitySummary(rows, 'lossQty'),
      skuCount: rows.filter((row) => row.currentQty > 0).length,
      missingQtyCount: rows.length - known.length,
    }
  }, [rows])

  /** 品类下拉选项（由当前数据去重生成） */
  const categoryOptions = useMemo(() => {
    const set = new Set<string>()
    rows.forEach((item) => {
      if (item.category) set.add(item.category)
    })
    return Array.from(set).map((value) => ({ value, label: value }))
  }, [rows])

  /** 查询 / 重置 */
  const handleSearch = (): void => {
    setPageNum(1)
    setFilters(filterForm.getFieldsValue())
  }

  const handleReset = (): void => {
    filterForm.resetFields()
    setPageNum(1)
    setFilters({})
  }

  /** 表格列定义（对照原型 P16） */
  const columns: ProColumns<InventoryRecord>[] = [
    { title: '库存编号', dataIndex: 'inventoryId', width: 110 },
    {
      title: '品名',
      key: 'product',
      width: 160,
      render: (_, record) => (
        <Space size={4}>
          <span>{record.productName ?? '-'}</span>
          {record.frozen ? <Tag color="volcano">冻结</Tag> : null}
        </Space>
      ),
    },
    { title: '仓库', dataIndex: 'warehouseName', width: 110 },
    {
      title: '当前库存',
      dataIndex: 'currentQty',
      width: 120,
      render: (_, record) => (
        <MetricText
          value={typeof record.currentQty === 'number' ? record.currentQty : null}
          suffix={record.unit ? ` ${record.unit}` : ''}
          missingTip="后端 /harvests/inventory 未返回 currentQty（当前返回的是流水结构），显示为「—」"
        />
      ),
    },
    {
      title: '安全库存',
      dataIndex: 'safeQty',
      width: 110,
      render: (_, record) => (
        <MetricText
          value={typeof record.safeQty === 'number' ? record.safeQty : null}
          suffix={record.unit ? ` ${record.unit}` : ''}
          missingTip="后端 /harvests/inventory 未返回 safeQty（当前返回的是流水结构），显示为「—」"
        />
      ),
    },
    { title: '批次', dataIndex: 'batchNo', width: 130 },
    {
      title: '入库日期',
      dataIndex: 'lastInAt',
      width: 170,
      render: (_, record) =>
        record.lastInAt ? dayjs(record.lastInAt).format('YYYY-MM-DD') : '-',
    },
    { title: '保质期至', dataIndex: 'expireDate', width: 120 },
    {
      title: '状态',
      key: 'health',
      width: 100,
      render: (_, record) => {
        const health = healthOf(record) as keyof typeof INVENTORY_HEALTH_META
        const meta = INVENTORY_HEALTH_META[health] ?? INVENTORY_HEALTH_META.normal
        return <Tag color={meta.color}>● {meta.label}</Tag>
      },
    },
    {
      title: '操作',
      key: 'option',
      fixed: 'right',
      width: 280,
      valueType: 'option',
      render: (_, record) => [
        <Typography.Link
          key="detail"
          onClick={() => navigate(`/production/harvests/inventory/${record.inventoryId}`)}
        >
          详情
        </Typography.Link>,
        <Typography.Link key="in" onClick={() => openAction('in', record)}>
          入库
        </Typography.Link>,
        <Typography.Link disabled={Boolean(record.frozen) || !(record.currentQty > (record.frozenQty ?? 0))} key="out" onClick={() => openAction('out', record)}>
          出库
        </Typography.Link>,
        <Typography.Link disabled={Boolean(record.frozen) || !(record.currentQty > (record.frozenQty ?? 0))} key="loss" onClick={() => openAction('loss', record)}>
          损耗
        </Typography.Link>,
        record.frozen ? (
          <Popconfirm key="unfreeze" title={`确认解冻 ${record.warehouseName} 的库存？`} onConfirm={() => freezeMutation.mutate({ inventoryId: String(record.inventoryId), batchId: record.batchId, frozen: false })}><Typography.Link>解冻</Typography.Link></Popconfirm>
        ) : (
          <Popconfirm
            key="freeze"
            title={`确认冻结 ${record.warehouseName} 的库存？`}
            description="冻结后不可出库，请先解冻。"
            okText="确认冻结"
            cancelText="取消"
            onConfirm={() => freezeMutation.mutate({ inventoryId: String(record.inventoryId), batchId: record.batchId, frozen: true })}
          >
            <Typography.Link>
              <LockOutlined /> 冻结
            </Typography.Link>
          </Popconfirm>
        ),
      ],
    },
  ]

  /** 弹窗标题映射 */
  const actionTitleMap: Record<StockAction, string> = {
    in: '库存入库',
    out: '库存出库',
    loss: '损耗登记',
  }

  return (
    <PageContainer
      className="harvest-business-page"
      title="库存管理"
      subTitle="当前经营主体全部仓库"
      extra={[
        <Button key="harvests" onClick={() => navigate('/production/harvests')}>
          采收记录
        </Button>,
        <Button
          key="create"
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/production/harvests/inventory/create')}
        >
          新增库存
        </Button>,
      ]}
    >

      {overview.missingQtyCount > 0 ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={`有 ${overview.missingQtyCount} 条记录后端未返回库存台账字段（inventoryId / currentQty / safeQty / productName），相关列显示为「—」`}
          description="部分数量缺失，汇总仅包含已有数量，请刷新后核实。"
        />
      ) : null}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic title="在库记录" value={overview.skuCount} suffix="个" />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic
              title="库存总量（按单位）"
              value={overview.totalQty}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic
              title="冻结数量"
              value={overview.frozenQty}
              valueStyle={{ color: '#fa541c' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic
              title="累计损耗"
              value={overview.lossQty}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {warnings.length > 0 ? (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: 16 }}
          message={`库存预警：${warnings.length} 条库存需要关注${warnings.length > 5 ? '（仅展示前 5 条，可按状态筛选）' : ''}`}
          description={
            <Space direction="vertical" size={2}>
              {warnings.slice(0, 5).map((item, index) => (
                <Typography.Text key={item.inventoryId ?? `inventory-row-${index}`}>
                  {item.warehouseName ?? '—'} - {item.productName ?? '—'} 库存
                  {healthOf(item) === 'expiring' ? '临期' : '不足'}（当前{' '}
                  <MetricText
                    value={typeof item.currentQty === 'number' ? item.currentQty : null}
                    suffix={item.unit ?? ''}
                    missingTip="后端未返回 currentQty，显示为「—」"
                  />
                  {healthOf(item) === 'expiring' ? (
                    <>，保质期至 {item.expireDate ?? '—'}</>
                  ) : (
                    <>
                      ，安全库存{' '}
                      <MetricText
                        value={typeof item.safeQty === 'number' ? item.safeQty : null}
                        suffix={item.unit ?? ''}
                        missingTip="后端未返回 safeQty，显示为「—」"
                      />
                    </>
                  )}
                  ）
                </Typography.Text>
              ))}
            </Space>
          }
        />
      ) : null}

      <Card style={{ marginBottom: 16 }}>
        <Form form={filterForm} layout="inline" style={{ rowGap: 12 }} onFinish={handleSearch}>
          <Form.Item name="keyword" label="品名"><Input allowClear placeholder="搜索品名" /></Form.Item>
          <Form.Item name="batchNo" label="批次号"><Input allowClear placeholder="搜索采收批次" /></Form.Item>
          <Form.Item name="warehouseName" label="仓库">
            <Select
              allowClear
              placeholder="全部仓库"
              options={WAREHOUSE_OPTIONS}
              style={{ width: 140 }}
            />
          </Form.Item>
          <Form.Item name="category" label="品类">
            <Select
              allowClear
              placeholder="全部品类"
              options={categoryOptions}
              style={{ width: 140 }}
            />
          </Form.Item>
          <Form.Item name="healthStatus" label="状态">
            <Select
              allowClear
              placeholder="全部状态"
              options={INVENTORY_HEALTH_OPTIONS}
              style={{ width: 140 }}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" onClick={handleSearch}>
                查询
              </Button>
              <Button onClick={handleReset}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card title="库存记录">
        {!subjectId ? (
          <Empty description="请先选择经营主体" />
        ) : listQuery.isError ? (
          <Empty
            description={
              <Space direction="vertical">
                <Typography.Text type="danger">库存数据加载失败，请稍后重试</Typography.Text>
                <Button onClick={() => void invalidateInventory()}>重新加载</Button>
              </Space>
            }
          />
        ) : (
          <ProTable<InventoryRecord>
            cardProps={false}
            columnWidthStorageKey="inventory-records"
            scroll={{ x: 'max-content' }}
            rowKey="inventoryId"
            columns={columns}
            dataSource={rows.slice((pageNum - 1) * pageSize, pageNum * pageSize)}
            loading={listQuery.isFetching}
            search={false}
            options={{ reload: () => void invalidateInventory(), density: true, setting: true }}
            pagination={{
              current: pageNum,
              pageSize,
              total: rows.length,
              showSizeChanger: true,
              onChange: (nextPage, nextSize) => {
                setPageNum(nextPage)
                setPageSize(nextSize)
              },
            }}
          />
        )}
      </Card>

      <Modal
        title={`${action ? actionTitleMap[action] : ''}：${actionTarget?.productName ?? ''}`}
        open={Boolean(action)}
        okText="确认提交"
        cancelText="取消"
        confirmLoading={
          inboundMutation.isPending || outboundMutation.isPending || lossMutation.isPending
        }
        onOk={handleStockSubmit}
        onCancel={closeAction}
        destroyOnClose
      >
        <Form form={stockForm} layout="vertical" style={{ marginTop: 16 }}>
          {action === 'loss' ? (
            <Form.Item
              name="reason"
              label="损耗原因"
              rules={[{ required: true, message: '请选择损耗原因' }]}
            >
              <Select options={LOSS_REASON_OPTIONS} placeholder="请选择损耗原因" />
            </Form.Item>
          ) : null}
          <Form.Item
            name="quantity"
            label={action === 'loss' ? '损耗数量' : action === 'out' ? '出库数量' : '入库数量'}
            rules={[{ required: true, message: '请输入数量' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0.01}
              precision={2}
              placeholder={`当前库存 ${actionTarget?.currentQty ?? 0}${actionTarget?.unit ?? 'kg'}`}
            />
          </Form.Item>
          {action === 'out' ? (
            <Form.Item name="orderNo" label="关联单据号">
              <Input placeholder="如销售订单号 SO20260602（可选）" />
            </Form.Item>
          ) : null}
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="可填写操作说明" />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  )
}

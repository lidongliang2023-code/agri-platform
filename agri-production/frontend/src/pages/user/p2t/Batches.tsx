import { useEffect, useState } from 'react'
import { Alert, Button, Input, Space, Tag, Typography } from 'antd'
import PageContainer from '@/components/ProductionPageContainer'
import BusinessRecordList from '@/components/BusinessRecordList'
import type { ColumnsType } from 'antd/es/table'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { listP2tBatches } from '@/api/p2t'
import type { P2tBatchRow } from '@/api/p2t'
import useAuthStore from '@/store/auth'

export default function P2tBatches(): JSX.Element {
  const subjectId = useAuthStore((state) => state.userInfo?.tenantId)
  const [keyword, setKeyword] = useState('')
  const [pageNum, setPageNum] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  useEffect(() => { setPageNum(1) }, [subjectId])
  const query = useQuery({
    queryKey: ['p2t-batches', subjectId, keyword, pageNum, pageSize],
    queryFn: () => listP2tBatches({ keyword: keyword || undefined, pageNum, pageSize }),
  })
  const columns: ColumnsType<P2tBatchRow> = [
    { title: '批次号', dataIndex: 'batchNo', width: 190, render: (value) => <Typography.Text copyable>{value}</Typography.Text> },
    { title: '作物', dataIndex: 'cropName', width: 140 },
    { title: '品种', dataIndex: 'cropVariety', width: 130 },
    { title: '农场', dataIndex: 'farmName', width: 180 },
    { title: '采收日期', dataIndex: 'harvestDate', width: 120 },
    { title: '产量', key: 'quantity', width: 130, render: (_, row) => `${row.quantity} ${row.unit}` },
    { title: '当前库存', key: 'stockQty', width: 130, render: (_, row) => `${row.stockQty} ${row.unit}` },
    { title: '冻结量', key: 'frozenQty', width: 130, render: (_, row) => `${row.frozenQty} ${row.unit}` },
    { title: '过期未冻结量', key: 'unusableQty', width: 140, render: (_, row) => `${row.unusableQty} ${row.unit}` },
    { title: '库存可用量', key: 'availableStockQty', width: 140, render: (_, row) => `${row.availableStockQty} ${row.unit}` },
    { title: '库存校验', key: 'stockCheck', width: 180, render: (_, row) => row.stockUnitMismatch ? <Tag color="red">库存单位不一致</Tag> : row.stockShortfallQty > 0 ? <Tag color="red">供给缺口 {row.stockShortfallQty} {row.unit}</Tag> : <Tag color="green">正常</Tag> },
    { title: '供给占用', key: 'publishedQty', width: 130, render: (_, row) => `${row.publishedQty} ${row.unit}` },
    { title: '可发布', key: 'publishableQty', width: 130, render: (_, row) => `${row.publishableQty} ${row.unit}` },
    { title: '已认购', key: 'reservedQty', width: 130, render: (_, row) => `${row.reservedQty} ${row.unit}` },
    { title: '质检', key: 'qualityJudged', width: 110, render: (_, row) => <Tag color={row.qualityJudged ? 'green' : 'orange'}>{row.qualityJudged ? '已判定' : '未判定'}</Tag> },
    { title: '品种映射', key: 'mapped', width: 110, render: (_, row) => <Tag color={row.mapped ? 'green' : 'red'}>{row.mapped ? '已映射' : '未映射'}</Tag> },
    { title: '操作', key: 'actions', fixed: 'right', width: 260, render: (_, row) => <Space size={8} wrap>
      <Link to={`/production/harvests/${row.batchId}`}>采收详情</Link>
      <Link to={`/production/p2t/trace?batchNo=${encodeURIComponent(row.batchNo)}`}>产销链路</Link>
      {row.publishable ? <Link to={`/production/p2t/offers?batchId=${row.batchId}&create=1`}>发布供给</Link> : <Typography.Text type="secondary">{row.mapped ? '无可发布量' : '待映射'}</Typography.Text>}
    </Space> },
  ]
  return <PageContainer title="采收批次与可售量">
    <Input.Search key={subjectId} allowClear placeholder="搜索批次号或品种" onSearch={(value) => { setKeyword(value.trim()); setPageNum(1) }} style={{ maxWidth: 480, marginBottom: 16 }} />
    {query.isError && <Alert type="error" showIcon message="批次加载失败" description={query.error instanceof Error ? query.error.message : '请重试'} action={<Button onClick={() => void query.refetch()}>重试</Button>} />}
    <BusinessRecordList<P2tBatchRow> rowKey="batchId" columns={columns} dataSource={query.data?.list ?? []} loading={query.isFetching}
      toolbarTitle="采收批次" columnWidthStorageKey="p2t-batches" onReload={() => query.refetch()}
      pagination={{ current: pageNum, pageSize, total: query.data?.total ?? 0, showSizeChanger: true, showTotal: (total) => `共 ${total} 个批次`, onChange: (page, size) => { setPageNum(size === pageSize ? page : 1); setPageSize(size) } }} />
  </PageContainer>
}

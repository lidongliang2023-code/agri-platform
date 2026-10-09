/**
 * 页面名称：SOP 标准作业规程库
 * 路由路径：/admin/production/sop
 * 所属模块：SOP与知识库
 * PRD 序号：PRD 6.2 #26（PRD 独有页面，原型未绘制）
 *
 * 本轮重写说明（重要，改这个文件前先看）：
 *
 * 旧版是「SOP模板审核」页，整套审核模型（AUDIT_STATUS_MAP 待审核/已通过/已驳回、
 * 审核意见、通过/驳回按钮、6 条 MOCK_TEMPLATES 示例模板）**是前端照原型编出来的**：
 * - 后端 `GET /admin/sop` 的返回体里**没有任何审核字段**（实测 3 条：DEMO-SOP-001/002/003，
 *   字段为 sopId/cropId/sopCode/sopName/sopType/versionNo/contentUrl/stageSeq/
 *   applicableRegion/publisher/status + 审计列）；
 * - 表 `prod_sop_library` 只有 `status`（1发布/0草稿），没有 audit_status；
 * - `PATCH /admin/sop/{id}/audit` **后端不存在**，实测返回 HTTP 200 + `code:500`
 *   （任何不存在的子路径都是这个响应），是「以为调通了其实没写进去」。
 *
 * 处置口径：**不为前端虚构的概念改后端数据模型**，改为展示后端真实的规程库。
 * 审核流程若产品上确实需要，属后端缺口，另行排期（见交付说明）。
 *
 * 纪律：
 * - 列表只认 `GET /admin/sop` 的真实返回，无本地示例数据、无空结果兜底塞数据；
 * - 后端没有的字段一律显示「—」，不本地算、不填 0、不猜；
 * - 查询条件只用后端 `page()` 真实支持的 `keyword`（匹配 sop_name）与 `status`，
 *   不再传会被静默丢弃的参数。
 */
import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import { EyeOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listSopLibrary } from '@/api'
import type { SopLibraryItem } from '@/api'

/** 规程类型文案与配色（对应后端 sop_type：PLANT / PEST / HARVEST） */
const SOP_TYPE_MAP: Record<string, { label: string; color: string }> = {
  PLANT: { label: '种植', color: 'green' },
  PEST: { label: '植保', color: 'orange' },
  HARVEST: { label: '采收', color: 'blue' },
}

/** 状态文案与配色（对应后端 status：1发布 / 0草稿） */
const STATUS_MAP: Record<number, { label: string; color: string }> = {
  1: { label: '已发布', color: 'success' },
  0: { label: '草稿', color: 'default' },
}

/** 查询条件（字段与后端 page() 的真实入参一一对应） */
interface FilterState {
  /** 规程名称关键字，后端按 sop_name 模糊匹配 */
  keyword?: string
  /** 状态 1发布 0草稿 */
  status?: number
}

/** 空值展示：后端没有就是没有，不填占位值 */
function dash(value: unknown): string {
  return value === null || value === undefined || value === '' ? '—' : String(value)
}

/**
 * 渲染规程类型标签
 * @param type 后端 sop_type 原值
 */
function renderSopType(type?: string | null): JSX.Element {
  if (!type) return <Typography.Text type="secondary">—</Typography.Text>
  const meta = SOP_TYPE_MAP[type]
  if (!meta) return <Tag>{type}</Tag>
  return <Tag color={meta.color}>{meta.label}</Tag>
}

/**
 * 渲染状态标签
 * @param status 后端 status 原值
 */
function renderStatus(status?: number | null): JSX.Element {
  if (status === null || status === undefined) {
    return <Typography.Text type="secondary">—</Typography.Text>
  }
  const meta = STATUS_MAP[status]
  if (!meta) return <Tag>{status}</Tag>
  return <Tag color={meta.color}>{meta.label}</Tag>
}

/**
 * SOP 标准作业规程库页面
 * @returns 页面内容
 */
export default function SopLibrary(): JSX.Element {
  const queryClient = useQueryClient()
  const [form] = Form.useForm<FilterState>()
  const [filters, setFilters] = useState<FilterState>({})
  const [previewRow, setPreviewRow] = useState<SopLibraryItem | undefined>(undefined)

  const listQuery = useQuery({
    queryKey: ['admin-sop-library', filters],
    queryFn: () => listSopLibrary({ pageNum: 1, pageSize: 200, ...filters }),
  })

  const rows = useMemo<SopLibraryItem[]>(() => listQuery.data?.list ?? [], [listQuery.data])

  /** 统计口径全部来自真实返回（总数 / 已发布 / 草稿），不做任何推算 */
  const stats = useMemo(
    () => ({
      total: rows.length,
      published: rows.filter((row) => row.status === 1).length,
      draft: rows.filter((row) => row.status === 0).length,
    }),
    [rows],
  )

  const columns = useMemo(
    () => [
      { title: '规程编码', dataIndex: 'sopCode', width: 150, render: (v?: string | null) => dash(v) },
      {
        title: '规程名称',
        dataIndex: 'sopName',
        width: 240,
        render: (text?: string | null) => (
          <Typography.Text strong>{dash(text)}</Typography.Text>
        ),
      },
      {
        title: '类型',
        dataIndex: 'sopType',
        width: 90,
        render: (type?: string | null) => renderSopType(type),
      },
      {
        title: '作物ID',
        dataIndex: 'cropId',
        width: 140,
        render: (v?: string | null) => dash(v),
      },
      { title: '版本', dataIndex: 'versionNo', width: 90, render: (v?: string | null) => dash(v) },
      {
        title: '适用阶段',
        dataIndex: 'stageSeq',
        width: 100,
        render: (seq?: number | null) =>
          seq === null || seq === undefined ? '—' : `第 ${seq} 阶段`,
      },
      {
        title: '适用区域',
        dataIndex: 'applicableRegion',
        width: 180,
        render: (v?: string | null) => dash(v),
      },
      { title: '发布人', dataIndex: 'publisher', width: 120, render: (v?: string | null) => dash(v) },
      {
        title: '状态',
        dataIndex: 'status',
        width: 100,
        render: (status?: number | null) => renderStatus(status),
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        width: 170,
        render: (v?: string | null) => dash(v),
      },
      {
        title: '操作',
        key: 'action',
        width: 100,
        fixed: 'right' as const,
        render: (_: unknown, row: SopLibraryItem) => (
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setPreviewRow(row)}>
            详情
          </Button>
        ),
      },
    ],
    [],
  )

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {listQuery.isError ? (
        <Alert
          type="error"
          showIcon
          message="规程库加载失败"
          description={
            (listQuery.error as Error | undefined)?.message ??
            '未取到后端数据，页面不展示任何替代数据。'
          }
          action={
            <Button
              size="small"
              onClick={() => void queryClient.invalidateQueries({ queryKey: ['admin-sop-library'] })}
            >
              重试
            </Button>
          }
        />
      ) : null}

      <Row gutter={16}>
        <Col span={8}>
          <Card>
            <Statistic title="规程总数" value={stats.total} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="已发布" value={stats.published} valueStyle={{ color: '#13a05a' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="草稿" value={stats.draft} valueStyle={{ color: '#8c8c8c' }} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Form<FilterState>
          form={form}
          layout="inline"
          style={{ rowGap: 12, marginBottom: 16 }}
          onFinish={(values) => setFilters(values)}
        >
          <Form.Item name="keyword" label="规程名称">
            <Input allowClear placeholder="按规程名称关键字查询" style={{ width: 220 }} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select
              allowClear
              placeholder="全部"
              style={{ width: 140 }}
              options={[
                { value: 1, label: '已发布' },
                { value: 0, label: '草稿' },
              ]}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                查询
              </Button>
              <Button
                onClick={() => {
                  form.resetFields()
                  setFilters({})
                }}
              >
                重置
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => void queryClient.invalidateQueries({ queryKey: ['admin-sop-library'] })}
              >
                刷新
              </Button>
            </Space>
          </Form.Item>
        </Form>

        <Table<SopLibraryItem>
          rowKey="sopId"
          columns={columns}
          dataSource={rows}
          loading={listQuery.isLoading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
          scroll={{ x: 1500 }}
          locale={{ emptyText: <Empty description="暂无 SOP 规程" /> }}
        />
      </Card>

      {/* 规程详情抽屉：字段全部取自真实返回，缺失显示「—」 */}
      <Drawer
        title={previewRow ? `规程详情 - ${dash(previewRow.sopName)}` : '规程详情'}
        width={720}
        open={Boolean(previewRow)}
        onClose={() => setPreviewRow(undefined)}
      >
        {previewRow ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="规程编码">{dash(previewRow.sopCode)}</Descriptions.Item>
              <Descriptions.Item label="版本">{dash(previewRow.versionNo)}</Descriptions.Item>
              <Descriptions.Item label="类型">{renderSopType(previewRow.sopType)}</Descriptions.Item>
              <Descriptions.Item label="作物ID">{dash(previewRow.cropId)}</Descriptions.Item>
              <Descriptions.Item label="适用阶段">
                {previewRow.stageSeq === null || previewRow.stageSeq === undefined
                  ? '—'
                  : `第 ${previewRow.stageSeq} 阶段`}
              </Descriptions.Item>
              <Descriptions.Item label="适用区域">
                {dash(previewRow.applicableRegion)}
              </Descriptions.Item>
              <Descriptions.Item label="发布人">{dash(previewRow.publisher)}</Descriptions.Item>
              <Descriptions.Item label="状态">{renderStatus(previewRow.status)}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{dash(previewRow.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{dash(previewRow.updatedAt)}</Descriptions.Item>
              <Descriptions.Item label="规程文件" span={2}>
                {previewRow.contentUrl ? (
                  <Typography.Link href={previewRow.contentUrl} target="_blank" rel="noreferrer">
                    {previewRow.contentUrl}
                  </Typography.Link>
                ) : (
                  '—'
                )}
              </Descriptions.Item>
            </Descriptions>
          </Space>
        ) : null}
      </Drawer>
    </Space>
  )
}

/**
 * 页面名称：溯源报告
 * 路由路径：/production/trace/reports
 * 所属模块：质量检测与溯源
 * 原型来源：用户端原型 P26 trace-reports（原型补充页面）
 *
 * 还原要点：
 * - 头部 `< 返回 溯源报告`（→trace）+ `下载PDF` / `打印` 按钮
 * - 报告列表：报告编号 / 溯源码 / 批次号 / 产品名称 / 生成时间 / 存证状态 / 操作
 * - 支持「+ 生成报告」：按批次 / 溯源码实时汇总数据生成报告
 * - 报告预览为原型 P26 四章结构：
 *   一、产品基本信息 二、生产过程记录 三、质量检测 四、区块链存证
 *
 * 设计说明：后端暂未提供溯源报告存储接口，报告清单与生成结果持久化在浏览器
 * localStorage（key: agri_trace_reports_v1），报告正文数据全部来自真实业务接口。
 */
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { PageContainer, ProTable } from '@ant-design/pro-components'
import type { ProColumns } from '@ant-design/pro-components'
import {
  AutoComplete,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  ArrowLeftOutlined,
  FilePdfOutlined,
  PlusOutlined,
  PrinterOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import useFarmStore from '@/store/farm'
import { fetchFullChainNodes } from '@/api/trace'
import { listInspectionsByBatch } from '@/api/quality'
import { getHarvest, listHarvests } from '@/api/harvests'
import { listGrowthRecords } from '@/api/growth'
import { listInputUsages } from '@/api/inputs'
import type { HarvestBatch, RawInspection, TraceReport } from '@/types'

/** 报告本地存储键 */
const STORAGE_KEY = 'agri_trace_reports_v1'

/** 生成报告表单值 */
interface GenerateFormValues {
  /** 批次 ID / 批次号 */
  batchId: string
  /** 溯源码（可空） */
  code?: string
}

/**
 * 读取本地报告清单。
 *
 * @returns 报告列表
 */
function readReports(): TraceReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as TraceReport[]) : []
  } catch {
    return []
  }
}

/**
 * 写入本地报告清单。
 *
 * @param list 报告列表
 */
function writeReports(list: TraceReport[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // localStorage 不可用时静默降级为内存态
  }
}

/** 仅保留日期 */
function formatDate(value?: string): string {
  if (!value) return '-'
  const date = dayjs(value)
  return date.isValid() ? date.format('YYYY-MM-DD') : value
}

/** HTML 转义，避免报告内容破坏导出文档结构 */
function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"]/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      default:
        return '&quot;'
    }
  })
}

/**
 * 组装可打印的独立 HTML 报告文档。
 *
 * @param report 溯源报告
 * @returns HTML 文本
 */
function buildReportHtml(report: TraceReport): string {
  const rows: string[] = []
  const push = (title: string, items: [string, unknown][]): void => {
    rows.push(`<h2>${escapeHtml(title)}</h2><table>${items
      .map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value)}</td></tr>`)
      .join('')}</table>`)
  }
  push('一、产品基本信息', [
    ['产品名称', report.productName ?? '-'],
    ['品种', report.variety ?? '-'],
    ['质量等级', report.grade ?? '-'],
    ['产地', [report.region, report.farmName, report.plotName].filter(Boolean).join(' · ') || '-'],
    ['批次号', report.batchNo ?? report.batchId ?? '-'],
    ['采收日期', formatDate(report.harvestDate)],
  ])
  push('二、生产过程记录', [
    ['种植日期', formatDate(report.plantDate)],
    ['灌溉方式', report.irrigation ?? '-'],
    ['土壤类型', report.soilType ?? '-'],
    ['施肥记录', `${report.fertilizeCount} 次`],
    ['病虫害防治', `${report.protectCount} 次`],
    ['投入品合规', report.inputCompliant ? '✅ 全部投入品合规' : '⚠️ 存在待核查投入品'],
  ])
  push('三、质量检测', [
    ['检测编号', report.inspectionNo ?? '-'],
    ['检测机构', report.labName ?? '-'],
    ['检测结果', report.inspectResult ?? '-'],
    ['综合评级', report.inspectGrade ?? '-'],
  ])
  push('四、区块链存证', [
    ['全链路存证记录', `${report.chainTotal} 条`],
    ['已上链记录', `${report.chainOnChain} 条`],
    ['验证状态', report.verifyPassed ? '✅ 通过' : '⏳ 待上链'],
  ])
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8" />
<title>${escapeHtml(report.reportNo)}</title>
<style>body{font-family:"Microsoft YaHei",sans-serif;padding:32px;color:#1f1f1f}
h1{text-align:center}h2{font-size:16px;margin-top:24px;border-left:4px solid #52c41a;padding-left:8px}
table{width:100%;border-collapse:collapse;margin-top:8px}
th,td{border:1px solid #d9d9d9;padding:8px 12px;text-align:left;font-size:13px}
th{width:160px;background:#fafafa}.meta{text-align:center;color:#8c8c8c;font-size:13px}</style>
</head><body><h1>📑 产品溯源报告</h1>
<div class="meta">溯源码 ${escapeHtml(report.code)} · 生成时间 ${escapeHtml(report.generatedAt)} · 报告编号 ${escapeHtml(report.reportNo)}</div>
${rows.join('')}</body></html>`
}

/**
 * 溯源报告页
 *
 * 业务职责：生成、预览、导出与打印面向消费者 / 监管的正式溯源报告。
 *
 * @returns 页面内容
 */
export default function Reports(): JSX.Element {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const currentFarm = useFarmStore((state) => state.currentFarm)
  const farmId = currentFarm?.farmId

  const paramBatchId = searchParams.get('batchId') ?? ''
  const paramCode = searchParams.get('code') ?? ''

  const [reports, setReports] = useState<TraceReport[]>(() => readReports())
  const [genOpen, setGenOpen] = useState<boolean>(false)
  const [preview, setPreview] = useState<TraceReport | null>(null)
  const [genForm] = Form.useForm<GenerateFormValues>()

  /** 采收批次下拉 */
  const batchQuery = useQuery({
    queryKey: ['harvest-batch-options', farmId],
    enabled: Boolean(farmId),
    queryFn: () => listHarvests({ farmId, pageNum: 1, pageSize: 100 }),
  })

  /** 批次下拉选项 */
  const batchOptions = useMemo(
    () =>
      (batchQuery.data?.list ?? []).map((batch: HarvestBatch) => ({
        value: String(batch.batchId),
        label: `${batch.batchNo ?? batch.batchId} · ${batch.cropName ?? batch.cropId ?? '未知名产品'}`,
      })),
    [batchQuery.data],
  )

  /**
   * 持久化报告清单。
   *
   * @param next 最新报告列表
   */
  const persist = (next: TraceReport[]): void => {
    setReports(next)
    writeReports(next)
  }

  /** 生成报告：汇总批次 / 检测 / 全链路 / 生产过程真实数据 */
  const generateMutation = useMutation({
    mutationFn: async (values: GenerateFormValues): Promise<TraceReport> => {
      const batchId = String(values.batchId).trim()
      const code = (values.code ?? '').trim()
      const batch = await getHarvest(batchId)
      const plotId = String(batch.plotId ?? '')

      const [nodes, inspections, growth, usages] = await Promise.all([
        fetchFullChainNodes(batchId),
        listInspectionsByBatch(batchId),
        plotId
          ? listGrowthRecords({ plotId, pageNum: 1, pageSize: 100 })
          : Promise.resolve({ list: [], total: 0, pageNum: 1, pageSize: 0, pages: 0 }),
        plotId
          ? listInputUsages({ plotId, pageNum: 1, pageSize: 100 })
          : Promise.resolve({ list: [], total: 0, pageNum: 1, pageSize: 0, pages: 0 }),
      ])

      const plotGrowth = plotId
        ? (growth.list ?? []).filter((item) => String(item.plotId) === plotId)
        : []
      const plotUsages = plotId
        ? (usages.list ?? []).filter((item) => String(item.plotId ?? '') === plotId)
        : []
      const sortedGrowth = [...plotGrowth].sort((a, b) =>
        String(a.recordDate).localeCompare(String(b.recordDate)),
      )
      const inspection = (inspections ?? [])[0] as RawInspection | undefined

      const chainTotal =
        plotGrowth.length + plotUsages.length + (inspections?.length ?? 0) + (nodes?.length ?? 0)
      const chainOnChain =
        plotGrowth.filter((item) => item.onChain).length +
        plotUsages.filter((item) => item.onChain).length +
        (inspections ?? []).filter((item) => item.onChain).length +
        (nodes ?? []).filter((item) => item.onChain).length

      const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
      return {
        reportId: `RPT${Date.now()}`,
        reportNo: `RPT${dayjs().format('YYYYMMDD')}${String(reports.length + 1).padStart(3, '0')}`,
        code: code || '—',
        batchId,
        batchNo: batch.batchNo ?? batchId,
        productName: batch.cropName ?? batch.cropId,
        variety: batch.cropVariety,
        grade: batch.grade,
        farmName: currentFarm?.farmName,
        plotName: batch.plotName ?? batch.plotId,
        region: currentFarm?.farmName,
        harvestDate: batch.harvestDate,
        plantDate: sortedGrowth[0]?.recordDate,
        irrigation: undefined,
        soilType: undefined,
        fertilizeCount: plotUsages.length,
        protectCount: plotGrowth.filter((item) => Boolean(item.pestInfo)).length,
        inputCompliant: plotUsages.every((item) => item.onChain) || plotUsages.length === 0,
        inspectionNo: inspection?.inspectionNo ?? inspection?.inspectionId,
        labName: inspection?.labName,
        inspectResult:
          inspection?.result === 'PASS'
            ? '合格（各项指标均未超标）'
            : inspection?.result === 'FAIL'
              ? '不合格（存在超标项）'
              : '暂无检测结论',
        inspectGrade: batch.grade,
        chainTotal,
        chainOnChain,
        verifyPassed: chainTotal > 0 && chainOnChain === chainTotal,
        generatedAt: now,
      }
    },
    onSuccess: (report) => {
      persist([report, ...reports])
      setGenOpen(false)
      setPreview(report)
      message.success(`报告 ${report.reportNo} 已生成`)
    },
    onError: () => {
      message.error('生成报告失败，请确认批次是否存在')
    },
  })

  /** 提交生成 */
  const submitGenerate = (): void => {
    void genForm.validateFields().then((values) => {
      generateMutation.mutate(values)
    })
  }

  /** 打印当前预览报告 */
  const handlePrint = (): void => {
    if (!preview) {
      message.warning('请先预览一份溯源报告')
      return
    }
    window.print()
  }

  /** 下载 PDF（调起独立报告窗口的打印，可在打印对话框中选择「另存为 PDF」） */
  const handleDownloadPdf = (report: TraceReport): void => {
    const win = window.open('', '_blank')
    if (!win) {
      message.warning('浏览器阻止了弹窗，请允许弹窗后重试')
      return
    }
    win.document.write(buildReportHtml(report))
    win.document.close()
    win.focus()
    win.print()
    message.info('已调起打印，请在打印对话框中选择「另存为 PDF」')
  }

  /** 删除报告 */
  const handleDelete = (reportId: string): void => {
    persist(reports.filter((item) => item.reportId !== reportId))
    if (preview?.reportId === reportId) setPreview(null)
    message.success('报告已删除')
  }

  /** 表格列定义 */
  const columns: ProColumns<TraceReport>[] = [
    { title: '报告编号', dataIndex: 'reportNo', width: 170 },
    {
      title: '溯源码',
      dataIndex: 'code',
      width: 220,
      render: (_, record) => <Typography.Text code>{record.code}</Typography.Text>,
    },
    { title: '批次号', key: 'batchNo', width: 150, render: (_, r) => r.batchNo ?? r.batchId ?? '-' },
    { title: '产品名称', dataIndex: 'productName', width: 140, render: (_, r) => r.productName ?? '-' },
    { title: '生成时间', dataIndex: 'generatedAt', width: 180 },
    {
      title: '存证状态',
      key: 'chain',
      width: 150,
      render: (_, record) => (
        <Space size={4}>
          <Tag color={record.verifyPassed ? 'green' : 'orange'}>
            {record.chainOnChain}/{record.chainTotal} 已上链
          </Tag>
          {record.verifyPassed && <Tag color="green">✅ 通过</Tag>}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'option',
      width: 240,
      valueType: 'option',
      render: (_, record) => [
        <Typography.Link key="preview" onClick={() => setPreview(record)}>
          预览
        </Typography.Link>,
        <Typography.Link key="pdf" onClick={() => handleDownloadPdf(record)}>
          下载PDF
        </Typography.Link>,
        <Typography.Link
          key="print"
          onClick={() => {
            setPreview(record)
            window.setTimeout(() => window.print(), 300)
          }}
        >
          打印
        </Typography.Link>,
        <Popconfirm
          key="delete"
          title="确认删除该报告？"
          okText="确认删除"
          cancelText="取消"
          onConfirm={() => handleDelete(record.reportId)}
        >
          <Typography.Link type="danger">删除</Typography.Link>
        </Popconfirm>,
      ],
    },
  ]

  return (
    <PageContainer
      title={
        <Space>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/production/trace')}
          >
            返回
          </Button>
          <span>溯源报告</span>
        </Space>
      }
      subTitle={currentFarm ? currentFarm.farmName : undefined}
      extra={[
        <Button
          key="create"
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setGenOpen(true)}
        >
          + 生成报告
        </Button>,
        <Button
          key="pdf"
          icon={<FilePdfOutlined />}
          disabled={!preview}
          onClick={handlePrint}
        >
          下载PDF
        </Button>,
        <Button key="print" icon={<PrinterOutlined />} disabled={!preview} onClick={handlePrint}>
          打印
        </Button>,
      ]}
    >
      {/* 打印时仅保留报告正文 */}
      <style>
        {`@media print {
          body * { visibility: hidden; }
          .trace-report-print, .trace-report-print * { visibility: visible; }
          .trace-report-print { position: absolute; left: 0; top: 0; width: 100%; }
        }`}
      </style>

      <ProTable<TraceReport>
        rowKey="reportId"
        size="small"
        columns={columns}
        dataSource={reports}
        search={false}
        options={{ density: true, setting: true }}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 份` }}
        locale={{
          emptyText: (
            <Empty description="暂无溯源报告，点击右上角「+ 生成报告」按批次生成" />
          ),
        }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setGenOpen(true)}
          >
            + 生成报告
          </Button>,
        ]}
      />

      <Modal
        title="生成溯源报告"
        open={genOpen}
        okText="生成报告"
        cancelText="取消"
        confirmLoading={generateMutation.isPending}
        destroyOnClose
        onOk={submitGenerate}
        onCancel={() => setGenOpen(false)}
      >
        <Form
          form={genForm}
          layout="vertical"
          style={{ marginTop: 16 }}
          initialValues={{ batchId: paramBatchId, code: paramCode }}
        >
          <Form.Item
            name="batchId"
            label="关联批次"
            rules={[{ required: true, message: '请选择或输入采收批次 ID' }]}
            extra="报告正文将实时汇总该批次的生产、检测与存证数据"
          >
            <AutoComplete
              options={batchOptions}
              placeholder="选择或输入采收批次 ID"
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <Form.Item name="code" label="溯源码">
            <Input allowClear placeholder="如 AG010101202606010001（可空）" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={preview ? `📑 产品溯源报告 · ${preview.reportNo}` : '报告预览'}
        width={900}
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        extra={
          preview ? (
            <Space>
              <Button icon={<FilePdfOutlined />} onClick={() => handleDownloadPdf(preview)}>
                下载PDF
              </Button>
              <Button icon={<PrinterOutlined />} onClick={handlePrint}>
                打印
              </Button>
            </Space>
          ) : null
        }
      >
        {preview && (
          <div className="trace-report-print">
            <Descriptions title="📑 产品溯源报告" column={2} bordered size="small">
              <Descriptions.Item label="溯源码">{preview.code}</Descriptions.Item>
              <Descriptions.Item label="生成时间">{preview.generatedAt}</Descriptions.Item>
            </Descriptions>

            <Descriptions
              title="一、产品基本信息"
              column={2}
              bordered
              size="small"
              style={{ marginTop: 16 }}
            >
              <Descriptions.Item label="产品名称">{preview.productName ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="品种">{preview.variety ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="质量等级">
                {preview.grade ? <Tag color="blue">{preview.grade} 级</Tag> : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="产地">
                {[preview.region, preview.farmName, preview.plotName].filter(Boolean).join(' · ') ||
                  '-'}
              </Descriptions.Item>
              <Descriptions.Item label="批次号">
                {preview.batchNo ?? preview.batchId ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="采收日期">
                {formatDate(preview.harvestDate)}
              </Descriptions.Item>
            </Descriptions>

            <Descriptions
              title="二、生产过程记录"
              column={2}
              bordered
              size="small"
              style={{ marginTop: 16 }}
            >
              <Descriptions.Item label="种植日期">
                {formatDate(preview.plantDate)}
              </Descriptions.Item>
              <Descriptions.Item label="灌溉方式">{preview.irrigation ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="土壤类型">{preview.soilType ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="施肥记录">
                {preview.fertilizeCount} 次
              </Descriptions.Item>
              <Descriptions.Item label="病虫害防治">{preview.protectCount} 次</Descriptions.Item>
              <Descriptions.Item label="投入品合规">
                {preview.inputCompliant ? '✅ 全部投入品合规' : '⚠️ 存在待核查投入品'}
              </Descriptions.Item>
            </Descriptions>

            <Descriptions
              title="三、质量检测"
              column={2}
              bordered
              size="small"
              style={{ marginTop: 16 }}
            >
              <Descriptions.Item label="检测编号">{preview.inspectionNo ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="检测机构">{preview.labName ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="检测结果" span={2}>
                {preview.inspectResult ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="综合评级">
                {preview.inspectGrade ? <Tag color="green">{preview.inspectGrade} 级</Tag> : '-'}
              </Descriptions.Item>
            </Descriptions>

            <Descriptions
              title="四、区块链存证"
              column={2}
              bordered
              size="small"
              style={{ marginTop: 16 }}
            >
              <Descriptions.Item label="全链路存证记录">
                {preview.chainTotal} 条
              </Descriptions.Item>
              <Descriptions.Item label="已上链记录">{preview.chainOnChain} 条</Descriptions.Item>
              <Descriptions.Item label="验证状态" span={2}>
                {preview.verifyPassed ? '✅ 通过' : '⏳ 待上链'}
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Drawer>
    </PageContainer>
  )
}

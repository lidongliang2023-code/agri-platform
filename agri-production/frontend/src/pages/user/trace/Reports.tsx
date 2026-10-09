/**
 * 页面名称：溯源报告
 * 路由路径：/production/trace/reports
 * 所属模块：质量检测与溯源
 * 原型来源：用户端原型 P26 trace-reports（原型补充页面）
 *
 * 还原要点：
 * - 头部 `< 返回 溯源报告`（→trace）+ `下载PDF` / `打印` 按钮
 * - 报告列表：报告编号 / 溯源码 / 批次号 / 产品名称 / 生成时间 / 数据来源 / 操作
 * - 支持「+ 生成报告」：按批次 / 溯源码实时汇总数据生成报告
 * - 报告预览为原型 P26 四章结构：
 *   一、产品基本信息 二、生产过程记录 三、质量检测 四、区块链存证
 *
 * ============================ 重要设计说明 ============================
 * 后端**没有**溯源报告存储能力（已核实：无 prod_trace_report 或任何溯源报告表；
 * prod_report_task 是「运营报表任务」，字段为 reportType/farmId/bizDateFrom/fileUrl，
 * 没有 batchId / 溯源码 / 产品名称 / 等级，语义不匹配，无法承接）。
 *
 * 因此本页采用【方案一：实时聚合、不落库】：
 * - 「生成报告」= 现场调真实业务接口聚合成一份报告 → 直接预览 / 打印 / 另存 PDF；
 * - **不写 localStorage、不产生历史清单**：刷新或关闭页面后报告消失；
 * - 页面上不存在"看起来像服务端返回的报告列表"，也就不存在"假清单"；
 * - 报告正文数据来源全部为真实接口：
 *     GET /harvests/{id}                      批次档案（产品 / 等级 / 采收日期 / 地块）
 *     GET /trace/full-chain/{batchId}/nodes   全链路节点
 *     GET /quality/inspections/by-batch       批次检测记录
 *     GET /growth                             生长监测记录
 *     GET /inputs/usages                      投入品使用记录
 * - 任何一项接口未返回，报告中该章节显示「— / 未接入」并在顶部明确列出，**不做本地估算**。
 * ======================================================================
 */
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { PageContainer, ProTable } from '@ant-design/pro-components'
import type { ProColumns } from '@ant-design/pro-components'
import {
  Alert,
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

/** 生成报告表单值 */
interface GenerateFormValues {
  /** 批次 ID / 批次号 */
  batchId: string
  /** 溯源码（可空） */
  code?: string
}

/**
 * 实时聚合生成的报告。
 *
 * 与 TraceReport 的区别：所有"后端可能拿不到"的字段改为可选，
 * 取不到时渲染为「— / 未接入」，绝不填 0、绝不本地估算。
 */
interface GeneratedReport
  extends Omit<
    TraceReport,
    'chainTotal' | 'chainOnChain' | 'verifyPassed' | 'fertilizeCount' | 'protectCount' | 'inputCompliant'
  > {
  /** 投入品使用记录条数（后端返回时才有值） */
  fertilizeCount?: number
  /** 病虫害防治次数（后端未提供该口径，恒为 undefined） */
  protectCount?: number
  /** 投入品是否全部合规（后端未提供合规校验结果，恒为 undefined） */
  inputCompliant?: boolean
  /** 全链路记录数（后端返回时才有值） */
  chainTotal?: number
  /** 已上链记录数（后端未提供上链状态字段，恒为 undefined） */
  chainOnChain?: number
  /** 链上验证是否通过（后端未提供上链状态字段，恒为 undefined） */
  verifyPassed?: boolean
  /** 本次未能取到的数据源名称（用于报告中明示，不静默留空） */
  unavailable: string[]
}

/** 仅保留日期 */
function formatDate(value?: string): string {
  if (!value) return '-'
  const date = dayjs(value)
  return date.isValid() ? date.format('YYYY-MM-DD') : value
}

/**
 * 可选数值渲染：取不到时显示占位文案。
 *
 * @param value 数值
 * @param unit 单位
 * @param placeholder 缺失占位
 * @returns 展示文案
 */
function formatCount(value: number | undefined, unit: string, placeholder = '未接入'): string {
  return value === undefined ? placeholder : `${value} ${unit}`
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
function buildReportHtml(report: GeneratedReport): string {
  const rows: string[] = []
  const push = (title: string, items: [string, unknown][]): void => {
    rows.push(`<h2>${escapeHtml(title)}</h2><table>${items
      .map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value)}</td></tr>`)
      .join('')}</table>`)
  }
  push('一、产品基本信息', [
    ['产品名称', report.productName ?? '—'],
    ['品种', report.variety ?? '—'],
    ['质量等级', report.grade ?? '—'],
    ['产地', [report.region, report.farmName, report.plotName].filter(Boolean).join(' · ') || '—'],
    ['批次号', report.batchNo ?? report.batchId ?? '—'],
    ['采收日期', formatDate(report.harvestDate)],
  ])
  push('二、生产过程记录', [
    ['种植日期', formatDate(report.plantDate)],
    ['灌溉方式', report.irrigation ?? '未接入'],
    ['土壤类型', report.soilType ?? '未接入'],
    ['投入品使用记录', formatCount(report.fertilizeCount, '条')],
    ['病虫害防治记录', formatCount(report.protectCount, '次')],
    ['投入品合规结论', report.inputCompliant === undefined ? '未接入' : report.inputCompliant ? '全部合规' : '存在待核查项'],
  ])
  push('三、质量检测', [
    ['检测编号', report.inspectionNo ?? '—'],
    ['检测机构', report.labName ?? '—'],
    ['检测结论', report.inspectResult ?? '—'],
    ['质量等级（采收初评）', report.inspectGrade ?? '—'],
  ])
  push('四、区块链存证', [
    ['全链路存证记录', formatCount(report.chainTotal, '条')],
    ['已上链记录', report.chainOnChain === undefined ? '未接入（后端未提供上链状态字段）' : `${report.chainOnChain} 条`],
    ['验证状态', report.verifyPassed === undefined ? '未接入' : report.verifyPassed ? '通过' : '待上链'],
  ])
  const unavailableHtml =
    report.unavailable.length > 0
      ? `<p style="color:#d46b08">⚠️ 本次未能取到的数据源：${escapeHtml(report.unavailable.join('、'))}（后端未返回，报告中标注为「未接入」，未做任何本地估算）</p>`
      : ''
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8" />
<title>${escapeHtml(report.reportNo)}</title>
<style>body{font-family:"Microsoft YaHei",sans-serif;padding:32px;color:#1f1f1f}
h1{text-align:center}h2{font-size:16px;margin-top:24px;border-left:4px solid #52c41a;padding-left:8px}
table{width:100%;border-collapse:collapse;margin-top:8px}
th,td{border:1px solid #d9d9d9;padding:8px 12px;text-align:left;font-size:13px}
th{width:160px;background:#fafafa}.meta{text-align:center;color:#8c8c8c;font-size:13px}</style>
</head><body><h1>📑 产品溯源报告</h1>
<div class="meta">溯源码 ${escapeHtml(report.code || '未填写')} · 生成时间 ${escapeHtml(report.generatedAt)} · 报告编号 ${escapeHtml(report.reportNo)}</div>
<p style="color:#8c8c8c;font-size:12px">本报告为实时聚合生成，未保存到服务端；重新生成即可获得最新数据。</p>
${unavailableHtml}
${rows.join('')}</body></html>`
}

/**
 * 溯源报告页
 *
 * 业务职责：按批次实时聚合并预览 / 导出面向消费者与监管的溯源报告（不落库、不产生清单）。
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

  /** 当前实时生成的报告（刷新即消失，不持久化） */
  const [preview, setPreview] = useState<GeneratedReport | null>(null)
  const [genOpen, setGenOpen] = useState<boolean>(false)
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
   * 生成报告：汇总批次 / 检测 / 全链路 / 生产过程真实数据。
   *
   * 约定：批次档案取不到 = 整体失败；其余数据源取不到则记录到 unavailable 并标注「未接入」。
   */
  const generateMutation = useMutation({
    mutationFn: async (values: GenerateFormValues): Promise<GeneratedReport> => {
      const batchId = String(values.batchId).trim()
      const code = (values.code ?? '').trim()

      /** 本次未能取到的数据源（后端报错 / 未返回） */
      const unavailable: string[] = []
      /** 批次档案：取不到直接判定生成失败 */
      const batch = await getHarvest(batchId)
      const plotId = String(batch.plotId ?? '')

      if (!plotId) {
        unavailable.push('生长监测记录（该批次未关联地块）', '投入品使用记录（该批次未关联地块）')
      }

      const [nodes, inspections, growth, usages] = await Promise.all([
        fetchFullChainNodes(batchId).catch(() => {
          unavailable.push('全链路节点')
          return null
        }),
        listInspectionsByBatch(batchId).catch(() => {
          unavailable.push('质量检测记录')
          return null
        }),
        plotId
          ? listGrowthRecords({ plotId, pageNum: 1, pageSize: 100 }).catch(() => {
              unavailable.push('生长监测记录')
              return null
            })
          : Promise.resolve(null),
        plotId
          ? listInputUsages({ plotId, pageNum: 1, pageSize: 100 }).catch(() => {
              unavailable.push('投入品使用记录')
              return null
            })
          : Promise.resolve(null),
      ])

      const plotGrowth = plotId
        ? (growth?.list ?? []).filter((item) => String(item.plotId) === plotId)
        : []
      const plotUsages = plotId
        ? (usages?.list ?? []).filter((item) => String(item.plotId ?? '') === plotId)
        : []
      const sortedGrowth = [...plotGrowth].sort((a, b) =>
        String(a.recordDate).localeCompare(String(b.recordDate)),
      )
      const inspection = (inspections ?? [])[0] as RawInspection | undefined

      const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
      return {
        reportId: `RPT${Date.now()}`,
        reportNo: `RPT${dayjs().format('YYYYMMDDHHmmss')}`,
        code: code || '',
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
        // 灌溉方式 / 土壤类型：后端无对应字段，保持缺失 → 渲染为「未接入」
        irrigation: undefined,
        soilType: undefined,
        // 投入品使用记录条数（口径：prod_input_usage 中该地块的记录数）
        fertilizeCount: usages ? plotUsages.length : undefined,
        // 病虫害防治：后端未提供防治记录口径，不做估算
        protectCount: undefined,
        // 投入品合规：后端未提供合规校验结果，不做估算
        inputCompliant: undefined,
        inspectionNo: inspection?.inspectionNo ?? inspection?.inspectionId,
        labName: inspection?.labName,
        inspectResult:
          inspection === undefined
            ? undefined
            : inspection.result === 'PASS'
              ? '合格'
              : inspection.result === 'FAIL'
                ? '不合格（存在超标项）'
                : '暂无检测结论',
        inspectGrade: batch.grade,
        // 全链路节点数（后端返回才有值）
        chainTotal: nodes ? nodes.length : undefined,
        // 上链状态：后端返回体中不存在 onChain 字段，一律按「未接入」呈现
        chainOnChain: undefined,
        verifyPassed: undefined,
        generatedAt: now,
        unavailable,
      }
    },
    onSuccess: (report) => {
      setPreview(report)
      setGenOpen(false)
      message.success(
        report.unavailable.length > 0
          ? `报告 ${report.reportNo} 已生成（实时聚合，未保存到服务端）；有 ${report.unavailable.length} 项数据未取到，已在报告中标注`
          : `报告 ${report.reportNo} 已生成（实时聚合，未保存到服务端）`,
      )
    },
    onError: () => {
      message.error('生成报告失败：未能读取该批次档案，请确认批次是否存在')
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
      message.warning('请先生成一份溯源报告')
      return
    }
    window.print()
  }

  /** 下载 PDF（调起独立报告窗口的打印，可在打印对话框中选择「另存为 PDF」） */
  const handleDownloadPdf = (report: GeneratedReport): void => {
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

  /** 丢弃当前报告（本页不保存任何报告，丢弃即回到空态） */
  const handleDiscard = (): void => {
    setPreview(null)
    message.success('已丢弃当前报告（本页不保存报告，如需留存请打印或另存为 PDF）')
  }

  /** 表格列定义 */
  const columns: ProColumns<GeneratedReport>[] = [
    {
      title: '报告编号',
      dataIndex: 'reportNo',
      width: 200,
      render: (_, record) => (
        <Space size={4}>
          <span>{record.reportNo}</span>
          <Tag color="purple">实时生成·未保存</Tag>
        </Space>
      ),
    },
    {
      title: '溯源码',
      dataIndex: 'code',
      width: 200,
      render: (_, record) =>
        record.code ? <Typography.Text code>{record.code}</Typography.Text> : <Typography.Text type="secondary">未填写</Typography.Text>,
    },
    { title: '批次号', key: 'batchNo', width: 150, render: (_, r) => r.batchNo ?? r.batchId ?? '-' },
    { title: '产品名称', dataIndex: 'productName', width: 140, render: (_, r) => r.productName ?? '-' },
    { title: '生成时间', dataIndex: 'generatedAt', width: 180 },
    {
      title: '数据来源',
      key: 'source',
      width: 180,
      render: (_, record) =>
        record.unavailable.length > 0 ? (
          <Tag color="orange">{record.unavailable.length} 项未取到</Tag>
        ) : (
          <Tag color="green">全部取自真实接口</Tag>
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
          key="discard"
          title="确认丢弃当前报告？"
          description="本页不保存任何报告，丢弃后需重新生成"
          okText="确认丢弃"
          cancelText="取消"
          onConfirm={handleDiscard}
        >
          <Typography.Link type="danger">丢弃</Typography.Link>
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
          onClick={() => preview && handleDownloadPdf(preview)}
        >
          下载PDF
        </Button>,
        <Button key="print" icon={<PrinterOutlined />} disabled={!preview} onClick={handlePrint}>
          打印
        </Button>,
      ]}
    >
      <Alert
        type="warning"
        showIcon
        banner
        message="⚠️ 溯源报告为实时生成，不会保存：后端暂无报告存储能力，本页不落库、也不产生报告清单"
        description={
          <span>
            后端<strong>没有溯源报告表</strong>（<Typography.Text code>prod_report_task</Typography.Text>{' '}
            是运营报表任务，字段不含批次 / 溯源码 / 产品，无法承接），因此本页
            <strong>不做任何本地清单</strong>：点击「+ 生成报告」会现场调用真实业务接口
            （采收批次 / 全链路节点 / 质量检测 / 生长监测 / 投入品使用）聚合成一份报告，
            供预览、打印或另存为 PDF。
            <br />
            <strong>刷新页面、关闭页面后报告即消失</strong>，也不会出现在任何其他设备或账号下。
            如需留存，请直接打印或「另存为 PDF」。
            <br />
            报告正文中任何后端未返回的字段一律显示「— / 未接入」，
            <strong>不做本地估算、不填 0、不填随机数</strong>。
          </span>
        }
      />

      {/* 打印时仅保留报告正文 */}
      <style>
        {`@media print {
          body * { visibility: hidden; }
          .trace-report-print, .trace-report-print * { visibility: visible; }
          .trace-report-print { position: absolute; left: 0; top: 0; width: 100%; }
        }`}
      </style>

      <ProTable<GeneratedReport>
        rowKey="reportId"
        size="small"
        columns={columns}
        dataSource={preview ? [preview] : []}
        search={false}
        options={{ density: true, setting: true }}
        pagination={false}
        locale={{
          emptyText: (
            <Empty
              description={
                <Space direction="vertical" size={8}>
                  <Typography.Text>当前没有报告 —— 本页不保存报告，也不展示历史清单</Typography.Text>
                  <Typography.Text type="secondary">
                    点击右上角「+ 生成报告」，按批次实时聚合生成（正文数据来自真实业务接口）
                  </Typography.Text>
                </Space>
              }
            />
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
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 8 }}
          message="生成结果不会被保存，仅用于本次预览 / 打印"
        />
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
            extra="报告正文将实时汇总该批次的生产、检测与全链路数据"
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
            <Input allowClear placeholder="如 DEMO-TC-0001（可空，留空则报告中显示「未填写」）" />
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
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="本报告为实时聚合生成，未保存到服务端；刷新或关闭后即消失"
              description={
                preview.unavailable.length > 0
                  ? `本次未取到的数据源：${preview.unavailable.join('、')}（报告中标注为「未接入」，未做任何本地估算）`
                  : '全部章节均取自真实业务接口'
              }
            />

            <Descriptions title="📑 产品溯源报告" column={2} bordered size="small">
              <Descriptions.Item label="溯源码">
                {preview.code || <Typography.Text type="secondary">未填写</Typography.Text>}
              </Descriptions.Item>
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
                {preview.grade ? <Tag color="blue">{preview.grade}</Tag> : '-'}
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
              <Descriptions.Item label="灌溉方式">{preview.irrigation ?? '未接入'}</Descriptions.Item>
              <Descriptions.Item label="土壤类型">{preview.soilType ?? '未接入'}</Descriptions.Item>
              <Descriptions.Item label="投入品使用记录">
                {formatCount(preview.fertilizeCount, '条')}
              </Descriptions.Item>
              <Descriptions.Item label="病虫害防治记录">
                {formatCount(preview.protectCount, '次')}
              </Descriptions.Item>
              <Descriptions.Item label="投入品合规结论">
                {preview.inputCompliant === undefined
                  ? '未接入（后端未提供合规校验结果）'
                  : preview.inputCompliant
                    ? '✅ 全部投入品合规'
                    : '⚠️ 存在待核查投入品'}
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
              <Descriptions.Item label="检测结论" span={2}>
                {preview.inspectResult ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="质量等级（采收初评）">
                {preview.inspectGrade ? <Tag color="green">{preview.inspectGrade}</Tag> : '-'}
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
                {formatCount(preview.chainTotal, '条')}
              </Descriptions.Item>
              <Descriptions.Item label="已上链记录">
                {preview.chainOnChain === undefined ? '未接入（后端未提供上链状态字段）' : `${preview.chainOnChain} 条`}
              </Descriptions.Item>
              <Descriptions.Item label="验证状态" span={2}>
                {preview.verifyPassed === undefined ? (
                  <Typography.Text type="secondary">未接入</Typography.Text>
                ) : preview.verifyPassed ? (
                  '✅ 通过'
                ) : (
                  '⏳ 待上链'
                )}
              </Descriptions.Item>
            </Descriptions>

            <Typography.Paragraph type="secondary" style={{ marginTop: 16, fontSize: 12 }}>
              数据口径：产品名称 / 等级 / 采收日期取自 GET /harvests/{'{id}'}；种植日期取自生长记录最早一条；
              投入品使用记录取自 GET /inputs/usages（按地块过滤）；检测结论取自 GET /quality/inspections/by-batch；
              全链路记录数取自 GET /trace/full-chain/{'{batchId}'}/nodes。
              灌溉方式、土壤类型、病虫害防治、投入品合规、上链状态后端均未返回，按「未接入」呈现。
            </Typography.Paragraph>
          </div>
        )}
      </Drawer>
    </PageContainer>
  )
}

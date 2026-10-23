/**
 * 页面名称：新增农场
 * 路由路径：/production/farms/create
 * 所属模块：农场数字化管理
 * 原型来源：用户端原型 P3 farm-create
 *
 * 还原要点（对照原型 P3）：
 * - 头部 `< 返回农场列表` ／ 新增农场
 * - 分节「农场基本信息」：农场名称（2-50 字符，主体内唯一校验）、农场类型（radio 六项，默认蔬菜种植）、
 *   省/市/区三级联动、详细地址、面积（亩）、海拔（米）、负责人、联系电话、农场简介（500 字计数）
 * - 分节「资质信息（可选）」：无公害农产品 / 有机认证 / 绿色食品认证 / 地理标志认证 / GAP 认证（多选）
 * + 证书附件上传区：JPG、PNG、PDF，单个文件 ≤10MB，已选文件可预览与删除
 * - 底部三按钮：`取消`、`保存并继续添加地块 →`、`保存并查看详情`
 *
 * 补充说明：后端 FarmInfoEntity 无「海拔」「简介」字段，统一以
 * `海拔:35m；产业类型:蔬菜种植；简介:xxx` 结构持久化到 remark 字段。
 */
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { PageContainer } from '@ant-design/pro-components'
import { FilePdfOutlined, FileTextOutlined, InboxOutlined, LeftOutlined } from '@ant-design/icons'
import {
  Button,
  Card,
  Cascader,
  Checkbox,
  Divider,
  Form,
  Input,
  InputNumber,
  Radio,
  Space,
  Typography,
  Upload,
  message,
} from 'antd'
import { createFarm, createFarmCert, getFarm, listFarms, updateFarm } from '@/api/farms'
import type { FarmCertPayload } from '@/api/farms'
import type { FarmCertType, PageQuery } from '@/types'

/** 单个文件上限（10MB） */
const MAX_FILE_SIZE = 10 * 1024 * 1024

/** 允许上传的扩展名 */
const ACCEPT_EXT = /\.(jpg|jpeg|png|pdf)$/i

/**
 * 资质选项 → 后端 certType 枚举。
 *
 * ⚠️ 后端 `FarmCertEntity.certType` 只开放 4 个取值：GREEN / ORGANIC / GEO / HACCP，
 * 而原型 P3 有 5 种资质名称，无法一一对应。此处的映射是把原型选项就近归到已有枚举：
 * 安全 / 绿色类（无公害农产品、绿色食品认证）→ GREEN，体系类（GAP）→ HACCP。
 * 后端若补齐 `OTHER` / `GAP` / `WUWUHAI` 等枚举值，此处需同步放开。
 */
const CERT_CODE_MAP: Partial<Record<string, FarmCertType>> = {
  无公害农产品: 'GREEN',
  有机认证: 'ORGANIC',
  绿色食品认证: 'GREEN',
  地理标志认证: 'GEO',
  'GAP认证': 'HACCP',
}

/** 资质选项（原型 P3） */
const CERT_OPTIONS: string[] = [
  '无公害农产品',
  '有机认证',
  '绿色食品认证',
  '地理标志认证',
  'GAP认证',
]

/** 农场类型选项（原型 P3，默认选中蔬菜种植） */
const FARM_TYPE_OPTIONS: string[] = [
  '蔬菜种植',
  '水稻种植',
  '果树种植',
  '综合养殖',
  '畜牧养殖',
  '水产养殖',
]

/** 业务类型 → 后端 farmType（1 种植 2 养殖 3 混合） */
const BUSINESS_TYPE_VALUE_MAP: Record<string, number> = {
  蔬菜种植: 1,
  水稻种植: 1,
  果树种植: 1,
  综合养殖: 3,
  畜牧养殖: 2,
  水产养殖: 2,
}

/** 省市区级联数据节点 */
interface RegionNode {
  /** 行政名称 */
  value: string
  /** 展示文案 */
  label: string
  /** 下级节点 */
  children?: RegionNode[]
}

/** 内置省市区静态数据（覆盖原型示例地区与主要农业产区） */
const REGION_OPTIONS: RegionNode[] = [
  {
    value: '北京市',
    label: '北京市',
    children: [
      {
        value: '北京市',
        label: '北京市',
        children: [
          { value: '顺义区', label: '顺义区' },
          { value: '通州区', label: '通州区' },
          { value: '大兴区', label: '大兴区' },
          { value: '昌平区', label: '昌平区' },
          { value: '平谷区', label: '平谷区' },
        ],
      },
    ],
  },
  {
    value: '黑龙江省',
    label: '黑龙江省',
    children: [
      {
        value: '哈尔滨市',
        label: '哈尔滨市',
        children: [
          { value: '五常市', label: '五常市' },
          { value: '双城区', label: '双城区' },
          { value: '尚志市', label: '尚志市' },
        ],
      },
      {
        value: '齐齐哈尔市',
        label: '齐齐哈尔市',
        children: [
          { value: '龙江县', label: '龙江县' },
          { value: '讷河市', label: '讷河市' },
        ],
      },
    ],
  },
  {
    value: '山东省',
    label: '山东省',
    children: [
      {
        value: '烟台市',
        label: '烟台市',
        children: [
          { value: '栖霞市', label: '栖霞市' },
          { value: '莱山区', label: '莱山区' },
          { value: '福山区', label: '福山区' },
        ],
      },
      {
        value: '潍坊市',
        label: '潍坊市',
        children: [
          { value: '寿光市', label: '寿光市' },
          { value: '安丘市', label: '安丘市' },
        ],
      },
    ],
  },
  {
    value: '河南省',
    label: '河南省',
    children: [
      {
        value: '郑州市',
        label: '郑州市',
        children: [
          { value: '中牟县', label: '中牟县' },
          { value: '荥阳市', label: '荥阳市' },
        ],
      },
      {
        value: '周口市',
        label: '周口市',
        children: [
          { value: '太康县', label: '太康县' },
          { value: '淮阳区', label: '淮阳区' },
        ],
      },
    ],
  },
  {
    value: '江苏省',
    label: '江苏省',
    children: [
      {
        value: '南京市',
        label: '南京市',
        children: [
          { value: '六合区', label: '六合区' },
          { value: '溧水区', label: '溧水区' },
        ],
      },
      {
        value: '徐州市',
        label: '徐州市',
        children: [
          { value: '邳州市', label: '邳州市' },
          { value: '沛县', label: '沛县' },
        ],
      },
    ],
  },
  {
    value: '四川省',
    label: '四川省',
    children: [
      {
        value: '成都市',
        label: '成都市',
        children: [
          { value: '崇州市', label: '崇州市' },
          { value: '邛崃市', label: '邛崃市' },
        ],
      },
      {
        value: '绵阳市',
        label: '绵阳市',
        children: [
          { value: '安州区', label: '安州区' },
          { value: '江油市', label: '江油市' },
        ],
      },
    ],
  },
]

/** 已选文件项 */
interface UploadedFile {
  /** 唯一标识 */
  uid: string
  /** 文件名 */
  name: string
  /** 文件大小（字节） */
  size: number
  /** 是否 PDF */
  pdf: boolean
}

/** 表单值 */
interface FarmFormValues {
  /** 农场名称 */
  farmName: string
  /** 农场类型标签 */
  farmTypeLabel: string
  /** 省市区 */
  region: string[]
  /** 详细地址 */
  address: string
  /** 面积（亩） */
  areaTotal: number
  /** 海拔（米） */
  altitude?: number
  /** 负责人 */
  managerName: string
  /** 联系电话 */
  managerPhone: string
  /** 农场简介 */
  profile?: string
  /** 资质多选 */
  certNames?: string[]
}

/** 格式化文件体积 */
function formatSize(size: number): string {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)}MB`
  return `${Math.max(1, Math.round(size / 1024))}KB`
}

/** 组装 remark（海拔 / 产业类型 / 简介） */
function buildRemark(values: FarmFormValues): string {
  const parts: string[] = []
  if (values.altitude !== undefined && values.altitude !== null) {
    parts.push(`海拔:${values.altitude}m`)
  }
  if (values.farmTypeLabel) parts.push(`产业类型:${values.farmTypeLabel}`)
  if (values.profile) parts.push(`简介:${values.profile.replace(/[；;]/g, '，')}`)
  return parts.join('；')
}

/** 从 remark 解析自定义键值 */
function parseRemarkField(remark: string | undefined, key: string): string | undefined {
  if (!remark) return undefined
  const match = remark.match(new RegExp(`${key}[:：]\\s*([^；;]+)`))
  const value = match?.[1]?.trim()
  return value ? value : undefined
}

/**
 * 新增 / 编辑农场页面
 *
 * 业务职责：按原型 P3 分段表单录入农场信息，创建成功后可跳转继续添加地块或查看农场详情。
 *
 * @returns 页面内容
 */
export default function Create(): JSX.Element {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editingFarmId = searchParams.get('farmId')

  const [form] = Form.useForm<FarmFormValues>()
  const [fileList, setFileList] = useState<UploadedFile[]>([])
  const [submitAction, setSubmitAction] = useState<'plot' | 'detail'>('detail')

  /** 编辑态：加载原农场数据 */
  const farmQuery = useQuery({
    queryKey: ['farm-detail', editingFarmId],
    enabled: Boolean(editingFarmId),
    queryFn: () => getFarm(editingFarmId as string),
  })

  /** 回填编辑表单 */
  const initialValues = useMemo<FarmFormValues | undefined>(() => {
    const farm = farmQuery.data
    if (!farm) return undefined
    const region = [farm.province, farm.city, farm.district].filter(Boolean) as string[]
    const altitude = parseRemarkField(farm.remark, '海拔')
    return {
      farmName: farm.farmName,
      farmTypeLabel: parseRemarkField(farm.remark, '产业类型') ?? '蔬菜种植',
      region,
      address: farm.address,
      areaTotal: Number(farm.areaTotal) || 0,
      altitude: altitude ? Number(altitude.replace('m', '')) || undefined : undefined,
      managerName: farm.managerName,
      managerPhone: farm.managerPhone,
      profile: parseRemarkField(farm.remark, '简介'),
    }
  }, [farmQuery.data])

  /**
   * 创建 / 更新并提交资质。
   *
   * @param values 表单值
   * @param action 提交后跳转目标
   * @returns 农场 ID
   */
  const persist = async (values: FarmFormValues): Promise<string> => {
    // 字段映射约定（后端 FarmInfoEntity 无海拔 / 简介 / 业务类型等独立列）：
    // 海拔、简介、产业类型统一序列化写入 remark，格式 `海拔:35m；产业类型:蔬菜种植；简介:xxx`。
    // 后端未来补这些列时需同步迁移此处与读取侧（FarmList / FarmDetail 的 parseRemarkField）。
    const [province, city, district] = values.region ?? []
    const payload = {
      farmName: values.farmName,
      farmType: (BUSINESS_TYPE_VALUE_MAP[values.farmTypeLabel] ?? 1) as 1 | 2 | 3,
      province: province ?? '',
      city: city ?? '',
      district: district ?? '',
      address: values.address,
      areaTotal: Number(values.areaTotal) || 0,
      managerName: values.managerName,
      managerPhone: values.managerPhone,
      status: 1 as 0 | 1,
      remark: buildRemark(values),
    }

    let farmId = editingFarmId ?? ''
    if (farmId) {
      await updateFarm(farmId, payload)
    } else {
      // 后端 POST /farms 返回 ApiResponse<String>（新农场主键），直取即可。
      farmId = await createFarm(payload)
    }

    // 资质写库：新增场景根据用户勾选生成资质记录
    if (!editingFarmId && farmId && (values.certNames ?? []).length > 0) {
      const issueDate = new Date().toISOString().slice(0, 10)
      const expire = new Date()
      expire.setFullYear(expire.getFullYear() + 1)
      const expireDate = expire.toISOString().slice(0, 10)
      await Promise.allSettled(
        (values.certNames ?? []).map((certName) => {
          const payload: FarmCertPayload = {
            farmId,
            certName,
            certType: CERT_CODE_MAP[certName],
            issueDate,
            expireDate,
            attachUrl: fileList[0]?.name ?? '',
            status: 1,
          }
          return createFarmCert(farmId, payload)
        }),
      )
    }
    return farmId
  }

  /** 提交 mutation */
  const submitMutation = useMutation({
    mutationFn: async (params: { values: FarmFormValues; action: 'plot' | 'detail' }) => {
      const farmId = await persist(params.values)
      return { farmId, action: params.action }
    },
    onSuccess: ({ farmId, action }) => {
      message.success(editingFarmId ? '农场信息已保存' : '农场创建成功')
      if (action === 'plot') {
        navigate(`/production/plots/create?farmId=${farmId}`)
      } else if (farmId) {
        navigate(`/production/farms/${farmId}`)
      } else {
        navigate('/production/farms')
      }
    },
  })

  /** 提交入口：统一校验后按按钮类型跳转 */
  const handleSubmit = (action: 'plot' | 'detail'): void => {
    setSubmitAction(action)
    void form.validateFields().then((values) => {
      submitMutation.mutate({ values, action })
    })
  }

  /** 上传前校验：类型 + 大小 */
  const beforeUpload = (file: File): boolean => {
    if (!ACCEPT_EXT.test(file.name)) {
      message.error('仅支持 JPG、PNG、PDF 格式的文件')
      return false
    }
    if (file.size > MAX_FILE_SIZE) {
      message.error(`「${file.name}」超过 10MB，请压缩后重试`)
      return false
    }
    setFileList((prev) => [
      ...prev,
      {
        uid: `${file.name}-${file.size}-${Date.now()}`,
        name: file.name,
        size: file.size,
        pdf: /\.pdf$/i.test(file.name),
      },
    ])
    return false
  }

  return (
    <PageContainer
      title={editingFarmId ? '编辑农场' : '新增农场'}
      onBack={() => navigate('/production/farms')}
      backIcon={<LeftOutlined />}
      extra={[
        <Button key="cancel" onClick={() => navigate('/production/farms')}>
          取消
        </Button>,
        <Button
          key="continue"
          disabled={Boolean(editingFarmId)}
          loading={submitAction === 'plot' && submitMutation.isPending}
          onClick={() => handleSubmit('plot')}
        >
          保存并继续添加地块 →
        </Button>,
        <Button
          key="detail"
          type="primary"
          loading={submitAction === 'detail' && submitMutation.isPending}
          onClick={() => handleSubmit('detail')}
        >
          保存并查看详情
        </Button>,
      ]}
    >
      {editingFarmId && farmQuery.isLoading && <Card loading />}
      {!editingFarmId || farmQuery.data ? (
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            farmTypeLabel: '蔬菜种植',
            certNames: ['有机认证'],
            ...(initialValues ?? {}),
          }}
          disabled={submitMutation.isPending}
        >
          <Card title="农场基本信息" style={{ marginBottom: 16 }}>
            <Form.Item
              name="farmName"
              label="农场名称"
              extra="2-50 个字符，同一主体内唯一"
              rules={[
                { required: true, message: '请输入农场名称' },
                { min: 2, max: 50, message: '农场名称需为 2-50 个字符' },
                {
                  validator: async (_rule, value: string) => {
                    if (!value || editingFarmId) return
                    try {
                      const params: PageQuery = { pageNum: 1, pageSize: 10 }
                      const result = await listFarms({ ...params, keyword: value })
                      const duplicated = (result.list ?? []).some(
                        (farm) => farm.farmName === value,
                      )
                      if (duplicated) {
                        throw new Error('农场名称在当前主体内已存在，请更换')
                      }
                    } catch (error) {
                      // 校验接口不可用时放行，避免阻塞用户提交
                      if (error instanceof Error && error.message.includes('已存在')) {
                        throw error
                      }
                    }
                  },
                },
              ]}
            >
              <Input placeholder="请输入农场名称（同主体内唯一）" style={{ maxWidth: 480 }} />
            </Form.Item>

            <Form.Item name="farmTypeLabel" label="农场类型" rules={[{ required: true, message: '请选择农场类型' }]}>
              <Radio.Group
                options={FARM_TYPE_OPTIONS.map((item) => ({ value: item, label: item }))}
                optionType="button"
                buttonStyle="solid"
              />
            </Form.Item>

            <Form.Item
              name="region"
              label="省/市/区"
              rules={[{ required: true, message: '请选择省/市/区' }]}
            >
              <Cascader options={REGION_OPTIONS} placeholder="请选择省 / 市 / 区" style={{ maxWidth: 420 }} />
            </Form.Item>

            <Form.Item name="address" label="详细地址" rules={[{ required: true, message: '请输入详细地址' }]}>
              <Input placeholder="请输入详细地址" style={{ maxWidth: 480 }} />
            </Form.Item>

            <Space size={24} wrap>
              <Form.Item
                name="areaTotal"
                label="面积（亩）"
                rules={[{ required: true, message: '请输入农场面积' }]}
              >
                <InputNumber min={0} precision={2} placeholder="请输入面积" style={{ width: 220 }} />
              </Form.Item>
              <Form.Item name="altitude" label="海拔（米）">
                <InputNumber min={0} max={9000} placeholder="选填" style={{ width: 220 }} />
              </Form.Item>
            </Space>

            <Space size={24} wrap>
              <Form.Item
                name="managerName"
                label="负责人"
                rules={[{ required: true, message: '请输入负责人姓名' }]}
              >
                <Input placeholder="请输入负责人姓名" style={{ width: 220 }} />
              </Form.Item>
              <Form.Item
                name="managerPhone"
                label="联系电话"
                rules={[
                  { required: true, message: '请输入联系电话' },
                  { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的 11 位手机号' },
                ]}
              >
                <Input placeholder="请输入手机号" style={{ width: 220 }} />
              </Form.Item>
            </Space>

            <Form.Item name="profile" label="农场简介" extra="用于农场主页展示与溯源报告引用">
              <Input.TextArea
                rows={4}
                maxLength={500}
                showCount
                placeholder="请输入农场简介（不超过 500 字）"
                style={{ maxWidth: 640 }}
              />
            </Form.Item>
          </Card>

          <Card title="资质信息（可选）" style={{ marginBottom: 16 }}>
            <Form.Item name="certNames" label="资质认证">
              <Checkbox.Group
                options={CERT_OPTIONS.map((item) => ({ value: item, label: item }))}
              />
            </Form.Item>

            <Divider orientation="left" plain>
              资质证书附件
            </Divider>
            <Upload.Dragger
              accept=".jpg,.jpeg,.png,.pdf"
              multiple
              showUploadList={false}
              beforeUpload={(file) => {
                beforeUpload(file as File)
                return false
              }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">拖拽文件到此处，或 点击上传</p>
              <p className="ant-upload-hint">支持 JPG、PNG、PDF，单个文件不超过 10MB</p>
            </Upload.Dragger>

            {fileList.length > 0 && (
              <div style={{ marginTop: 12 }}>
                {fileList.map((file) => (
                  <Space
                    key={file.uid}
                    size={12}
                    style={{ display: 'flex', padding: '6px 0', borderBottom: '1px dashed #f0f0f0' }}
                  >
                    {file.pdf ? <FilePdfOutlined /> : <FileTextOutlined />}
                    <Typography.Text>📄 {file.name}</Typography.Text>
                    <Typography.Text type="secondary">{formatSize(file.size)}</Typography.Text>
                    <Typography.Link onClick={() => message.info('预览功能需在附件上传完成后开放')}>
                      预览
                    </Typography.Link>
                    <Typography.Link
                      type="danger"
                      onClick={() =>
                        setFileList((prev) => prev.filter((item) => item.uid !== file.uid))
                      }
                    >
                      删除
                    </Typography.Link>
                  </Space>
                ))}
              </div>
            )}
          </Card>
        </Form>
      ) : null}
    </PageContainer>
  )
}

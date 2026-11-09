import Card from '@/components/SectionCard'
/**
 * 页面名称：新增农场
 * 路由路径：/production/farms/create
 * 所属模块：农场数字化管理
 * 原型来源：用户端原型 P3 farm-create
 *
 * 还原要点（对照原型 P3）：
 * - 头部 `< 返回农场管理` ／ 新增农场
 * - 分节「农场基本信息」：农场名称（2-50 字符，主体内唯一校验）、农场类型（radio 六项，默认蔬菜种植）、
 *   省/市/区三级联动、详细地址、面积（亩）、海拔（米）、负责人、联系电话、农场简介（500 字计数）
 * - 分节「资质信息（可选）」：无公害农产品 / 有机认证 / 绿色食品认证 / 地理标志认证 / GAP 认证（多选）
 * + 证书附件上传区：JPG、PNG、WEBP，单张 ≤5MB，已选文件可预览与删除
 * - 底部三按钮：`取消`、`保存并继续添加地块 →`、`保存并查看详情`
 *
 * 补充说明：后端 FarmInfoEntity 无「海拔」「简介」字段，统一以
 * `海拔:35m；产业类型:蔬菜种植；简介:xxx` 结构持久化到 remark 字段。
 */
import { useMemo, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import PageContainer from '@/components/ProductionPageContainer'
import { FilePdfOutlined, FileTextOutlined, InboxOutlined, LeftOutlined } from '@ant-design/icons'
import {
  Alert,
  Button,
  Cascader,
  Checkbox,
  Divider,
  Form,
  Input,
  InputNumber,
  Radio,
  Select,
  Space,
  Typography,
  Upload,
  message,
} from 'antd'
import { createFarm, createFarmCert, getFarm, listFarms, updateFarm, listFarmCerts, uploadFarmCertificate, previewFarmCertificate } from '@/api/farms'
import useAuthStore from '@/store/auth'
import { FARM_REGION_OPTIONS } from '@/data/farmRegions'
import type { FarmCertType, PageQuery } from '@/types'

/** 单个文件上限（5MB） */
const MAX_FILE_SIZE = 5 * 1024 * 1024

/** 允许上传的扩展名 */
const ACCEPT_EXT = /\.(jpg|jpeg|png|webp)$/i

/** 按生产证照真实分类展示，不以近似类型替代。 */
const CERT_CODE_MAP: Partial<Record<string, FarmCertType>> = {
  有机认证: 'ORGANIC', 绿色食品认证: 'GREEN', 地理标志认证: 'GEO', HACCP认证: 'HACCP',
}
const CERT_OPTIONS = Object.keys(CERT_CODE_MAP)

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
  url?: string
  subject: string
  certName?: string
  status: 'uploading' | 'done' | 'error'
  saved?: boolean
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
  const initialSubject = useRef(useAuthStore.getState().userInfo?.tenantId)
  const createdId = useRef<string>('')
  const savedNames = useRef(new Set<string>())
  const subject = useAuthStore((state) => state.userInfo?.tenantId)
  const certQuery = useQuery({ queryKey: ['farm-certs', editingFarmId, subject], enabled: Boolean(editingFarmId), queryFn: () => listFarmCerts(editingFarmId!, { pageNum: 1, pageSize: 100 }) })
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
    if (initialSubject.current !== useAuthStore.getState().userInfo?.tenantId) throw new Error('经营主体已变更，请重新打开农场表单')
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

    const operationSubject = useAuthStore.getState().userInfo?.tenantId
    if (fileList.some(file => file.status !== 'done' || !file.certName || file.subject !== operationSubject)) throw new Error('请等待上传完成、移除失败附件并为每份附件选择证书类型；切换主体后请重新上传')
    let farmId = editingFarmId || createdId.current
    if (farmId) {
      await updateFarm(farmId, payload)
    } else {
      // 后端 POST /farms 返回 ApiResponse<String>（新农场主键），直取即可。
      farmId = await createFarm(payload)
      createdId.current = farmId
    }

    // 不推断签发日期或有效期；上传材料不等于审核通过。
    for (const file of fileList.filter(item => !item.saved)) {
      if (operationSubject !== useAuthStore.getState().userInfo?.tenantId) throw new Error('主体已切换，请重新进入农场后操作')
      await createFarmCert(farmId, { farmId, certName: file.certName!, certType: CERT_CODE_MAP[file.certName!], attachUrl: file.url })
      file.saved = true
    }
    for (const certName of values.certNames ?? []) {
      if (fileList.some(file => file.certName === certName) || savedNames.current.has(certName) || certQuery.data?.list.some(cert => cert.certName === certName)) continue
      if (operationSubject !== useAuthStore.getState().userInfo?.tenantId) throw new Error('主体已切换，请重新进入农场后操作')
      await createFarmCert(farmId, { farmId, certName, certType: CERT_CODE_MAP[certName] })
      savedNames.current.add(certName)
    }
    return farmId
  }

  /** 提交 mutation */
  const submitMutation = useMutation({
    mutationFn: async (params: { values: FarmFormValues; action: 'plot' | 'detail' }) => {
      const farmId = await persist(params.values)
      return { farmId, action: params.action }
    },
    onError: (error: Error) => {
      message.error(createdId.current ? `农场已创建，证书关联未全部完成：${error.message}。请留在此页重试，不会重复创建农场。` : error.message || '农场保存失败，请检查主体权限及服务状态', 8)
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
    if (submitMutation.isPending) return
    setSubmitAction(action)
    void form.validateFields().then((values) => {
      submitMutation.mutate({ values, action })
    }).catch(() => {
      message.warning('请检查必填项，补齐后再保存')
    })
  }

  /** 上传前校验：类型 + 大小 */
  const beforeUpload = (file: File): boolean => {
    if (!ACCEPT_EXT.test(file.name) || file.size === 0 || file.size > MAX_FILE_SIZE) {
      message.error('请选择不超过 5MB 的 JPG、PNG 或 WEBP 图片'); return false
    }
    const current = useAuthStore.getState().userInfo?.tenantId
    if (!current) { message.error('请先选择经营主体'); return false }
    const uid = crypto.randomUUID()
    setFileList(prev => [...prev, { uid, name: file.name, size: file.size, pdf: false, subject: current, status: 'uploading' }])
    void uploadFarmCertificate(file, current).then(url => {
      if (useAuthStore.getState().userInfo?.tenantId !== current) throw new Error('主体已切换，请移除附件后重新上传')
      setFileList(prev => prev.map(item => item.uid === uid ? { ...item, url, status: 'done' } : item))
    }).catch((error) => {
      setFileList(prev => prev.map(item => item.uid === uid ? { ...item, status: 'error' } : item))
      message.error(error.response?.data?.message || error.message || '上传失败，请移除后重试')
    })
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

      {editingFarmId && farmQuery.isError && <Card><Alert type="error" showIcon message="农场资料加载失败" action={<Button onClick={() => void farmQuery.refetch()}>重新加载</Button>} /></Card>}
      {editingFarmId && farmQuery.isLoading && <Card loading />}
      {!editingFarmId || farmQuery.data ? (
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            farmTypeLabel: '蔬菜种植',
            certNames: [],
            ...(initialValues ?? {}),
          }}
          disabled={submitMutation.isPending}
        >
          <Card title="01 · 农场基本信息" style={{ marginBottom: 16 }}>
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
              rules={[{ required: true, message: '请选择省、市、区县' }, {
                validator: (_, value: string[] | undefined) => {
                  let options = FARM_REGION_OPTIONS
                  for (const name of value ?? []) {
                    const node = options.find((item) => item.value === name)
                    if (!node) return Promise.reject(new Error('请重新选择有效的省、市、区县'))
                    options = node.children ?? []
                  }
                  return value?.length && !options.length
                    ? Promise.resolve()
                    : Promise.reject(new Error('请选择完整地区'))
                },
              }]}
            >
              <Cascader
                options={FARM_REGION_OPTIONS}
                placeholder="请选择省 / 市 / 区县"
                showSearch={{ filter: (input, path) => path.some((item) => String(item.label).includes(input.trim())) }}
                style={{ width: '100%', maxWidth: 480 }}
                allowClear
              />
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

          <Card title="02 · 资质信息（可选）" style={{ marginBottom: 16 }}>
            <Form.Item name="certNames" label="资质认证">
              <Checkbox.Group
                options={CERT_OPTIONS.map((item) => ({ value: item, label: item }))}
              />
            </Form.Item>

            <Divider orientation="left" plain>
              资质证书附件
            </Divider>
            <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="证书材料上传" description="每份图片请选择对应资质，保存农场后关联附件。上传或勾选资质不代表审核通过，不自动填写签发日期和有效期。移除待提交附件不会删除平台文件。" />
            <Upload.Dragger
              accept=".jpg,.jpeg,.png,.webp"
              disabled={submitMutation.isPending}
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
              <p className="ant-upload-text">拖拽证书图片到此处，或点击上传</p>
              <p className="ant-upload-hint">支持 JPG、PNG、WEBP，单张不超过 5MB；暂不支持 PDF</p>
            </Upload.Dragger>

            {editingFarmId && <div style={{ marginTop: 12 }}>
              {certQuery.isError ? <Alert type="error" message="已有证书加载失败" action={<Button onClick={() => void certQuery.refetch()}>重试</Button>} /> : certQuery.isLoading ? '正在加载已有证书…' : certQuery.data?.list.map(cert => <Card key={cert.certId} title={cert.certName} style={{ marginBottom: 8 }}>
                <Typography.Text type="secondary">{cert.expireDate ? `有效期至 ${cert.expireDate}` : '未填写有效期'} · 材料记录不代表审核结论</Typography.Text>
                {cert.attachUrl && <Button type="link" onClick={() => void previewFarmCertificate(cert.attachUrl!).catch(error => message.error(error.message))}>预览已有附件</Button>}
              </Card>)}
            </div>}
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
                    <Select disabled={submitMutation.isPending || file.saved} placeholder="选择证书类型" value={file.certName} style={{ minWidth: 160 }} options={CERT_OPTIONS.map(value => ({ value, label: value }))} onChange={certName => setFileList(prev => prev.map(item => item.uid === file.uid ? { ...item, certName } : item))} />
                    <Typography.Text>{file.status === 'uploading' ? '上传中' : file.status === 'error' ? '上传失败，请移除后重试' : file.saved ? '已关联' : '已上传，待保存关联'}</Typography.Text>
                    <Typography.Link disabled={!file.url || file.subject !== subject} onClick={() => file.url && void previewFarmCertificate(file.url).catch(error => message.error(error.message))}>
                      预览
                    </Typography.Link>
                    <Typography.Link
                      type="danger"
                      disabled={submitMutation.isPending || file.saved}
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

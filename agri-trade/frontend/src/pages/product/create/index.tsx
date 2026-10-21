import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Button,
  Card,
  Col,
  Form,
  Image,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Spin,
  Typography,
  Upload,
  message,
} from 'antd'
import { DeleteOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons'
import {
  createSellerProduct,
  getCategoryList,
  getSellerProductById,
  updateSellerProduct,
  uploadSellerProductImage,
  type SellerProductDetail,
} from '@/api/product'

const { TextArea } = Input

interface CategoryRow {
  id: number
  parentId?: number | null
  categoryName: string
  level?: number
}

/**
 * 卖家商品新增/编辑。
 *
 * <p>与主数据运营端共用交易商品表与全部商品字段。卖家主体由后端从 SSO 令牌推导，
 * 页面只传当前选择的 `sellerId` 用于多主体账号确认归属，不能借此写入其他卖家。</p>
 */
export default function ProductCreate(): JSX.Element {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [images, setImages] = useState<string[]>([])
  const [loading, setLoading] = useState(Boolean(id))
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const isEdit = Boolean(id)
  const requestedSellerId = params.get('sellerId') || undefined

  useEffect(() => {
    getCategoryList()
      .then((body: { code?: number; data?: CategoryRow[] }) => {
        if (body?.code === 200) setCategories(body.data ?? [])
      })
      .catch(() => message.error('加载商品分类失败'))
  }, [])

  useEffect(() => {
    if (!id) {
      form.setFieldsValue({ status: 1, priceType: 'fixed', unit: 'kg', minOrderQuantity: 1 })
      return
    }
    let cancelled = false
    setLoading(true)
    getSellerProductById(id)
      .then((body: { code?: number; data?: SellerProductDetail; message?: string }) => {
        if (cancelled) return
        if (body?.code !== 200 || !body.data) {
          message.error(body?.message ?? '商品不存在')
          return
        }
        const item = body.data
        setImages(item.images ?? [])
        form.setFieldsValue({
          ...item,
          certificationsText: (item.certifications ?? []).join(','),
        })
      })
      .catch(() => message.error('加载商品失败'))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id, form])

  const uploadFile = async (file: File): Promise<void> => {
    if (images.length >= 9) {
      message.warning('商品图片最多 9 张')
      return
    }
    setUploading(true)
    try {
      const body = await uploadSellerProductImage(file)
      if (body?.code !== 200 || !body.data?.url) throw new Error(body?.message || '上传失败')
      setImages((previous) => [...previous, body.data.url])
      message.success('图片上传成功')
    } catch (error) {
      message.error(error instanceof Error ? error.message : '图片上传失败')
    } finally {
      setUploading(false)
    }
  }

  const removeImage = (index: number): void => {
    setImages((previous) => previous.filter((_, current) => current !== index))
  }

  const onFinish = async (values: Record<string, unknown>): Promise<void> => {
    if (!images.length) {
      message.warning('请至少上传一张商品图片')
      return
    }
    const category = categories.find((item) => Number(item.id) === Number(values.categoryId))
    const payload = {
      ...values,
      sellerId: requestedSellerId,
      categoryName: category?.categoryName,
      certifications: String(values.certificationsText ?? '')
        .split(/[,，]/)
        .map((item) => item.trim())
        .filter(Boolean),
      images,
    }
    setSubmitting(true)
    try {
      const body = isEdit
        ? await updateSellerProduct(id!, payload)
        : await createSellerProduct(payload)
      if (body?.code !== 200) {
        message.error(body?.message ?? '保存商品失败')
        return
      }
      message.success(isEdit ? '商品已更新，内容与主数据管理同步' : '商品已提交，主数据端可立即查看')
      navigate('/member/seller?tab=goods', { replace: true })
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存商品失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div style={{ padding: 80, textAlign: 'center' }}><Spin size="large" /></div>
  }

  return (
    <div style={{ padding: 20 }}>
      <Card
        title={isEdit ? '编辑我的商品' : '上架新商品'}
        extra={<Button onClick={() => navigate('/member/seller?tab=goods')}>返回卖家中心</Button>}
      >
        <Typography.Paragraph type="secondary">
          与主数据运营端使用同一张交易商品表和完整字段；保存后运营端可查看，审核通过的已发布商品会同步到官网。
        </Typography.Paragraph>
        <Form form={form} layout="vertical" onFinish={(values) => void onFinish(values)}>
          <Card title="基础信息" size="small" style={{ marginBottom: 18 }}>
            <Row gutter={16}>
              <Col xs={24} md={12} lg={8}><Form.Item name="productName" label="商品名称" rules={[{ required: true }]}><Input placeholder="如：赣南脐橙 10kg 箱装" /></Form.Item></Col>
              <Col xs={24} md={12} lg={8}><Form.Item name="productCode" label="商品编码"><Input placeholder="留空自动生成" disabled={isEdit} /></Form.Item></Col>
              <Col xs={24} md={12} lg={8}><Form.Item name="barcode" label="条码"><Input /></Form.Item></Col>
              <Col xs={24} md={12} lg={8}><Form.Item name="categoryId" label="商品分类" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={categories.map((item) => ({ value: item.id, label: `${'　'.repeat(Math.max(0, Number(item.level ?? 1) - 1))}${item.categoryName}` }))} /></Form.Item></Col>
              <Col xs={24} md={12} lg={8}><Form.Item name="variety" label="品种"><Input placeholder="如：纽荷尔脐橙" /></Form.Item></Col>
              <Col xs={24} md={12} lg={8}><Form.Item name="status" label="商品启停"><Select options={[{ value: 1, label: '启用' }, { value: 0, label: '停用' }]} /></Form.Item></Col>
            </Row>
          </Card>

          <Card title="产地与规格" size="small" style={{ marginBottom: 18 }}>
            <Row gutter={16}>
              <Col xs={24} md={12} lg={6}><Form.Item name="originProvince" label="产地省份"><Input /></Form.Item></Col>
              <Col xs={24} md={12} lg={6}><Form.Item name="originCity" label="产地城市"><Input /></Form.Item></Col>
              <Col xs={24} md={12} lg={6}><Form.Item name="originDistrict" label="区县"><Input /></Form.Item></Col>
              <Col xs={24} md={12} lg={6}><Form.Item name="originAddress" label="详细产地"><Input /></Form.Item></Col>
              <Col xs={24} md={12} lg={6}><Form.Item name="specLevel" label="规格等级"><Input placeholder="一级/特级" /></Form.Item></Col>
              <Col xs={24} md={12} lg={6}><Form.Item name="qualityLevel" label="质量等级"><Input /></Form.Item></Col>
              <Col xs={24} md={12} lg={6}><Form.Item name="specSize" label="规格尺寸"><Input placeholder="75-85mm / 10kg箱" /></Form.Item></Col>
              <Col xs={24} md={12} lg={6}><Form.Item name="harvestBatchNo" label="采收批次"><Input /></Form.Item></Col>
            </Row>
          </Card>

          <Card title="价格与库存" size="small" style={{ marginBottom: 18 }}>
            <Row gutter={16}>
              <Col xs={24} md={12} lg={6}><Form.Item name="price" label="销售单价" rules={[{ required: true }]}><InputNumber min={0.01} precision={2} style={{ width: '100%' }} /></Form.Item></Col>
              <Col xs={24} md={12} lg={6}><Form.Item name="priceMin" label="参考最低价"><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item></Col>
              <Col xs={24} md={12} lg={6}><Form.Item name="priceMax" label="参考最高价"><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item></Col>
              <Col xs={24} md={12} lg={6}><Form.Item name="priceType" label="价格类型"><Select options={[{ value: 'fixed', label: '固定价' }, { value: 'negotiable', label: '可议价' }]} /></Form.Item></Col>
              <Col xs={24} md={12} lg={6}><Form.Item name="stockQuantity" label="库存数量" rules={[{ required: true }]}><InputNumber min={0} precision={3} style={{ width: '100%' }} /></Form.Item></Col>
              <Col xs={24} md={12} lg={6}><Form.Item name="unit" label="计量单位" rules={[{ required: true }]}><Input placeholder="箱 / kg / 吨" /></Form.Item></Col>
              <Col xs={24} md={12} lg={6}><Form.Item name="minOrderQuantity" label="起订量" rules={[{ required: true }]}><InputNumber min={0.001} precision={3} style={{ width: '100%' }} /></Form.Item></Col>
            </Row>
          </Card>

          <Card title="品质与详情" size="small" style={{ marginBottom: 18 }}>
            <Row gutter={16}>
              <Col xs={24} lg={12}><Form.Item name="certificationsText" label="认证信息"><Input placeholder="绿色食品,地理标志" /></Form.Item></Col>
              <Col xs={24} lg={12}><Form.Item name="qualityReportUrl" label="质量报告地址"><Input placeholder="https://..." /></Form.Item></Col>
              <Col span={24}><Form.Item name="description" label="商品描述" rules={[{ required: true }]}><TextArea rows={4} /></Form.Item></Col>
              <Col span={24}><Form.Item name="videoUrl" label="视频地址"><Input placeholder="可选，https://..." /></Form.Item></Col>
            </Row>
          </Card>

          <Card title="商品图片（首张为主图）" size="small" style={{ marginBottom: 18 }}>
            <Space wrap>
              <Upload accept="image/jpeg,image/png,image/webp" showUploadList={false}
                beforeUpload={(file) => { void uploadFile(file as File); return false }}>
                <Button icon={<UploadOutlined />} loading={uploading}>上传图片</Button>
              </Upload>
              <Typography.Text type="secondary">最多 9 张，单张不超过 5MB</Typography.Text>
            </Space>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
              {images.map((image, index) => (
                <div key={image} style={{ position: 'relative', border: index === 0 ? '2px solid #159a5e' : '1px solid #e3eae5', borderRadius: 8, overflow: 'hidden' }}>
                  <Image src={image} width={110} height={90} style={{ objectFit: 'cover' }} />
                  <Button size="small" danger type="text" icon={<DeleteOutlined />}
                    style={{ position: 'absolute', right: 2, top: 2 }} onClick={() => removeImage(index)} />
                  {index === 0 && <span style={{ position: 'absolute', left: 5, bottom: 5, padding: '2px 6px', borderRadius: 4, background: '#0e5233', color: '#fff', fontSize: 10 }}>主图</span>}
                </div>
              ))}
              {!images.length && <Typography.Text type="secondary">尚未上传图片</Typography.Text>}
            </div>
          </Card>

          <Space>
            <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={submitting} disabled={uploading}>
              {isEdit ? '保存商品' : '提交上架'}
            </Button>
            <Button onClick={() => navigate('/member/seller?tab=goods')}>取消</Button>
          </Space>
        </Form>
      </Card>
    </div>
  )
}

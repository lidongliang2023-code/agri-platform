import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Button,
  Col,
  Form,
  Image,
  Input,
  InputNumber,
  Row,
  Select,
  Spin,
  Upload,
  message,
} from 'antd'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  MinusCircleOutlined,
  PictureOutlined,
  PlusOutlined,
  ShopOutlined,
  TagsOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import {
  createSellerProduct,
  getCategoryList,
  getSellerProductById,
  updateSellerProduct,
  uploadSellerProductImage,
  type SellerProductDetail,
} from '@/api/product'
import ProvinceCityFields from '@/components/ProvinceCityFields'
import { Panel } from '../../member-center/shared'
import './product-create.css'

const { TextArea } = Input

interface CategoryRow {
  id: number
  parentId?: number | null
  categoryName: string
  level?: number
}

interface SkuFormValue {
  id?: number | null
  skuCode?: string
  skuName?: string
  barcode?: string | null
  unit?: string
  price?: number
  stockQuantity?: number
  minOrderQuantity?: number
  status?: number
}

const emptySku = (): SkuFormValue => ({
  skuCode: '',
  skuName: '',
  barcode: '',
  unit: 'kg',
  minOrderQuantity: 1,
  status: 1,
})

/**
 * 卖家商品新增/编辑。
 *
 * <p>与主数据运营端共用交易商品表与全部商品字段。卖家主体由后端从 SSO 令牌推导，
 * 页面只传当前选择的 `sellerId` 用于多主体账号确认归属，不能借此写入其他卖家。</p>
 */
export default function ProductCreate({ embedded = false }: { embedded?: boolean }): JSX.Element {
  const { id: routeId } = useParams()
  const [params] = useSearchParams()
  const id = routeId || params.get('id') || undefined
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [images, setImages] = useState<string[]>([])
  const [loading, setLoading] = useState(Boolean(id))
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const isEdit = Boolean(id)
  const requestedSellerId = params.get('sellerId') || undefined
  // 从信息资讯「发布供应」跳过来时会带 returnUrl：发布完成或取消后回到原页面。
  // 两个子系统是独立域名，用 navigate 处理不了绝对地址，必须区分开。
  const returnPath = params.get('returnUrl') || '/member/seller?tab=goods'
  const returnExternal = /^https?:\/\//i.test(returnPath)
  const returnLabel = returnExternal ? '返回信息资讯' : embedded ? '返回商品管理' : '返回卖家中心'
  const leave = (): void => {
    if (returnExternal) window.location.assign(returnPath)
    else navigate(returnPath)
  }

  useEffect(() => {
    getCategoryList()
      .then((body: { code?: number; data?: CategoryRow[] }) => {
        if (body?.code === 200) setCategories(body.data ?? [])
      })
      .catch(() => message.error('加载商品分类失败'))
  }, [])

  useEffect(() => {
    if (!id) {
      form.setFieldsValue({
        status: 1,
        priceType: 'fixed',
        unit: 'kg',
        minOrderQuantity: 1,
        skus: [emptySku()],
      })
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
        const skus = item.skus?.length
          ? item.skus
          : [{
            skuCode: `${item.productCode || 'DEFAULT'}-DEFAULT`,
            skuName: item.specSize || item.specLevel || item.qualityLevel || '默认规格',
            barcode: item.barcode,
            unit: item.unit,
            price: item.price ?? item.priceMin ?? undefined,
            stockQuantity: item.stockQuantity ?? 0,
            minOrderQuantity: item.minOrderQuantity ?? 1,
            status: 1,
          }]
        form.setFieldsValue({
          ...item,
          skus,
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
    const skus = Array.isArray(values.skus) ? values.skus as SkuFormValue[] : []
    const sellableSkus = skus.filter((item) => item.status !== 0)
    if (skus.length === 0 || sellableSkus.length === 0) {
      message.warning('请至少维护一个启用SKU')
      return
    }
    const prices = sellableSkus.map((item) => Number(item.price)).filter((value) => value > 0)
    const stocks = sellableSkus.map((item) => Number(item.stockQuantity ?? 0))
    const minOrders = sellableSkus.map((item) => Number(item.minOrderQuantity ?? 1))
    const primarySku = sellableSkus[0]
    const category = categories.find((item) => Number(item.id) === Number(values.categoryId))
    const payload = {
      ...values,
      skus,
      price: Math.min(...prices),
      priceMin: Math.min(...prices),
      priceMax: Math.max(...prices),
      stockQuantity: stocks.reduce((total, value) => total + value, 0),
      unit: primarySku.unit,
      minOrderQuantity: Math.min(...minOrders),
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
      leave()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存商品失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="seller-product-page seller-product-loading"><Spin size="large" /><span>正在读取商品资料…</span></div>
  }

  return (
    <div className={`seller-product-page product-create-page${embedded ? ' is-embedded' : ''}`}>
      <section className="seller-product-hero">
        <span className="seller-product-hero-icon"><ShopOutlined /></span>
        <div><small>{isEdit ? 'EDIT PRODUCT' : 'PUBLISH PRODUCT'}</small><h2>{isEdit ? '编辑商品' : '发布新商品'}</h2><p>维护完整商品资料、价格库存与产地信息，审核后同步至官网和交易大厅。</p></div>
        <button type="button" className="mc-btn ghost" onClick={leave}>
          <ArrowLeftOutlined /> {returnLabel}
        </button>
      </section>

      <div className="seller-product-steps">
        <div className="on"><span>01</span><strong>基础资料</strong><small>名称、分类和品种</small></div>
        <i />
        <div><span>02</span><strong>产地规格</strong><small>产地与质量标准</small></div>
        <i />
        <div><span>03</span><strong>价格库存</strong><small>售价与可供数量</small></div>
        <i />
        <div><span>04</span><strong>图片发布</strong><small>上传图片并提交</small></div>
      </div>

      <Form form={form} layout="vertical" onFinish={(values) => void onFinish(values)}>
        <div className="seller-product-layout">
          <div className="seller-product-main">
            <Panel title="基础信息" extra={<span className="seller-product-note">商品识别与分类</span>}>
              <div className="seller-product-section">
                <Row gutter={[16, 0]}>
                  <Col xs={24} lg={12}><Form.Item name="productName" label="商品名称" rules={[{ required: true, message: '请填写商品名称' }]}><Input placeholder="如：赣南脐橙 10kg 箱装" /></Form.Item></Col>
                  <Col xs={24} md={12} lg={6}><Form.Item name="productCode" label="商品编码"><Input placeholder="留空自动生成" disabled={isEdit} /></Form.Item></Col>
                  <Col xs={24} md={12} lg={6}><Form.Item name="barcode" label="商品条码"><Input placeholder="可选" /></Form.Item></Col>
                  <Col xs={24} md={12} lg={8}><Form.Item name="categoryId" label="商品分类" rules={[{ required: true, message: '请选择商品分类' }]}><Select showSearch optionFilterProp="label" placeholder="请选择分类" options={categories.map((item) => ({ value: item.id, label: `${'　'.repeat(Math.max(0, Number(item.level ?? 1) - 1))}${item.categoryName}` }))} /></Form.Item></Col>
                  <Col xs={24} md={12} lg={8}><Form.Item name="variety" label="商品品种"><Input placeholder="如：纽荷尔脐橙" /></Form.Item></Col>
                  <Col xs={24} md={12} lg={8}><Form.Item name="status" label="商品启停"><Select options={[{ value: 1, label: '启用' }, { value: 0, label: '停用' }]} /></Form.Item></Col>
                </Row>
              </div>
            </Panel>

            <Panel title="产地与规格" extra={<span className="seller-product-note">货源真实属性</span>}>
              <div className="seller-product-section">
                <Row gutter={[16, 0]}>
                  <ProvinceCityFields
                    form={form}
                    provinceName="originProvince"
                    cityName="originCity"
                    provinceLabel="产地省份"
                    cityLabel="产地城市"
                    provinceColProps={{ xs: 12, md: 12, lg: 6 }}
                    cityColProps={{ xs: 12, md: 12, lg: 6 }}
                  />
                  <Col xs={12} md={12} lg={6}><Form.Item name="originDistrict" label="区县"><Input /></Form.Item></Col>
                  <Col xs={12} md={12} lg={6}><Form.Item name="originAddress" label="详细产地"><Input /></Form.Item></Col>
                  <Col xs={12} md={12} lg={6}><Form.Item name="specLevel" label="规格等级"><Input placeholder="一级 / 特级" /></Form.Item></Col>
                  <Col xs={12} md={12} lg={6}><Form.Item name="qualityLevel" label="质量等级"><Input /></Form.Item></Col>
                  <Col xs={12} md={12} lg={6}><Form.Item name="specSize" label="规格尺寸"><Input placeholder="75-85mm / 10kg箱" /></Form.Item></Col>
                  <Col xs={12} md={12} lg={6}><Form.Item name="harvestBatchNo" label="采收批次"><Input /></Form.Item></Col>
                </Row>
              </div>
            </Panel>

            <Panel title="价格与SKU库存" extra={<span className="seller-product-note">每个规格独立计价与库存</span>}>
              <div className="seller-product-section seller-sku-section">
                <Form.List name="skus" rules={[{
                  validator: async (_, value) => {
                    if (!Array.isArray(value) || value.length === 0) {
                      throw new Error('请至少维护一个SKU')
                    }
                  },
                }]}>
                  {(fields, { add, remove }, { errors }) => (
                    <>
                      <div className="seller-sku-list-head">
                        <div>
                          <strong>可售规格</strong>
                          <span>同一商品可配置多个包装、等级或重量规格，采购方下单时选择具体 SKU。</span>
                        </div>
                        <span className="mc-tag ghost">{fields.length} 个 SKU</span>
                      </div>
                      {fields.map((field, index) => (
                        <div className="seller-sku-card" key={field.key}>
                          <div className="seller-sku-card-head">
                            <div><span>SKU {String(index + 1).padStart(2, '0')}</span><strong>{form.getFieldValue(['skus', field.name, 'skuName']) || '待填写规格'}</strong></div>
                            <button type="button" className="seller-sku-remove" disabled={fields.length <= 1}
                              onClick={() => remove(field.name)}>
                              <MinusCircleOutlined /> 删除
                            </button>
                          </div>
                          <Row gutter={[14, 0]}>
                            <Col xs={24} md={12} lg={8}>
                              <Form.Item {...field} name={[field.name, 'skuName']} label="SKU名称 / 销售规格"
                                rules={[{ required: true, whitespace: true, message: '请填写SKU规格' }]}>
                                <Input placeholder="如：5kg/箱 · 一级果" maxLength={200} />
                              </Form.Item>
                            </Col>
                            <Col xs={24} md={12} lg={8}>
                              <Form.Item {...field} name={[field.name, 'skuCode']} label="SKU编码">
                                <Input placeholder="留空自动生成" maxLength={64} />
                              </Form.Item>
                            </Col>
                            <Col xs={24} md={12} lg={8}>
                              <Form.Item {...field} name={[field.name, 'barcode']} label="SKU条码">
                                <Input placeholder="可选" maxLength={100} />
                              </Form.Item>
                            </Col>
                            <Col xs={12} md={8} lg={5}>
                              <Form.Item {...field} name={[field.name, 'price']} label="销售单价（元）"
                                rules={[{ required: true, message: '请填写单价' }]}>
                                <InputNumber min={0.01} precision={2} style={{ width: '100%' }} />
                              </Form.Item>
                            </Col>
                            <Col xs={12} md={8} lg={5}>
                              <Form.Item {...field} name={[field.name, 'stockQuantity']} label="库存数量"
                                rules={[{ required: true, message: '请填写库存' }]}>
                                <InputNumber min={0} precision={3} style={{ width: '100%' }} />
                              </Form.Item>
                            </Col>
                            <Col xs={12} md={8} lg={4}>
                              <Form.Item {...field} name={[field.name, 'unit']} label="单位"
                                rules={[{ required: true, whitespace: true, message: '请填写单位' }]}>
                                <Input placeholder="箱 / kg" maxLength={20} />
                              </Form.Item>
                            </Col>
                            <Col xs={12} md={12} lg={5}>
                              <Form.Item {...field} name={[field.name, 'minOrderQuantity']} label="起订量"
                                rules={[{ required: true, message: '请填写起订量' }]}>
                                <InputNumber min={0.001} precision={3} style={{ width: '100%' }} />
                              </Form.Item>
                            </Col>
                            <Col xs={24} md={12} lg={5}>
                              <Form.Item {...field} name={[field.name, 'status']} label="SKU状态">
                                <Select options={[{ value: 1, label: '启用' }, { value: 0, label: '停用' }]} />
                              </Form.Item>
                            </Col>
                          </Row>
                        </div>
                      ))}
                      <button type="button" className="seller-sku-add" onClick={() => add(emptySku())}>
                        <PlusOutlined /> 添加 SKU
                      </button>
                      <Form.ErrorList errors={errors} />
                    </>
                  )}
                </Form.List>
              </div>
            </Panel>

            <Panel title="品质与详情" extra={<span className="seller-product-note">补充交易信任资料</span>}>
              <div className="seller-product-section">
                <Row gutter={[16, 0]}>
                  <Col xs={24} lg={12}><Form.Item name="certificationsText" label="认证信息"><Input placeholder="绿色食品,地理标志" /></Form.Item></Col>
                  <Col xs={24} lg={12}><Form.Item name="qualityReportUrl" label="质量报告地址"><Input placeholder="https://..." /></Form.Item></Col>
                  <Col xs={24}><Form.Item name="description" label="商品描述" rules={[{ required: true, message: '请填写商品描述' }]}><TextArea rows={4} placeholder="描述种植方式、采收标准、包装与发货说明" /></Form.Item></Col>
                  <Col xs={24}><Form.Item name="videoUrl" label="商品视频地址"><Input placeholder="可选，https://..." /></Form.Item></Col>
                </Row>
              </div>
            </Panel>

            <Panel title={`商品图片（${images.length}/9 · 首张为主图）`} extra={<span className="seller-product-note">支持 JPG、PNG、WEBP</span>}>
              <div className="seller-product-images">
                <Upload accept="image/jpeg,image/png,image/webp" showUploadList={false}
                  beforeUpload={(file) => { void uploadFile(file as File); return false }}>
                  <button type="button" className="seller-product-upload" disabled={uploading}>
                    <UploadOutlined /><strong>{uploading ? '正在上传…' : '上传商品图片'}</strong><small>最多 9 张，单张不超过 5MB</small>
                  </button>
                </Upload>
                {images.map((image, index) => (
                  <div className={`seller-product-image${index === 0 ? ' main' : ''}`} key={image}>
                    <Image src={image} width={132} height={104} style={{ objectFit: 'cover' }} />
                    {index === 0 && <span>主图</span>}
                    <Button size="small" danger type="text" icon={<DeleteOutlined />}
                      onClick={() => removeImage(index)} />
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <aside className="seller-product-aside">
            <Panel title="发布检查">
              <ul className="seller-product-checks">
                <li><CheckCircleOutlined /> 商品名称、分类和销售单价必填</li>
                <li><CheckCircleOutlined /> 产地与库存会直接展示在商品详情</li>
                <li><CheckCircleOutlined /> 至少上传一张清晰商品图片</li>
                <li><InfoCircleOutlined /> 发布后由运营审核，审核通过同步官网</li>
              </ul>
            </Panel>
            <Panel title="资料提示">
              <div className="seller-product-tips">
                <p><TagsOutlined /> 规格、等级和认证信息越完整，采购方越容易比较。</p>
                <p><PictureOutlined /> 首张图片作为商品主图，请使用真实货源照片。</p>
                <p><ShopOutlined /> 与主数据管理使用同一份商品数据。</p>
              </div>
            </Panel>
            <div className="seller-product-submit">
              <button type="submit" className="mc-btn" disabled={submitting || uploading}>
                <PlusOutlined /> {submitting ? '正在保存…' : isEdit ? '保存商品' : '提交上架'}
              </button>
              <button type="button" className="mc-btn ghost" onClick={leave}>取消</button>
            </div>
          </aside>
        </div>
      </Form>
    </div>
  )
}

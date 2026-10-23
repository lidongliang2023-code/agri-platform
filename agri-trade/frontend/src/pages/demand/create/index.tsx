import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Col, DatePicker, Form, Input, Row, Select, Spin, Switch, message } from 'antd'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  FileSearchOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
} from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import { createDemand, getDemandById, parseNaturalLanguage, updateDemand } from '@/api/demand'
import { getCategoryList, getProductById } from '@/api/product'
import ProvinceCityFields from '@/components/ProvinceCityFields'
import { Panel } from '../../member-center/shared'
import './demand-create.css'

const { TextArea } = Input

interface CategoryRow {
  id: number
  parentId?: number | null
  categoryName: string
  level?: number
}

/**
 * 发布 / 编辑采购需求（同一张表单）。
 *
 * <p>这一页是重写的：原版提交的字段名与实体几乎全对不上 ——
 * category / specification / minPrice / maxPrice / cycle / grade / needSample /
 * qualityDesc / certifications / packaging / deliveryDate 这 11 个字段，
 * 实体里分别叫 categoryId+categoryName / variety+specDesc / priceMin / priceMax /
 * demandType / qualityLevel / sampleRequire / qualityRequirement /
 * certificationRequire / packagingRequire / deliveryDeadline；
 * 另外 contactName / contactPhone 实体里根本没有，而实体该有的 demandName 表单里没有。
 * 于是"提交成功"之后存下来的是一条几乎空白的需求。</p>
 *
 * <p>三种入口：新建、编辑（?id=）、从商品详情带着货源来（?productId=）。</p>
 */
export default function DemandCreate({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [form] = Form.useForm()
  const editingId = params.get('id')
  const productId = params.get('productId')
  const isEdit = Boolean(editingId)
  const returnPath = embedded ? '/member/buyer?tab=inquiry' : '/demand'

  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [nlpText, setNlpText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [hints, setHints] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getCategoryList()
      .then((res: { code: number; data?: CategoryRow[] }) => {
        if (res?.code === 200) setCategories(res.data ?? [])
      })
      .catch(() => undefined)
  }, [])

  // 编辑：把已有需求回填到表单（日期字段要转成 dayjs，否则 DatePicker 显示不出来）
  useEffect(() => {
    if (!editingId) return
    getDemandById(Number(editingId))
      .then((res: { code: number; data?: Record<string, unknown> }) => {
        if (res?.code === 200 && res.data) {
          form.setFieldsValue({
            ...res.data,
            deliveryDeadline: res.data.deliveryDeadline ? dayjs(String(res.data.deliveryDeadline)) : undefined,
            sampleRequire: res.data.sampleRequire === 1
          })
        }
      })
      .catch(() => message.error('加载需求失败'))
  }, [editingId, form])

  // 从商品详情带 productId 进来：把货源的关键信息预填进需求，买家不用再抄一遍
  useEffect(() => {
    if (!productId) return
    getProductById(Number(productId))
      .then((res: { code: number; data?: Record<string, unknown> }) => {
        if (res?.code === 200 && res.data) {
          const p = res.data as Record<string, unknown>
          form.setFieldsValue({
            productName: p.productName,
            variety: p.variety,
            categoryId: p.categoryId,
            categoryName: p.categoryName,
            unit: p.unit,
            quantity: Number(params.get('quantity')) > 0 ? Number(params.get('quantity')) : undefined,
            priceMin: p.priceMin,
            priceMax: p.priceMax
          })
          message.info(`已按货源「${p.productName}」预填，可直接修改`)
        }
      })
      .catch(() => undefined)
  }, [productId, params, form])

  /** 自然语言 → 结构化字段（后端 POST /api/trade/nlp/parse） */
  const handleParse = async () => {
    if (!nlpText.trim()) {
      message.warning('先说说你要采购什么')
      return
    }
    setParsing(true)
    try {
      const res = await parseNaturalLanguage(nlpText.trim())
      if (res?.code !== 200 || !res.data) {
        message.error(res?.message ?? '解析失败')
        return
      }
      const parsed = res.data as {
        productName?: string; quantity?: string; unit?: string; price?: string
        location?: string; timeRange?: string; quality?: string; additionalRequirements?: string
      }
      const nextHints: string[] = []

      // 能直接落到表单字段的就落；落不下去的（自然语言里的价格区间、模糊时间）
      // 只做提示，不猜数字 —— 猜错的价格会直接被当成真实报价依据。
      const patch: Record<string, unknown> = {}
      if (parsed.productName) patch.productName = parsed.productName
      if (parsed.quantity) {
        const num = Number(String(parsed.quantity).replace(/[^\d.]/g, ''))
        if (!Number.isNaN(num) && num > 0) patch.quantity = num
        else nextHints.push(`解析到数量：${parsed.quantity}（未识别为数字，未自动填写）`)
      }
      if (parsed.unit) patch.unit = parsed.unit
      if (parsed.quality) patch.qualityRequirement = parsed.quality
      if (parsed.additionalRequirements) patch.additionalRequirements = parsed.additionalRequirements
      if (parsed.location) patch.deliveryAddress = parsed.location

      const priceNumbers = (String(parsed.price ?? '').match(/\d+(\.\d+)?/g) ?? []).map(Number)
      if (priceNumbers.length >= 2) {
        patch.priceMin = Math.min(priceNumbers[0], priceNumbers[1])
        patch.priceMax = Math.max(priceNumbers[0], priceNumbers[1])
      } else if (parsed.price) {
        nextHints.push(`解析到价格：${parsed.price}（不是可用的数字区间，未自动填写）`)
      }
      if (parsed.timeRange) {
        const date = dayjs(parsed.timeRange)
        if (date.isValid()) patch.deliveryDeadline = date
        else nextHints.push(`解析到时间：${parsed.timeRange}（不是标准日期，未自动填写）`)
      }

      form.setFieldsValue(patch)
      if (!patch.productName) {
        nextHints.push('没解析出商品名，请手动补充；需求标题也可自行修改')
      } else if (!form.getFieldValue('demandName')) {
        form.setFieldsValue({ demandName: `${patch.productName} 采购需求` })
      }
      setHints(nextHints)
      message.success('已按描述预填，请核对后提交')
    } catch {
      message.error('解析失败（检查后端是否在运行）')
    } finally {
      setParsing(false)
    }
  }

  const onFinish = async (values: Record<string, unknown>) => {
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        ...values,
        deliveryDeadline: values.deliveryDeadline
          ? (values.deliveryDeadline as Dayjs).format('YYYY-MM-DD HH:mm:ss')
          : undefined,
        sampleRequire: values.sampleRequire ? 1 : 0
      }
      // categoryName 跟着 categoryId 一起存：列表页显示的是名称，
      // 只存 id 的话列表上品类那一列就是空的
      const category = categories.find((item) => item.id === Number(values.categoryId))
      if (category) payload.categoryName = category.categoryName

      const res = isEdit
        ? await updateDemand(Number(editingId), payload)
        : await createDemand(payload)
      if (res?.code === 200) {
        message.success(isEdit ? '需求已更新' : '需求已发布')
        navigate(isEdit ? `/demand/detail/${editingId}` : returnPath)
      } else {
        message.error(res?.message ?? '保存失败')
      }
    } catch {
      message.error('保存失败（检查后端是否在运行）')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`buyer-demand-page demand-create-page${embedded ? ' is-embedded' : ''}`}>
      <section className="buyer-demand-hero">
        <span className="buyer-demand-hero-icon">
          {isEdit ? <FileSearchOutlined /> : <SendOutlined />}
        </span>
        <div>
          <small>{isEdit ? 'EDIT PURCHASE REQUEST' : 'PUBLISH PURCHASE REQUEST'}</small>
          <h2>{isEdit ? '编辑采购需求' : '发布采购需求'}</h2>
          <p>填写采购品类、数量和交付要求，平台将辅助撮合供应商并接收正式报价。</p>
        </div>
        <button type="button" className="mc-btn ghost" onClick={() =>
          navigate(isEdit ? `/demand/detail/${editingId}` : returnPath)}>
          <ArrowLeftOutlined /> {embedded ? '返回需求管理' : '返回'}
        </button>
      </section>

      <div className="buyer-demand-steps">
        <div className="on"><span>01</span><strong>填写采购需求</strong><small>商品、价格与交付要求</small></div>
        <i />
        <div><span>02</span><strong>智能撮合询价</strong><small>比较供应商正式报价</small></div>
        <i />
        <div><span>03</span><strong>接受报价成单</strong><small>合同、支付与履约</small></div>
      </div>

      {!isEdit && (
        <section className="buyer-demand-ai">
          <div className="buyer-demand-ai-head">
            <span><RobotOutlined /></span>
            <div><strong>智能需求助手</strong><small>用一句话描述采购需求，系统会尝试预填表单</small></div>
          </div>
          <TextArea
            rows={2}
            value={nlpText}
            onChange={(e) => setNlpText(e.target.value)}
            placeholder="例如：我要采购 200 吨五常稻花香大米，价格 115 到 135 元一吨，11 月底前送到北京新发地"
          />
          <div className="buyer-demand-ai-foot">
            <button type="button" className="mc-btn" disabled={parsing} onClick={() => void handleParse()}>
              {parsing ? <><Spin size="small" /> 正在解析</> : <><RobotOutlined /> 智能解析并预填</>}
            </button>
            <span>解析结果仅作草稿，发布前请逐项核对</span>
          </div>
          {hints.length > 0 && (
            <Alert
              type="warning"
              showIcon
              message="以下内容未自动填写，请确认"
              description={<ul>{hints.map((item) => <li key={item}>{item}</li>)}</ul>}
            />
          )}
        </section>
      )}

      <Form form={form} layout="vertical" onFinish={onFinish}>
        <div className="buyer-demand-layout">
          <div className="buyer-demand-main">
            <Panel title="基本信息" extra={<span className="buyer-demand-section-note">定义采购标的</span>}>
              <div className="buyer-demand-section">
                <Row gutter={[16, 0]}>
                  <Col xs={24} lg={12}>
                    <Form.Item label="需求标题" name="demandName" rules={[{ required: true, message: '请填写需求标题' }]}>
                      <Input placeholder="例如：五常大米 200 吨采购需求" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12} lg={6}>
                    <Form.Item label="采购品类" name="categoryId" rules={[{ required: true, message: '请选择采购品类' }]}>
                      <Select
                        placeholder="请选择品类"
                        showSearch
                        optionFilterProp="label"
                        options={categories.map((item) => ({
                          value: item.id,
                          label: item.level === 2 ? `　${item.categoryName}` : item.categoryName,
                        }))}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12} lg={6}>
                    <Form.Item label="品种" name="variety">
                      <Input placeholder="例如：五常稻花香" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item label="商品名称" name="productName">
                      <Input placeholder="例如：东北五常大米 25kg/袋" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item label="交易类型" name="demandType" initialValue="spot">
                      <Select options={[
                        { value: 'spot', label: '现货采购' },
                        { value: 'long_term', label: '长期合作' },
                        { value: 'presale', label: '订单农业 / 预售' },
                      ]} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item label="等级要求" name="qualityLevel">
                      <Input placeholder="例如：一级" />
                    </Form.Item>
                  </Col>
                </Row>
              </div>
            </Panel>

            <Panel title="数量与价格" extra={<span className="buyer-demand-section-note">明确采购预算</span>}>
              <div className="buyer-demand-section">
                <Row gutter={[16, 0]}>
                  <Col xs={12} md={6}>
                    <Form.Item label="采购数量" name="quantity" rules={[{ required: true, message: '请输入采购数量' }]}>
                      <Input placeholder="例如：200" />
                    </Form.Item>
                  </Col>
                  <Col xs={12} md={6}>
                    <Form.Item label="单位" name="unit" rules={[{ required: true, message: '请选择单位' }]}>
                      <Select options={['吨', '公斤', '件', '箱', '袋'].map((value) => ({ value, label: value }))} />
                    </Form.Item>
                  </Col>
                  <Col xs={12} md={6}>
                    <Form.Item label="期望最低价（元）" name="priceMin">
                      <Input placeholder="例如：115" />
                    </Form.Item>
                  </Col>
                  <Col xs={12} md={6}>
                    <Form.Item label="期望最高价（元）" name="priceMax">
                      <Input placeholder="例如：135" />
                    </Form.Item>
                  </Col>
                </Row>
              </div>
            </Panel>

            <Panel title="交收要求" extra={<span className="buyer-demand-section-note">约定交付条件</span>}>
              <div className="buyer-demand-section">
                <Row gutter={[16, 0]}>
                  <Col xs={24} md={6}>
                    <Form.Item label="期望交货时间" name="deliveryDeadline">
                      <DatePicker showTime style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <ProvinceCityFields
                    form={form}
                    provinceLabel="收货省份"
                    cityLabel="收货城市"
                    provinceColProps={{ xs: 12, md: 6 }}
                    cityColProps={{ xs: 12, md: 6 }}
                  />
                  <Col xs={24} md={6}>
                    <Form.Item label="需要样品" name="sampleRequire" valuePropName="checked" initialValue={false}>
                      <Switch checkedChildren="需要" unCheckedChildren="不需要" />
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Form.Item label="收货地址" name="deliveryAddress">
                      <Input placeholder="例如：新发地农产品批发市场粮油区 3 号库" />
                    </Form.Item>
                  </Col>
                </Row>
              </div>
            </Panel>

            <Panel title="质量与包装" extra={<span className="buyer-demand-section-note">补充验货标准</span>}>
              <div className="buyer-demand-section">
                <Row gutter={[16, 0]}>
                  <Col xs={24} md={8}>
                    <Form.Item label="质量要求" name="qualityRequirement">
                      <TextArea rows={3} placeholder="例如：出米率不低于 66%，水分≤14.5%" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item label="资质要求" name="certificationRequire">
                      <TextArea rows={3} placeholder="例如：需提供质检报告" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item label="包装要求" name="packagingRequire">
                      <TextArea rows={3} placeholder="例如：25kg/袋，托盘装载" />
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Form.Item label="其他补充要求" name="additionalRequirements">
                      <TextArea rows={2} placeholder="补充结算方式、开票要求或其他说明" />
                    </Form.Item>
                  </Col>
                </Row>
              </div>
            </Panel>

            <div className="buyer-demand-actions">
              <button type="submit" className="mc-btn" disabled={saving}>
                <SendOutlined /> {saving ? '正在保存…' : isEdit ? '保存修改' : '发布采购需求'}
              </button>
              <button type="button" className="mc-btn ghost" onClick={() => navigate('/demand')}>
                取消
              </button>
              <span><SafetyCertificateOutlined /> 发布后可在“我的询价”跟踪报价与成单进度</span>
            </div>
          </div>

          <aside className="buyer-demand-aside">
            <Panel title="发布建议">
              <div className="buyer-demand-guide">
                <p><CheckCircleOutlined /> 标题写明品类、规格和数量，便于供应商快速判断。</p>
                <p><CheckCircleOutlined /> 期望价格保留合理区间，实际成交以供应商正式报价为准。</p>
                <p><CheckCircleOutlined /> 质量、包装和交付时间越明确，后续履约争议越少。</p>
              </div>
            </Panel>
            <Panel title="后续流程">
              <div className="buyer-demand-flow">
                <div><span>01</span><strong>发布需求</strong><small>等待系统撮合</small></div>
                <div><span>02</span><strong>供应商询价报价</strong><small>比较价格与交付</small></div>
                <div><span>03</span><strong>接受报价成单</strong><small>签署合同并支付</small></div>
                <div><span>04</span><strong>履约与售后</strong><small>物流签收和评价</small></div>
              </div>
            </Panel>
          </aside>
        </div>
      </Form>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Alert, Button, Card, Col, DatePicker, Divider, Form, Input, Row, Select, Space, Switch, Typography, message
} from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import { createDemand, getDemandById, parseNaturalLanguage, updateDemand } from '@/api/demand'
import { getCategoryList, getProductById } from '@/api/product'

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
export default function DemandCreate() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [form] = Form.useForm()
  const editingId = params.get('id')
  const productId = params.get('productId')
  const isEdit = Boolean(editingId)

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
            priceMin: p.priceMin,
            priceMax: p.priceMax
          })
          message.info(`已按货源「${p.productName}」预填，可直接修改`)
        }
      })
      .catch(() => undefined)
  }, [productId, form])

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
        navigate(isEdit ? `/demand/detail/${editingId}` : '/demand')
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
    <div style={{ padding: 20 }}>
      <Card
        title={isEdit ? '编辑采购需求' : '发布采购需求'}
        extra={<Button type="link" onClick={() => navigate(isEdit ? `/demand/detail/${editingId}` : '/demand')}>返回</Button>}
      >
        {!isEdit && (
          <Card size="small" style={{ marginBottom: 24, background: '#f8fafc' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Typography.Text strong>
                <RobotOutlined /> 用一句话描述需求（可选）
              </Typography.Text>
              <TextArea
                rows={2}
                value={nlpText}
                onChange={(e) => setNlpText(e.target.value)}
                placeholder="例如：我要采购 200 吨五常稻花香大米，价格 115 到 135 元一吨，11 月底前送到北京新发地"
              />
              <Space>
                <Button type="primary" loading={parsing} onClick={handleParse}>
                  智能解析并预填
                </Button>
                <Typography.Text type="secondary">
                  解析结果只是草稿，请核对下面的字段后再提交
                </Typography.Text>
              </Space>
              {hints.length > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  message="以下内容没有自动填写，需要你确认"
                  description={
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {hints.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  }
                />
              )}
            </Space>
          </Card>
        )}

        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Divider orientation="left">基本信息</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="需求标题" name="demandName" rules={[{ required: true, message: '请填写需求标题' }]}>
                <Input placeholder="例如：五常大米 200 吨采购需求" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="采购品类" name="categoryId" rules={[{ required: true, message: '请选择采购品类' }]}>
                <Select
                  placeholder="请选择品类"
                  showSearch
                  optionFilterProp="label"
                  options={categories.map((item) => ({
                    value: item.id,
                    label: item.level === 2 ? `　${item.categoryName}` : item.categoryName
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="品种" name="variety">
                <Input placeholder="例如：五常稻花香" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="商品名称" name="productName">
                <Input placeholder="例如：东北五常大米 25kg/袋" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="交易类型" name="demandType" initialValue="spot">
                <Select
                  options={[
                    { value: 'spot', label: '现货采购' },
                    { value: 'long_term', label: '长期合作' },
                    { value: 'presale', label: '订单农业/预售' }
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="等级要求" name="qualityLevel">
                <Input placeholder="例如：一级" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">数量与价格</Divider>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="采购数量" name="quantity" rules={[{ required: true, message: '请输入采购数量' }]}>
                <Input placeholder="例如：200" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="单位" name="unit" rules={[{ required: true, message: '请选择单位' }]}>
                <Select
                  placeholder="请选择"
                  options={[
                    { value: '吨', label: '吨' },
                    { value: '公斤', label: '公斤' },
                    { value: '件', label: '件' },
                    { value: '箱', label: '箱' },
                    { value: '袋', label: '袋' }
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="期望最低价（元）" name="priceMin">
                <Input placeholder="例如：115" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="期望最高价（元）" name="priceMax">
                <Input placeholder="例如：135" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">交收要求</Divider>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="期望交货时间" name="deliveryDeadline">
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="收货省份" name="deliveryProvince">
                <Input placeholder="例如：北京市" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="收货城市" name="deliveryCity">
                <Input placeholder="例如：北京市" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="需要样品" name="sampleRequire" valuePropName="checked" initialValue={false}>
                <Switch checkedChildren="需要" unCheckedChildren="不需要" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item label="收货地址" name="deliveryAddress">
                <Input placeholder="例如：新发地农产品批发市场粮油区 3 号库" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="质量要求" name="qualityRequirement">
                <Input placeholder="例如：出米率不低于 66%，水分≤14.5%" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="资质要求" name="certificationRequire">
                <Input placeholder="例如：需提供质检报告" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="包装要求" name="packagingRequire">
                <Input placeholder="例如：25kg/袋，托盘装载" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item label="其他补充要求" name="additionalRequirements">
                <TextArea rows={2} placeholder="补充说明，例如结算方式、开票要求等" />
              </Form.Item>
            </Col>
          </Row>

          <Space>
            <Button type="primary" htmlType="submit" loading={saving}>
              {isEdit ? '保存修改' : '发布需求'}
            </Button>
            <Button onClick={() => navigate('/demand')}>取消</Button>
          </Space>
        </Form>
      </Card>
    </div>
  )
}

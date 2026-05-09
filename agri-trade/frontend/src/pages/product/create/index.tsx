import { useState } from 'react'
import { Form, Input, Select, DatePicker, Checkbox, Button, Card, Row, Col, Upload, Image } from 'antd'
import { PlusOutlined, UploadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { createProduct } from '@/api/product'

const { Option } = Select
const { TextArea } = Input

function ProductCreate() {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [images, setImages] = useState<string[]>([])

  const handleImageUpload = (file: any) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      setImages([...images, e.target?.result as string])
    }
    reader.readAsDataURL(file)
    return false
  }

  const onFinish = async (values: any) => {
    await createProduct({ ...values, images })
    navigate('/product')
  }

  return (
    <Card title="发布货源" extra={<Button type="link" onClick={() => navigate('/product')}>返回列表</Button>}>
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Card title="商品信息" style={{ marginBottom: 24 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="农产品品类"
                name="category"
                rules={[{ required: true, message: '请选择品类' }]}
              >
                <Select placeholder="请选择品类">
                  <Option value="vegetable">蔬菜</Option>
                  <Option value="fruit">水果</Option>
                  <Option value="grain">粮油</Option>
                  <Option value="meat">肉类</Option>
                  <Option value="seafood">海鲜</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="品种名称"
                name="productName"
                rules={[{ required: true, message: '请输入品种名称' }]}
              >
                <Input placeholder="请输入品种名称" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="产地-省份"
                name="province"
                rules={[{ required: true, message: '请选择省份' }]}
              >
                <Select placeholder="请选择省份">
                  <Option value="sd">山东省</Option>
                  <Option value="hn">河南省</Option>
                  <Option value="js">江苏省</Option>
                  <Option value="gd">广东省</Option>
                  <Option value="sc">四川省</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="产地-城市"
                name="city"
                rules={[{ required: true, message: '请选择城市' }]}
              >
                <Select placeholder="请选择城市">
                  <Option value="jinan">济南市</Option>
                  <Option value="qingdao">青岛市</Option>
                  <Option value="zhengzhou">郑州市</Option>
                  <Option value="nanjing">南京市</Option>
                  <Option value="guangzhou">广州市</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="产地-区县"
                name="district"
                rules={[{ required: true, message: '请选择区县' }]}
              >
                <Select placeholder="请选择区县">
                  <Option value="shouguang">寿光市</Option>
                  <Option value="qingzhou">青州市</Option>
                  <Option value="zhongmou">中牟县</Option>
                  <Option value="gaoyou">高邮市</Option>
                  <Option value="conghua">从化区</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="规格信息" style={{ marginBottom: 24 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="单果规格" name="singleSpec">
                <Input placeholder="如80#以上（直径80mm以上）" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="包装规格" name="packaging">
                <Select placeholder="请选择包装规格">
                  <Option value="10jin">10斤装/箱</Option>
                  <Option value="20jin">20斤装/箱</Option>
                  <Option value="50kg">50kg/袋</Option>
                  <Option value="custom">自定义</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="等级" name="grade">
                <Select placeholder="请选择等级">
                  <Option value="premium">优等</Option>
                  <Option value="first">一级</Option>
                  <Option value="second">二级</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="库存与价格" style={{ marginBottom: 24 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="可供货量"
                name="quantity"
                rules={[{ required: true, message: '请输入可供货量' }]}
              >
                <Input placeholder="请输入数量" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="数量单位"
                name="unit"
                rules={[{ required: true, message: '请选择单位' }]}
              >
                <Select placeholder="请选择单位">
                  <Option value="ton">吨</Option>
                  <Option value="kg">千克</Option>
                  <Option value="piece">件</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="日均可供货量" name="dailyQuantity">
                <Input placeholder="日均供货能力" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="单价"
                name="price"
                rules={[{ required: true, message: '请输入单价' }]}
              >
                <Input placeholder="元/斤或元/件" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="价格有效期" name="priceValidDate">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="品质信息" style={{ marginBottom: 24 }}>
          <Form.Item label="认证信息" name="certifications">
            <Checkbox.Group options={[
              { label: '绿色食品', value: 'green' },
              { label: '有机认证', value: 'organic' },
              { label: '地理标志', value: 'geographic' },
            ]} />
          </Form.Item>
          <Form.Item label="检测报告" name="testReport">
            <Upload.Dragger accept=".jpg,.png,.pdf" beforeUpload={() => false}>
              <p className="ant-upload-drag-icon">
                <UploadOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽上传检测报告</p>
            </Upload.Dragger>
          </Form.Item>
        </Card>

        <Card title="商品展示" style={{ marginBottom: 24 }}>
          <Form.Item label="商品图片" rules={[{ required: true, message: '请上传商品图片' }]}>
            <Upload.Dragger accept=".jpg,.png" beforeUpload={handleImageUpload}>
              <p className="ant-upload-drag-icon">
                <UploadOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽上传商品图片（最多9张）</p>
              <p className="ant-upload-hint">建议包含：整体图/细节图/包装图</p>
            </Upload.Dragger>
            {images.length > 0 && (
              <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
                {images.map((img, index) => (
                  <Image key={index} src={img} width={100} height={100} />
                ))}
              </div>
            )}
          </Form.Item>
          <Form.Item
            label="产品描述"
            name="description"
            rules={[{ required: true, message: '请输入产品描述' }]}
          >
            <TextArea rows={4} placeholder="详细描述产品特点和优势" />
          </Form.Item>
        </Card>

        <Form.Item>
          <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>
            发布货源
          </Button>
          <Button style={{ marginLeft: 8 }} onClick={() => navigate('/product')}>
            取消
          </Button>
        </Form.Item>
      </Form>
    </Card>
  )
}

export default ProductCreate

import { Form, Input, Select, DatePicker, Checkbox, Button, Card, Row, Col } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { createDemand } from '@/api/demand'

const { Option } = Select
const { TextArea } = Input

function DemandCreate() {
  const navigate = useNavigate()
  const [form] = Form.useForm()

  const onFinish = async (values: any) => {
    await createDemand(values)
    navigate('/demand')
  }

  return (
    <Card title="发布采购需求" extra={<Button type="link" onClick={() => navigate('/demand')}>返回列表</Button>}>
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Card title="基本信息" style={{ marginBottom: 24 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="采购品类"
                name="category"
                rules={[{ required: true, message: '请选择采购品类' }]}
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
                label="品种/规格"
                name="specification"
              >
                <Input placeholder="请输入品种或规格" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="采购数量"
                name="quantity"
                rules={[{ required: true, message: '请输入采购数量' }]}
              >
                <Input placeholder="请输入数量" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="数量单位"
                name="unit"
                rules={[{ required: true, message: '请选择数量单位' }]}
              >
                <Select placeholder="请选择单位">
                  <Option value="ton">吨</Option>
                  <Option value="kg">千克</Option>
                  <Option value="piece">件</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="持续周期"
                name="cycle"
                rules={[{ required: true, message: '请选择持续周期' }]}
              >
                <Select placeholder="请选择周期">
                  <Option value="single">单次采购</Option>
                  <Option value="daily">每日供应</Option>
                  <Option value="longterm">长期合作</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="价格预期" style={{ marginBottom: 24 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="最低价"
                name="minPrice"
              >
                <Input placeholder="最低价（元/斤）" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="最高价"
                name="maxPrice"
              >
                <Input placeholder="最高价（元/斤）" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="交货条件" style={{ marginBottom: 24 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="交货地点"
                name="deliveryLocation"
                rules={[{ required: true, message: '请输入交货地点' }]}
              >
                <Input placeholder="请输入交货地点" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="最晚交货日期"
                name="deliveryDate"
                rules={[{ required: true, message: '请选择最晚交货日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="品质要求" style={{ marginBottom: 24 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="等级标准" name="grade">
                <Select placeholder="请选择等级标准">
                  <Option value="premium">优等</Option>
                  <Option value="first">一级</Option>
                  <Option value="second">二级</Option>
                  <Option value="none">无要求</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="样品要求" name="needSample">
                <Checkbox>需要先看样品</Checkbox>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="品质描述" name="qualityDesc">
            <TextArea rows={3} placeholder="请详细描述采购品质要求" />
          </Form.Item>
        </Card>

        <Card title="特殊要求" style={{ marginBottom: 24 }}>
          <Form.Item label="认证要求" name="certifications">
            <Checkbox.Group options={[
              { label: '绿色食品', value: 'green' },
              { label: '有机认证', value: 'organic' },
              { label: '地理标志', value: 'geographic' },
            ]} />
          </Form.Item>
          <Form.Item label="包装要求" name="packaging">
            <Input placeholder="请输入包装要求" />
          </Form.Item>
        </Card>

        <Card title="联系方式" style={{ marginBottom: 24 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="联系人"
                name="contactName"
                rules={[{ required: true, message: '请输入联系人姓名' }]}
              >
                <Input placeholder="请输入联系人姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="手机号"
                name="contactPhone"
                rules={[{ required: true, message: '请输入手机号' }]}
              >
                <Input placeholder="请输入手机号" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Form.Item>
          <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>
            发布需求
          </Button>
          <Button style={{ marginLeft: 8 }} onClick={() => navigate('/demand')}>
            取消
          </Button>
        </Form.Item>
      </Form>
    </Card>
  )
}

export default DemandCreate
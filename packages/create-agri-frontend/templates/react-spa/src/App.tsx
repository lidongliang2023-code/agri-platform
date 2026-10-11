import { Card, Layout, Space, Tag, Typography } from 'antd'
import { PLOT_STATUS_META } from '@agri/shared/types/farm'
import { WIRING_CHECK } from './shared-wiring'

const { Header, Content } = Layout
const { Paragraph, Text, Title } = Typography

/**
 * 骨架首页。
 *
 * 页面上的每一个值都来自共享包，所以「接线是否打通」不用看代码、打开页面就知道：
 * 有值 = 通，白屏或构建失败 = 没通。
 */
export default function App() {
  const plotStatuses = Object.entries(PLOT_STATUS_META)

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>
          {{APP_NAME}}
        </Title>
      </Header>
      <Content style={{ padding: 16 }}>
        <Card title="共享包接线自检（@agri/shared）">
          <Space direction="vertical" size="middle">
            <Text>
              品牌主色：<Tag color={WIRING_CHECK.brandColor}>{WIRING_CHECK.brandColor}</Tag>
              （取自共享包，非本目录写死）
            </Text>
            <Text>侧边栏宽度常量：{WIRING_CHECK.siderWidth}px</Text>
            <Text>地块状态元数据条数：{WIRING_CHECK.plotStatusCount}</Text>
            <Paragraph style={{ marginBottom: 0 }}>
              地块状态取值：
              <Space wrap>
                {plotStatuses.map(([code, meta]) => (
                  <Tag key={code} color={meta.color}>
                    {code} {meta.label}
                  </Tag>
                ))}
              </Space>
            </Paragraph>
          </Space>
        </Card>
      </Content>
    </Layout>
  )
}

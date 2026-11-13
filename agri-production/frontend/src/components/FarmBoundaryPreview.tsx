import { useMemo } from 'react'
import { Empty, Space, Typography } from 'antd'
import { TiandituMap, computePolygonMetrics, parseBoundaryVertices, polygonCentroid } from '@agri/shared'

export default function FarmBoundaryPreview({ boundary, name = '农场' }: { boundary?: string | null; name?: string }): JSX.Element {
  const vertices = useMemo(() => parseBoundaryVertices(boundary), [boundary])
  const center = useMemo(() => polygonCentroid(vertices), [vertices])
  const metrics = useMemo(() => computePolygonMetrics(vertices), [vertices])
  if (vertices.length < 3 || !center) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未绘制农场边界" />
  return <Space direction="vertical" style={{ width: '100%' }}>
    <Typography.Text type="secondary">{vertices.length} 个顶点 · 测算面积约 {metrics.areaMu.toFixed(2)} 亩 · 周长约 {Math.round(metrics.perimeterMeters)} 米（测算值仅供参考）</Typography.Text>
    <TiandituMap height={340} showLegend={false} points={[{ id: 'farm-boundary', title: name, ...center, boundary }]} />
  </Space>
}

import { Tabs } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'

const GROUPS = [
  [
    ['/production/quality', '质量检测台账'],
    ['/production/quality/grading', '批次等级查询'],
  ],
  [
    ['/production/trace/full-chain', '生产与质量链路'],
    ['/production/trace/reports', '批次溯源报告'],
  ],
  [
    ['/production/blockchain', '存证概览'],
    ['/production/blockchain/records', '存证记录'],
    ['/production/blockchain/verify', '凭证核验'],
  ],
  [
    ['/production/p2t/offers', '供给单'],
    ['/production/p2t/batches', '可发布批次'],
    ['/production/p2t/variety', '品种映射配置'],
  ],
  [
    ['/production/p2t', '产销工作台'],
    ['/production/p2t/boundary', '业务口径与协作说明'],
  ],
]

/** 将同一业务的低频页面收敛为页内导航，保留既有深链接。 */
export default function ProductionModuleNav(): JSX.Element | null {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const group = GROUPS.find(items => items.some(([path]) => path === pathname))
  if (!group) return null
  return <Tabs activeKey={pathname} items={group.map(([key, label]) => ({ key, label }))}
    onChange={path => navigate(`${path}${search}`)} style={{ marginBottom: 16 }} />
}

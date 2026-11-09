import { PageContainer } from '@ant-design/pro-components'
import type { ComponentProps } from 'react'
import './ProductionPageContainer.css'
import ProductionModuleNav from './ProductionModuleNav'

/** 生产用户端标准页头：统一标题、副标题、返回入口与右侧操作区。 */
export default function ProductionPageContainer({ className = '', children, ...props }: ComponentProps<typeof PageContainer>): JSX.Element {
  return <PageContainer {...props} className={`production-page-container ${className}`.trim()}><ProductionModuleNav />{children}</PageContainer>
}

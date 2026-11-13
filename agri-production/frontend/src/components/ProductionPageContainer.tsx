import { PageContainer } from '@ant-design/pro-components'
import type { ComponentProps } from 'react'
import { Grid } from 'antd'
import './ProductionFormMobile.css'
import './ProductionPageContainer.css'
import ProductionModuleNav from './ProductionModuleNav'

/** 生产用户端标准页头：统一标题、副标题、返回入口与右侧操作区。 */
export default function ProductionPageContainer({ className = '', children, mobileForm = false, extra, ...props }: ComponentProps<typeof PageContainer> & { mobileForm?: boolean }): JSX.Element {
  const screens = Grid.useBreakpoint()
  const mobile = screens.md === false
  return <PageContainer {...props} extra={mobileForm && mobile ? undefined : extra} className={`production-page-container ${mobileForm ? 'production-form-page' : ''} ${className}`.trim()}><ProductionModuleNav />{children}{mobileForm && mobile && extra && <div className="production-mobile-form-actions" role="group" aria-label="表单操作">{extra}</div>}</PageContainer>
}

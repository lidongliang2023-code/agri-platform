/** 生产管理用户端 / 运营端：在共享 antd 主题上收口到买家中心绿色视觉。 */
import type { ThemeConfig } from 'antd'
import { antdTheme } from '@agri/shared'

export const productionTheme: ThemeConfig = {
  ...antdTheme,
  token: {
    ...antdTheme.token,
    colorPrimary: '#12764a',
    colorLink: '#12764a',
    colorLinkHover: '#159a5e',
    colorText: '#0b1a12',
    colorTextSecondary: '#6b7c72',
    colorBorder: '#e3eae5',
    colorBorderSecondary: '#e3eae5',
    colorBgLayout: '#f4f7f5',
    colorBgContainer: '#ffffff',
    borderRadius: 12,
  },
  components: {
    ...antdTheme.components,
    Layout: {
      ...antdTheme.components?.Layout,
      bodyBg: '#f4f7f5',
      headerBg: '#ffffff',
      headerHeight: 60,
      siderBg: '#06281a',
    },
    Menu: {
      ...antdTheme.components?.Menu,
      itemBorderRadius: 8,
      itemMarginInline: 10,
    },
    Card: {
      ...antdTheme.components?.Card,
      headerFontSize: 15,
    },
    Table: {
      ...antdTheme.components?.Table,
      headerBg: '#f4f7f5',
      headerColor: '#4b5d53',
      borderColor: '#e3eae5',
      rowHoverBg: '#f1fbf5',
    },
    Button: {
      ...antdTheme.components?.Button,
      borderRadius: 8,
    },
    Input: {
      ...antdTheme.components?.Input,
      activeBorderColor: '#159a5e',
      hoverBorderColor: '#6fd6a2',
    },
    Select: {
      ...antdTheme.components?.Select,
      optionSelectedBg: '#e4f6ec',
    },
  },
}

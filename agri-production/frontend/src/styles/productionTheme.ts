/** 生产管理用户端 / 运营端：在共享 antdv 主题上收口到买家中心绿色视觉。 */
import type { ThemeConfig } from 'ant-design-vue/es/config-provider/context'
import { antdvTheme } from '@agri/shared/vue/antdv'

export const productionTheme = {
  token: {
    ...antdvTheme.token,
    colorPrimary: '#2d8f4e',
    colorLink: '#2d8f4e',
    colorLinkHover: '#247a3f',
    colorText: '#1a1a1a',
    colorTextSecondary: '#595959',
    colorBorder: '#e8e8e8',
    colorBorderSecondary: '#f0f0f0',
    colorBgLayout: '#f5f6fa',
    colorBgContainer: '#ffffff',
    borderRadius: 6,
  },
  components: {
    Layout: {
      colorBgBody: '#f5f6fa',
      colorBgHeader: '#ffffff',
    },
    Menu: {
      radiusItem: 8,
    },
    Table: {
      colorFillAlter: '#fafafa',
      colorTextHeading: '#4b5d53',
      colorBorderSecondary: '#e3eae5',
    },
    Button: {
      borderRadius: 4,
    },
    Input: {
      colorPrimaryHover: '#6fd6a2',
      colorPrimary: '#159a5e',
    },
    Select: {
      controlItemBgActive: '#e4f6ec',
    },
  },
} as ThemeConfig

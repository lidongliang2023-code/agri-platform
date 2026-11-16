/// <reference types="@dcloudio/types" />
/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

declare const uni: any

interface ImportMetaEnv {
  readonly VITE_TRADE_API_BASE?: string
  readonly VITE_TRADE_LAN_PREVIEW?: string
  readonly VITE_TRADE_AUTH_BASE?: string
  /** 统一认证中心网页版地址（登录页「注册账号」在 H5 里打开），如 https://sso.agri-platform.com */
  readonly VITE_TRADE_SSO_WEB?: string
  readonly VITE_PRODUCTION_MOBILE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

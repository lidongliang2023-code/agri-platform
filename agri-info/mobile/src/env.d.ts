/// <reference types="@dcloudio/types" />
/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

declare const uni: any

interface ImportMetaEnv {
  readonly VITE_INFO_API_BASE?: string
  readonly VITE_INFO_AUTH_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

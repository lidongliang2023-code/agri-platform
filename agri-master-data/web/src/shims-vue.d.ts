/// <reference types="vite/client" />

// 让 tsc 认识 .vue 单文件组件：没有这个声明，router/index.ts 里 import 任何 .vue 都会报 TS2307，
// 而构建脚本是 `tsc && vite build` —— 整条构建会卡在类型检查上，与页面本身无关。
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}

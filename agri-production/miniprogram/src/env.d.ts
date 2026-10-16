/// <reference types="@dcloudio/types" />

/**
 * 让 `tsc --noEmit` 认识 `.vue` 单文件组件与 uni 全局对象。

 *
 * <p>uni-app 的构建（vite 插件）本来就能处理 .vue，但**类型检查**走的是标准 tsc，
 * 没有这个声明文件时 `src/main.ts` 里的 `import App from './App.vue'` 会直接报 TS2307 ——
 * 于是"编译能过、类型检查挂"，门禁里就没法加 tsc 这一步。</p>
 */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

/** uni-app 注入的全局对象（`uni.request` / `uni.getStorageSync` 等） */
declare const uni: any

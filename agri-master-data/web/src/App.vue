<!-- 根组件：只放路由出口。布局由各视图/布局组件自行决定（与既有 .vue 页面的写法保持一致）。 -->
<template>
  <a-config-provider :theme="theme">
    <router-view />
  </a-config-provider>
</template>

<script setup lang="ts">
import { theme as antTheme } from 'ant-design-vue'

/**
 * Ant Design Vue 主题：颜色遵循 PC UI V1 设计规范（主色 #2d8f4e）。
 *
 * 页面主体用 ui.css 的 mds-* 类，antd 只承担 message / 少量表单控件；
 * 不统一主色的话，同一页面里会出现绿色按钮 + 蓝色 focus 环这种两套品牌色并存。
 */
const theme = {
  token: {
    colorPrimary: '#2d8f4e',
    colorSuccess: '#2d8f4e',
    colorWarning: '#ff8c2a',
    colorError: '#e53935',
    colorInfo: '#1981f0',
    colorText: '#1a1a1a',
    colorTextSecondary: '#595959',
    colorBorder: '#e8e8e8',
    colorBgLayout: '#f5f6fa',
    borderRadius: 6,
    fontSize: 14,
  },
  algorithm: [antTheme.defaultAlgorithm],
}
</script>

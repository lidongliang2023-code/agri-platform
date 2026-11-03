<!-- 根组件：只放路由出口。布局由各视图/布局组件自行决定（与既有 .vue 页面的写法保持一致）。 -->
<template>
  <a-config-provider :theme="theme">
    <router-view />
  </a-config-provider>
</template>

<script setup lang="ts">
import { theme as antTheme } from 'ant-design-vue'

/**
 * Ant Design Vue 主题：主色与其它子系统统一为平台绿（#13a05a）。
 *
 * 页面主体用 ui.css 的 mds-* 类，antd 只承担 message / 少量表单控件；
 * 不统一主色的话，同一页面里会出现绿色按钮 + 蓝色 focus 环这种两套品牌色并存。
 */
const theme = {
  token: {
    colorPrimary: '#13a05a',
    colorSuccess: '#2e7d32',
    colorWarning: '#e65100',
    colorError: '#c62828',
    colorInfo: '#1565c0',
    borderRadius: 6,
    fontSize: 14,
  },
  algorithm: [antTheme.defaultAlgorithm],
}
</script>

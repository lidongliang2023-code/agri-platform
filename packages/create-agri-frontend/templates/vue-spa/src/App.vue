<template>
  <a-config-provider :locale="zhCN" :theme="antdvTheme">
    <router-view />
  </a-config-provider>
</template>

<script setup lang="ts">
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import { antdvTheme } from '@agri/shared/vue/antdv'
</script>

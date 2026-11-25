<template>
  <div style="padding: 24px">
    <a-card title="{{APP_NAME}}">
      <p>Vue 3 + TypeScript + Ant Design Vue 4 + Pinia + Vue Router 4 骨架已就绪。</p>
      <p>品牌主色：<code>{{ BRAND_COLOR }}</code></p>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { BRAND_COLOR } from '@agri/shared/vue/antdv'
</script>

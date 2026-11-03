<template>
  <div class="m-empty">
    <span class="ico">{{ icon }}</span>
    <h4>{{ title }}</h4>
    <p v-if="desc">{{ desc }}</p>
    <slot name="actions" />
  </div>
</template>

<script setup>
defineProps({
  icon: { type: String, default: '📦' },
  title: { type: String, default: '暂无数据' },
  desc: { type: String, default: '' },
})
</script>

<template>
  <div class="sec-hd">
    <h2>{{ title }}</h2>
    <span v-if="desc" class="sec-desc">{{ desc }}</span>
    <slot />
    <button v-if="moreText" type="button" class="more" @click="$emit('more')">{{ moreText }}</button>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  desc: { type: String, default: '' },
  moreText: { type: String, default: '' },
})
defineEmits(['more'])
</script>

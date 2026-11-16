<script setup lang="ts">
/** 统一的分段标签：横向可滑动，选中项深绿底白字；样式在 App.vue 的 .seg 规范里。 */
defineProps<{ modelValue: string; options: Array<[string, string]> }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()
</script>
<template>
  <scroll-view scroll-x class="seg" :show-scrollbar="false">
    <view class="seg-track">
      <button v-for="option in options" :key="option[0]" class="seg-item" :class="{ on: modelValue === option[0] }" @tap="emit('update:modelValue', option[0])">{{ option[1] }}</button>
    </view>
  </scroll-view>
</template>

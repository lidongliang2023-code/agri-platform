<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="name === 'back'">
      <path d="m15 18-6-6 6-6" /><path d="M9 12h11" />
    </template>
    <template v-else-if="name === 'seed'">
      <path d="M12 21c0-6 3-9 8-9 0 6-3 9-8 9Z" /><path d="M12 21c0-6-3-9-8-9 0 6 3 9 8 9Z" /><path d="M12 21v-8" />
    </template>
    <template v-else-if="name === 'shield'">
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" /><path d="m9 12 2 2 4-4" />
    </template>
    <template v-else-if="name === 'zap'">
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </template>
    <template v-else-if="name === 'money'">
      <circle cx="12" cy="12" r="8" /><path d="M9 9h6M9 15h6M12 7v10" />
    </template>
    <template v-else-if="name === 'cart'">
      <circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M3 4h2l2.2 10.2A2 2 0 0 0 9.2 16H18l2-8H6" />
    </template>
    <template v-else-if="name === 'box'">
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="M4 7.5 12 12l8-4.5M12 12v9" />
    </template>
    <template v-else-if="name === 'factory'">
      <path d="M3 21V10l5 3V10l5 3V7l8 5v9H3Z" /><path d="M7 17h2M12 17h2M17 17h2" />
    </template>
    <template v-else-if="name === 'user'">
      <circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
    </template>
    <template v-else-if="name === 'check'">
      <path d="m5 12 5 5 9-10" />
    </template>
    <template v-else-if="name === 'eye'">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.8" />
    </template>
    <template v-else-if="name === 'eye-off'">
      <path d="m3 3 18 18" /><path d="M10.6 6.2A11 11 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.1 2.8M6.2 6.5C3.8 8.2 2.5 12 2.5 12s3.5 6 9.5 6c1.3 0 2.5-.3 3.6-.7" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </template>
    <template v-else>
      <circle cx="12" cy="12" r="8" />
    </template>
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 16 })
</script>

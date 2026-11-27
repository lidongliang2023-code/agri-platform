<template>
  <section class="agri-detail-section">
    <header v-if="title || $slots.title || $slots.extra" class="agri-detail-section-head">
      <h3 class="agri-detail-section-title">
        <slot name="title">{{ title }}</slot>
      </h3>
      <div v-if="$slots.extra" class="agri-detail-section-extra">
        <slot name="extra" />
      </div>
    </header>
    <div class="agri-detail-section-body" :class="{ 'is-flush': flush }">
      <slot />
    </div>
    <footer v-if="$slots.footer" class="agri-detail-section-footer">
      <slot name="footer" />
    </footer>
  </section>
</template>

<script setup lang="ts">
import './AgriVueDetail.css'

withDefaults(defineProps<{
  title?: string
  flush?: boolean
}>(), {
  title: '',
  flush: false,
})
</script>

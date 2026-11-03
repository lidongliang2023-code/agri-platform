<template>
  <div class="mall-root">
    <MallHeader />

    <div class="m-crumb">
      <div class="m-crumb-inner">
        <span>🏠 首页</span>
        <span class="sep">/</span>
        <b>{{ route.meta?.group || '商城' }}</b>
        <span class="sep">/</span>
        <b>{{ route.meta?.title || '商城首页' }}</b>
      </div>
    </div>

    <main class="m-page">
      <router-view v-slot="{ Component }">
        <component :is="Component" />
      </router-view>
    </main>

    <MallFooter />
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import MallHeader from './components/MallHeader.vue'
import MallFooter from './components/MallFooter.vue'
import { useUserStore } from './stores/user'

const route = useRoute()
const userStore = useUserStore()

onMounted(() => {
  userStore.init()
})
</script>

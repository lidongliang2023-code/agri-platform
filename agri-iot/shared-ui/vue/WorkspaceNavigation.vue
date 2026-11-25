<template>
  <div class="iot-level-nav">
    <a-menu
      theme="dark"
      mode="inline"
      :inline-collapsed="collapsed"
      :selected-keys="[selected]"
      :open-keys="collapsed ? undefined : openKeys"
      @open-change="handleOpenChange"
      @click="handleSelect"
    >
      <a-sub-menu v-for="group in groups" :key="group.group">
        <template #icon><component :is="group.items[0]?.icon" /></template>
        <template #title>{{ group.group }}</template>
        <a-menu-item v-for="item in group.items" :key="item.page">
          <template #icon><component :is="item.icon" /></template>
          {{ item.label }}
        </a-menu-item>
      </a-sub-menu>
    </a-menu>
  </div>

  <a-drawer
    title="物联网功能导航"
    placement="left"
    :width="240"
    :open="mobileOpen"
    class="iot-nav-drawer"
    @close="emit('mobile-close')"
  >
    <div class="iot-level-nav">
      <a-menu
        theme="dark"
        mode="inline"
        :inline-collapsed="false"
        :selected-keys="[selected]"
        :open-keys="openKeys"
        @open-change="handleOpenChange"
        @click="handleSelect"
      >
        <a-sub-menu v-for="group in groups" :key="group.group">
          <template #icon><component :is="group.items[0]?.icon" /></template>
          <template #title>{{ group.group }}</template>
          <a-menu-item v-for="item in group.items" :key="item.page">
            <template #icon><component :is="item.icon" /></template>
            {{ item.label }}
          </a-menu-item>
        </a-sub-menu>
      </a-menu>
    </div>
    <div class="pc-side-user">
      <SidebarUserCard
        :client-id="clientId"
        :role-label="clientId === 'iot' ? '物联网用户' : '物联网平台运营'"
        :collapsed="false"
        :switch-url="switchUrl"
        :switch-label="clientId === 'iot' ? '切换身份（运营端）' : '切换身份（用户端）'"
      />
    </div>
  </a-drawer>
</template>

<script setup lang="ts">
import { computed, ref, watch, type Component } from 'vue'
import SidebarUserCard from './SidebarUserCard.vue'
import '../workspace-navigation.css'

export interface NavigationGroup {
  group: string
  items: Array<{ page: string; label: string; icon: Component }>
}

const props = defineProps<{
  groups: NavigationGroup[]
  selected: string
  collapsed: boolean
  clientId: string
  mobileOpen: boolean
}>()

const emit = defineEmits<{
  navigate: [page: string]
  'mobile-close': []
}>()

const activeGroup = computed(() =>
  props.groups.find((group) => group.items.some((item) => item.page === props.selected))?.group,
)
const openKeys = ref<string[]>(activeGroup.value ? [activeGroup.value] : [])

watch(activeGroup, (group) => {
  if (group && !openKeys.value.includes(group)) {
    openKeys.value = [...openKeys.value, group]
  }
})

const switchUrl = computed(
  () => `${window.location.protocol}//${window.location.hostname}:${props.clientId === 'iot' ? 8102 : 8101}/`,
)

function handleOpenChange(keys: (string | number)[]) {
  openKeys.value = keys.map(String)
}

function handleSelect({ key }: { key: string | number }) {
  emit('navigate', String(key))
  emit('mobile-close')
}
</script>

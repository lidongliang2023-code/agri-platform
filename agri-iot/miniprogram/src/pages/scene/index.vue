<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api, type Scene } from '../../api/iot'

const items = ref<Scene[]>([])
const activating = ref(0)

onShow(load)

async function load() {
  try {
    items.value = await api.scenes()
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' })
  }
}

async function activate(item: Scene) {
  uni.showModal({
    title: '启用场景',
    content: `确认启用「${item.sceneName}」并下发控制指令？`,
    success: async (result) => {
      if (!result.confirm) return
      activating.value = item.id
      try {
        await api.activateScene(item.id)
        uni.showToast({ title: '场景已启用', icon: 'success' })
        load()
      } catch (error) {
        uni.showToast({ title: error instanceof Error ? error.message : '启用失败', icon: 'none' })
      } finally {
        activating.value = 0
      }
    },
  })
}

function edit(item?: Scene) {
  uni.navigateTo({ url: `/pages/scene/edit${item ? `?id=${item.id}` : ''}` })
}

function automation() {
  uni.navigateTo({ url: '/pages/automation/index' })
}

function remove(item: Scene) {
  uni.showModal({
    title: '删除场景',
    content: `确定删除「${item.sceneName}」吗？`,
    confirmColor: '#c54b4b',
    success: async (result) => {
      if (!result.confirm) return
      try {
        await api.deleteScene(item.id)
        uni.showToast({ title: '已删除', icon: 'success' })
        load()
      } catch (error) {
        uni.showToast({ title: error instanceof Error ? error.message : '删除失败', icon: 'none' })
      }
    },
  })
}
</script>

<template>
  <view class="page pad">
    <view class="toolbar">
      <view class="toolbar-main"><text class="toolbar-title">{{ items.filter(i => i.active).length }} 个场景运行中</text><text class="toolbar-sub">一键应用环境联动策略</text></view>
      <view class="toolbar-actions"><button class="btn btn-sm btn-primary" @tap="edit()">新建场景</button></view>
    </view>
    <view class="list-item link-row" @tap="automation"><text class="item-icon purple">自</text><view class="list-body"><text class="item-title">自动化规则</text><text class="item-meta">按传感器、定时或离线自动触发设备动作</text></view><text class="chev">›</text></view>
    <view class="list">
      <view v-for="item in items" :key="item.id" class="list-item column" :class="{ active: item.active }">
        <view class="item-head"><text class="scene-icon">{{ item.icon }}</text><text class="item-title">{{ item.sceneName }}</text><text class="tag" :class="item.active ? 'green' : 'gray'">{{ item.active ? '运行中' : '未启用' }}</text></view>
        <text class="item-meta">{{ item.category }} · {{ item.plotCount }} 个地块</text>
        <text v-if="item.description" class="item-text">{{ item.description }}</text>
        <view class="item-actions">
          <button class="btn btn-sm" @tap="edit(item)">编辑</button>
          <button class="btn btn-sm btn-danger" @tap="remove(item)">删除</button>
          <button class="btn btn-sm" :class="item.active ? 'btn-ghost' : 'btn-primary'" :loading="activating === item.id" @tap="activate(item)">{{ item.active ? '重新应用' : '启用场景' }}</button>
        </view>
      </view>
    </view>
    <view v-if="!items.length" class="empty">暂无场景，点右上角“新建场景”</view>
  </view>
</template>

<style lang="scss" scoped>
.list-item.active { border-color: #88c8a2; background: #f7fcf9; }
.scene-icon { flex-shrink: 0; font-size: 34rpx; }
.link-row { margin-bottom: 24rpx; }
</style>

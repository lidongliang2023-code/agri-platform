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
    <view class="between head">
      <view><text class="page-title">场景控制</text><text class="tiny">一键应用环境联动策略</text></view>
      <view class="head-actions">
        <button class="btn btn-sm btn-ghost" @tap="automation">自动化规则</button>
        <button class="btn btn-sm btn-primary" @tap="edit()">+ 新建场景</button>
      </view>
    </view>
    <view class="scene-list">
      <view class="scene" :class="{ active: item.active }" v-for="item in items" :key="item.id">
        <view class="between"><text class="scene-icon">{{ item.icon }}</text><text class="tag" :class="item.active ? 'green' : 'gray'">{{ item.active ? '运行中' : '未启用' }}</text></view>
        <text class="strong">{{ item.sceneName }}</text>
        <text class="tiny">{{ item.category }} · {{ item.plotCount }} 个地块</text>
        <text class="muted">{{ item.description }}</text>
        <view class="scene-actions">
          <button class="btn btn-sm btn-ghost" @tap="edit(item)">编辑</button>
          <button class="btn btn-sm btn-danger" @tap="remove(item)">删除</button>
          <button class="btn btn-sm" :class="item.active ? 'btn-ghost' : 'btn-primary'" :loading="activating === item.id" @tap="activate(item)">{{ item.active ? '重新应用' : '启用场景' }}</button>
        </view>
      </view>
    </view>
    <view v-if="!items.length" class="empty">暂无场景，请新建场景</view>
  </view>
</template>

<style lang="scss" scoped>
.page-title, .page .tiny { display: block; }
.page-title { font-size: 38rpx; font-weight: 750; }
.page .tiny { margin-top: 4rpx; }
.head-actions { display: flex; gap: 8rpx; }
.scene-list { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12rpx; margin-top: 20rpx; }
.scene { display: flex; flex-direction: column; gap: 6rpx; padding: 20rpx; border: 1rpx solid #e1e9e3; border-radius: 20rpx; background: #fff; }
.scene.active { border-color: #88c8a2; background: #f2fbf5; }
.scene-icon { font-size: 34rpx; }
.scene .muted { min-height: 64rpx; line-height: 1.55; }
.scene-actions { display: flex; gap: 6rpx; margin-top: 7rpx; }
.scene-actions .btn { flex: 1; padding: 0 8rpx; font-size: 24rpx; }
@media (max-width: 520px) { .scene-list { grid-template-columns: 1fr; } .head-actions .btn { font-size: 24rpx; } }
</style>

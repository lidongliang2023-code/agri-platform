<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api, type AutomationRule } from '../../api/iot'

const items = ref<AutomationRule[]>([])
const busy = ref(0)

onShow(load)

async function load() {
  try {
    items.value = await api.rules()
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '规则加载失败', icon: 'none' })
  }
}

function edit(item?: AutomationRule) {
  uni.navigateTo({ url: `/pages/automation/edit${item ? `?id=${item.id}` : ''}` })
}

async function toggle(item: AutomationRule) {
  if (busy.value) return
  busy.value = item.id
  try {
    await api.toggleRule(item.id)
    uni.showToast({ title: item.enabled ? '规则已停用' : '规则已启用', icon: 'success' })
    load()
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '状态更新失败', icon: 'none' })
  } finally {
    busy.value = 0
  }
}

async function execute(item: AutomationRule) {
  if (busy.value || !item.enabled) return
  busy.value = item.id
  try {
    await api.executeRule(item.id)
    uni.showToast({ title: '申请已登记，请核对设备回执', icon: 'none' })
    load()
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '执行失败', icon: 'none' })
  } finally {
    busy.value = 0
  }
}

function remove(item: AutomationRule) {
  uni.showModal({
    title: '删除自动化规则',
    content: `确定删除「${item.ruleName}」吗？`,
    confirmColor: '#b71c1c',
    success: async (result) => {
      if (!result.confirm) return
      try {
        await api.deleteRule(item.id)
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
      <view class="toolbar-main"><text class="toolbar-title">{{ items.filter(i => i.enabled).length }} / {{ items.length }} 条规则运行中</text><text class="toolbar-sub">触发条件、执行设备与动作</text></view>
      <view class="toolbar-actions"><button class="btn btn-sm btn-primary" @tap="edit()">新建规则</button></view>
    </view>
    <view class="list">
      <view class="list-item column" v-for="item in items" :key="item.id">
        <view class="item-head"><text class="item-title">{{ item.ruleName }}</text><text class="tag" :class="item.enabled ? 'green' : 'gray'">{{ item.enabled ? '运行中' : '已停用' }}</text></view>
        <text class="item-meta">{{ item.ruleCode }}</text>
        <view class="condition"><text>触发</text><b>{{ item.trigger }}</b></view>
        <view class="condition"><text>动作</text><b>{{ item.action }}</b></view>
        <view class="rule-meta"><text>触发 {{ item.triggerCount }} 次</text><text>冷却 {{ Math.round((item.cooldownSeconds || 0) / 60) }} 分钟</text><text>{{ item.lastTrigger }}</text></view>
        <view class="item-actions">
          <button class="btn btn-sm" @tap="edit(item)">编辑</button>
          <button class="btn btn-sm btn-danger" @tap="remove(item)">删除</button>
          <button class="btn btn-sm" :disabled="!!busy" :loading="busy === item.id" @tap="toggle(item)">{{ item.enabled ? '停用' : '启用' }}</button>
          <button class="btn btn-sm btn-primary" :disabled="!!busy || !item.enabled" :loading="busy === item.id" @tap="execute(item)">执行</button>
        </view>
      </view>
    </view>
    <view v-if="!items.length" class="empty">暂无自动化规则，点右上角“新建规则”</view>
  </view>
</template>

<style scoped lang="scss">
.condition{display:grid;grid-template-columns:64rpx 1fr;gap:8rpx;padding:14rpx 16rpx;border-radius:14rpx;background:#f5faf7;font-size:26rpx}.condition text{color:#666666}.condition b{font-weight:600}.rule-meta{display:flex;flex-wrap:wrap;gap:16rpx;color:#666666;font-size:24rpx}
</style>

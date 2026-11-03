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
function back() { uni.navigateBack() }

async function toggle(item: AutomationRule) {
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
  busy.value = item.id
  try {
    await api.executeRule(item.id)
    uni.showToast({ title: '规则已执行', icon: 'success' })
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
    confirmColor: '#c54b4b',
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
    <view class="between head">
      <view><text class="page-title">自动化规则</text><text class="tiny">触发条件、执行设备与动作</text></view>
      <view class="head-actions"><button class="btn btn-sm btn-ghost" @tap="back">返回</button><button class="btn btn-sm btn-primary" @tap="edit()">+ 新建规则</button></view>
    </view>
    <view class="rule-list">
      <view class="rule" v-for="item in items" :key="item.id">
        <view class="between"><view><text class="rule-name">{{ item.ruleName }}</text><text class="tiny">{{ item.ruleCode }}</text></view><text class="tag" :class="item.enabled ? 'green' : 'gray'">{{ item.enabled ? '运行中' : '已停用' }}</text></view>
        <view class="condition"><text>触发</text><b>{{ item.trigger }}</b></view>
        <view class="condition"><text>动作</text><b>{{ item.action }}</b></view>
        <view class="rule-meta"><text>触发 {{ item.triggerCount }} 次</text><text>冷却 {{ Math.round((item.cooldownSeconds || 0) / 60) }} 分钟</text><text>{{ item.lastTrigger }}</text></view>
        <view class="rule-actions">
          <button class="btn btn-sm btn-ghost" @tap="edit(item)">编辑</button>
          <button class="btn btn-sm btn-danger" @tap="remove(item)">删除</button>
          <button class="btn btn-sm" :loading="busy === item.id" @tap="toggle(item)">{{ item.enabled ? '停用' : '启用' }}</button>
          <button class="btn btn-sm btn-primary" :loading="busy === item.id" @tap="execute(item)">执行</button>
        </view>
      </view>
    </view>
    <view v-if="!items.length" class="empty">暂无自动化规则，请新建规则</view>
  </view>
</template>

<style scoped lang="scss">
.page-title,.page .tiny{display:block}.page-title{font-size:38rpx;font-weight:750}.page .tiny{margin-top:4rpx}.head-actions{display:flex;gap:8rpx}.rule-list{display:flex;flex-direction:column;gap:13rpx;margin-top:20rpx}.rule{padding:21rpx;border:1rpx solid #e1e9e3;border-radius:21rpx;background:#fff}.rule-name{display:block;font-size:26rpx;font-weight:700}.condition{display:grid;grid-template-columns:64rpx 1fr;gap:8rpx;margin-top:13rpx;padding:13rpx;border-radius:13rpx;background:#f5faf7;font-size:21rpx}.condition text{color:#718277}.condition b{font-weight:600}.rule-meta{display:flex;flex-wrap:wrap;gap:12rpx;margin-top:12rpx;color:#94a198;font-size:17rpx}.rule-actions{display:flex;gap:6rpx;margin-top:14rpx}.rule-actions .btn{flex:1;padding:0 6rpx;font-size:18rpx}@media(max-width:520px){.head-actions .btn{font-size:17rpx}}
</style>

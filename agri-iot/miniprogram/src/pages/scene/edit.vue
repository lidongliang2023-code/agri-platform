<script setup lang="ts">
import { reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api, type Scene } from '../../api/iot'

const configPlaceholder = JSON.stringify({ valve: 'on', durationMinutes: 15 })
const id = ref(0)
const saving = ref(false)
const loaded = ref(false), error = ref('')
const form = reactive({
  sceneName: '',
  icon: '⚙️',
  category: '自定义场景',
  description: '',
  config: '{}',
  plotCount: 0,
})

onLoad(async (options?: Record<string, string>) => {
  id.value = Number(options?.id || 0)
  uni.setNavigationBarTitle({ title: id.value ? '编辑场景' : '新建场景' })
  if (!Number.isSafeInteger(id.value) || id.value < 0) { error.value = '场景编号无效'; return }
  if (!id.value) { loaded.value = true; return }
  try {
    const scenes = await api.scenes()
    const scene = scenes.find((item: Scene) => item.id === id.value)
    if (!scene) throw new Error('场景不存在或已被删除')
    Object.assign(form, scene)
    loaded.value = true
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '场景加载失败'
  }
})

async function submit() {
  if (saving.value || !loaded.value) return
  if (!form.sceneName.trim()) {
    uni.showToast({ title: '请输入场景名称', icon: 'none' })
    return
  }
  try {
    const config = JSON.parse(form.config || '{}')
    if (!config || Array.isArray(config) || typeof config !== 'object') throw new Error()
  } catch {
    uni.showToast({ title: '执行配置必须是 JSON 对象', icon: 'none' })
    return
  }
  saving.value = true
  try {
    if (id.value) await api.updateScene(id.value, form)
    else await api.createScene(form)
    uni.showToast({ title: id.value ? '场景已更新' : '场景已创建', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 300)
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '保存失败', icon: 'none' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <view class="page pad has-footer">
    <view v-if="error" class="error">{{ error }}</view>
    <view v-else-if="!loaded" class="loading">正在加载场景…</view>
    <view v-if="loaded" class="card">
      <view class="card-head"><text class="card-title">场景信息</text><text class="tag blue">场景联动</text></view>
      <view class="form-item"><text class="form-label">场景名称</text><input v-model="form.sceneName" class="input" placeholder="例如：低温保温" /></view>
      <view class="grid-2">
        <view class="form-item"><text class="form-label">场景图标</text><input v-model="form.icon" class="input" maxlength="8" /></view>
        <view class="form-item"><text class="form-label">适用地块数量</text><input v-model.number="form.plotCount" class="input" type="number" /></view>
      </view>
      <view class="form-item"><text class="form-label">场景分类</text><input v-model="form.category" class="input" placeholder="环境控制、水肥管理等" /></view>
      <view class="form-item"><text class="form-label">场景说明</text><textarea v-model="form.description" class="textarea" placeholder="说明场景用途和执行目标" /></view>
      <view class="form-item"><text class="form-label">执行配置（JSON）</text><textarea v-model="form.config" class="textarea mono" :placeholder="configPlaceholder" /></view>
      <view class="footer-bar"><button class="btn btn-primary" :disabled="saving" :loading="saving" @tap="submit">保存场景</button></view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.mono { font-family: ui-monospace, monospace; font-size: 24rpx; }
</style>

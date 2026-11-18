<template>
  <view class="page shop-page">
    <view v-if="loading" class="empty"><text>正在加载店铺资料…</text></view>
    <template v-else>
      <view class="hero"><text class="hero-kicker">SHOP PROFILE</text><text class="hero-title">{{ form.shopName || '店铺资料' }}</text><text class="hero-desc">审核状态：{{ auditLabel }}</text></view>
      <view class="card form-card">
        <view class="form-item"><text class="form-label">店铺名称</text><input v-model="form.shopName" class="input" /></view>
        <view class="form-item"><text class="form-label">注册类型</text><picker :range="registerTypes" range-key="label" @change="selectRegisterType"><view class="input">{{ registerTypeLabel }}</view></picker></view>
        <view class="form-item"><text class="form-label">公司名称</text><input v-model="form.companyName" class="input" /></view>
        <view class="form-item"><text class="form-label">联系人</text><input v-model="form.contactName" class="input" /></view>
        <view class="form-item"><text class="form-label">联系电话</text><input v-model="form.contactPhone" class="input" type="number" maxlength="11" /></view>
        <view class="form-item"><text class="form-label">详细地址</text><textarea v-model="form.address" class="textarea" /></view>
        <view class="form-item"><text class="form-label">店铺简介</text><textarea v-model="form.shopDesc" class="textarea" maxlength="500" /></view>
        <view class="form-item"><text class="form-label">省份</text><input v-model="form.province" class="input" /></view>
        <view class="form-item"><text class="form-label">城市</text><input v-model="form.city" class="input" /></view>
        <view class="form-item"><text class="form-label">区县</text><input v-model="form.district" class="input" /></view>
        <view class="form-footer"><button class="btn btn-primary btn-block" :loading="saving" :disabled="saving || loading" @tap="save">保存店铺资料</button></view>
      </view>
      <view class="note">店铺名称和联系方式将用于客户识别店铺与订单服务，请填写真实、有效的信息。</view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { channelApi, type ChannelPartner } from '../../api'
import { channelSession, currentChannelId, saveChannelSession } from '../../session'
import { toast } from '../../utils'

const registerTypes = [{ label: '个人', value: 'PERSONAL' }, { label: '企业', value: 'COMPANY' }]
const loading = ref(true)
const saving = ref(false)
const form = reactive<ChannelPartner>({ id: 0, shopName: '', registerType: 'PERSONAL', companyName: '', contactName: '', contactPhone: '' })
const registerTypeLabel = computed(() => form.registerType === 'COMPANY' ? '企业' : '个人')
const auditLabel = computed(() => ({ APPROVED: '已通过', PENDING: '审核中', REJECTED: '已驳回' } as Record<string, string>)[String(form.auditStatus)] || '未知')

onShow(load)

async function load() {
  const id = currentChannelId()
  if (!id) return
  loading.value = true
  try {
    const profile = await channelApi.getProfile()
    if (!profile.applied || !profile.id) throw new Error('当前账号没有渠道档案')
    Object.assign(form, profile)
  } catch (error) {
    toast((error as Error).message)
  } finally {
    loading.value = false
  }
}

function selectRegisterType(event: { detail: { value: string } }) {
  form.registerType = registerTypes[Number(event.detail.value)]?.value || 'PERSONAL'
}

async function save() {
  if (saving.value || loading.value) return
  if (!form.shopName.trim()) return toast('请输入店铺名称')
  if (!form.contactName.trim()) return toast('请输入联系人')
  if (!/^1\d{10}$/.test(form.contactPhone)) return toast('请输入正确的联系电话')
  saving.value = true
  try {
    const result = await channelApi.updateChannel(form)
    if (!result.success) throw new Error(result.message || '保存失败')
    if (channelSession.account) saveChannelSession({ ...channelSession.account, shopName: form.shopName })
    toast('店铺资料已保存', 'success')
  } catch (error) {
    toast((error as Error).message)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.shop-page { padding-bottom: 30rpx; }
.form-card { margin-top: 18rpx; }
.note { margin: 0 28rpx; color: #84938a; font-size: 24rpx; line-height: 1.7; }
.shop-page { padding-bottom:calc(100px + env(safe-area-inset-bottom)); }
</style>

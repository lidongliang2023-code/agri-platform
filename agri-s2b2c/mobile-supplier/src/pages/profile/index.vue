<template>
  <view class="page profile-page">
    <view class="shop-hero">
      <view class="shop-mark">供</view>
      <view class="shop-copy">
        <text class="shop-name">{{ supplier?.shopName || '供应商店铺' }}</text>
        <text class="shop-company">{{ supplier?.companyName || '丰链云认证供应商' }}</text>
        <text class="shop-account">{{ maskedPhone }}</text>
      </view>
      <text class="tag" :class="supplier?.auditStatus === 'APPROVED' ? 'tag-green' : 'tag-orange'">
        {{ supplier?.auditStatus === 'APPROVED' ? '资质已通过' : '审核处理中' }}
      </text>
    </view>

    <view class="quick-menu card">
      <view class="compact-row" @tap="goOrders"><view class="compact-icon">单</view><view class="compact-copy"><text>订单履约</text><small class="small-copy">查看订单与物流状态</small></view><text class="arrow">›</text></view>
      <view class="compact-row" @tap="goProducts"><view class="compact-icon">品</view><view class="compact-copy"><text>商品管理</text><small class="small-copy">库存、价格与审核状态</small></view><text class="arrow">›</text></view>
      <view class="compact-row" @tap="goAudit"><view class="compact-icon">审</view><view class="compact-copy"><text>审核进度</text><small class="small-copy">查看平台审核意见</small></view><text class="arrow">›</text></view>
    </view>

    <view class="section-head"><view><text class="kicker">SHOP PROFILE</text><text class="title">店铺资料</text></view></view>
    <view class="card form-card">
      <view class="form-item"><text class="form-label">店铺名称</text><input v-model="form.shopName" class="input" /></view>
      <view class="form-item"><text class="form-label">公司名称</text><input v-model="form.companyName" class="input" /></view>
      <view class="form-item"><text class="form-label">所属行业</text><input v-model="form.industry" class="input" /></view>
      <view class="form-item"><text class="form-label">联系人</text><input v-model="form.legalName" class="input" /></view>
      <view class="form-item"><text class="form-label">联系电话</text><input v-model="form.contactPhone" class="input" type="number" maxlength="11" /></view>
      <view class="form-item"><text class="form-label">详细地址</text><textarea v-model="form.address" class="textarea" /></view>
      <button class="btn btn-primary btn-block" :loading="saving" @tap="save">保存店铺资料</button>
    </view>

    <view class="platform-card">
      <text>当前运行端</text><b>{{ platformLabel }}</b><small class="small-copy">同一套供应商业务支持小程序、Android / iOS App 和 H5。</small>
    </view>
    <button class="logout" @tap="logout">退出登录</button>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { supplierApi, type Supplier } from '../../api'
import { clearSupplierSession, requireSupplierLogin, supplierSession } from '../../session'
import { toast } from '../../utils'
import { logoutUnifiedAccount } from '../../../../frontend-shared/mobile-unified-auth'

const supplier = ref<Supplier | null>(null)
const saving = ref(false)
const form = reactive<Supplier>({
  id: supplierSession.account?.id || 1,
  shopName: '',
  shopDesc: '',
  companyName: '',
  creditCode: '',
  industry: '',
  legalName: '',
  contactPhone: '',
  province: '',
  city: '',
  district: '',
  address: '',
  bankName: '',
  bankAccount: '',
  bankBranch: '',
})
const maskedPhone = computed(
  () => supplierSession.account?.nickname || supplierSession.account?.username || supplierSession.account?.phone || '',
)
const platformLabel = computed(() => {
  const platform = uni.getSystemInfoSync().uniPlatform
  return platform === 'mp-weixin' ? '微信小程序' : platform === 'app' ? 'APP' : 'H5'
})

onShow(load)

async function load() {
  if (!requireSupplierLogin()) return
  try {
    supplier.value = await supplierApi.getSupplier(supplierSession.account?.id || 1)
    Object.assign(form, supplier.value)
  } catch (error) {
    toast((error as Error).message)
  }
}

async function save() {
  if (!form.shopName.trim()) return toast('请输入店铺名称')
  if (!form.companyName.trim()) return toast('请输入公司名称')
  if (!/^1\d{10}$/.test(form.contactPhone)) return toast('请输入正确的联系电话')
  saving.value = true
  try {
    const result = await supplierApi.updateSupplier(form)
    if (!result.success) throw new Error(result.message || '保存失败')
    toast('店铺资料已保存', 'success')
  } catch (error) {
    toast((error as Error).message)
  } finally {
    saving.value = false
  }
}

function goOrders() { uni.switchTab({ url: '/pages/orders/index' }) }
function goProducts() { uni.switchTab({ url: '/pages/products/index' }) }
function goAudit() { uni.navigateTo({ url: '/pages/audit/index' }) }

function logout() {
  uni.showModal({
    title: '退出登录',
    content: '确定退出供应商移动工作台吗？',
    async success(result) {
      if (!result.confirm) return
      await logoutUnifiedAccount()
      clearSupplierSession()
      uni.reLaunch({ url: '/pages/login/index' })
    },
  })
}
</script>

<style scoped lang="scss">
.profile-page {
  padding-bottom: 36rpx;
}

.shop-hero {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin: 18rpx 22rpx 0;
  padding: 26rpx;
  border-radius: 24rpx;
  background:
    radial-gradient(circle at 88% 0, rgba(110,231,162,.18), transparent 42%),
    linear-gradient(135deg, #073821, #12764a);
  color: #fff;
}

.shop-mark {
  display: grid;
  width: 74rpx;
  height: 74rpx;
  flex: 0 0 74rpx;
  place-items: center;
  border: 1rpx solid rgba(255,255,255,.24);
  border-radius: 20rpx;
  background: rgba(255,255,255,.1);
  color: #c9f2d7;
  font-size: 30rpx;
  font-weight: 800;
}

.shop-copy {
  min-width: 0;
  flex: 1;
}

.shop-name,
.shop-company,
.shop-account {
  display: block;
}

.shop-name {
  font-size: 27rpx;
  font-weight: 800;
}

.shop-company {
  margin-top: 5rpx;
  color: rgba(255,255,255,.64);
  font-size: 18rpx;
}

.shop-account {
  margin-top: 5rpx;
  color: rgba(255,255,255,.42);
  font-size: 16rpx;
}

.quick-menu {
  padding-top: 8rpx;
  padding-bottom: 8rpx;
}

.arrow {
  color: #a1ada6;
  font-size: 36rpx;
}

.form-card {
  margin-top: 0;
}

.platform-card {
  margin: 0 22rpx;
  padding: 22rpx;
  border: 1rpx solid #dcebe2;
  border-radius: 20rpx;
  background: #f5fbf7;
}

.platform-card text,
.platform-card b,
.platform-card .small-copy {
  display: block;
}

.platform-card text {
  color: #718277;
  font-size: 17rpx;
}

.platform-card b {
  margin-top: 4rpx;
  color: #0e5233;
  font-size: 24rpx;
}

.platform-card .small-copy {
  margin-top: 7rpx;
  color: #718277;
  font-size: 17rpx;
  line-height: 1.55;
}

.logout {
  height: 74rpx;
  margin: 20rpx 22rpx 0;
  border: 1rpx solid #efcccc;
  border-radius: 16rpx;
  background: #fff;
  color: #c54b4b;
  font-size: 22rpx;
  line-height: 72rpx;
}
</style>

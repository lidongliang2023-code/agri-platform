<template>
  <div class="my-page">
    <div class="user-card" v-if="user">
      <img :src="user.avatar || defaultAvatar" class="user-avatar" />
      <div class="user-info">
        <h2 class="user-name">{{ user.nickname || '用户' }}</h2>
        <p class="user-phone">{{ user.phone }}</p>
        <van-tag type="primary" size="small">{{ memberLevel }}</van-tag>
      </div>
      <van-button type="primary" plain @click="editProfile">编辑资料</van-button>
    </div>
    <div class="user-card" v-else>
      <van-button type="primary" block @click="goLogin">登录/注册</van-button>
    </div>
    <div class="stats-card">
      <div class="stat-item">
        <span class="stat-value">{{ user?.points || 0 }}</span>
        <span class="stat-label">积分</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{{ user?.totalConsume || 0 }}</span>
        <span class="stat-label">累计消费</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">0</span>
        <span class="stat-label">优惠券</span>
      </div>
    </div>
    <van-cell-group inset>
      <van-cell icon="orders-o" title="我的订单" is-link @click="goOrders">
        <template #extra>
          <van-badge content="2" class="badge" />
        </template>
      </van-cell>
      <van-cell icon="map-o" title="收货地址" is-link @click="goAddresses" />
      <van-cell icon="ticket-o" title="优惠券" is-link />
      <van-cell icon="service-o" title="客服中心" is-link />
      <van-cell icon="settings-o" title="设置" is-link />
    </van-cell-group>
    <van-cell-group inset>
      <van-cell icon="scan-o" title="扫码溯源" is-link />
      <van-cell icon="star-o" title="我的收藏" is-link />
      <van-cell icon="share-o" title="邀请好友" is-link />
    </van-cell-group>
    <div class="logout-btn" v-if="user">
      <van-button type="default" block @click="logout">退出登录</van-button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'

const router = useRouter()
const userStore = useUserStore()

const user = computed(() => userStore.user)
const defaultAvatar = 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=user%20avatar%20icon%20simple&image_size=square'

const memberLevel = computed(() => {
  const level = user.value?.memberLevel
  const levelMap = { 'NORMAL': '普通会员', 'VIP': 'VIP会员', 'SVIP': '超级会员' }
  return levelMap[level] || '普通会员'
})

const goLogin = () => {
  router.push('/login')
}

const goOrders = () => {
  if (!user.value) {
    router.push('/login')
    return
  }
  router.push('/orders')
}

const goAddresses = () => {
  if (!user.value) {
    router.push('/login')
    return
  }
  router.push('/addresses')
}

const editProfile = () => {
  alert('编辑资料功能开发中')
}

const logout = () => {
  userStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.my-page {
  min-height: 100vh;
  padding: 10px;
}

.user-card {
  display: flex;
  align-items: center;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  margin-bottom: 15px;
}

.user-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid rgba(255,255,255,0.5);
}

.user-info {
  flex: 1;
  margin-left: 15px;
}

.user-name {
  font-size: 20px;
  font-weight: bold;
  color: #fff;
  margin-bottom: 5px;
}

.user-phone {
  font-size: 14px;
  color: rgba(255,255,255,0.8);
  margin-bottom: 8px;
}

.stats-card {
  display: flex;
  justify-content: space-around;
  padding: 20px;
  background: #fff;
  border-radius: 16px;
  margin-bottom: 15px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #333;
}

.stat-label {
  font-size: 12px;
  color: #999;
  margin-top: 5px;
}

.badge {
  margin-left: 10px;
}

.logout-btn {
  margin-top: 30px;
}
</style>
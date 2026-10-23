<template>
  <div class="addresses-page">
    <van-nav-bar title="收货地址" left-arrow @click-left="$router.back()" />
    <div class="address-list">
      <div class="address-card" v-for="address in addresses" :key="address.id" @click="selectAddress(address)">
        <van-radio v-model="selectedId" :value="address.id" />
        <div class="address-info">
          <div class="address-top">
            <span class="address-name">{{ address.name }}</span>
            <span class="address-phone">{{ address.phone }}</span>
            <van-tag v-if="address.isDefault" type="primary" size="small">默认</van-tag>
          </div>
          <p class="address-detail">{{ address.province }}{{ address.city }}{{ address.district }}{{ address.address }}</p>
        </div>
        <div class="address-actions">
          <van-icon name="edit" @click.stop="editAddress(address.id)" />
          <van-icon name="delete" @click.stop="deleteAddress(address.id)" />
        </div>
      </div>
    </div>
    <van-empty v-if="addresses.length === 0" description="暂无收货地址" />
    <div class="bottom-bar">
      <van-button type="primary" block @click="addAddress">添加收货地址</van-button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { consumerApi } from '../api'

const router = useRouter()
const userStore = useUserStore()
const addresses = ref([])
const selectedId = ref(null)

onMounted(() => {
  if (!userStore.user) {
    router.push('/login')
    return
  }
  loadAddresses()
})

const loadAddresses = async () => {
  const res = await consumerApi.getAddresses(userStore.user.id)
  addresses.value = res
}

const selectAddress = (address) => {
  selectedId.value = address.id
  router.push('/order-confirm')
}

const addAddress = () => {
  router.push('/address-add')
}

const editAddress = (id) => {
  router.push(`/address-edit/${id}`)
}

const deleteAddress = async (id) => {
  if (!confirm('确定删除这个地址吗？')) return
  const res = await consumerApi.deleteAddress(id)
  if (res.success) {
    loadAddresses()
  }
}
</script>

<style scoped>
.addresses-page {
  min-height: 100vh;
  padding-bottom: 80px;
}

.address-list {
  padding: 10px;
}

.address-card {
  display: flex;
  align-items: flex-start;
  padding: 15px;
  background: #fff;
  border-radius: 12px;
  margin-bottom: 10px;
}

.address-info {
  flex: 1;
  margin-left: 12px;
}

.address-top {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 5px;
}

.address-name {
  font-size: 16px;
  font-weight: bold;
}

.address-phone {
  font-size: 14px;
  color: #666;
}

.address-detail {
  font-size: 14px;
  color: #666;
}

.address-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: #999;
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 10px 15px;
  background: #fff;
  box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
}
</style>
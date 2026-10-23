<template>
  <div class="address-edit-page">
    <van-nav-bar title="编辑收货地址" left-arrow @click-left="$router.back()" />
    <van-cell-group inset>
      <van-field v-model="form.name" placeholder="收货人姓名" />
      <van-field v-model="form.phone" placeholder="手机号码" type="tel" />
      <van-field v-model="form.province" placeholder="省份" />
      <van-field v-model="form.city" placeholder="城市" />
      <van-field v-model="form.district" placeholder="区县" />
      <van-field v-model="form.address" placeholder="详细地址" />
      <van-cell title="设为默认地址">
        <template #right-icon>
          <van-switch v-model="form.isDefault" />
        </template>
      </van-cell>
    </van-cell-group>
    <div class="bottom-bar">
      <van-button type="primary" block @click="saveAddress">保存地址</van-button>
    </div>
  </div>
</template>

<script setup>
import { reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '../stores/user'
import { consumerApi } from '../api'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const form = reactive({
  id: null,
  name: '',
  phone: '',
  province: '',
  city: '',
  district: '',
  address: '',
  isDefault: false,
  consumerId: null
})

onMounted(() => {
  loadAddress()
})

const loadAddress = async () => {
  const res = await consumerApi.getAddresses(userStore.user.id)
  const address = res.find(a => a.id === parseInt(route.params.id))
  if (address) {
    Object.assign(form, address)
  }
}

const saveAddress = async () => {
  if (!form.name || !form.phone || !form.province || !form.city || !form.district || !form.address) {
    alert('请填写完整信息')
    return
  }
  const res = await consumerApi.updateAddress(form)
  if (res.success) {
    alert('保存成功')
    router.push('/addresses')
  }
}
</script>

<style scoped>
.address-edit-page {
  min-height: 100vh;
  padding-bottom: 80px;
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
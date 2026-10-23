<template>
  <div class="app">
    <router-view v-if="!isLoginPage" />
    <router-view v-else />
    <van-tabbar v-if="showTabBar" route>
      <van-tabbar-item icon="home-o" to="/">首页</van-tabbar-item>
      <van-tabbar-item icon="apps-o" to="/category">分类</van-tabbar-item>
      <van-tabbar-item icon="cart-o" to="/cart">购物车</van-tabbar-item>
      <van-tabbar-item icon="user-o" to="/my">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from './stores/user'

const route = useRoute()
const userStore = useUserStore()

onMounted(() => {
  userStore.init()
})

const isLoginPage = computed(() => route.name === 'Login')
const showTabBar = computed(() => {
  const hideTabs = ['Login', 'ProductDetail', 'Search', 'OrderDetail', 'Addresses', 'AddressAdd', 'AddressEdit', 'OrderConfirm']
  return !hideTabs.includes(route.name) && !isLoginPage.value
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background-color: #f5f5f5;
}

.app {
  min-height: 100vh;
  padding-bottom: 50px;
}
</style>
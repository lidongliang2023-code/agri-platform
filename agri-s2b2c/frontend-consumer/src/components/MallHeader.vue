<template>
  <header class="m-topbar">
    <div class="m-container m-top-inner">
      <button type="button" class="m-logo" @click="go('/')">
        <span class="lg">🌾</span>
        <span class="txt">
          农联优选
          <small>产地直供 · 全程溯源</small>
        </span>
      </button>

      <el-dropdown trigger="hover" @command="onCategory" popper-class="m-cat-drop">
        <button type="button" class="m-allcat">☰ 全部分类 <span class="ar">▾</span></button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-for="cat in topCategories" :key="cat.id" :command="cat.id">
              <span class="cat-ico">{{ cat.icon || '🌿' }}</span>{{ cat.name }}
            </el-dropdown-item>
            <el-dropdown-item v-if="!topCategories.length" disabled>分类暂无数据</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <div class="m-search">
        <span class="ic">🔍</span>
        <input
          v-model="keyword"
          type="text"
          placeholder="搜索商品 / 品牌 / 产地，如「有机大米」「赣南脐橙」"
          aria-label="搜索商品"
          @keyup.enter="submitSearch"
        />
        <button type="button" class="m-btn primary sm" @click="submitSearch">搜索</button>
      </div>

      <div class="m-links">
        <button type="button" class="cl" @click="go('/trace')">
          <span class="ic">🔍</span><b>溯源查询</b>
        </button>
        <button type="button" class="cl" @click="go('/cart')">
          <span class="ic">🛒</span><b>购物车</b>
          <i v-if="userStore.cartCount" class="m-badge">{{ userStore.cartCount > 99 ? '99+' : userStore.cartCount }}</i>
        </button>
        <button type="button" class="cl" @click="go('/messages')">
          <span class="ic">🔔</span><b>消息</b>
          <i v-if="userStore.unreadCount" class="m-badge">{{ userStore.unreadCount }}</i>
        </button>
        <button type="button" class="cl" @click="go('/mine')">
          <span class="ic">👤</span><b>{{ userStore.displayName }}</b>
        </button>
      </div>
    </div>
  </header>

  <nav class="m-mainnav" aria-label="商城主导航">
    <div class="m-container m-mainnav-inner">
      <button
        v-for="item in navs"
        :key="item.path"
        type="button"
        class="m-nav-item"
        :class="{ active: isActive(item) }"
        @click="go(item.path)"
      >
        {{ item.label }}
      </button>
      <span class="nav-gap" />
      <a class="m-nav-item ext" :href="crossModule.trade" target="_blank" rel="noopener">交易撮合 ›</a>
      <a class="m-nav-item ext" :href="crossModule.production" target="_blank" rel="noopener">生产溯源 ›</a>
    </div>
  </nav>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { crossModule } from '../config/cross-module'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const keyword = ref('')

const navs = [
  { label: '首页', path: '/', match: ['Home'] },
  { label: '全部分类', path: '/category', match: ['Category', 'ProductList'] },
  { label: '限时秒杀', path: '/flash', match: ['FlashList'] },
  { label: '拼团专区', path: '/groups', match: ['GroupList', 'GroupDetail'] },
  { label: '领券中心', path: '/coupons', match: ['CouponCenter', 'MyCoupon'] },
  { label: '会员中心', path: '/member', match: ['Member', 'Growth', 'Points', 'PointsMall', 'SignIn'] },
  { label: '我的订单', path: '/orders', match: ['Orders', 'OrderDetail', 'Logistics'] },
  { label: '模块边界', path: '/boundary', match: ['Boundary'] },
]

const topCategories = computed(() => userStore.categories.slice(0, 10))

onMounted(() => {
  userStore.loadCategories()
})

function isActive(item) {
  return item.match.includes(route.name)
}

function go(path) {
  router.push(path)
}

function submitSearch() {
  const q = keyword.value.trim()
  router.push({ path: '/search', query: q ? { q } : {} })
}

function onCategory(categoryId) {
  router.push({ path: '/products', query: { categoryId } })
}
</script>

<style scoped>
.m-topbar {
  position: sticky;
  top: 0;
  z-index: 120;
  background: #fff;
  box-shadow: 0 1px 4px rgba(4, 31, 20, .05);
}

.m-top-inner {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 74px;
}

.m-logo {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 9px;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
}

.m-logo .lg {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 11px;
  background: linear-gradient(135deg, #12764a, #4fb07f);
  font-size: 21px;
  box-shadow: 0 6px 14px rgba(18, 118, 74, .22);
}

.m-logo .txt {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  color: #12764a;
  font-size: 19px;
  font-weight: 800;
  letter-spacing: .5px;
  line-height: 1.15;
}

.m-logo .txt small {
  color: #6b7c72;
  font-size: var(--agri-font-size-micro);
  font-weight: 500;
  letter-spacing: 1.4px;
}

.m-allcat {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 14px;
  border: 1px solid #e3eae5;
  border-radius: 9px;
  background: #f8fbf9;
  color: #33453b;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
}

.m-allcat:hover {
  border-color: #9fd0b6;
  color: #12764a;
}

.m-allcat .ar {
  color: #93a29a;
  font-size: var(--agri-font-size-micro);
}

.m-search {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  height: 44px;
  min-width: 240px;
  padding: 0 6px 0 14px;
  border: 1.5px solid #12764a;
  border-radius: 22px;
  background: #fff;
}

.m-search .ic {
  color: #6b7c72;
  font-size: 14px;
}

.m-search input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: none;
  color: #0b1a12;
  font-size: 13.5px;
}

.m-search input::placeholder {
  color: #9aa8a0;
}

.m-links {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
}

.cl {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 10px;
  border: 0;
  border-radius: 9px;
  background: none;
  color: #33453b;
  font-size: 13px;
  cursor: pointer;
}

.cl:hover {
  background: #f1fbf5;
  color: #12764a;
}

.cl .ic {
  font-size: 15px;
}

.cl b {
  font-weight: 600;
  white-space: nowrap;
}

.cl .m-badge {
  position: absolute;
  top: 2px;
  right: 2px;
}

.m-mainnav {
  position: sticky;
  top: 74px;
  z-index: 110;
  border-bottom: 1px solid #e3eae5;
  background: #fff;
}

.m-mainnav-inner {
  display: flex;
  align-items: stretch;
  gap: 2px;
  overflow-x: auto;
}

.m-nav-item {
  position: relative;
  height: 45px;
  padding: 0 18px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: none;
  color: #33453b;
  font-size: 14.5px;
  white-space: nowrap;
  cursor: pointer;
}

.m-nav-item:hover {
  color: #12764a;
}

.m-nav-item.active {
  border-bottom-color: #12764a;
  color: #12764a;
  font-weight: 700;
}

.m-nav-item.ext {
  color: #8b9a91;
  font-size: 13.5px;
}

.nav-gap {
  margin-left: auto;
}

.cat-ico {
  margin-right: 8px;
}
</style>

<template>
  <div class="m-container shop" v-loading="loading">
    <template v-if="channel">
      <section class="shop-hd m-card">
        <div class="logo">
          <img v-if="channel.shopLogo && !logoBroken" :src="channel.shopLogo" :alt="channel.shopName" @error="logoBroken = true" />
          <span v-else>{{ (channel.shopName || '渠').slice(0, 1) }}</span>
        </div>
        <div class="meta">
          <h1>{{ channel.shopName }}</h1>
          <p>{{ channel.shopDesc || '该渠道暂无店铺简介' }}</p>
          <div class="m-row-wrap">
            <span class="m-tag">{{ gradeText }}</span>
            <span class="m-tag plain">在售 {{ products.length }} 款</span>
            <span class="m-tag plain">平台供应商发货</span>
          </div>
        </div>
        <div class="tip">
          <b>渠道专柜</b>
          <span>
            这里展示的是渠道商从平台选品清单中选中的商品，价格与库存由平台统一管控；
            渠道商不持有库存，下单后仍由产地供应商直发。
          </span>
        </div>
      </section>

      <div class="sec-hd">
        <h2>本店在售</h2>
        <span class="sec-desc">来自渠道选品清单（ACTIVE 状态）</span>
      </div>

      <div v-if="products.length" class="m-grid m-grid-4">
        <ProductCard
          v-for="item in products"
          :key="item.id"
          :product="toProduct(item)"
          :show-fav="false"
          @add="addToCart(item)"
        />
      </div>
      <EmptyBlock
        v-else
        icon="🏪"
        title="该渠道还没有在售商品"
        desc="渠道商从平台选品清单中选中并处于生效状态后，商品才会出现在这里。"
      >
        <template #actions>
          <button type="button" class="m-btn primary" @click="$router.push('/products')">去平台商城逛逛</button>
        </template>
      </EmptyBlock>
    </template>

    <EmptyBlock
      v-else-if="!loading"
      icon="🚫"
      title="渠道店铺不存在或未开通"
      desc="该渠道可能尚未通过平台审核，或分享链接已失效。"
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="$router.push('/')">返回商城首页</button>
      </template>
    </EmptyBlock>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { consumerApi } from '../api'
import { useUserStore } from '../stores/user'
import { money } from '../utils/format'
import ProductCard from '../components/ProductCard.vue'
import EmptyBlock from '../components/EmptyBlock.vue'

const route = useRoute()
const userStore = useUserStore()

const loading = ref(false)
const channel = ref(null)
const products = ref([])
const logoBroken = ref(false)

const gradeText = computed(() => {
  const grade = channel.value?.grade
  return grade ? `渠道等级 ${grade}` : '平台认证渠道'
})

/** 渠道接口只返回必要字段，补成 ProductCard 需要的形状（不补佣金率——那是渠道商自己的数据，不该给消费者看）。 */
function toProduct(item) {
  return {
    id: item.id,
    name: item.name,
    price: item.price,
    stock: item.stock,
    unit: item.unit,
    images: item.image ? [item.image] : [],
  }
}

async function load() {
  loading.value = true
  try {
    const data = await consumerApi.getChannelShop(route.params.channelId)
    channel.value = data?.channel || null
    products.value = data?.products || []
  } catch (err) {
    channel.value = null
    if (err.response?.status !== 404) {
      ElMessage.error(err.friendlyMessage || '渠道店铺加载失败')
    }
  } finally {
    loading.value = false
  }
}

async function addToCart(item) {
  if (!userStore.consumerId) {
    ElMessage.warning('请先完成登录')
    return
  }
  try {
    const res = await consumerApi.addCart({
      consumerId: userStore.consumerId,
      productId: item.id,
      quantity: 1,
      channelId: route.params.channelId,
    })
    if (res?.success === false) {
      ElMessage.warning(res.message || '加入购物车失败')
      return
    }
    await userStore.refreshCart()
    ElMessage.success(`已加入购物车（¥${money(item.price)}）`)
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '加入购物车失败')
  }
}

onMounted(load)
</script>

<style scoped>
.shop {
  margin-top: 18px;
}

.shop-hd {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 20px 22px;
}

.logo {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  overflow: hidden;
  width: 72px;
  height: 72px;
  border-radius: 16px;
  background: linear-gradient(135deg, #12764a, #4fb07f);
  color: #fff;
  font-size: 26px;
  font-weight: 800;
}

.logo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.meta h1 {
  margin: 0;
  font-size: 19px;
  font-weight: 800;
}

.meta p {
  margin: 4px 0 8px;
  color: #6b7c72;
  font-size: 13px;
}

.tip {
  margin-left: auto;
  max-width: 330px;
  padding: 12px 14px;
  border: 1px solid #d9ece2;
  border-radius: 10px;
  background: #f6fcf9;
}

.tip b {
  display: block;
  margin-bottom: 4px;
  color: #12764a;
  font-size: 12.5px;
}

.tip span {
  color: #6b7c72;
  font-size: 12px;
  line-height: 1.7;
}

@media (max-width: 1080px) {
  .shop-hd { flex-wrap: wrap; }
  .tip { margin-left: 0; max-width: none; }
}
</style>

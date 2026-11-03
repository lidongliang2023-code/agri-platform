<template>
  <div class="m-container" v-loading="loading">
    <!-- 页头 -->
    <div class="m-page-hd">
      <h1>我的收藏</h1>
      <span class="sub">收藏按「消费者 + 商品」唯一存储，取消后再收藏会重新出现在列表最前面</span>
      <div class="hd-actions">
        <button
          type="button"
          class="m-btn sm"
          :disabled="!invalidRows.length || cleaning"
          @click="clearInvalid"
        >
          清理失效商品{{ invalidRows.length ? `（${invalidRows.length}）` : '' }}
        </button>
        <button type="button" class="m-btn sm" @click="router.push('/products')">去逛逛</button>
      </div>
    </div>

    <!-- 未登录 -->
    <EmptyBlock
      v-if="userStore.booted && !consumerId"
      icon="🔐"
      title="登录后查看收藏"
      desc="收藏记录挂在商城消费者账号下。当前浏览器没有检测到已登录的统一身份，请从统一门户登录后再进入商城。"
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="router.push('/')">返回首页</button>
      </template>
    </EmptyBlock>

    <template v-else>
      <!-- 统计条 -->
      <div class="m-card sum-bar">
        <span>共收藏 <b class="num">{{ rows.length }}</b> 件商品</span>
        <span class="m-tag plain" v-if="invalidRows.length">其中 {{ invalidRows.length }} 件已下架或售罄</span>
        <span class="m-spacer" />
        <span class="muted small">失效商品指：商品状态不是 APPROVED，或可售库存 ≤ 0</span>
      </div>

      <!-- 收藏列表 -->
      <div v-if="cards.length" class="m-grid m-grid-4 fav-grid">
        <ProductCard
          v-for="item in cards"
          :key="item.card.id"
          :product="item.card"
          :favorited="true"
          @favorite="remove(item.row)"
          @add="addToCart(item.row)"
        />
      </div>

      <EmptyBlock
        v-else-if="!loading"
        icon="⭐"
        title="收藏夹还是空的"
        desc="收藏是你在商城里主动点「♡」留下的商品，不对任何账号自动生成。去商品列表挑几件产地直供好货，点右上角爱心即可收藏。"
      >
        <template #actions>
          <button type="button" class="m-btn primary" @click="router.push('/products')">去逛逛好货</button>
        </template>
      </EmptyBlock>

      <p v-if="cards.length" class="note muted small">
        商品价格、库存与上下架状态以商品接口实时返回为准；失效商品不会被自动删除，需要你手动清理。
      </p>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { consumerApi } from '../api'
import { useUserStore } from '../stores/user'
import ProductCard from '../components/ProductCard.vue'
import EmptyBlock from '../components/EmptyBlock.vue'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const cleaning = ref(false)
const removingId = ref(null)
const rows = ref([])

const consumerId = computed(() => userStore.consumerId)

/** 失效判定：商品下架/未审核，或库存为 0（后端 LEFT JOIN 时商品可能已删除，字段为 null）。 */
function isInvalid(row) {
  return row.status !== 'APPROVED' || Number(row.stock ?? 0) <= 0
}

const invalidRows = computed(() => rows.value.filter(isInvalid))

/**
 * 收藏接口返回的是 productId + 单张 image，商品卡（ProductCard）读的是 id + images，
 * 这里做一层纯字段映射，不补造任何商品信息。
 */
const cards = computed(() =>
  rows.value.map((row) => ({
    row,
    card: {
      id: row.productId,
      name: row.name,
      price: row.price,
      origin: row.origin,
      stock: row.stock,
      images: row.image ? [row.image] : [],
    },
  })),
)

async function load() {
  if (!consumerId.value) {
    rows.value = []
    return
  }
  loading.value = true
  try {
    rows.value = (await consumerApi.getFavorites(consumerId.value)) || []
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '收藏加载失败')
  } finally {
    loading.value = false
  }
}

/** 取消收藏：写完后回读列表确认该商品已消失，再提示成功。 */
async function remove(row) {
  if (removingId.value) return
  removingId.value = row.productId
  try {
    const res = await consumerApi.removeFavorite(consumerId.value, row.productId)
    if (res?.success === false) {
      ElMessage.error(res.message || '取消收藏失败')
      await load()
      return
    }
    await load()
    if (rows.value.some((item) => String(item.productId) === String(row.productId))) {
      ElMessage.error('取消失败，收藏仍在列表中，请稍后重试')
      return
    }
    ElMessage.success('已取消收藏')
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '取消收藏失败')
    await load()
  } finally {
    removingId.value = null
  }
}

/** 清理失效商品：逐个取消收藏后回读，失败的商品如实统计，不谎报"全部清理成功"。 */
async function clearInvalid() {
  const targets = invalidRows.value.slice()
  if (!targets.length) {
    ElMessage.warning('当前没有失效商品需要清理')
    return
  }
  try {
    await ElMessageBox.confirm(
      `将取消收藏 ${targets.length} 件已下架或已售罄的商品，取消后需要重新收藏。确认清理？`,
      '清理失效商品',
      { confirmButtonText: '确认清理', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }

  cleaning.value = true
  try {
    const failed = []
    for (const row of targets) {
      const res = await consumerApi.removeFavorite(consumerId.value, row.productId).catch(() => null)
      if (!res || res.success === false) failed.push(row.name || row.productId)
    }
    await load()
    const left = invalidRows.value.length
    if (!left && !failed.length) {
      ElMessage.success(`已清理 ${targets.length} 件失效商品`)
    } else if (left < targets.length) {
      ElMessage.warning(`已清理 ${targets.length - left} 件，还有 ${left} 件未能取消（可能已被其它操作修改），请重试`)
    } else {
      ElMessage.error('清理未生效，请刷新后重试')
    }
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '清理失败')
    await load()
  } finally {
    cleaning.value = false
  }
}

/** 加入购物车：只做加购，不直接下单；加完回读购物车数量。 */
async function addToCart(row) {
  try {
    const res = await consumerApi.addCart({
      consumerId: consumerId.value,
      productId: row.productId,
      quantity: 1,
    })
    if (res?.success === false) {
      ElMessage.warning(res.message || '加入购物车失败（商品可能已下架或无库存）')
      return
    }
    await userStore.refreshCart()
    ElMessage.success('已加入购物车')
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '加入购物车失败')
  }
}

onMounted(load)

// 统一身份异步换回消费者 ID：拿到后再查收藏
watch(
  () => consumerId.value,
  (id) => {
    if (id) load()
  },
)
</script>

<style scoped>
.m-container {
  width: min(1280px, calc(100% - 48px));
  margin: 18px auto 0;
}

.sum-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px 18px;
}

.sum-bar b {
  color: #0b1a12;
  font-size: 15px;
  font-weight: 800;
}

.fav-grid {
  align-items: stretch;
}

.note {
  margin: 16px 0 0;
  line-height: 1.8;
}
</style>

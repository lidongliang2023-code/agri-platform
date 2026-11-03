<template>
  <div class="m-container" v-loading="loading">
    <!-- 顶部 -->
    <div class="m-page-hd lead">
      <h1>我的购物车</h1>
      <span class="sub">共 {{ rows.length }} 种商品 · 已选 {{ selectedCount }} 件</span>
      <div class="hd-actions">
        <button type="button" class="m-btn sm" @click="router.push('/products')">继续逛逛 ›</button>
      </div>
    </div>

    <!-- 未登录 -->
    <EmptyBlock
      v-if="userStore.booted && !userStore.consumerId"
      icon="🔐"
      title="登录后查看购物车"
      desc="购物车按消费者账号存储。当前浏览器没有检测到已登录的统一身份，请从统一门户登录后再进入商城。"
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="router.push('/')">返回首页</button>
      </template>
    </EmptyBlock>

    <template v-else>
      <div v-if="rows.length" class="m-card cart-card">
        <!-- 表头 -->
        <div class="cart-row cart-head">
          <el-checkbox
            :model-value="allSelected"
            :indeterminate="someSelected && !allSelected"
            :disabled="busy"
            @change="selectAll"
          >
            全选
          </el-checkbox>
          <span />
          <span class="muted small">商品信息</span>
          <span class="muted small">单价</span>
          <span class="muted small">数量</span>
          <span class="muted small">小计</span>
          <span class="muted small">操作</span>
        </div>

        <!-- 商品行 -->
        <div v-for="row in rows" :key="row.id" class="cart-row item" :class="{ out: isSoldOut(row) }">
          <el-checkbox
            :model-value="Boolean(row.selected) && !isSoldOut(row)"
            :disabled="isSoldOut(row) || busy"
            @change="(value) => selectOne(row, value)"
          />

          <div class="thumb" @click="router.push(`/product/${row.productId}`)">
            <img
              v-if="row.image && !brokenImages.has(String(row.id))"
              :src="row.image"
              :alt="row.name"
              @error="markBroken(row)"
            />
            <span v-else class="ph">🌿</span>
          </div>

          <div class="info">
            <div class="name" @click="router.push(`/product/${row.productId}`)">{{ row.name }}</div>
            <div class="m-row-wrap meta">
              <span class="muted small">{{ row.spec || '规格以商品详情为准' }}</span>
              <span v-if="row.shopName" class="m-tag plain">{{ row.shopName }}</span>
              <span v-if="row.activityType === 'FLASH'" class="m-tag red">秒杀价</span>
              <span v-if="isSoldOut(row)" class="m-tag red">已售罄</span>
              <span v-else-if="Number(row.stock || 0) <= 5" class="m-tag amber">仅剩 {{ row.stock }} 件</span>
            </div>
          </div>

          <div class="price sm">
            <span class="cur">¥</span>{{ money(linePrice(row)) }}
            <span v-if="row.activityPrice" class="cost">¥{{ money(row.price) }}</span>
          </div>

          <div class="qty">
            <el-input-number
              :model-value="row.quantity"
              :min="1"
              :max="Math.max(1, Number(row.stock || 1))"
              :disabled="isSoldOut(row) || busy"
              size="small"
              @change="(value) => saveQty(row, value)"
            />
            <span class="muted small stock-line">库存 {{ row.stock ?? 0 }}</span>
          </div>

          <div class="subtotal">
            <span class="price sm"><span class="cur">¥</span>{{ money(lineTotal(row)) }}</span>
          </div>

          <div class="ops">
            <button type="button" class="m-btn text" :disabled="busy" @click="remove(row)">删除</button>
          </div>
        </div>
      </div>

      <EmptyBlock
        v-else-if="!loading && userStore.booted"
        icon="🛒"
        title="购物车是空的"
        desc="你还没有把商品加入购物车。购物车按当前登录的消费者账号存储，加入后会在这里按供应商/渠道展示，方便一次结算。"
      >
        <template #actions>
          <button type="button" class="m-btn primary" @click="router.push('/products')">去逛逛</button>
        </template>
      </EmptyBlock>

      <!-- 结算栏 -->
      <div v-if="rows.length" class="m-card checkout">
        <el-checkbox
          :model-value="allSelected"
          :indeterminate="someSelected && !allSelected"
          :disabled="busy"
          @change="selectAll"
        >
          全选
        </el-checkbox>
        <span class="muted small">已选 <b class="num">{{ selectedCount }}</b> 件</span>
        <span v-if="hasSoldOut" class="m-tag red">有已售罄商品，需先移除</span>
        <span class="m-spacer" />
        <span class="muted small">合计（不含运费）</span>
        <span class="price lg"><span class="cur">¥</span>{{ money(selectedAmount) }}</span>
        <button type="button" class="m-btn primary" :disabled="!selectedCount || busy" @click="checkout">
          去结算
        </button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { consumerApi } from '../api'
import { useUserStore } from '../stores/user'
import { money } from '../utils/format'
import EmptyBlock from '../components/EmptyBlock.vue'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const busy = ref(false)
const rows = ref([])
const brokenImages = ref(new Set())

function markBroken(row) {
  brokenImages.value = new Set([...brokenImages.value, String(row.id)])
}

const availableRows = computed(() => rows.value.filter((row) => !isSoldOut(row)))
const selectedRows = computed(() =>
  availableRows.value.filter((row) => Boolean(row.selected)),
)
const selectedCount = computed(() =>
  selectedRows.value.reduce((sum, row) => sum + Number(row.quantity || 0), 0),
)
const selectedAmount = computed(() =>
  round2(selectedRows.value.reduce((sum, row) => sum + Number(linePrice(row)) * Number(row.quantity || 0), 0)),
)
const hasSoldOut = computed(() => rows.value.some((row) => isSoldOut(row)))
const allSelected = computed(
  () => availableRows.value.length > 0 && availableRows.value.every((row) => Boolean(row.selected)),
)
const someSelected = computed(() => availableRows.value.some((row) => Boolean(row.selected)))

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

function isSoldOut(row) {
  return Number(row?.stock ?? 0) <= 0
}

/** 结算单价：秒杀进行中按活动价，否则按商品价（与后端下单时的取价规则一致）。 */
function linePrice(row) {
  return row?.activityPrice ?? row?.price ?? 0
}

function lineTotal(row) {
  return round2(Number(linePrice(row)) * Number(row.quantity || 0))
}

/** 购物车读接口：写操作之后统一回到这里复核，避免"点了没反应"的假成功。 */
async function load(silent = false) {
  if (!userStore.consumerId) return
  if (!silent) loading.value = true
  try {
    const lines = await consumerApi.getCart(userStore.consumerId)
    rows.value = Array.isArray(lines) ? lines : []
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '购物车加载失败')
  } finally {
    if (!silent) loading.value = false
  }
}

async function saveQty(row, value) {
  const quantity = Number(value)
  if (!Number.isInteger(quantity) || quantity < 1) {
    await load(true)
    return
  }
  if (isSoldOut(row)) {
    ElMessage.warning('该商品已售罄，请先移除')
    await load(true)
    return
  }
  busy.value = true
  try {
    const res = await consumerApi.updateCart({ id: row.id, quantity })
    if (res?.success === false) {
      ElMessage.warning(res.message || '数量更新失败')
      await load(true)
      return
    }
    await load(true)
    const fresh = rows.value.find((item) => String(item.id) === String(row.id))
    if (!fresh || Number(fresh.quantity) !== quantity) {
      ElMessage.error('数量未更新，请重试')
      return
    }
    await userStore.refreshCart()
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '数量更新失败')
    await load(true)
  } finally {
    busy.value = false
  }
}

async function selectOne(row, selected) {
  if (selected && isSoldOut(row)) {
    ElMessage.warning('该商品已售罄，请先移除后再结算')
    await load(true)
    return
  }
  busy.value = true
  try {
    const res = await consumerApi.updateCart({ id: row.id, selected: Boolean(selected) })
    if (res?.success === false) {
      ElMessage.warning(res.message || '勾选失败')
    }
    await load(true)
    const fresh = rows.value.find((item) => String(item.id) === String(row.id))
    if (!fresh || Boolean(fresh.selected) !== Boolean(selected)) {
      ElMessage.error('勾选状态未更新，请重试')
    }
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '勾选失败')
    await load(true)
  } finally {
    busy.value = false
  }
}

async function selectAll(selected) {
  const next = Boolean(selected)
  if (next && hasSoldOut.value) {
    ElMessage.warning('购物车中有已售罄商品，请先移除后再全选')
    return
  }
  if (!userStore.consumerId) return
  busy.value = true
  try {
    const res = await consumerApi.selectAllCart(userStore.consumerId, next)
    if (res?.success === false) {
      ElMessage.warning(res.message || '全选失败')
    }
    await load(true)
    const mismatch = availableRows.value.some((row) => Boolean(row.selected) !== next)
    if (mismatch) ElMessage.error('勾选状态未更新，请重试')
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '全选失败')
    await load(true)
  } finally {
    busy.value = false
  }
}

async function remove(row) {
  busy.value = true
  try {
    const res = await consumerApi.deleteCart(row.id)
    if (res?.success === false) {
      ElMessage.warning(res.message || '删除失败')
    }
    await load(true)
    const stillThere = rows.value.some((item) => String(item.id) === String(row.id))
    if (stillThere) {
      ElMessage.error('删除未生效，请重试')
      return
    }
    await userStore.refreshCart()
    ElMessage.success('已从购物车移除')
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '删除失败')
    await load(true)
  } finally {
    busy.value = false
  }
}

function checkout() {
  if (!selectedCount.value) {
    ElMessage.warning('请先勾选要结算的商品')
    return
  }
  router.push('/order/confirm')
}

// App.vue 在 onMounted 里做统一身份初始化，consumerId 是异步换回来的；
// 这里监听它，拿到消费者 ID 后再拉购物车，避免直接进入购物车时误判「未登录」。
watch(
  () => userStore.consumerId,
  (id) => {
    if (id) load()
  },
  { immediate: true },
)
</script>

<style scoped>
.m-container {
  width: min(1280px, calc(100% - 48px));
  margin: 0 auto;
}

.lead {
  margin-top: 18px;
}

.cart-card {
  overflow: hidden;
}

.cart-row {
  display: grid;
  grid-template-columns: 74px 76px minmax(0, 1fr) 110px 150px 110px 70px;
  align-items: center;
  gap: 8px;
  padding: 14px 18px;
}

.cart-head {
  padding: 12px 18px;
  border-bottom: 1px solid #e3eae5;
  background: #f8fbf9;
}

.item {
  border-bottom: 1px solid #f1f5f2;
}

.item:last-child {
  border-bottom: 0;
}

.item:hover {
  background: #fbfdfc;
}

.item.out .name,
.item.out .price {
  color: #93a29a;
}

.thumb {
  display: grid;
  place-items: center;
  overflow: hidden;
  width: 64px;
  height: 64px;
  border-radius: 8px;
  background: linear-gradient(135deg, #eef7f1, #e2f0e7);
  cursor: pointer;
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb .ph {
  color: rgba(18, 118, 74, .3);
  font-size: 22px;
}

.info {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.name {
  overflow: hidden;
  font-size: 13.5px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
  cursor: pointer;
}

.name:hover {
  color: #12764a;
}

.meta {
  gap: 6px;
}

.qty {
  display: grid;
  gap: 4px;
  justify-items: start;
}

.qty :deep(.el-input-number) {
  width: 118px;
}

.stock-line {
  color: #93a29a;
}

.subtotal {
  text-align: right;
}

.ops {
  text-align: right;
}

.checkout {
  position: sticky;
  bottom: 16px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  padding: 12px 18px;
  box-shadow: 0 8px 24px rgba(4, 31, 20, .07);
}

@media (max-width: 1080px) {
  .cart-row { grid-template-columns: 60px 64px minmax(0, 1fr) 90px 130px 90px 60px; }
}
</style>

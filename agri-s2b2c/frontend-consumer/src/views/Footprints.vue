<template>
  <div class="m-container" v-loading="loading">
    <!-- 页头 -->
    <div class="m-page-hd">
      <h1>我的足迹</h1>
      <span class="sub">按最近浏览时间倒序，同一件商品只保留最后一次访问；最多保留 60 条</span>
      <div class="hd-actions">
        <button type="button" class="m-btn sm" :disabled="!rows.length || clearing" @click="clearAll">清空足迹</button>
        <button type="button" class="m-btn sm" @click="router.push('/products')">去逛逛</button>
      </div>
    </div>

    <!-- 未登录 -->
    <EmptyBlock
      v-if="userStore.booted && !consumerId"
      icon="🔐"
      title="登录后查看浏览足迹"
      desc="足迹挂在商城消费者账号下，由浏览商品的动作自动写入。当前浏览器没有检测到已登录的统一身份，请从统一门户登录后再进入商城。"
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="router.push('/')">返回首页</button>
      </template>
    </EmptyBlock>

    <template v-else>
      <!-- 统计条 -->
      <div class="m-card sum-bar">
        <span>共 <b class="num">{{ rows.length }}</b> 条浏览记录</span>
        <span class="m-spacer" />
        <span class="muted small">清空后不可恢复，正在看的商品再次访问会重新记录</span>
      </div>

      <!-- 按日期分组 -->
      <div v-if="groups.length" class="m-stack">
        <section v-for="group in groups" :key="group.key" class="m-card group">
          <header class="group-hd">
            <b>{{ group.label }}</b>
            <span v-if="group.sub" class="muted small num">{{ group.sub }}</span>
            <span class="m-spacer" />
            <span class="muted small num">{{ group.items.length }} 件</span>
          </header>

          <div class="fp-list">
            <article v-for="item in group.items" :key="item.id" class="fp-item">
              <div class="thumb" @click="openProduct(item.productId)">
                <img
                  v-if="usableImage(item.image) && !brokenIds.has(String(item.id))"
                  :src="usableImage(item.image)"
                  :alt="item.name"
                  loading="lazy"
                  @error="markBroken(item.id)"
                />
                <span v-else class="ph">🌿</span>
              </div>

              <div class="fp-info">
                <div class="fp-name" :title="item.name" @click="openProduct(item.productId)">
                  {{ item.name || '商品已删除' }}
                </div>
                <div class="m-row-wrap">
                  <span v-if="item.origin" class="muted small">{{ item.origin }}</span>
                  <span v-if="item.status && item.status !== 'APPROVED'" class="m-tag plain">已下架</span>
                  <span v-else-if="item.stock != null && Number(item.stock) <= 0" class="m-tag plain">已售罄</span>
                </div>
              </div>

              <div class="fp-price">
                <span class="price sm"><span class="cur">¥</span>{{ money(item.price) }}</span>
              </div>

              <div class="fp-time">
                <span class="muted small num">{{ timeOf(item.visitedAt) }}</span>
                <span class="muted small">浏览</span>
              </div>

              <button type="button" class="m-btn sm" @click="openProduct(item.productId)">查看</button>
            </article>
          </div>
        </section>
      </div>

      <EmptyBlock
        v-else-if="!loading"
        icon="👣"
        title="还没有浏览足迹"
        desc="足迹由浏览商品自动记录：打开任意商品详情页即写入一条，同一商品只保留最近一次。当前账号还没有记录，去商品列表逛逛就会生成。"
      >
        <template #actions>
          <button type="button" class="m-btn primary" @click="router.push('/products')">去挑好货</button>
        </template>
      </EmptyBlock>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { consumerApi } from '../api'
import { useUserStore } from '../stores/user'
import { dateOnly, money, usableImage } from '../utils/format'
import EmptyBlock from '../components/EmptyBlock.vue'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const clearing = ref(false)
const rows = ref([])
const brokenIds = ref(new Set())

const consumerId = computed(() => userStore.consumerId)

function pad(value) {
  return String(value).padStart(2, '0')
}

/** 本地日期串（YYYY-MM-DD），用于和 visitedAt 的日期部分比较，不能用 UTC 否则跨零点分组会错。 */
function localDate(offsetDays = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** visitedAt 形如 "2026-10-30 12:08:33"（后端给的是字符串），取日期与时分。 */
function timeOf(value) {
  const text = String(value || '').replace('T', ' ')
  return text.length >= 16 ? text.slice(11, 16) : '—'
}

/**
 * 日期分组：今天 / 昨天 / 更早（更早的按具体日期各成一组），
 * 组头展示日期与条数；数据本身已按 visitedAt 倒序，这里保持顺序。
 */
const groups = computed(() => {
  const today = localDate(0)
  const yesterday = localDate(-1)
  const bucket = new Map()

  for (const item of rows.value) {
    const day = dateOnly(item.visitedAt) === '—' ? '未知日期' : dateOnly(item.visitedAt)
    if (!bucket.has(day)) bucket.set(day, [])
    bucket.get(day).push(item)
  }

  return [...bucket.entries()].map(([day, items]) => {
    const isToday = day === today
    const isYesterday = day === yesterday
    return {
      key: day,
      // 今天 / 昨天用相对说法，更早的直接用日期当组头
      label: isToday ? '今天' : isYesterday ? '昨天' : day,
      sub: isToday || isYesterday ? day : '',
      items,
    }
  })
})

function markBroken(id) {
  brokenIds.value = new Set([...brokenIds.value, String(id)])
}

function openProduct(productId) {
  if (!productId) {
    ElMessage.warning('该商品已被删除，无法查看详情')
    return
  }
  router.push(`/product/${productId}`)
}

async function load() {
  if (!consumerId.value) {
    rows.value = []
    return
  }
  loading.value = true
  try {
    rows.value = (await consumerApi.getFootprints(consumerId.value)) || []
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '足迹加载失败')
  } finally {
    loading.value = false
  }
}

/** 清空足迹：接口无回执明细，必须回读列表确认为空后再提示。 */
async function clearAll() {
  if (!rows.value.length) {
    ElMessage.warning('当前没有足迹需要清空')
    return
  }
  try {
    await ElMessageBox.confirm(
      `将清空 ${rows.value.length} 条浏览记录，清空后不可恢复（再次浏览商品会重新记录）。确认清空？`,
      '清空足迹',
      { confirmButtonText: '确认清空', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }

  clearing.value = true
  try {
    const res = await consumerApi.clearFootprints(consumerId.value)
    if (res?.success === false) {
      ElMessage.error(res.message || '清空失败')
      await load()
      return
    }
    await load()
    if (rows.value.length === 0) {
      ElMessage.success('足迹已清空')
    } else {
      ElMessage.error(`仍有 ${rows.value.length} 条记录未清除，请刷新后重试`)
    }
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '清空足迹失败')
    await load()
  } finally {
    clearing.value = false
  }
}

onMounted(load)

// 统一身份异步换回消费者 ID：拿到后再查足迹
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

.group {
  overflow: hidden;
}

.group-hd {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  border-bottom: 1px solid #eef3ef;
  background: #fbfdfc;
}

.group-hd b {
  font-size: 14px;
  font-weight: 700;
}

.fp-list {
  padding: 0 18px;
}

.fp-item {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) 110px 76px 72px;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
  border-bottom: 1px dashed #eef3ef;
}

.fp-item:last-child {
  border-bottom: 0;
}

.thumb {
  display: grid;
  place-items: center;
  overflow: hidden;
  width: 72px;
  height: 72px;
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
  font-size: 24px;
}

.fp-info {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.fp-name {
  overflow: hidden;
  font-size: 13.5px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
  cursor: pointer;
}

.fp-name:hover {
  color: #12764a;
}

.fp-price {
  text-align: right;
}

.fp-time {
  display: grid;
  justify-items: end;
  gap: 2px;
  line-height: 1.5;
}

@media (max-width: 960px) {
  .fp-item { grid-template-columns: 64px minmax(0, 1fr) 90px 72px; }
  .fp-time { display: none; }
}
</style>

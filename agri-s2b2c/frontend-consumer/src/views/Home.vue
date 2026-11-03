<template>
  <div class="m-container" v-loading="loading">
    <!-- 主视觉 -->
    <section class="hero">
      <div class="hero-main">
        <span class="hero-eyebrow">🌾 基地直供 · 源头好货</span>
        <h1>从田间到餐桌<br />每一件都查得到来路</h1>
        <p>
          平台已接入 <b>{{ stats.farms }}</b> 个认证产地供应商、<b>{{ stats.skus }}</b> 个在架产地直供 SKU，
          下单后由产地直发，48 小时内出库；批次、检测报告与物流全流程可查。
        </p>
        <div class="hero-actions">
          <button type="button" class="m-btn primary" @click="$router.push('/products')">逛逛当季好物</button>
          <button type="button" class="hero-ghost" @click="$router.push('/trace')">扫码查溯源</button>
        </div>
      </div>
      <aside class="hero-side">
        <div class="side-card">
          <div class="side-hd">我的账户</div>
          <div class="side-user">
            <span class="avatar">{{ (userStore.displayName || '客').slice(0, 1) }}</span>
            <div>
              <b>{{ userStore.displayName }}</b>
              <small>{{ memberLevelText(userStore.user?.memberLevel) }}</small>
            </div>
          </div>
          <div class="side-stats">
            <button type="button" @click="$router.push('/points')">
              <b>{{ userStore.user?.points ?? 0 }}</b><span>积分</span>
            </button>
            <button type="button" @click="$router.push('/my-coupons')">
              <b>{{ myCoupons.length }}</b><span>优惠券</span>
            </button>
            <button type="button" @click="$router.push('/favorites')">
              <b>{{ favCount }}</b><span>收藏</span>
            </button>
          </div>
          <button type="button" class="m-btn block" @click="$router.push('/signin')">签到领积分</button>
        </div>
      </aside>
    </section>

    <!-- 快捷入口 -->
    <div class="quick">
      <button v-for="q in quickLinks" :key="q.label" type="button" class="quick-item" @click="$router.push(q.path)">
        <i>{{ q.icon }}</i>
        <span>{{ q.label }}</span>
        <small>{{ q.desc }}</small>
      </button>
    </div>

    <!-- 渠道好店 -->
    <template v-if="channels.length">
      <SectionHead title="🏪 渠道好店" desc="社区团长与门店精选，进店享渠道价">
        <span class="muted small">共 {{ channels.length }} 家</span>
      </SectionHead>
      <div class="channel-row">
        <article v-for="c in channels" :key="c.id" class="channel-card" @click="$router.push(`/channel/${c.id}`)">
          <div class="channel-logo">
            <img v-if="c.shopLogo" :src="c.shopLogo" :alt="c.shopName" />
            <span v-else>{{ (c.shopName || '渠').slice(0, 1) }}</span>
          </div>
          <div class="channel-copy">
            <b>{{ c.shopName }}</b>
            <span class="muted small">{{ c.shopDesc || c.featuredProduct || '渠道精选好物' }}</span>
            <div class="channel-meta">
              <em>{{ gradeText(c.grade) }}</em>
              <span>{{ c.productCount || 0 }} 款在售</span>
              <span v-if="c.minPrice">低至 ¥{{ Number(c.minPrice).toFixed(2) }}</span>
            </div>
          </div>
        </article>
      </div>
    </template>

    <!-- 限时秒杀 -->
    <template v-if="flashSales.length">
      <SectionHead title="🔥 限时秒杀" more-text="更多秒杀 ›" @more="$router.push('/flash')">
        <span class="muted small">距本场结束</span>
        <Countdown :end-time="flashEnd" />
      </SectionHead>
      <div class="flash-row">
        <article v-for="item in flashSales" :key="item.id" class="flash-card">
          <div class="flash-thumb" @click="$router.push(`/product/${item.productId}`)">
            <span>⚡</span>
            <i class="flash-flag">秒杀</i>
          </div>
          <div class="flash-bd">
            <div class="pc-name" @click="$router.push(`/product/${item.productId}`)">{{ item.productName }}</div>
            <div class="muted small">{{ item.unit ? `规格：${item.unit}` : '产地直供' }}</div>
            <div class="progress">
              <span class="bar"><i :style="{ width: soldPercent(item) + '%' }" /></span>
              <small>已抢 {{ soldPercent(item) }}%</small>
            </div>
            <div class="price-row">
              <span class="price"><span class="cur">¥</span>{{ money(item.salePrice) }}</span>
              <span class="cost">¥{{ money(item.originalPrice) }}</span>
            </div>
            <button
              type="button"
              class="m-btn primary sm block"
              :disabled="Number(item.remainStock) <= 0"
              @click="$router.push(`/product/${item.productId}`)"
            >
              {{ Number(item.remainStock) <= 0 ? '已抢光' : '立即抢购' }}
            </button>
          </div>
        </article>
      </div>
    </template>

    <!-- 智能选品 -->
    <section class="smart">
      <span class="smart-ic">🤖</span>
      <div>
        <b>智能选品 · 为你挑好货</b>
        <p>
          按「热销度 × 库存充足度 × 溯源完整度」给在架商品打分，为你筛出 {{ picks.length }} 款当季好货；
          打分只用平台真实字段，不伪造口味评价。
        </p>
      </div>
      <button type="button" class="m-btn sm ghost" @click="showReason = true">查看推荐理由</button>
    </section>

    <!-- 新品上市 -->
    <SectionHead title="🌱 新品上市" desc="最近上架的产地直供商品" more-text="查看更多 ›" @more="$router.push('/products')" />
    <div v-if="newArrivals.length" class="m-grid m-grid-4">
      <ProductCard
        v-for="p in newArrivals"
        :key="p.id"
        :product="p"
        :favorited="favorites.has(p.id)"
        badge="新品"
        @favorite="favorites.toggle(p.id)"
        @add="addToCart(p)"
      />
    </div>
    <EmptyBlock v-else icon="🌱" title="暂无在架商品" desc="供应商完成上架并通过平台审核后，商品会出现在这里。" />

    <!-- 溯源好物 -->
    <section class="trace-band">
      <div class="trace-hd">
        <div>
          <h2>🔍 溯源好物专区</h2>
          <p>一物一码：按商品或溯源码查询批次、产地、检测报告与储运信息</p>
        </div>
        <button type="button" class="m-btn ghost" @click="$router.push('/trace')">进入溯源 ›</button>
      </div>
      <div v-if="traceGoods.length" class="trace-grid">
        <button
          v-for="p in traceGoods"
          :key="p.id"
          type="button"
          class="trace-item"
          @click="$router.push({ path: '/trace', query: { productId: p.id } })"
        >
          <span class="dot-mark">✓</span>
          <b>{{ p.name }}</b>
          <small>{{ p.origin || '产地信息见溯源详情' }}</small>
          <span class="trace-link">查溯源 ›</span>
        </button>
      </div>
      <EmptyBlock v-else icon="🔍" title="暂无溯源商品" desc="商品录入溯源批次后，会在这里开放查询入口。" />
    </section>

    <!-- 活动专区 -->
    <SectionHead title="🎉 活动专区" desc="拼团、领券、签到，一起省一点" />
    <div class="m-grid m-grid-3">
      <button type="button" class="promo promo-group" @click="$router.push('/groups')">
        <b>👥 拼团好货</b>
        <span>{{ groups.length ? `${groups.length} 个在售团，人多价更低` : '2 人成团，拼团价直降' }}</span>
        <i>去拼团 ›</i>
      </button>
      <button type="button" class="promo promo-coupon" @click="$router.push('/coupons')">
        <b>🎫 领券中心</b>
        <span>{{ coupons.length }} 张在发优惠券，先领后买</span>
        <i>去领券 ›</i>
      </button>
      <button type="button" class="promo promo-sign" @click="$router.push('/signin')">
        <b>📅 签到有礼</b>
        <span>每日签到得积分，积分可兑换优惠券</span>
        <i>去签到 ›</i>
      </button>
    </div>

    <!-- 热销榜单 -->
    <SectionHead title="🏆 热销榜单" desc="按累计销量排序" more-text="查看全部 ›" @more="$router.push('/products')" />
    <div class="rank-wrap">
      <div class="rank-list">
        <button
          v-for="(p, index) in salesTop"
          :key="p.id"
          type="button"
          class="rank-item"
          @click="$router.push(`/product/${p.id}`)"
        >
          <span class="rank-no" :class="'no' + (index + 1)">{{ index + 1 }}</span>
          <span class="rank-name">{{ p.name }}</span>
          <span class="muted small">{{ p.origin || p.categoryName || '产地直供' }}</span>
          <span class="rank-sales">月销 {{ p.sales ?? 0 }}</span>
          <span class="price sm"><span class="cur">¥</span>{{ money(p.price) }}</span>
        </button>
        <EmptyBlock v-if="!salesTop.length" icon="🏆" title="暂无销量数据" />
      </div>
      <aside class="rank-side m-card m-card-pad">
        <h4>当季推荐</h4>
        <p class="muted small">按上架时间与库存情况给出的补货提示，数据来自商品接口。</p>
        <div v-for="p in newArrivals.slice(0, 3)" :key="p.id" class="side-row" @click="$router.push(`/product/${p.id}`)">
          <span class="side-name">{{ p.name }}</span>
          <span class="price sm">¥{{ money(p.price) }}</span>
        </div>
        <EmptyBlock v-if="!newArrivals.length" icon="🌾" title="暂无上新" />
      </aside>
    </div>

    <!-- 猜你喜欢 -->
    <SectionHead title="猜你喜欢" desc="基于在架商品的销量与库存推荐" />
    <div v-if="recommend.length" class="m-grid m-grid-4">
      <ProductCard
        v-for="p in recommend"
        :key="p.id"
        :product="p"
        :favorited="favorites.has(p.id)"
        @favorite="favorites.toggle(p.id)"
        @add="addToCart(p)"
      />
    </div>
    <EmptyBlock v-else icon="🛒" title="暂无更多商品" desc="等供应商补货后再来看看。" />

    <el-dialog v-model="showReason" title="智能选品规则说明" width="520px">
      <div class="reason">
        <p>本页推荐不调用大模型，也不编造用户评价，全部由在架商品的真实字段计算：</p>
        <ul>
          <li><b>热销度</b>：商品累计销量（<code>sales</code>）归一化后占 45%。</li>
          <li><b>库存充足度</b>：可售库存（<code>stock</code>）高于 50 件，占 30%。</li>
          <li><b>溯源完整度</b>：商品是否填写产地（<code>origin</code>），占 25%。</li>
        </ul>
        <p class="muted small">
          推荐位只做排序，不改变价格与库存；真正的 AI 选品能力属于 AI 中台，接入前这里保持规则口径。
        </p>
      </div>
      <template #footer>
        <el-button type="primary" @click="showReason = false">知道了</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { consumerApi } from '../api'
import { useUserStore } from '../stores/user'
import { useFavorites } from '../composables/useFavorites'
import { memberLevelText, money, soldPercent } from '../utils/format'
import SectionHead from '../components/SectionHead.vue'
import ProductCard from '../components/ProductCard.vue'
import EmptyBlock from '../components/EmptyBlock.vue'
import Countdown from '../components/Countdown.vue'

const router = useRouter()
const userStore = useUserStore()
const favorites = useFavorites()

function gradeText(grade) {
  return { LEVEL_1: '铜牌渠道', LEVEL_2: '银牌渠道', LEVEL_3: '金牌渠道' }[grade] || '渠道认证'
}

const loading = ref(false)
const products = ref([])
const channels = ref([])
const flashSales = ref([])
const groups = ref([])
const coupons = ref([])
const myCoupons = ref([])
const showReason = ref(false)

const quickLinks = [
  { icon: '⏰', label: '限时秒杀', desc: '整点开抢', path: '/flash' },
  { icon: '👥', label: '拼团专区', desc: '人多价更低', path: '/groups' },
  { icon: '⭐', label: '会员中心', desc: '等级与权益', path: '/member' },
  { icon: '📅', label: '签到领积分', desc: '每日 +5', path: '/signin' },
  { icon: '🎫', label: '优惠券中心', desc: '先领后买', path: '/coupons' },
  { icon: '🎁', label: '积分商城', desc: '积分兑好券', path: '/points-mall' },
]

const stats = computed(() => {
  const suppliers = new Set(products.value.map((p) => p.supplierName).filter(Boolean))
  return { farms: suppliers.size || '—', skus: products.value.length || 0 }
})

const flashEnd = computed(() => {
  const ends = flashSales.value.map((item) => item.endTime).filter(Boolean).sort()
  return ends[0] || ''
})

const newArrivals = computed(() => products.value.slice(0, 4))
const traceGoods = computed(() => products.value.filter((p) => p.origin).slice(0, 4))

const salesTop = computed(() =>
  [...products.value].sort((a, b) => Number(b.sales || 0) - Number(a.sales || 0)).slice(0, 5),
)

const recommend = computed(() => {
  const scored = products.value.map((p) => {
    const sales = Number(p.sales || 0)
    const stock = Number(p.stock || 0)
    const score = Math.min(sales / 1000, 1) * 0.45 + (stock > 50 ? 1 : 0) * 0.3 + (p.origin ? 1 : 0) * 0.25
    return { p, score }
  })
  return scored.sort((a, b) => b.score - a.score).slice(0, 8).map((row) => row.p)
})

const picks = computed(() => recommend.value)
const favCount = computed(() => favorites.ids.value.size)

async function load() {
  loading.value = true
  try {
    const [page, marketing, channelList] = await Promise.all([
      consumerApi.getProducts({ page: 1, size: 24 }),
      consumerApi.getMarketing().catch(() => null),
      consumerApi.getChannels({ limit: 8 }).catch(() => []),
    ])
    products.value = page?.records || []
    channels.value = channelList || []
    flashSales.value = (marketing?.flashSales || []).filter((item) => Number(item.remainStock) > 0).slice(0, 4)
    groups.value = marketing?.groupBuys || []
    coupons.value = marketing?.coupons || []

    if (userStore.consumerId) {
      myCoupons.value = (await consumerApi.getCoupons(userStore.consumerId).catch(() => [])) || []
    }
    await favorites.load()
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '首页数据加载失败')
  } finally {
    loading.value = false
  }
}

async function addToCart(product) {
  if (!userStore.consumerId) {
    ElMessage.warning('请先完成登录')
    return
  }
  try {
    const res = await consumerApi.addCart({ consumerId: userStore.consumerId, productId: product.id, quantity: 1 })
    if (res?.success === false) {
      ElMessage.warning(res.message || '加入购物车失败')
      return
    }
    await userStore.refreshCart()
    ElMessage.success('已加入购物车')
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '加入购物车失败')
  }
}

onMounted(load)
</script>

<style scoped>
.channel-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 18px;
}
.channel-card {
  display: flex;
  gap: 12px;
  padding: 14px;
  border: 1px solid #e3eae5;
  border-radius: 14px;
  background: #fff;
  cursor: pointer;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.channel-card:hover {
  box-shadow: 0 10px 24px rgba(17, 62, 41, 0.08);
  transform: translateY(-2px);
}
.channel-logo {
  display: grid;
  width: 52px;
  height: 52px;
  place-items: center;
  overflow: hidden;
  border-radius: 12px;
  background: #e5f5eb;
  color: #12764a;
  font-size: 22px;
  font-weight: 700;
  flex-shrink: 0;
}
.channel-logo img { width: 100%; height: 100%; object-fit: cover; }
.channel-copy { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.channel-copy b { font-size: 14px; color: #173e2a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.channel-meta { display: flex; flex-wrap: wrap; gap: 8px; font-size: var(--agri-font-size-micro); color: #84938a; }
.channel-meta em { font-style: normal; padding: 1px 8px; border-radius: 999px; background: #e5f5eb; color: #0f6a43; }
@media (max-width: 1100px) { .channel-row { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 640px) { .channel-row { grid-template-columns: 1fr; } }

.hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
  margin-top: 18px;
}

.hero-main {
  position: relative;
  overflow: hidden;
  padding: 34px 40px;
  border-radius: 16px;
  background:
    radial-gradient(900px 300px at 88% -30%, rgba(255, 214, 153, .45), transparent 60%),
    linear-gradient(120deg, #0e5233 0%, #12764a 48%, #2f8f63 100%);
  color: #fff;
}

.hero-main::after {
  position: absolute;
  right: -60px;
  bottom: -80px;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  background: rgba(255, 255, 255, .07);
  content: "";
}

.hero-eyebrow {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 12px;
  border-radius: 20px;
  background: rgba(255, 255, 255, .16);
  font-size: 12px;
  letter-spacing: .5px;
}

.hero-main h1 {
  margin: 14px 0 10px;
  font-size: 30px;
  font-weight: 800;
  letter-spacing: 1px;
  line-height: 1.32;
}

.hero-main p {
  max-width: 560px;
  margin: 0 0 20px;
  color: rgba(255, 255, 255, .86);
  font-size: 13.5px;
  line-height: 1.8;
}

.hero-main p b {
  color: #fff;
}

.hero-actions {
  display: flex;
  gap: 10px;
}

.hero-main .m-btn.primary {
  background: #fff;
  color: #0e5233;
  box-shadow: 0 8px 20px rgba(4, 31, 20, .18);
}

.hero-ghost {
  height: 36px;
  padding: 0 16px;
  border: 1px solid rgba(255, 255, 255, .5);
  border-radius: 8px;
  background: transparent;
  color: #fff;
  font-size: 13.5px;
  cursor: pointer;
}

.hero-ghost:hover {
  background: rgba(255, 255, 255, .12);
}

.hero-side {
  display: flex;
}

.side-card {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border: 1px solid #e3eae5;
  border-radius: 16px;
  background: #fff;
}

.side-hd {
  color: #6b7c72;
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: .5px;
}

.side-user {
  display: flex;
  align-items: center;
  gap: 10px;
}

.side-user .avatar {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: linear-gradient(135deg, #e4f6ec, #cbeadb);
  color: #12764a;
  font-size: 17px;
  font-weight: 800;
}

.side-user b {
  display: block;
  font-size: 14px;
}

.side-user small {
  color: #6b7c72;
  font-size: var(--agri-font-size-micro);
}

.side-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: 10px 0;
  border-top: 1px solid #eef3ef;
  border-bottom: 1px solid #eef3ef;
}

.side-stats button {
  display: grid;
  gap: 2px;
  padding: 4px 0;
  border: 0;
  background: none;
  color: #0b1a12;
  cursor: pointer;
}

.side-stats b {
  font-size: 16px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.side-stats span {
  color: #6b7c72;
  font-size: var(--agri-font-size-micro);
}

.quick {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
  margin-top: 18px;
}

.quick-item {
  display: grid;
  justify-items: center;
  gap: 4px;
  padding: 14px 8px;
  border: 1px solid #e3eae5;
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  transition: border-color .15s, transform .15s, box-shadow .15s;
}

.quick-item:hover {
  transform: translateY(-2px);
  border-color: #bfe0cd;
  box-shadow: 0 10px 24px rgba(4, 31, 20, .06);
}

.quick-item i {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  background: #f1fbf5;
  font-size: 18px;
  font-style: normal;
}

.quick-item span {
  font-size: 13px;
  font-weight: 600;
}

.quick-item small {
  color: #93a29a;
  font-size: var(--agri-font-size-micro);
}

.flash-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.flash-card {
  overflow: hidden;
  border: 1px solid #f1ddd3;
  border-radius: 12px;
  background: #fff;
}

.flash-thumb {
  position: relative;
  display: grid;
  place-items: center;
  height: 130px;
  background: linear-gradient(135deg, #fff2ea, #ffe2d2);
  font-size: 34px;
  cursor: pointer;
}

.flash-flag {
  position: absolute;
  top: 10px;
  left: 10px;
  padding: 2px 8px;
  border-radius: 6px;
  background: #d45b32;
  color: #fff;
  font-size: var(--agri-font-size-micro);
  font-style: normal;
  font-weight: 700;
}

.flash-bd {
  display: grid;
  gap: 8px;
  padding: 12px 14px 14px;
}

.progress {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress .bar {
  flex: 1;
  overflow: hidden;
  height: 6px;
  border-radius: 4px;
  background: #fdece4;
}

.progress .bar i {
  display: block;
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, #f0a06f, #d45b32);
}

.progress small {
  color: #d45b32;
  font-size: var(--agri-font-size-micro);
}

.smart {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 20px;
  padding: 16px 20px;
  border: 1px solid #dce9f5;
  border-radius: 12px;
  background: linear-gradient(120deg, #f2f8fe, #eef7f1);
}

.smart-ic {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: #fff;
  font-size: 20px;
  box-shadow: 0 4px 12px rgba(11, 94, 134, .1);
}

.smart b {
  font-size: 14px;
}

.smart p {
  margin: 2px 0 0;
  color: #5c6f66;
  font-size: 12.5px;
}

.smart .m-btn {
  margin-left: auto;
}

.trace-band {
  margin-top: 26px;
  padding: 20px 22px;
  border: 1px solid #d9ece2;
  border-radius: 14px;
  background: linear-gradient(120deg, #f4fbf7, #ffffff 60%);
}

.trace-hd {
  display: flex;
  align-items: center;
  gap: 12px;
}

.trace-hd h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
}

.trace-hd p {
  margin: 2px 0 0;
  color: #6b7c72;
  font-size: 12.5px;
}

.trace-hd .m-btn {
  margin-left: auto;
}

.trace-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.trace-item {
  position: relative;
  display: grid;
  gap: 3px;
  padding: 12px 14px;
  border: 1px solid #e3eae5;
  border-radius: 10px;
  background: #fff;
  text-align: left;
  cursor: pointer;
}

.trace-item:hover {
  border-color: #bfe0cd;
}

.trace-item b {
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.trace-item small {
  color: #93a29a;
  font-size: var(--agri-font-size-micro);
}

.trace-item .dot-mark {
  position: absolute;
  top: 10px;
  right: 10px;
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #e4f6ec;
  color: #12764a;
  font-size: var(--agri-font-size-micro);
}

.trace-link {
  color: #12764a;
  font-size: var(--agri-font-size-micro);
  font-weight: 600;
}

.promo {
  display: grid;
  gap: 4px;
  padding: 18px 20px;
  border: 1px solid #e3eae5;
  border-radius: 12px;
  background: #fff;
  text-align: left;
  cursor: pointer;
  transition: transform .15s, box-shadow .15s;
}

.promo:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 24px rgba(4, 31, 20, .07);
}

.promo b {
  font-size: 15px;
}

.promo span {
  color: #6b7c72;
  font-size: 12.5px;
}

.promo i {
  margin-top: 6px;
  color: #12764a;
  font-size: 12.5px;
  font-style: normal;
  font-weight: 600;
}

.promo-group { background: linear-gradient(120deg, #f2fbf6, #fff); }
.promo-coupon { background: linear-gradient(120deg, #fdf6f0, #fff); }
.promo-sign { background: linear-gradient(120deg, #f4f7fe, #fff); }

.rank-wrap {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
  align-items: start;
}

.rank-list {
  overflow: hidden;
  border: 1px solid #e3eae5;
  border-radius: 12px;
  background: #fff;
}

.rank-item {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) 150px 90px 90px;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 18px;
  border: 0;
  border-bottom: 1px solid #f1f5f2;
  background: #fff;
  text-align: left;
  cursor: pointer;
}

.rank-item:last-child {
  border-bottom: 0;
}

.rank-item:hover {
  background: #f8fbf9;
}

.rank-no {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: #f1f5f2;
  color: #6b7c72;
  font-size: 12px;
  font-weight: 700;
}

.rank-no.no1 { background: #d45b32; color: #fff; }
.rank-no.no2 { background: #d88718; color: #fff; }
.rank-no.no3 { background: #b07a2b; color: #fff; }

.rank-name {
  overflow: hidden;
  font-size: 13.5px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.rank-sales {
  color: #93a29a;
  font-size: 12px;
  text-align: right;
}

.rank-item .price {
  text-align: right;
}

.rank-side h4 {
  margin: 0 0 4px;
  font-size: 14px;
}

.side-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px dashed #eef3ef;
  cursor: pointer;
}

.side-row:last-of-type {
  border-bottom: 0;
}

.side-name {
  flex: 1;
  overflow: hidden;
  font-size: 12.5px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.reason ul {
  margin: 8px 0 12px;
  padding-left: 18px;
  color: #4b5d53;
  font-size: 13px;
  line-height: 1.9;
}

.reason code {
  padding: 1px 5px;
  border-radius: 4px;
  background: #f1f5f2;
  color: #12764a;
  font-size: 12px;
}

@media (max-width: 1180px) {
  .hero { grid-template-columns: minmax(0, 1fr); }
  .hero-side { display: none; }
  .quick { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .flash-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .trace-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .rank-wrap { grid-template-columns: minmax(0, 1fr); }
}
</style>

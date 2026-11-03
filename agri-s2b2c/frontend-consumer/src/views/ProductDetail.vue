<template>
  <div class="m-container" v-loading="loading">
    <div v-if="product" class="detail">
      <!-- 图片与购买区 -->
      <section class="gallery m-card">
        <div class="main-img">
          <img v-if="activeImage && !broken" :src="activeImage" :alt="product.name" @error="broken = true" />
          <span v-else class="ph">🌿</span>
          <span v-if="product.origin" class="img-tag">{{ product.origin }} · 产地直供</span>
        </div>
        <div v-if="images.length > 1" class="thumbs">
          <button
            v-for="(img, index) in images"
            :key="img + index"
            type="button"
            class="thumb-btn"
            :class="{ on: index === activeIndex }"
            @click="selectImage(index)"
          >
            <img :src="img" :alt="`预览图 ${index + 1}`" />
          </button>
        </div>
      </section>

      <section class="buy m-card">
        <div class="buy-hd">
          <h1>{{ product.name }}</h1>
          <p v-if="product.sellingPoint" class="selling">{{ product.sellingPoint }}</p>
        </div>

        <div class="price-panel">
          <div class="price-line">
            <span class="label">售价</span>
            <span class="price lg"><span class="cur">¥</span>{{ money(sellPrice) }}</span>
            <span v-if="comparePrice" class="cost">¥{{ money(comparePrice) }}</span>
            <span v-if="product.unit" class="muted small">/ {{ product.unit }}</span>
            <span v-if="isFlash" class="m-tag red">秒杀进行中</span>
          </div>
          <div v-if="isFlash" class="flash-line">
            <span>秒杀价在活动期内自动生效，结算按活动价计算</span>
            <Countdown :end-time="product.activityEndTime" end-text="本场已结束" />
            <span class="muted small">每人限购 {{ product.activityLimit || '不限' }} 件 · 活动库存 {{ product.activityRemainStock ?? '—' }} 件</span>
          </div>
          <div class="meta-line">
            <span>累计销量 <b>{{ product.sales ?? 0 }}</b></span>
            <span>可售库存 <b>{{ product.stock ?? 0 }}</b></span>
            <span>评价 <b>{{ summary.total || 0 }}</b> 条</span>
          </div>
        </div>

        <dl class="attrs">
          <div><dt>产地</dt><dd>{{ product.origin || '—' }}</dd></div>
          <div><dt>等级</dt><dd>{{ product.grade || '—' }}</dd></div>
          <div><dt>规格</dt><dd>{{ product.spec || '—' }}</dd></div>
          <div><dt>分类</dt><dd>{{ product.categoryName || '—' }}</dd></div>
          <div><dt>供货方</dt><dd>{{ product.supplierName || '—' }}</dd></div>
          <div>
            <dt>认证</dt>
            <dd>
              <span v-if="!certList.length">—</span>
              <span v-for="c in certList" :key="c" class="m-tag">{{ c }}</span>
            </dd>
          </div>
        </dl>

        <div class="qty-row">
          <span class="label">数量</span>
          <el-input-number v-model="quantity" :min="1" :max="maxQuantity" />
          <span class="muted small">最多可购 {{ maxQuantity }} 件</span>
        </div>

        <div class="actions">
          <button type="button" class="m-btn primary" :disabled="!inStock" @click="buyNow">立即购买</button>
          <button type="button" class="m-btn ghost" :disabled="!inStock" @click="addToCart">加入购物车</button>
          <button type="button" class="m-btn" @click="favorites.toggle(product.id)">
            {{ favorites.has(product.id) ? '♥ 已收藏' : '♡ 收藏' }}
          </button>
          <a class="m-btn" :href="crossModule.masterData" target="_blank" rel="noopener">货源主数据 ›</a>
        </div>

        <div class="assure">
          <span>✅ 产地直发</span>
          <span>✅ 一物一码可溯源</span>
          <span>✅ 坏果包赔</span>
          <span>✅ 平台售后兜底</span>
        </div>
      </section>
    </div>

    <EmptyBlock
      v-else-if="!loading"
      icon="🍃"
      title="商品不存在或已下架"
      desc="该商品可能已下架或未通过平台审核，可返回列表看看其他产地好货。"
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="$router.push('/products')">返回商品列表</button>
      </template>
    </EmptyBlock>

    <!-- 详情 / 评价 / 溯源 -->
    <section v-if="product" class="tabs-card m-card">
      <el-tabs v-model="tab" class="detail-tabs">
        <el-tab-pane label="商品详情" name="detail">
          <div class="pane">
            <div class="kv-list">
              <div><span>商品名称</span><b>{{ product.name }}</b></div>
              <div><span>卖点</span><b>{{ product.sellingPoint || '—' }}</b></div>
              <div><span>规格/单位</span><b>{{ product.spec || '—' }} {{ product.unit ? `/ ${product.unit}` : '' }}</b></div>
              <div><span>产地</span><b>{{ product.origin || '—' }}</b></div>
              <div><span>等级</span><b>{{ product.grade || '—' }}</b></div>
              <div><span>供货方</span><b>{{ product.supplierName || '—' }}</b></div>
              <div><span>上架时间</span><b>{{ dateTime(product.createTime) }}</b></div>
              <div><span>认证信息</span><b>{{ certList.length ? certList.join('、') : '—' }}</b></div>
            </div>
            <p class="pane-note">
              商品详情字段来自 S2B2C 商品档案（供应商提交、平台审核）。营养、口感等主观描述当前后端未提供，
              这里不做臆测；如需更完整的货源档案，可从「货源主数据」进入主数据模块查看。
            </p>
          </div>
        </el-tab-pane>

        <el-tab-pane :label="`累计评价（${summary.total || 0}）`" name="reviews">
          <div class="pane">
            <div class="review-summary">
              <div class="score">
                <b>{{ summary.average ? summary.average.toFixed(1) : '—' }}</b>
                <el-rate :model-value="Number(summary.average || 0)" disabled allow-half />
                <small>{{ summary.total || 0 }} 条评价</small>
              </div>
              <div class="bars">
                <div v-for="row in summary.distribution || []" :key="row.star" class="bar-row">
                  <span>{{ row.star }} 星</span>
                  <span class="bar"><i :style="{ width: barWidth(row) }" /></span>
                  <span class="muted small">{{ row.count }}</span>
                </div>
              </div>
            </div>

            <div v-if="reviews.length" class="review-list">
              <article v-for="review in reviews" :key="review.id" class="review-item">
                <div class="rv-hd">
                  <span class="avatar">{{ (review.nickname || '匿').slice(0, 1) }}</span>
                  <div>
                    <b>{{ review.anonymous ? '匿名用户' : review.nickname || '商城用户' }}</b>
                    <small>{{ dateTime(review.createTime) }}</small>
                  </div>
                  <el-rate :model-value="Number(review.rating || 0)" disabled size="small" />
                </div>
                <p class="rv-content">{{ review.content || '该用户未填写评价内容' }}</p>
                <div v-if="review.tags" class="m-row-wrap">
                  <span v-for="tag in splitTags(review.tags)" :key="tag" class="m-tag plain">{{ tag }}</span>
                </div>
                <div v-if="review.reply" class="rv-reply">商家回复：{{ review.reply }}</div>
              </article>
            </div>
            <EmptyBlock
              v-else
              icon="💬"
              title="还没有评价"
              desc="该商品暂未收到消费者评价。购买并确认收货后即可发表评价，评价内容会真实展示。"
            />
          </div>
        </el-tab-pane>

        <el-tab-pane label="溯源信息" name="trace">
          <div class="pane">
            <div v-if="traces.length" class="trace-list">
              <article v-for="t in traces" :key="t.id" class="trace-card">
                <div class="tr-hd">
                  <b>批次 {{ t.batchCode }}</b>
                  <span class="m-tag">产地 {{ t.origin || '—' }}</span>
                </div>
                <div class="tr-grid">
                  <div><span>种植日期</span><b>{{ dateOnly(t.plantingDate) }}</b></div>
                  <div><span>采收日期</span><b>{{ dateOnly(t.harvestDate) }}</b></div>
                  <div><span>加工信息</span><b>{{ t.processingInfo || '—' }}</b></div>
                  <div><span>储运信息</span><b>{{ t.storageInfo || '—' }}</b></div>
                  <div class="full"><span>质检报告</span><b>{{ t.qualityReport || '—' }}</b></div>
                </div>
              </article>
            </div>
            <EmptyBlock
              v-else
              icon="🔍"
              title="该商品暂无溯源批次"
              desc="溯源批次由生产管理模块在采收/加工环节写入。你也可以用溯源码直接查询。"
            >
              <template #actions>
                <button type="button" class="m-btn ghost" @click="$router.push('/trace')">去溯源查询</button>
              </template>
            </EmptyBlock>
            <p class="pane-note">
              溯源数据只读展示；完整种植-采收-加工链路在生产管理模块，可通过
              <a :href="crossModule.production" target="_blank" rel="noopener">生产溯源</a> 查看。
            </p>
          </div>
        </el-tab-pane>
      </el-tabs>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { consumerApi } from '../api'
import { useUserStore } from '../stores/user'
import { useFavorites } from '../composables/useFavorites'
import { crossModule } from '../config/cross-module'
import { dateOnly, dateTime, money, productImage, usableImage } from '../utils/format'
import Countdown from '../components/Countdown.vue'
import EmptyBlock from '../components/EmptyBlock.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const favorites = useFavorites()

const loading = ref(false)
const product = ref(null)
const reviews = ref([])
const summary = ref({ total: 0, average: 0, distribution: [] })
const traces = ref([])
const quantity = ref(1)
const tab = ref('detail')
const activeIndex = ref(0)
const broken = ref(false)

const images = computed(() => {
  const list = product.value?.images
  // 过滤空值，同时过滤掉返回「图片生成中」的演示占位图
  return Array.isArray(list) ? list.map((url) => usableImage(url)).filter(Boolean) : []
})

const activeImage = computed(() => images.value[activeIndex.value] || productImage(product.value))
const inStock = computed(() => Number(product.value?.stock || 0) > 0)

/** 活动价与商品价二选一：有秒杀就用秒杀价结算，原价挪到删除线（后端下单同一规则）。 */
const isFlash = computed(() => product.value?.activityType === 'FLASH' && product.value?.activityPrice != null)
const sellPrice = computed(() => (isFlash.value ? product.value.activityPrice : product.value?.price))
const comparePrice = computed(() => {
  if (!product.value) return null
  if (isFlash.value) return product.value.price
  return Number(product.value.originalPrice) > Number(product.value.price) ? product.value.originalPrice : null
})

/** 可购上限 = 商品库存 ∩ 活动库存 ∩ 每人限购（后端下单时按同一口径判定）。 */
const maxQuantity = computed(() => {
  const stock = Number(product.value?.stock || 1)
  if (!isFlash.value) return Math.max(1, stock)
  const activityStock = Number(product.value.activityRemainStock || stock)
  const limit = Number(product.value.activityLimit || 0)
  const capped = limit > 0 ? Math.min(activityStock, limit) : activityStock
  return Math.max(1, Math.min(stock, capped))
})

const certList = computed(() => {
  const raw = product.value?.certifications
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : [String(raw)]
  } catch {
    return String(raw).split(/[,，、]/).map((s) => s.trim()).filter(Boolean)
  }
})

function selectImage(index) {
  activeIndex.value = index
  broken.value = false
}

function splitTags(tags) {
  if (!tags) return []
  if (Array.isArray(tags)) return tags
  return String(tags).split(/[,，、]/).map((s) => s.trim()).filter(Boolean)
}

function barWidth(row) {
  const total = Number(summary.value.total || 0)
  if (!total) return '0%'
  return `${Math.round((Number(row.count || 0) / total) * 100)}%`
}

async function load() {
  const id = route.params.id
  loading.value = true
  product.value = null
  try {
    product.value = await consumerApi.getProductDetail(id)
    if (product.value?.id) {
      const [rv, sm, tr] = await Promise.all([
        consumerApi.getProductReviews({ productId: id, page: 1, size: 20 }).catch(() => ({ records: [] })),
        consumerApi.getReviewSummary(id).catch(() => ({ total: 0, average: 0, distribution: [] })),
        consumerApi.getTrace(id).catch(() => []),
      ])
      reviews.value = rv?.records || []
      summary.value = sm || { total: 0, average: 0, distribution: [] }
      traces.value = tr || []
      if (userStore.consumerId) {
        consumerApi.addFootprint(userStore.consumerId, id).catch(() => {})
      }
      await favorites.load()
    }
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '商品详情加载失败')
  } finally {
    loading.value = false
  }
}

async function addToCart() {
  if (!userStore.consumerId) {
    ElMessage.warning('请先完成登录')
    return
  }
  try {
    const res = await consumerApi.addCart({
      consumerId: userStore.consumerId,
      productId: product.value.id,
      quantity: quantity.value,
    })
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

async function buyNow() {
  const added = await consumerApi
    .addCart({ consumerId: userStore.consumerId, productId: product.value.id, quantity: quantity.value })
    .catch(() => null)
  if (!added || added.success === false) {
    ElMessage.warning(added?.message || '无法创建订单，请稍后重试')
    return
  }
  await userStore.refreshCart()
  router.push('/order/confirm')
}

watch(() => route.params.id, load)
onMounted(load)
</script>

<style scoped>
.detail {
  display: grid;
  grid-template-columns: 460px minmax(0, 1fr);
  gap: 16px;
  margin-top: 18px;
  align-items: start;
}

.gallery {
  padding: 14px;
}

.main-img {
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
  height: 420px;
  border-radius: 10px;
  background: linear-gradient(135deg, #eef7f1, #e0efe6);
}

.main-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.main-img .ph {
  color: rgba(18, 118, 74, .3);
  font-size: 72px;
}

.img-tag {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 3px 10px;
  border-radius: 6px;
  background: rgba(255, 255, 255, .94);
  color: #12764a;
  font-size: var(--agri-font-size-micro);
  font-weight: 700;
}

.thumbs {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.thumb-btn {
  overflow: hidden;
  width: 58px;
  height: 58px;
  padding: 0;
  border: 1px solid #e3eae5;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
}

.thumb-btn.on {
  border-color: #12764a;
  box-shadow: 0 0 0 2px rgba(18, 118, 74, .12);
}

.thumb-btn img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.buy {
  padding: 22px 24px;
}

.buy-hd h1 {
  margin: 0;
  font-size: 21px;
  font-weight: 800;
  line-height: 1.45;
}

.selling {
  margin: 8px 0 0;
  color: #6b7c72;
  font-size: 13px;
}

.flash-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  color: #d45b32;
  font-size: 12.5px;
}

.price-panel {
  margin: 16px 0;
  padding: 16px 18px;
  border-radius: 12px;
  background: linear-gradient(120deg, #fdf6f1, #fbfdfb);
}

.price-line {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.price-line .label {
  color: #6b7c72;
  font-size: 12.5px;
}

.meta-line {
  display: flex;
  gap: 20px;
  margin-top: 10px;
  color: #6b7c72;
  font-size: 12.5px;
}

.meta-line b {
  color: #0b1a12;
}

.attrs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 20px;
  margin: 0 0 16px;
}

.attrs > div {
  display: flex;
  gap: 10px;
  font-size: 13px;
}

.attrs dt {
  flex: 0 0 56px;
  color: #6b7c72;
}

.attrs dd {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  color: #0b1a12;
  font-weight: 500;
}

.qty-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid #eef3ef;
}

.qty-row .label {
  color: #6b7c72;
  font-size: 13px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding-top: 12px;
}

.actions .m-btn {
  height: 40px;
  padding: 0 22px;
}

.assure {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px dashed #e6ede8;
  color: #6b7c72;
  font-size: 12px;
}

.tabs-card {
  margin-top: 16px;
  padding: 6px 22px 22px;
}

.pane {
  padding: 6px 0;
}

.kv-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 32px;
}

.kv-list > div {
  display: flex;
  gap: 12px;
  padding: 11px 0;
  border-bottom: 1px dashed #eef3ef;
  font-size: 13px;
}

.kv-list span {
  flex: 0 0 92px;
  color: #6b7c72;
}

.kv-list b {
  font-weight: 500;
}

.pane-note {
  margin: 14px 0 0;
  color: #93a29a;
  font-size: 12.5px;
  line-height: 1.8;
}

.pane-note a {
  color: #12764a;
  text-decoration: underline;
}

.review-summary {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: 28px;
  padding: 12px 0 20px;
  border-bottom: 1px solid #eef3ef;
}

.score {
  display: grid;
  justify-items: center;
  gap: 6px;
  padding: 12px;
  border-radius: 12px;
  background: #f8fbf9;
}

.score b {
  color: #d45b32;
  font-size: 30px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.score small {
  color: #6b7c72;
  font-size: 12px;
}

.bars {
  display: grid;
  gap: 8px;
  align-content: center;
}

.bar-row {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) 40px;
  align-items: center;
  gap: 10px;
  color: #6b7c72;
  font-size: 12px;
}

.bar-row .bar {
  overflow: hidden;
  height: 7px;
  border-radius: 4px;
  background: #f1f5f2;
}

.bar-row .bar i {
  display: block;
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, #f0b184, #d45b32);
}

.review-list {
  display: grid;
  gap: 18px;
  padding-top: 18px;
}

.review-item {
  padding-bottom: 16px;
  border-bottom: 1px dashed #eef3ef;
}

.rv-hd {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rv-hd .avatar {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #e4f6ec;
  color: #12764a;
  font-size: 14px;
  font-weight: 700;
}

.rv-hd b {
  display: block;
  font-size: 13px;
}

.rv-hd small {
  color: #93a29a;
  font-size: var(--agri-font-size-micro);
}

.rv-hd .el-rate {
  margin-left: auto;
}

.rv-content {
  margin: 10px 0 8px;
  color: #33453b;
  font-size: 13px;
  line-height: 1.8;
}

.rv-reply {
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  background: #f8fbf9;
  color: #6b7c72;
  font-size: 12.5px;
}

.trace-list {
  display: grid;
  gap: 14px;
}

.trace-card {
  padding: 16px 18px;
  border: 1px solid #e3eae5;
  border-radius: 12px;
  background: #fbfdfc;
}

.tr-hd {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.tr-hd b {
  font-size: 14px;
}

.tr-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 24px;
  font-size: 12.5px;
}

.tr-grid > div {
  display: flex;
  gap: 10px;
}

.tr-grid .full {
  grid-column: 1 / -1;
}

.tr-grid span {
  flex: 0 0 68px;
  color: #6b7c72;
}

.tr-grid b {
  color: #33453b;
  font-weight: 500;
}

@media (max-width: 1080px) {
  .detail { grid-template-columns: minmax(0, 1fr); }
  .main-img { height: 320px; }
  .attrs { grid-template-columns: minmax(0, 1fr); }
  .review-summary { grid-template-columns: minmax(0, 1fr); }
}
</style>

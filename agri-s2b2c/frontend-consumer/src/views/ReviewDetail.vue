<template>
  <div class="m-container" v-loading="loading">
    <!-- 页头 -->
    <div class="m-page-hd">
      <h1>评价详情</h1>
      <span class="sub">评价内容由消费者本人发表，商家回复由供应商在供应商端填写</span>
      <div class="hd-actions">
        <button type="button" class="m-btn sm" @click="router.push('/reviews')">返回评价中心</button>
      </div>
    </div>

    <!-- 未登录：评价归属个人 -->
    <EmptyBlock
      v-if="userStore.booted && !consumerId"
      icon="🔐"
      title="登录后查看评价详情"
      desc="只能查看自己发表的评价，商品评价请在商品详情页查看。当前浏览器没有检测到已登录的统一身份，请从统一门户登录后再进入商城。"
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="router.push('/')">返回首页</button>
      </template>
    </EmptyBlock>

    <div v-else-if="review" class="m-split">
      <section class="m-card m-card-pad">
        <header class="rv-hd">
          <span class="avatar">{{ review.anonymous ? '匿' : (userStore.displayName || '我').slice(0, 1) }}</span>
          <div class="rv-who">
            <b>{{ review.anonymous ? '匿名用户' : userStore.displayName }}</b>
            <span class="muted small num">{{ dateTime(review.createTime) }}</span>
          </div>
          <span v-if="review.anonymous" class="m-tag plain">匿名展示</span>
          <span class="m-spacer" />
          <el-rate :model-value="Number(review.rating || 0)" disabled />
        </header>

        <p class="rv-content">{{ review.content || '这条评价没有填写文字内容。' }}</p>

        <div v-if="tagList.length" class="m-row-wrap">
          <span v-for="tag in tagList" :key="tag" class="m-tag">{{ tag }}</span>
        </div>

        <!-- 评价图片：后端 images 可能是 JSON 数组串或逗号串，统一解析后交给 el-image 预览 -->
        <div v-if="images.length" class="rv-images">
          <el-image
            v-for="(img, index) in images"
            :key="img + index"
            :src="img"
            :preview-src-list="images"
            :initial-index="index"
            fit="cover"
            preview-teleported
            class="rv-img"
          />
        </div>

        <div v-if="review.reply" class="rv-reply">
          <b>商家回复</b>
          <p>{{ review.reply }}</p>
          <span class="muted small num">{{ dateTime(review.replyTime) }}</span>
        </div>

        <p v-else class="muted small reply-empty">商家还没有回复这条评价。</p>

        <div class="rv-ft">
          <span class="muted small num" v-if="review.orderId">来自订单 {{ review.orderId }}</span>
          <span class="m-spacer" />
          <button
            type="button"
            class="m-btn sm"
            :disabled="!review.productId"
            @click="router.push(`/product/${review.productId}`)"
          >
            查看商品
          </button>
          <button type="button" class="m-btn sm primary" @click="router.push('/reviews')">返回评价中心</button>
        </div>
      </section>

      <aside class="m-card m-card-pad side">
        <h4>这条评价的归属</h4>
        <dl class="kv">
          <div>
            <dt>商品</dt>
            <dd>{{ review.productName || '—' }}</dd>
          </div>
          <div>
            <dt>评分</dt>
            <dd class="num">{{ review.rating }} / 5</dd>
          </div>
          <div>
            <dt>发表时间</dt>
            <dd class="num">{{ dateTime(review.createTime) }}</dd>
          </div>
          <div>
            <dt>匿名</dt>
            <dd>{{ review.anonymous ? '是（商品页显示匿名用户）' : '否' }}</dd>
          </div>
        </dl>
        <p class="muted small side-note">
          本端只有「查看」能力：后端没有修改评价、追加图片、点赞/有用计数的接口，
          因此这里不提供编辑按钮，也不展示「有用 / 没用」数字。
        </p>
      </aside>
    </div>

    <EmptyBlock
      v-else-if="userStore.booted && !loading"
      icon="💬"
      title="没有找到这条评价"
      desc="只能查看自己发表的评价，商品评价请在商品详情页查看。该评价可能已被删除，或链接里的评价 ID 不属于当前账号。"
    >
      <template #actions>
        <div class="m-row-wrap">
          <button type="button" class="m-btn primary" @click="router.push('/reviews')">去评价中心</button>
          <button type="button" class="m-btn" @click="router.push('/products')">去逛逛商品</button>
        </div>
      </template>
    </EmptyBlock>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { consumerApi } from '../api'
import { useUserStore } from '../stores/user'
import { dateTime } from '../utils/format'
import EmptyBlock from '../components/EmptyBlock.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const review = ref(null)

const consumerId = computed(() => userStore.consumerId)

function splitTags(tags) {
  if (!tags) return []
  if (Array.isArray(tags)) return tags.filter(Boolean)
  return String(tags)
    .split(/[,，、]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
}

/** images 既可能是 JSON 数组字符串，也可能是逗号分隔串，两种都兼容。 */
function parseImages(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter(Boolean)
  const text = String(raw).trim()
  if (!text) return []
  if (text.startsWith('[')) {
    try {
      const list = JSON.parse(text)
      return Array.isArray(list) ? list.filter(Boolean) : []
    } catch {
      return []
    }
  }
  return text
    .split(/[,，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

const tagList = computed(() => splitTags(review.value?.tags))
const images = computed(() => parseImages(review.value?.images))

/**
 * 查找顺序：先在自己的评价里找（能拿到 orderId 等完整字段）；
 * 找不到且带了 productId 时，再从商品评价列表里找（商品详情页跳转过来的场景）。
 */
async function load() {
  if (!consumerId.value) {
    review.value = null
    return
  }
  const id = route.params.id
  loading.value = true
  review.value = null
  try {
    const mine = (await consumerApi.getMyReviews(consumerId.value).catch(() => [])) || []
    const own = mine.find((row) => String(row.id) === String(id))
    if (own) {
      review.value = own
      return
    }

    const productId = route.query.productId
    if (productId) {
      const page = await consumerApi
        .getProductReviews({ productId, page: 1, size: 50 })
        .catch(() => null)
      const hit = (page?.records || []).find((row) => String(row.id) === String(id))
      if (hit) {
        review.value = hit
        return
      }
    }
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '评价详情加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)

// 统一身份异步换回消费者 ID：拿到后再查评价
watch(
  () => consumerId.value,
  (id) => {
    if (id) load()
  },
)

// 在评价列表里连续切换详情时重新加载
watch(
  () => route.params.id,
  () => load(),
)
</script>

<style scoped>
.m-container {
  width: min(1280px, calc(100% - 48px));
  margin: 18px auto 0;
}

.rv-hd {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 14px;
  border-bottom: 1px solid #eef3ef;
}

.avatar {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #e4f6ec;
  color: #12764a;
  font-size: 15px;
  font-weight: 700;
}

.rv-who {
  display: grid;
  gap: 2px;
}

.rv-who b {
  font-size: 13.5px;
}

.rv-content {
  margin: 16px 0 12px;
  color: #33453b;
  font-size: 14px;
  line-height: 1.9;
  white-space: pre-wrap;
  word-break: break-word;
}

.rv-images {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}

.rv-img {
  width: 104px;
  height: 104px;
  border: 1px solid #e3eae5;
  border-radius: 8px;
  cursor: zoom-in;
}

.rv-reply {
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: 8px;
  background: #f8fbf9;
}

.rv-reply b {
  color: #12764a;
  font-size: 12.5px;
}

.rv-reply p {
  margin: 6px 0 4px;
  color: #4b5d53;
  font-size: 13px;
  line-height: 1.8;
}

.reply-empty {
  margin: 16px 0 0;
}

.rv-ft {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px dashed #eef3ef;
}

.side {
  align-self: start;
}

.side h4 {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 700;
}

.side .kv {
  display: grid;
  gap: 8px;
  margin: 0;
}

.side .kv > div {
  display: flex;
  gap: 10px;
  font-size: 12.5px;
}

.side dt {
  flex: 0 0 66px;
  color: #6b7c72;
}

.side dd {
  margin: 0;
  color: #0b1a12;
  word-break: break-all;
}

.side-note {
  margin: 14px 0 0;
  padding-top: 10px;
  border-top: 1px dashed #eef3ef;
  line-height: 1.8;
}
</style>

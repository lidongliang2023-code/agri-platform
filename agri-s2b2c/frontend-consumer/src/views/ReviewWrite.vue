<template>
  <div class="m-container" v-loading="loading">
    <!-- 页头 -->
    <div class="m-page-hd">
      <h1>发表评价</h1>
      <span class="sub">评价提交后不可修改；匿名评价不会在商品详情页展示你的昵称</span>
      <div class="hd-actions">
        <button type="button" class="m-btn sm" @click="router.push('/reviews')">评价中心 ›</button>
      </div>
    </div>

    <!-- 参数缺失 -->
    <EmptyBlock
      v-if="!orderId || !productId"
      icon="✍️"
      title="缺少订单或商品参数"
      desc="评价需要从「评价中心 → 待评价」进入，页面会带上订单号与商品 ID。手动打开本页时参数不完整，无法定位到具体商品。"
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="router.push('/reviews')">去评价中心</button>
      </template>
    </EmptyBlock>

    <!-- 未登录 -->
    <EmptyBlock
      v-else-if="userStore.booted && !consumerId"
      icon="🔐"
      title="登录后发表评价"
      desc="评价挂在消费者账号下，且必须来自本人的订单。当前浏览器没有检测到已登录的统一身份，请从统一门户登录后再进入商城。"
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="router.push('/')">返回首页</button>
      </template>
    </EmptyBlock>

    <!-- 订单/商品校验失败 -->
    <EmptyBlock
      v-else-if="blocked"
      icon="🚫"
      :title="blocked.title"
      :desc="blocked.desc"
    >
      <template #actions>
        <div class="m-row-wrap">
          <button type="button" class="m-btn primary" @click="router.push('/reviews')">去评价中心</button>
          <button v-if="blocked.reviewId" type="button" class="m-btn" @click="router.push(`/review/${blocked.reviewId}`)">
            查看已发表评价
          </button>
        </div>
      </template>
    </EmptyBlock>

    <!-- 评价表单 -->
    <div v-else-if="item" class="m-split">
      <section class="m-card m-card-pad">
        <!-- 商品信息（来自订单明细，不额外请求商品接口） -->
        <div class="target">
          <div class="thumb">
            <img v-if="item.image && !broken" :src="item.image" :alt="item.name" @error="broken = true" />
            <span v-else class="ph">🌿</span>
          </div>
          <div class="target-info">
            <b>{{ item.name }}</b>
            <span class="muted small">
              {{ item.spec || '规格以商品详情为准' }} · 数量 {{ item.quantity }}
            </span>
            <span class="muted small num">订单 {{ order?.orderNo || order?.id }} · {{ dateTime(order?.createTime) }}</span>
          </div>
        </div>

        <div class="form-body">
          <!-- 评分 -->
          <div class="m-field">
            <label>商品评分 <span class="req">*</span></label>
            <div class="m-row">
              <el-rate v-model="form.rating" :texts="RATE_TEXTS" show-text />
              <span class="muted small">必选 1-5 星</span>
            </div>
            <span v-if="errors.rating" class="err">{{ errors.rating }}</span>
          </div>

          <!-- 内容 -->
          <div class="m-field">
            <label for="rv-content">评价内容 <span class="req">*</span></label>
            <el-input
              id="rv-content"
              v-model="form.content"
              type="textarea"
              :rows="5"
              maxlength="500"
              resize="vertical"
              placeholder="说说收到货的口感、新鲜度、包装与物流情况（2-500 字）"
            />
            <div class="m-row">
              <span v-if="errors.content" class="err">{{ errors.content }}</span>
              <span v-else class="hint">至少 2 个字，最多 500 个字</span>
              <span class="m-spacer" />
              <span class="muted small num">{{ form.content.length }} / 500</span>
            </div>
          </div>

          <!-- 标签 -->
          <div class="m-field">
            <label>印象标签</label>
            <div class="m-row-wrap">
              <button
                v-for="tag in TAG_OPTIONS"
                :key="tag"
                type="button"
                class="pill"
                :class="{ on: form.tags.includes(tag) }"
                @click="toggleTag(tag)"
              >
                {{ tag }}
              </button>
            </div>
            <span class="hint">可多选，也可以不选；选中后会随评价一起展示</span>
          </div>

          <!-- 匿名 -->
          <div class="m-field">
            <label>匿名评价</label>
            <div class="m-row">
              <el-switch v-model="form.anonymous" />
              <span class="muted small">开启后商品详情页显示「匿名用户」，不影响你自己在评价中心查看</span>
            </div>
          </div>
        </div>

        <div class="form-ft">
          <button type="button" class="m-btn" :disabled="submitting" @click="router.push('/reviews')">取消</button>
          <button type="button" class="m-btn primary" :disabled="submitting" @click="submit">
            {{ submitting ? '提交中…' : '提交评价' }}
          </button>
        </div>
      </section>

      <!-- 右侧说明 -->
      <aside class="m-card m-card-pad side">
        <h4>评价须知</h4>
        <ul>
          <li>只有「已完成」订单里的商品可以评价，同一订单同一商品只能评价一次。</li>
          <li>评价内容会真实展示在商品详情页，请勿填写与商品无关的信息。</li>
          <li>匿名只隐藏昵称，评价本身与评分仍然计入商品统计。</li>
          <li>本端没有「图片上传」与「修改评价」接口，评价提交后不可编辑。</li>
        </ul>
        <p class="muted small side-note">
          评价提交后会回读「我的评价」列表确认记录已生成，未查到时不会提示成功。
        </p>
      </aside>
    </div>

    <EmptyBlock
      v-else-if="userStore.booted && !loading"
      icon="📦"
      title="没有找到该订单商品"
      desc="该订单可能已被删除，或商品不在订单明细中。请返回评价中心重新选择待评价商品。"
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="router.push('/reviews')">去评价中心</button>
      </template>
    </EmptyBlock>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { consumerApi } from '../api'
import { useUserStore } from '../stores/user'
import { dateTime } from '../utils/format'
import EmptyBlock from '../components/EmptyBlock.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const RATE_TEXTS = ['很差', '较差', '一般', '满意', '非常满意']
/** 标签选项为产品定义的固定枚举（后端 tags 是 VARCHAR 逗号串，不限制取值）。 */
const TAG_OPTIONS = ['基地直供', '新鲜', '口感好', '包装严实', '物流快', '值得回购', '溯源可查', '性价比高']

const loading = ref(false)
const submitting = ref(false)
const broken = ref(false)
const order = ref(null)
const item = ref(null)
const blocked = ref(null)

const form = reactive({ rating: 0, content: '', tags: [], anonymous: false })
const errors = reactive({ rating: '', content: '' })

const consumerId = computed(() => userStore.consumerId)
const orderId = computed(() => route.query.orderId || '')
const productId = computed(() => route.query.productId || '')

function toggleTag(tag) {
  const index = form.tags.indexOf(tag)
  if (index >= 0) form.tags.splice(index, 1)
  else form.tags.push(tag)
}

function validate() {
  errors.rating = ''
  errors.content = ''
  if (!form.rating) errors.rating = '请先选择评分'
  const content = form.content.trim()
  if (content.length < 2) errors.content = '评价内容至少 2 个字'
  else if (content.length > 500) errors.content = '评价内容最多 500 个字'
  return !errors.rating && !errors.content
}

/**
 * 加载订单并校验：
 * 1) 订单归属当前消费者（后端也会校验，前端提前拦一次给出明确提示）；
 * 2) 订单明细里能找到该商品；
 * 3) 该订单商品没有评价过（后端有唯一键，提前提示可以避免一次必然失败的提交）。
 */
async function load() {
  if (!orderId.value || !productId.value || !consumerId.value) return
  loading.value = true
  blocked.value = null
  try {
    const detail = await consumerApi.getOrderDetail(orderId.value)
    if (!detail) {
      blocked.value = { title: '订单不存在', desc: '该订单可能已被删除，或链接里的订单号有误。' }
      return
    }
    if (detail.consumerId && String(detail.consumerId) !== String(consumerId.value)) {
      blocked.value = { title: '订单不属于当前账号', desc: '只能评价自己账号下的订单商品，请从评价中心的待评价列表进入。' }
      return
    }
    order.value = detail

    const target = (detail.items || []).find((row) => String(row.productId) === String(productId.value))
    if (!target) {
      blocked.value = { title: '订单里没有该商品', desc: '订单明细中找不到这件商品，可能参数有误，请从评价中心重新进入。' }
      return
    }

    const reviews = (await consumerApi.getMyReviews(consumerId.value).catch(() => [])) || []
    const existed = reviews.find(
      (row) => String(row.orderId) === String(orderId.value) && String(row.productId) === String(productId.value),
    )
    if (existed) {
      blocked.value = {
        title: '该订单商品已评价',
        desc: '同一订单同一商品只能评价一次。可以到「已评价」里查看这条评价。',
        reviewId: existed.id,
      }
      return
    }

    item.value = target
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '订单信息加载失败')
    item.value = null
  } finally {
    loading.value = false
  }
}

/** 提交：成功后回读「我的评价」确认记录出现，再跳评价中心。 */
async function submit() {
  if (submitting.value) return
  if (!validate()) {
    ElMessage.warning(errors.rating || errors.content)
    return
  }

  submitting.value = true
  try {
    const payload = {
      consumerId: consumerId.value,
      orderId: orderId.value,
      orderItemId: route.query.orderItemId || item.value?.id || null,
      productId: productId.value,
      rating: form.rating,
      content: form.content.trim(),
      // 后端 tags 支持数组或逗号串，这里统一传逗号串，与库里的存储格式一致
      tags: form.tags.join(','),
      anonymous: Boolean(form.anonymous),
    }
    const res = await consumerApi.createReview(payload)
    if (res?.success === false) {
      ElMessage.error(res.message || '评价提交失败')
      return
    }

    const reviews = (await consumerApi.getMyReviews(consumerId.value).catch(() => null)) || []
    const created = reviews.find(
      (row) =>
        String(row.orderId) === String(orderId.value) && String(row.productId) === String(productId.value),
    )
    if (!created) {
      ElMessage.error('评价未查到，请稍后在评价中心确认是否提交成功')
      return
    }

    ElMessage.success('评价已提交')
    router.push('/reviews')
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '评价提交失败')
  } finally {
    submitting.value = false
  }
}

onMounted(load)

// 统一身份异步换回消费者 ID 后再校验订单归属
watch(
  () => consumerId.value,
  (id) => {
    if (id) load()
  },
)

// 从评价中心切换到另一件商品时重新加载
watch(
  () => [route.query.orderId, route.query.productId],
  () => {
    form.rating = 0
    form.content = ''
    form.tags = []
    form.anonymous = false
    item.value = null
    load()
  },
)
</script>

<style scoped>
.m-container {
  width: min(1280px, calc(100% - 48px));
  margin: 18px auto 0;
}

.req {
  color: #c94b4b;
}

.err {
  color: #c94b4b;
  font-size: 12px;
}

.target {
  display: flex;
  gap: 14px;
  padding-bottom: 16px;
  border-bottom: 1px solid #eef3ef;
}

.thumb {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  overflow: hidden;
  width: 76px;
  height: 76px;
  border-radius: 10px;
  background: linear-gradient(135deg, #eef7f1, #e2f0e7);
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb .ph {
  color: rgba(18, 118, 74, .3);
  font-size: 26px;
}

.target-info {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.target-info b {
  font-size: 15px;
  font-weight: 700;
}

.form-body {
  display: grid;
  gap: 18px;
  padding: 18px 0 4px;
}

.pill {
  height: 30px;
  padding: 0 14px;
  border: 1px solid #e3eae5;
  border-radius: 15px;
  background: #fff;
  color: #4b5d53;
  font-size: 12.5px;
  cursor: pointer;
  transition: border-color .15s, background .15s, color .15s;
}

.pill:hover {
  border-color: #159a5e;
  color: #12764a;
}

.pill.on {
  border-color: #12764a;
  background: #f1fbf5;
  color: #12764a;
  font-weight: 600;
}

.form-ft {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 16px;
  border-top: 1px solid #eef3ef;
}

.form-ft .m-btn {
  height: 38px;
  padding: 0 26px;
}

.side {
  align-self: start;
}

.side h4 {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 700;
}

.side ul {
  display: grid;
  gap: 7px;
  margin: 0;
  padding-left: 18px;
  color: #4b5d53;
  font-size: 12.5px;
  line-height: 1.8;
}

.side-note {
  margin: 12px 0 0;
  padding-top: 10px;
  border-top: 1px dashed #eef3ef;
  line-height: 1.8;
}
</style>

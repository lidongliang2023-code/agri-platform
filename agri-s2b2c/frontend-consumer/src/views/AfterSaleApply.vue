<template>
  <div class="m-container" style="margin-top: 18px" v-loading="loading">
    <!-- 页头 -->
    <div class="m-page-hd">
      <h1>申请售后</h1>
      <span class="sub">提交后由平台运营审核，审核结果可在售后详情查看</span>
      <div class="hd-actions">
        <button type="button" class="m-btn sm" @click="backToOrder">返回订单</button>
      </div>
    </div>

    <!-- 缺少订单号 -->
    <EmptyBlock
      v-if="!orderId"
      icon="📄"
      title="缺少订单号，无法申请售后"
      desc="售后必须关联到具体订单。请从「我的订单」或订单详情页点击「申请售后」进入本页。"
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="router.push('/orders')">去我的订单</button>
      </template>
    </EmptyBlock>

    <!-- 订单不存在 / 未登录 -->
    <EmptyBlock
      v-else-if="userStore.booted && !loading && !order"
      icon="🧾"
      :title="notLoggedIn ? '登录后申请售后' : '订单不存在或无权查看'"
      :desc="
        notLoggedIn
          ? '售后申请需要消费者身份。当前浏览器未检测到已登录的统一身份，请从统一门户登录后再进入商城。'
          : '该订单可能已被删除，或不属于当前登录的消费者账号。可到订单列表重新选择要售后的订单。'
      "
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="router.push('/orders')">去我的订单</button>
      </template>
    </EmptyBlock>

    <!-- 订单状态不允许售后 -->
    <section v-else-if="order && !canApply" class="m-card m-card-pad notice">
      <h2 class="notice-title">当前订单暂不能申请售后</h2>
      <p class="muted">
        订单状态为「{{ orderStatusText(order.status, order.statusText) }}」。只有已付款（待发货、已发货、待收货、已完成）的订单可以申请售后，
        未支付或已取消的订单没有产生实际扣款。
      </p>
      <div class="m-row-wrap">
        <button type="button" class="m-btn primary" @click="backToOrder">返回订单详情</button>
        <button type="button" class="m-btn" @click="router.push('/orders')">我的订单</button>
      </div>
    </section>

    <template v-else-if="order">
      <!-- 订单摘要 -->
      <section class="m-card">
        <div class="m-card-hd">
          <h3>订单摘要</h3>
          <span class="muted small num">{{ order.orderNo || `#${order.id}` }}</span>
          <div class="hd-actions">
            <span class="m-tag" :class="orderStatusClass">{{ orderStatusText(order.status, order.statusText) }}</span>
          </div>
        </div>
        <div class="m-card-pad">
          <div v-for="item in order.items || []" :key="item.id" class="sum-row">
            <div class="thumb">
              <img
                v-if="usableImage(item.image) && !isBroken(item)"
                :src="usableImage(item.image)"
                :alt="item.name"
                @error="markBroken(item)"
              />
              <span v-else class="ph">🌿</span>
            </div>
            <div class="sum-info">
              <div class="sum-name" :title="item.name">{{ item.name }}</div>
              <span class="muted small">{{ item.spec || '规格以商品详情为准' }}</span>
            </div>
            <span class="muted small num">¥{{ money(item.price) }} × {{ item.quantity }}</span>
            <span class="sum-amount num">¥{{ money(item.totalAmount) }}</span>
          </div>
          <p v-if="!(order.items || []).length" class="muted small">该订单没有返回商品明细，售后金额请按实付金额填写。</p>

          <div class="sum-foot">
            <span class="muted small">共 <b class="num">{{ totalQuantity }}</b> 件</span>
            <span class="m-spacer" />
            <span class="muted small">实付</span>
            <span class="price"><span class="cur">¥</span>{{ money(order.payAmount) }}</span>
          </div>
        </div>
      </section>

      <!-- 售后表单 -->
      <section class="m-card form-card">
        <div class="m-card-hd">
          <h3>售后信息</h3>
          <span class="muted small">带 * 的为必填</span>
        </div>
        <div class="m-card-pad">
          <div class="m-form-grid">
            <div class="m-field full">
              <label>售后类型 *</label>
              <el-radio-group v-model="form.type">
                <el-radio-button v-for="option in TYPE_OPTIONS" :key="option.value" :value="option.value">
                  {{ option.label }}
                </el-radio-button>
              </el-radio-group>
              <span class="hint">{{ typeHint }}</span>
            </div>

            <div class="m-field">
              <label>售后原因 *</label>
              <el-select v-model="form.reason" placeholder="请选择售后原因" style="width: 100%">
                <el-option v-for="reason in REASONS" :key="reason" :label="reason" :value="reason" />
              </el-select>
            </div>

            <div class="m-field">
              <label>退款金额 *</label>
              <el-input-number
                v-model="form.amount"
                :min="0.01"
                :max="maxAmount"
                :precision="2"
                :step="1"
                controls-position="right"
                style="width: 100%"
              />
              <span class="hint">默认按本单实付金额填入，最多可退 ¥{{ money(maxAmount) }}</span>
            </div>

            <div class="m-field full">
              <label>问题描述</label>
              <el-input
                v-model="form.description"
                type="textarea"
                :rows="4"
                maxlength="200"
                show-word-limit
                placeholder="可补充破损位置、少件明细、批次信息等，便于平台审核"
              />
              <span class="hint">
                当前售后接口只保存售后类型、原因与金额，问题描述不会落库；关键信息请写进原因，或提交后联系客服补充。
              </span>
            </div>
          </div>

          <div class="form-foot">
            <button type="button" class="m-btn" @click="backToOrder">返回订单详情</button>
            <span class="m-spacer" />
            <span class="muted small">提交后由平台运营审核，通常在 24 小时内响应</span>
            <button type="button" class="m-btn primary" :disabled="submitting" @click="submit">
              {{ submitting ? '提交中…' : '提交申请' }}
            </button>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { consumerApi } from '../api'
import { useUserStore } from '../stores/user'
import { money, orderStatusText, usableImage } from '../utils/format'
import EmptyBlock from '../components/EmptyBlock.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const TYPE_OPTIONS = [
  { value: 'REFUND', label: '仅退款', hint: '仅退款：不寄回商品，适合未收到货或商品存在问题的情况。' },
  { value: 'RETURN', label: '退货退款', hint: '退货退款：需先联系客服确认寄回地址，再把商品寄回。' },
  { value: 'EXCHANGE', label: '换货', hint: '换货：需先联系客服确认寄回与重新发货的安排。' },
]
const REASONS = ['商品破损', '商品与描述不符', '少件/漏发', '临期/变质', '不喜欢/不想要', '其他原因']

const loading = ref(false)
const submitting = ref(false)
const order = ref(null)
const brokenIds = ref(new Set())
const form = reactive({
  type: 'REFUND',
  reason: '',
  amount: 0.01,
  description: '',
})

const orderId = computed(() => route.query.orderId || '')
const notLoggedIn = computed(() => userStore.booted && !userStore.consumerId)
const totalQuantity = computed(() =>
  (order.value?.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0),
)
const maxAmount = computed(() => Number(order.value?.payAmount || 0))
const canApply = computed(() =>
  ['PENDING_SHIP', 'SHIPPED', 'PENDING_RECEIVE', 'COMPLETED'].includes(order.value?.status),
)
const typeHint = computed(
  () => TYPE_OPTIONS.find((option) => option.value === form.type)?.hint || '',
)
const orderStatusClass = computed(() => {
  const value = order.value?.status
  if (value === 'PENDING_PAY') return 'amber'
  if (value === 'SHIPPED' || value === 'PENDING_RECEIVE') return 'blue'
  if (value === 'CANCELLED') return 'plain'
  if (value === 'REFUNDING' || value === 'REFUNDED') return 'red'
  return ''
})

function isBroken(item) {
  return brokenIds.value.has(String(item.id))
}

function markBroken(item) {
  brokenIds.value = new Set([...brokenIds.value, String(item.id)])
}

function backToOrder() {
  if (orderId.value) router.push(`/order/${orderId.value}`)
  else router.push('/orders')
}

async function load() {
  if (!userStore.consumerId || !orderId.value) return
  loading.value = true
  try {
    order.value = await consumerApi.getOrderDetail(orderId.value)
    // 退款金额默认填本单实付，且不超过实付上限
    const limit = Number(order.value?.payAmount || 0)
    form.amount = limit > 0 ? limit : 0.01
  } catch (err) {
    order.value = null
    ElMessage.error(err.friendlyMessage || '订单加载失败')
  } finally {
    loading.value = false
  }
}

function validate() {
  if (!form.type) {
    ElMessage.warning('请选择售后类型')
    return false
  }
  if (!form.reason) {
    ElMessage.warning('请选择售后原因')
    return false
  }
  const amount = Number(form.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    ElMessage.warning('退款金额需大于 0')
    return false
  }
  if (amount > maxAmount.value) {
    ElMessage.warning('退款金额不能超过本单实付金额')
    return false
  }
  return true
}

/** 提交后回读售后列表：只有真的查到新记录才跳转，回读不到就如实说明可能未落库。 */
async function submit() {
  if (!validate() || !userStore.consumerId || !order.value) return
  submitting.value = true
  try {
    const before = (await consumerApi.getAfterSales(userStore.consumerId).catch(() => [])) || []
    const beforeIds = new Set(before.map((record) => String(record.id)))

    const payload = {
      consumerId: userStore.consumerId,
      orderId: Number(order.value.id),
      type: form.type,
      reason: form.reason,
      amount: Number(Number(form.amount).toFixed(2)),
    }
    const res = await consumerApi.createAfterSale(payload)
    if (res?.success === false) {
      ElMessage.error(res.message || '售后申请提交失败')
      return
    }

    const after = await consumerApi.getAfterSales(userStore.consumerId).catch(() => null)
    if (!after) {
      ElMessage.error('售后列表回读失败，请在订单详情的售后记录中确认是否已提交')
      return
    }
    const created = after.find(
      (record) => String(record.orderId) === String(order.value.id) && !beforeIds.has(String(record.id)),
    )
    if (!created) {
      ElMessage.error('申请可能未落库，请稍后在订单详情的售后记录中核实，或联系客服')
      return
    }
    ElMessage.success('售后申请已提交')
    router.replace(`/aftersale/${created.id}`)
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '售后申请提交失败')
  } finally {
    submitting.value = false
  }
}

// consumerId 异步换回后再查订单，避免直接进入本页时误判「未登录」
watch(
  () => [userStore.consumerId, orderId.value],
  ([id]) => {
    if (id) load()
  },
  { immediate: true },
)
</script>

<style scoped>
.m-container {
  width: min(1280px, calc(100% - 48px));
  margin-left: auto;
  margin-right: auto;
}

.notice {
  display: grid;
  gap: 12px;
}

.notice-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}

.sum-row {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) 150px 100px;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px dashed #eef3ef;
}

.sum-row + .sum-row {
  padding-top: 12px;
}

.thumb {
  display: grid;
  place-items: center;
  overflow: hidden;
  width: 56px;
  height: 56px;
  border-radius: 8px;
  background: linear-gradient(135deg, #eef7f1, #e2f0e7);
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb .ph {
  color: rgba(18, 118, 74, .3);
  font-size: 20px;
}

.sum-info {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.sum-name {
  overflow: hidden;
  font-size: 13.5px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.sum-row .num {
  text-align: right;
}

.sum-amount {
  color: #0b1a12;
  font-size: 13.5px;
  font-weight: 600;
  text-align: right;
}

.sum-foot {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid #eef3ef;
}

.form-card {
  margin-top: 16px;
}

.form-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px dashed #eef3ef;
}

@media (max-width: 960px) {
  .sum-row { grid-template-columns: 56px minmax(0, 1fr) 90px; }
  .sum-row .num:not(.sum-amount) { display: none; }
}
</style>

<template>
  <div class="m-container" v-loading="loading">
    <!-- 顶部 -->
    <div class="m-page-hd lead">
      <h1>确认订单</h1>
      <span class="sub">{{ items.length }} 种商品 · 共 {{ totalQuantity }} 件</span>
      <div class="hd-actions">
        <button type="button" class="m-btn sm" @click="router.push('/cart')">‹ 返回购物车</button>
      </div>
    </div>

    <!-- 拼团订单提示 -->
    <div v-if="isGroupOrder" class="group-banner">
      <span class="gb-ic">👥</span>
      <div>
        <b>{{ isLeader ? '正在发起拼团' : '正在参团' }} · {{ groupActivity?.name || '拼团活动' }}</b>
        <p class="muted small">
          {{ isLeader ? '团长价' : '拼团价' }}
          <b class="gb-price">¥{{ groupUnit == null ? '—' : money(groupUnit) }}</b>/件；
          下单即按团价扣款，满 {{ groupActivity?.groupSize || '—' }} 人成团；
          未成团的退款由平台运营端处理，本页不做退款动作。
        </p>
      </div>
    </div>

    <!-- 未登录 -->
    <EmptyBlock
      v-if="userStore.booted && !userStore.consumerId"
      icon="🔐"
      title="登录后才能下单"
      desc="订单与收货地址都绑定消费者账号。当前浏览器未检测到已登录的统一身份，请从统一门户登录后再进入商城。"
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="router.push('/')">返回首页</button>
      </template>
    </EmptyBlock>

    <template v-else>
      <!-- 没有勾选商品 -->
      <EmptyBlock
        v-if="!loading && userStore.booted && !items.length"
        icon="🧾"
        title="没有待结算的商品"
        desc="订单只按购物车中已勾选的行生成，当前没有勾选商品，因此无法提交订单。请先回购物车勾选要购买的商品。"
      >
        <template #actions>
          <button type="button" class="m-btn primary" @click="router.push('/cart')">去购物车</button>
        </template>
      </EmptyBlock>

      <div v-else-if="loading || items.length" class="m-split">
        <div class="m-stack">
          <!-- 收货地址 -->
          <div class="m-card">
            <div class="m-card-hd">
              <h3>收货地址</h3>
              <div class="hd-actions">
                <button type="button" class="m-btn sm" @click="openAddressDialog">修改</button>
              </div>
            </div>
            <div class="m-card-pad">
              <div v-if="address" class="addr">
                <div class="m-row-wrap">
                  <b class="addr-name">{{ address.name }}</b>
                  <span class="muted num">{{ address.phone }}</span>
                  <span v-if="address.isDefault" class="m-tag">默认地址</span>
                </div>
                <p class="addr-detail">
                  {{ [address.province, address.city, address.district, address.address].filter(Boolean).join('') }}
                </p>
              </div>
              <EmptyBlock
                v-else
                icon="📍"
                title="还没有收货地址"
                desc="收货地址由你在账户中心维护。没有地址无法生成订单，请先新增一条收货地址。"
              >
                <template #actions>
                  <button type="button" class="m-btn primary" @click="router.push('/address/new?from=confirm')">
                    新增地址
                  </button>
                </template>
              </EmptyBlock>
            </div>
          </div>

          <!-- 商品清单 -->
          <div class="m-card">
            <div class="m-card-hd">
              <h3>商品清单</h3>
              <span class="muted small">按提交时的购物车勾选生成，可能按供应商/渠道拆单</span>
            </div>
            <div class="goods">
              <div v-for="item in items" :key="item.id" class="goods-row">
                <div class="thumb">
                  <img
                    v-if="item.image && !brokenImages.has(String(item.id))"
                    :src="item.image"
                    :alt="item.name"
                    @error="markBroken(item)"
                  />
                  <span v-else class="ph">🌿</span>
                </div>
                <div class="goods-info">
                  <div class="goods-name">{{ item.name }}</div>
                  <div class="m-row-wrap">
                    <span class="muted small">{{ item.spec || '规格以商品详情为准' }}</span>
                    <span v-if="isGroupOrder" class="m-tag amber">拼团价</span>
                    <span v-else-if="item.activityType === 'FLASH'" class="m-tag red">秒杀价</span>
                  </div>
                </div>
                <div class="goods-price muted num">
                  ¥{{ money(linePrice(item)) }} × {{ item.quantity }}
                  <span
                    v-if="isGroupOrder ? Number(item.price) > Number(linePrice(item)) : item.activityPrice"
                    class="cost"
                  >原价 ¥{{ money(item.price) }}</span>
                </div>
                <div class="goods-sub price sm"><span class="cur">¥</span>{{ money(lineTotal(item)) }}</div>
              </div>
            </div>
          </div>

          <!-- 配送方式与备注 -->
          <div class="m-card m-card-pad form">
            <div class="m-field">
              <label>配送方式</label>
              <el-radio-group v-model="deliveryType">
                <el-radio-button value="EXPRESS">快递配送</el-radio-button>
                <el-radio-button value="SAME_DAY">同城冷链</el-radio-button>
              </el-radio-group>
              <span class="hint">
                仅作为订单提交字段；运费规则与时效由平台履约端计算，本页不做预估。
              </span>
            </div>

            <div class="m-field">
              <label>订单备注</label>
              <el-input
                v-model="remark"
                type="textarea"
                :rows="3"
                maxlength="200"
                show-word-limit
                placeholder="选填：口味偏好、送货时间等（200 字以内）"
              />
            </div>
          </div>
        </div>

        <!-- 金额汇总 -->
        <aside class="m-card m-card-pad summary">
          <h3 class="sum-title">金额明细</h3>

          <div class="m-field">
            <label>优惠券</label>
            <el-select v-model="couponId" placeholder="不使用优惠券" clearable class="coupon-select">
              <el-option label="不使用优惠券" value="" />
              <el-option
                v-for="coupon in usableCoupons"
                :key="coupon.id"
                :label="`${coupon.name}（${couponCondition(coupon)}，${couponValue(coupon)}）`"
                :value="coupon.id"
              />
            </el-select>
            <span v-if="couponError" class="hint">优惠券读取失败，本次按不使用优惠券结算。</span>
            <span v-else-if="!usableCoupons.length" class="hint">
              暂无可用优惠券：需为未使用状态，且商品合计达到券的使用门槛。
            </span>
          </div>

          <dl class="sum-list">
            <div><dt>商品合计</dt><dd class="num">¥{{ money(goodsTotal) }}</dd></div>
            <div><dt>优惠</dt><dd class="num discount">-¥{{ money(discountAmount) }}</dd></div>
            <div><dt>运费</dt><dd class="num">¥0.00</dd></div>
          </dl>
          <p class="muted small freight-hint">运费由平台规则计算，当前为 0.00，提交后以订单实际金额为准。</p>

          <div class="sum-total">
            <span class="muted small">应付</span>
            <span class="price lg"><span class="cur">¥</span>{{ money(payable) }}</span>
          </div>

          <button
            type="button"
            class="m-btn primary block submit"
            :disabled="submitDisabled"
            @click="submitOrder"
          >
            {{ submitting ? '提交中…' : '提交订单' }}
          </button>
          <p v-if="submitReason" class="muted small reason">{{ submitReason }}</p>
        </aside>
      </div>
    </template>

    <!-- 地址选择 -->
    <el-dialog v-model="addressDialog" title="选择收货地址" width="560px">
      <div v-if="addressList.length" class="addr-list">
        <div
          v-for="item in addressList"
          :key="item.id"
          class="addr-option"
          :class="{ on: String(item.id) === String(dialogAddressId) }"
          @click="dialogAddressId = item.id"
        >
          <el-radio v-model="dialogAddressId" :value="item.id">
            <span class="opt-name">{{ item.name }}</span>
            <span class="muted num">{{ item.phone }}</span>
            <span v-if="item.isDefault" class="m-tag">默认</span>
          </el-radio>
          <p class="opt-detail">
            {{ [item.province, item.city, item.district, item.address].filter(Boolean).join('') }}
          </p>
        </div>
      </div>
      <EmptyBlock
        v-else
        icon="📍"
        title="暂无收货地址"
        desc="收货地址由你在账户中心维护，新增后可在这里选择。"
      />

      <template #footer>
        <button type="button" class="m-btn" @click="router.push('/address/new?from=confirm')">新增地址</button>
        <button type="button" class="m-btn primary" :disabled="!dialogAddressId || savingAddress" @click="confirmAddress">
          确定
        </button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { consumerApi } from '../api'
import { useUserStore } from '../stores/user'
import { couponCondition, couponValue, money } from '../utils/format'
import EmptyBlock from '../components/EmptyBlock.vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

// 拼团下单：从拼团详情页带 groupBuyId / groupInstanceId 过来，团价由后端复核
const groupBuyId = ref(route.query.groupBuyId || '')
const groupInstanceId = ref(route.query.groupInstanceId || '')
const groupActivity = ref(null)
const isGroupOrder = computed(() => Boolean(groupBuyId.value))
const isLeader = computed(() => isGroupOrder.value && !groupInstanceId.value)
/** 展示用团价：团长按团长价、团员按团价；后端下单时会再算一次并覆盖。 */
const groupUnit = computed(() => {
  if (!isGroupOrder.value || !groupActivity.value) return null
  const leader = Number(groupActivity.value.leaderPrice)
  return isLeader.value ? (leader > 0 ? leader : groupActivity.value.groupPrice) : groupActivity.value.groupPrice
})

const loading = ref(false)
const submitting = ref(false)
const savingAddress = ref(false)

const addressList = ref([])
const selectedAddressId = ref(null)
const items = ref([])
const coupons = ref([])
const couponError = ref(false)
const couponId = ref('')

const remark = ref('')
const deliveryType = ref('EXPRESS')

const addressDialog = ref(false)
const dialogAddressId = ref(null)
const brokenImages = ref(new Set())

const address = computed(
  () => addressList.value.find((item) => String(item.id) === String(selectedAddressId.value)) || null,
)

const totalQuantity = computed(() =>
  items.value.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
)

const goodsTotal = computed(() =>
  round2(items.value.reduce((sum, item) => sum + Number(linePrice(item)) * Number(item.quantity || 0), 0)),
)

/**
 * 券优惠口径（后端 /consumer/coupons 下发 amount / type / discountRate / minAmount / 有效期）：
 * 1) type=DISCOUNT、discountRate 有值（9.5 表示 9.5 折，即支付 95%）→ 合计 × (1 - 9.5/10)；
 * 2) 其余按固定金额券，直接抵扣 amount（不超过商品合计）；
 * 3) 优惠为 0 的券不参与可选，最终金额仍以后端重算为准。
 */
function couponDiscount(coupon) {
  const total = goodsTotal.value
  if (String(coupon?.type || '').toUpperCase() === 'DISCOUNT' && coupon?.discountRate != null) {
    const rate = Number(coupon.discountRate)
    if (!Number.isFinite(rate) || rate <= 0 || rate >= 10) return 0
    return Math.min(total, Math.max(0, round2(total * (1 - rate / 10))))
  }
  const amount = Number(coupon?.amount)
  if (coupon?.amount != null && !Number.isNaN(amount) && amount > 0) {
    return Math.min(total, round2(amount))
  }
  return 0
}

const usableCoupons = computed(() => {
  const today = new Date().toISOString().slice(0, 10)
  return coupons.value.filter((coupon) => {
    if (String(coupon.status || '').toUpperCase() !== 'UNUSED') return false
    if (coupon.validStart && today < String(coupon.validStart).slice(0, 10)) return false
    if (coupon.validEnd && today > String(coupon.validEnd).slice(0, 10)) return false
    if (Number(coupon.minAmount || 0) > goodsTotal.value) return false
    return couponDiscount(coupon) > 0
  })
})

const discountAmount = computed(() => {
  const coupon = usableCoupons.value.find((item) => String(item.id) === String(couponId.value))
  return coupon ? couponDiscount(coupon) : 0
})

const payable = computed(() => Math.max(0, round2(goodsTotal.value - discountAmount.value)))

const submitDisabled = computed(() => !address.value || !items.value.length || submitting.value)

const submitReason = computed(() => {
  if (!items.value.length) return '购物车没有勾选商品，无法提交订单'
  if (!address.value) return '请先选择收货地址'
  return ''
})

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

/** 结算单价：拼团订单取团价，其余与后端下单取价一致（秒杀进行中取活动价）。 */
function linePrice(item) {
  if (isGroupOrder.value && groupUnit.value != null) return groupUnit.value
  return item?.activityPrice ?? item?.price ?? 0
}

function lineTotal(item) {
  return round2(Number(linePrice(item)) * Number(item.quantity || 0))
}

function markBroken(item) {
  brokenImages.value = new Set([...brokenImages.value, String(item.id)])
}

async function load() {
  if (!userStore.consumerId) return
  loading.value = true
  try {
    const [addresses, cart] = await Promise.all([
      consumerApi.getAddresses(userStore.consumerId),
      consumerApi.getCart(userStore.consumerId),
    ])
    addressList.value = Array.isArray(addresses) ? addresses : []
    const preferred = addressList.value.find((item) => item.isDefault) || addressList.value[0] || null
    selectedAddressId.value = preferred?.id ?? null
    items.value = (Array.isArray(cart) ? cart : []).filter((row) => row.selected === true)

    try {
      coupons.value = (await consumerApi.getCoupons(userStore.consumerId)) || []
      couponError.value = false
    } catch {
      coupons.value = []
      couponError.value = true
    }
    if (isGroupOrder.value) {
      const detail = await consumerApi.getGroupBuyDetail(groupBuyId.value).catch(() => null)
      groupActivity.value = detail?.activity || null
    }
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '确认订单数据加载失败')
  } finally {
    loading.value = false
  }
}

function openAddressDialog() {
  dialogAddressId.value = selectedAddressId.value
  addressDialog.value = true
}

/** 切换默认地址：写成功后回读地址列表，确认 isDefault 真的落到目标地址上。 */
async function confirmAddress() {
  const target = addressList.value.find((item) => String(item.id) === String(dialogAddressId.value))
  if (!target) {
    ElMessage.warning('请选择收货地址')
    return
  }
  if (String(target.id) === String(selectedAddressId.value) && target.isDefault) {
    addressDialog.value = false
    return
  }
  savingAddress.value = true
  try {
    const res = await consumerApi.updateAddress({ ...target, isDefault: true })
    if (res?.success === false) {
      ElMessage.error(res.message || '设置默认地址失败')
      return
    }
    const fresh = (await consumerApi.getAddresses(userStore.consumerId)) || []
    addressList.value = fresh
    const hit = fresh.find((item) => String(item.id) === String(target.id))
    if (!hit || !hit.isDefault) {
      ElMessage.error('默认地址未更新，请稍后重试')
      return
    }
    selectedAddressId.value = hit.id
    addressDialog.value = false
    ElMessage.success('已切换收货地址')
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '设置默认地址失败')
  } finally {
    savingAddress.value = false
  }
}

async function submitOrder() {
  if (submitDisabled.value) {
    if (submitReason.value) ElMessage.warning(submitReason.value)
    return
  }
  submitting.value = true
  try {
    const payload = {
      consumerId: userStore.consumerId,
      addressId: address.value.id,
      remark: remark.value.trim(),
      deliveryType: deliveryType.value,
    }
    if (isGroupOrder.value) {
      payload.groupBuyId = groupBuyId.value
      if (groupInstanceId.value) payload.groupInstanceId = groupInstanceId.value
    } else if (couponId.value) {
      // 只传券记录 ID；优惠金额由后端重算，前端展示值仅用于预览
      payload.couponUserId = couponId.value
    }
    const res = await consumerApi.createOrder(payload)
    if (!res?.success) {
      ElMessage.error(res?.message || '下单失败')
      return
    }
    const orderIds = Array.isArray(res.orderIds) ? res.orderIds : []
    if (Number(res.orderCount) > 1) {
      ElMessage.success(res.message || `已按供应商拆分为 ${res.orderCount} 个订单`)
    } else {
      ElMessage.success('下单成功')
    }
    await userStore.refreshCart()
    if (!orderIds.length) {
      ElMessage.warning('下单成功但未返回订单号，请到「我的订单」查看')
      router.replace('/orders')
      return
    }
    router.replace(`/pay/${orderIds[0]}`)
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '下单失败')
  } finally {
    submitting.value = false
  }
}

// consumerId 由统一身份异步换回：拿到后再加载地址与购物车，避免直接进入本页时误判「未登录」
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

.addr-name {
  font-size: 15px;
  font-weight: 700;
}

.addr-detail {
  margin: 6px 0 0;
  color: #33453b;
  font-size: 13px;
  line-height: 1.7;
}

.goods {
  padding: 6px 22px 14px;
}

.goods-row {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) 150px 100px;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px dashed #eef3ef;
}

.goods-row:last-child {
  border-bottom: 0;
}

.thumb {
  display: grid;
  place-items: center;
  overflow: hidden;
  width: 64px;
  height: 64px;
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
  font-size: 22px;
}

.goods-info {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.goods-name {
  overflow: hidden;
  font-size: 13.5px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.group-banner {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 14px;
  padding: 14px 18px;
  border: 1px solid #f0dcc9;
  border-radius: 12px;
  background: linear-gradient(120deg, #fdf6f1, #fff);
}

.group-banner .gb-ic {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  background: #fff;
  font-size: 18px;
}

.group-banner b {
  font-size: 13.5px;
}

.group-banner p {
  margin: 4px 0 0;
  line-height: 1.7;
}

.gb-price {
  color: #d45b32;
  font-size: 15px;
}

.goods-price {
  font-size: 12.5px;
  text-align: right;
}

.goods-sub {
  text-align: right;
}

.form {
  display: grid;
  gap: 16px;
}

.summary {
  position: sticky;
  top: 88px;
  display: grid;
  gap: 12px;
  align-content: start;
}

.sum-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
}

.coupon-select {
  width: 100%;
}

.sum-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding-top: 12px;
  border-top: 1px dashed #eef3ef;
}

.sum-list > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}

.sum-list dt {
  color: #6b7c72;
}

.sum-list dd {
  margin: 0;
  font-weight: 600;
}

.sum-list .discount {
  color: #d88718;
}

.freight-hint {
  margin: 0;
  color: #93a29a;
}

.sum-total {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding-top: 10px;
  border-top: 1px solid #eef3ef;
}

.submit {
  height: 42px;
}

.reason {
  margin: 0;
  color: #c94b4b;
  text-align: center;
}

.addr-list {
  display: grid;
  gap: 10px;
}

.addr-option {
  display: grid;
  gap: 2px;
  padding: 10px 14px;
  border: 1px solid #e3eae5;
  border-radius: 10px;
  cursor: pointer;
}

.addr-option.on {
  border-color: #12764a;
  background: #f1fbf5;
}

.opt-name {
  font-weight: 600;
}

.opt-detail {
  margin: 0 0 0 24px;
  color: #6b7c72;
  font-size: 12.5px;
  line-height: 1.6;
}

@media (max-width: 1080px) {
  .summary { position: static; }
  .goods-row { grid-template-columns: 56px minmax(0, 1fr) 110px; }
  .goods-sub { grid-column: 2 / -1; text-align: left; }
}
</style>

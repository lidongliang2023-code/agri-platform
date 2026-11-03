<template>
  <div class="m-container" v-loading="loading">
    <div class="m-page-hd lead">
      <h1>支付结果</h1>
      <span class="sub">结果以订单接口回读的状态为准</span>
    </div>

    <div v-if="order" class="m-card m-card-pad result">
      <span class="result-ic" :class="{ warn: !paid }">{{ paid ? '✅' : '⚠️' }}</span>

      <h2 class="result-title">{{ paid ? '支付成功' : '未查询到支付成功状态' }}</h2>
      <p class="result-desc muted">
        <template v-if="paid">
          订单已进入「{{ statusText }}」。平台收到支付结果后由产地供应商安排出库，发货后可在订单详情查看物流。
        </template>
        <template v-else>
          订单当前状态为「{{ statusText }}」，系统没有查到支付成功记录。若你刚完成支付，可稍后刷新或到订单详情确认，避免重复付款。
        </template>
      </p>

      <div class="amount">
        <span class="muted small">{{ paid ? '实付金额' : '应付金额' }}</span>
        <span class="price lg"><span class="cur">¥</span>{{ money(order.payAmount) }}</span>
      </div>

      <dl class="kv">
        <div><dt>订单号</dt><dd class="num">{{ order.orderNo || '—' }}</dd></div>
        <div><dt>创建时间</dt><dd>{{ dateTime(order.createTime) }}</dd></div>
        <div><dt>支付时间</dt><dd>{{ order.payTime ? dateTime(order.payTime) : '—' }}</dd></div>
        <div><dt>收货人</dt><dd>{{ order.address?.name || '—' }}</dd></div>
      </dl>

      <p class="tip">
        预计发货：订单进入待发货后，由供应商在履约端出库；具体时效以物流信息为准，本页不做时效承诺。
      </p>

      <div class="actions">
        <button type="button" class="m-btn primary" @click="router.push(`/order/${order.id}`)">查看订单详情</button>
        <button type="button" class="m-btn ghost" @click="router.push('/products')">继续逛逛</button>
        <button type="button" class="m-btn" @click="router.push('/')">返回首页</button>
      </div>
    </div>

    <EmptyBlock
      v-else-if="!loading"
      icon="🧾"
      title="没有可展示的支付结果"
      desc="地址栏缺少订单号，或该订单不存在/不属于当前账号。可到「我的订单」查看支付状态。"
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="router.push('/orders')">去我的订单</button>
      </template>
    </EmptyBlock>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { consumerApi } from '../api'
import { dateTime, money, orderStatusText } from '../utils/format'
import EmptyBlock from '../components/EmptyBlock.vue'

/** 后端订单状态里，属于「已付款」的几个状态。 */
const PAID_STATUS = ['PENDING_SHIP', 'SHIPPED', 'PENDING_RECEIVE', 'COMPLETED']

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const order = ref(null)

const paid = computed(() => PAID_STATUS.includes(String(order.value?.status || '')))
const statusText = computed(() => orderStatusText(order.value?.status, order.value?.statusText))

async function load() {
  const orderId = route.query.orderId
  if (!orderId) return
  loading.value = true
  try {
    order.value = await consumerApi.getOrderDetail(orderId)
  } catch (err) {
    order.value = null
    ElMessage.error(err.friendlyMessage || '订单信息加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.m-container {
  width: min(1280px, calc(100% - 48px));
  margin: 0 auto;
}

.lead {
  margin-top: 18px;
}

.result {
  display: grid;
  justify-items: center;
  gap: 10px;
  max-width: 640px;
  margin: 0 auto;
  padding: 40px 32px 32px;
  text-align: center;
}

.result-ic {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: 20px;
  background: #f1fbf5;
  font-size: 30px;
}

.result-ic.warn {
  background: #fdf3e3;
}

.result-title {
  margin: 4px 0 0;
  font-size: 20px;
  font-weight: 800;
}

.result-desc {
  max-width: 460px;
  margin: 0;
  font-size: 13px;
  line-height: 1.8;
}

.amount {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 6px;
}

.kv {
  display: grid;
  gap: 8px;
  width: 100%;
  margin: 12px 0 0;
  padding: 14px 16px;
  border-radius: 10px;
  background: #f8fbf9;
}

.kv > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}

.kv dt {
  color: #6b7c72;
}

.kv dd {
  margin: 0;
  font-weight: 600;
}

.tip {
  max-width: 460px;
  margin: 4px 0 0;
  color: #93a29a;
  font-size: 12.5px;
  line-height: 1.8;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  margin-top: 12px;
}
</style>

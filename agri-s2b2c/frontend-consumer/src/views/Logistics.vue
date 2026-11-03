<template>
  <div class="m-container" style="margin-top: 18px" v-loading="loading">
    <!-- 页头 -->
    <div class="m-page-hd">
      <h1>物流追踪</h1>
      <span class="sub">运单与轨迹由物流公司回传，平台只做展示</span>
      <div class="hd-actions">
        <button type="button" class="m-btn sm" @click="router.push(`/order/${orderId}`)">返回订单详情</button>
      </div>
    </div>

    <!-- 未登录 -->
    <EmptyBlock
      v-if="userStore.booted && !userStore.consumerId"
      icon="🔐"
      title="登录后查看物流"
      desc="物流信息按订单归属校验。当前浏览器未检测到已登录的统一身份，请从统一门户登录后再进入商城。"
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="router.push('/orders')">去我的订单</button>
      </template>
    </EmptyBlock>

    <template v-else>
      <template v-if="logistics">
        <!-- 运单卡 -->
        <section class="m-card waybill">
          <div class="wb-main">
            <span class="wb-ic">🚚</span>
            <div class="wb-info">
              <b class="wb-company">{{ logistics.logisticsCompany || '物流公司待回传' }}</b>
              <div class="m-row-wrap">
                <span class="muted small num">运单号 {{ logistics.logisticsNo || '—' }}</span>
                <button
                  v-if="logistics.logisticsNo"
                  type="button"
                  class="m-btn text"
                  @click="copyWaybill"
                >
                  复制
                </button>
              </div>
            </div>
            <span class="m-spacer" />
            <div class="wb-status">
              <span class="m-tag" :class="orderStatusClass">{{ orderStatusText(logistics.orderStatus) }}</span>
              <span v-if="logistics.status" class="m-tag plain">{{ logisticsStatusText(logistics.status) }}</span>
            </div>
          </div>

          <dl class="wb-meta">
            <div><dt>关联订单</dt><dd class="num">#{{ logistics.orderId || orderId }}</dd></div>
            <div><dt>发货时间</dt><dd class="num">{{ dateTime(logistics.createTime) }}</dd></div>
            <div><dt>轨迹更新</dt><dd class="num">{{ dateTime(logistics.updateTime) }}</dd></div>
          </dl>
        </section>

        <!-- 轨迹 -->
        <section class="m-card track-card">
          <div class="m-card-hd">
            <h3>物流轨迹</h3>
            <span class="muted small">{{ nodes.length }} 个节点</span>
            <div class="hd-actions">
              <button type="button" class="m-btn sm" :disabled="loading" @click="load">刷新物流</button>
            </div>
          </div>
          <div class="m-card-pad">
            <el-timeline v-if="nodes.length" class="track">
              <el-timeline-item
                v-for="(node, index) in nodes"
                :key="`${node.time}-${index}`"
                :timestamp="node.time || ''"
                :type="index === 0 ? 'success' : 'primary'"
                :hollow="index !== 0"
                placement="top"
              >
                <p class="node-text" :class="{ latest: index === 0 }">{{ node.text }}</p>
              </el-timeline-item>
            </el-timeline>
            <EmptyBlock
              v-else
              icon="🛰️"
              title="暂无轨迹文本"
              desc="物流公司只回传了运单号，还没有回传轨迹节点。供应商发货后节点会陆续同步，可稍后点击刷新。"
            />
            <p v-if="nodes.length === 1" class="muted small track-note">
              轨迹由物流公司回传，平台侧只有一条记录时说明尚未产生更多节点。
            </p>
            <p v-else-if="nodes.length > 1" class="muted small track-note">
              已按时间倒序排列（最新在上）。若时间缺失，则按物流公司回传顺序倒序展示。
            </p>
          </div>
        </section>

        <!-- 操作 -->
        <section class="m-card m-card-pad foot">
          <button type="button" class="m-btn" @click="router.push(`/order/${orderId}`)">返回订单详情</button>
          <button type="button" class="m-btn" :disabled="loading" @click="load">刷新物流</button>
          <span class="m-spacer" />
          <el-tooltip v-if="!canReceive" content="只有已发货/待收货的订单可以确认收货" placement="top">
            <span class="tip-wrap">
              <button type="button" class="m-btn primary" disabled>确认收货</button>
            </span>
          </el-tooltip>
          <button v-else type="button" class="m-btn primary" :disabled="busy" @click="receive">确认收货</button>
        </section>
      </template>

      <!-- 该订单还没有物流记录（后端 404） -->
      <EmptyBlock
        v-else-if="notFound && !loading"
        icon="🚚"
        title="该订单还没有物流信息"
        desc="物流记录由供应商发货时写入：订单未发货，或供应商还没回传运单号，都会是空。发货后可再来查看轨迹。"
      >
        <template #actions>
          <button type="button" class="m-btn primary" @click="router.push(`/order/${orderId}`)">返回订单详情</button>
          <button type="button" class="m-btn" @click="router.push('/orders')">我的订单</button>
        </template>
      </EmptyBlock>

      <!-- 其他加载失败 -->
      <EmptyBlock
        v-else-if="failed && !loading"
        icon="🛰️"
        title="物流信息加载失败"
        :desc="failedMessage"
      >
        <template #actions>
          <button type="button" class="m-btn primary" @click="load">重新加载</button>
          <button type="button" class="m-btn" @click="router.push(`/order/${orderId}`)">返回订单详情</button>
        </template>
      </EmptyBlock>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { consumerApi } from '../api'
import { useUserStore } from '../stores/user'
import { dateTime, orderStatusText } from '../utils/format'
import EmptyBlock from '../components/EmptyBlock.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const busy = ref(false)
const logistics = ref(null)
const notFound = ref(false)
const failed = ref(false)
const failedMessage = ref('')

const orderId = computed(() => route.params.orderId)
const orderStatusClass = computed(() => {
  const value = logistics.value?.orderStatus
  if (value === 'COMPLETED') return ''
  if (value === 'CANCELLED') return 'plain'
  if (value === 'REFUNDING' || value === 'REFUNDED') return 'red'
  return 'blue'
})
const canReceive = computed(() =>
  ['SHIPPED', 'PENDING_RECEIVE'].includes(logistics.value?.orderStatus),
)

/** 物流表 status 取值没有前端字典，未知值原样展示，不臆造文案。 */
function logisticsStatusText(value) {
  const map = {
    PENDING: '待揽收',
    SHIPPED: '已揽收',
    IN_TRANSIT: '运输中',
    DELIVERED: '已签收',
    EXCEPTION: '异常',
  }
  return map[value] || value
}

/** trackingInfo 是整段文本：按换行/分号拆成节点，带时间的按时间倒序，否则按回传顺序倒序。 */
const nodes = computed(() => {
  const raw = logistics.value?.trackingInfo
  if (!raw) return []
  const lines = String(raw)
    .split(/[\r\n;；]+/)
    .map((line) => line.trim())
    .filter(Boolean)
  const parsed = lines.map((line) => {
    const matched = line.match(/^(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?)\s*(.*)$/)
    if (!matched) return { time: '', text: line }
    return { time: matched[1].replace('T', ' '), text: matched[2] || line }
  })
  if (parsed.every((node) => node.time)) {
    return parsed.sort((a, b) => (a.time < b.time ? 1 : -1))
  }
  return parsed.reverse()
})

async function load() {
  if (!userStore.consumerId || !orderId.value) return
  loading.value = true
  notFound.value = false
  failed.value = false
  try {
    logistics.value = await consumerApi.getLogistics(orderId.value)
  } catch (err) {
    logistics.value = null
    if (err?.response?.status === 404) {
      notFound.value = true
    } else {
      failed.value = true
      failedMessage.value = err.friendlyMessage || '物流信息加载失败，请稍后重试'
    }
  } finally {
    loading.value = false
  }
}

async function copyWaybill() {
  const text = logistics.value?.logisticsNo
  if (!text) {
    ElMessage.warning('没有可复制的运单号')
    return
  }
  try {
    await navigator.clipboard.writeText(String(text))
    ElMessage.success('运单号已复制')
  } catch {
    ElMessage.warning('浏览器不允许自动复制，请手动选中运单号复制')
  }
}

async function receive() {
  if (!logistics.value) return
  try {
    await ElMessageBox.confirm(
      '确认已收到该订单的商品？确认后订单将变为已完成。',
      '确认收货',
      { confirmButtonText: '确认收货', cancelButtonText: '再等等', type: 'warning' },
    )
  } catch {
    return
  }
  busy.value = true
  try {
    const res = await consumerApi.receiveOrder(orderId.value)
    if (res?.success === false) {
      ElMessage.error(res.message || '确认收货失败')
      await load()
      return
    }
    // 回读订单状态，只有真的变成已完成才提示成功
    const detail = await consumerApi.getOrderDetail(orderId.value).catch(() => null)
    if (detail?.status === 'COMPLETED') {
      ElMessage.success('已确认收货')
      await load()
    } else {
      ElMessage.error('收货状态未更新，请刷新后重试')
      await load()
    }
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '确认收货失败')
  } finally {
    busy.value = false
  }
}

watch(
  () => [userStore.consumerId, orderId.value],
  ([id], previous) => {
    if (!id) return
    // 订单号变化时先清空旧数据，避免闪现上一个订单的运单
    if (previous && String(previous[1]) !== String(orderId.value)) logistics.value = null
    load()
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

.waybill {
  padding: 18px 22px;
}

.wb-main {
  display: flex;
  align-items: center;
  gap: 14px;
}

.wb-ic {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 12px;
  background: #f1fbf5;
  font-size: 22px;
}

.wb-info {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.wb-company {
  font-size: 15.5px;
  font-weight: 700;
}

.wb-status {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

.wb-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 32px;
  margin: 14px 0 0;
  padding-top: 14px;
  border-top: 1px dashed #eef3ef;
  font-size: 12.5px;
}

.wb-meta > div {
  display: flex;
  gap: 8px;
}

.wb-meta dt {
  color: #6b7c72;
}

.wb-meta dd {
  margin: 0;
  color: #0b1a12;
  font-weight: 500;
}

.track-card {
  margin-top: 16px;
}

.track {
  padding-top: 6px;
  padding-left: 4px;
}

.node-text {
  margin: 0;
  color: #33453b;
  font-size: 13px;
  line-height: 1.7;
}

.node-text.latest {
  color: #0b1a12;
  font-weight: 600;
}

.track-note {
  margin: 8px 0 0;
  padding-top: 10px;
  border-top: 1px dashed #eef3ef;
  line-height: 1.8;
}

.foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
}

.tip-wrap {
  display: inline-flex;
}
</style>

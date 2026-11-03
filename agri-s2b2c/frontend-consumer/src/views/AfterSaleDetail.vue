<template>
  <div class="m-container" style="margin-top: 18px" v-loading="loading">
    <!-- 页头 -->
    <div class="m-page-hd">
      <h1>售后详情</h1>
      <span class="sub">售后由平台运营审核处理，页面数据来自售后记录列表</span>
      <div class="hd-actions">
        <button type="button" class="m-btn sm" @click="router.push('/orders')">我的订单</button>
      </div>
    </div>

    <!-- 未登录 -->
    <EmptyBlock
      v-if="userStore.booted && !userStore.consumerId"
      icon="🔐"
      title="登录后查看售后详情"
      desc="售后记录按消费者账号存储。当前浏览器未检测到已登录的统一身份，请从统一门户登录后再进入商城。"
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="router.push('/orders')">去我的订单</button>
      </template>
    </EmptyBlock>

    <!-- 找不到记录 -->
    <EmptyBlock
      v-else-if="userStore.booted && !loading && !record"
      icon="🧾"
      title="没有找到这条售后记录"
      desc="售后单号可能已失效，或该记录不属于当前登录的消费者账号。请从订单详情的「售后记录」重新进入。"
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="router.push('/orders')">去我的订单</button>
      </template>
    </EmptyBlock>

    <template v-else-if="record">
      <!-- 状态与进度 -->
      <section class="m-card status-card">
        <div class="sc-head">
          <span class="m-tag" :class="statusClass">{{ statusText }}</span>
          <b class="sc-no num">售后单 {{ record.id }}</b>
          <span class="m-spacer" />
          <span class="muted small num">申请时间 {{ dateTime(record.createTime) }}</span>
        </div>

        <p v-if="flowAlert" class="sc-alert" :class="{ danger: isRejected }">{{ flowAlert }}</p>

        <el-steps
          :active="activeStep"
          :process-status="isRejected ? 'error' : 'process'"
          finish-status="success"
          align-center
        >
          <el-step title="提交申请" :description="dateTime(record.createTime)" />
          <el-step title="平台审核" :description="auditText" />
          <el-step title="退款/换货" :description="handleText" />
          <el-step title="完成" :description="isCompleted ? '已处理完成' : '—'" />
        </el-steps>
      </section>

      <div class="m-split detail-body">
        <div class="m-stack">
          <!-- 售后信息 -->
          <section class="m-card">
            <div class="m-card-hd">
              <h3>售后信息</h3>
              <span class="muted small">{{ typeText }}</span>
            </div>
            <div class="m-card-pad">
              <dl class="kv">
                <div>
                  <dt>售后单号</dt>
                  <dd class="m-row-wrap">
                    <span class="num">{{ record.id }}</span>
                    <button type="button" class="m-btn text" @click="copyText(record.id, '售后单号')">复制</button>
                  </dd>
                </div>
                <div>
                  <dt>关联订单</dt>
                  <dd>
                    <button type="button" class="link-btn num" @click="router.push(`/order/${record.orderId}`)">
                      #{{ record.orderId }} 查看订单 ›
                    </button>
                  </dd>
                </div>
                <div><dt>售后类型</dt><dd>{{ typeText }}</dd></div>
                <div><dt>售后原因</dt><dd>{{ record.reason || '—' }}</dd></div>
                <div><dt>申请时间</dt><dd class="num">{{ dateTime(record.createTime) }}</dd></div>
                <div><dt>处理状态</dt><dd><span class="m-tag" :class="statusClass">{{ statusText }}</span></dd></div>
              </dl>

              <div class="opinion">
                <h4>处理意见</h4>
                <p v-if="record.handleOpinion" class="opinion-text">{{ record.handleOpinion }}</p>
                <p v-else class="opinion-text muted">平台尚未处理，通常在 24 小时内响应。</p>
              </div>

              <div class="opinion" v-if="record.type === 'RETURN'">
                <h4>退货物流</h4>
                <template v-if="record.returnShippedAt">
                  <p class="opinion-text">
                    {{ record.returnCompany || '快递' }} · {{ record.returnLogisticsNo }}
                    <span class="muted small">（{{ dateTime(record.returnShippedAt) }} 已寄回）</span>
                  </p>
                  <p class="opinion-text muted" v-if="record.returnReceivedAt">
                    商家已确认收货：{{ dateTime(record.returnReceivedAt) }}
                  </p>
                  <p class="opinion-text muted" v-else>等待商家确认收货后退款。</p>
                </template>
                <template v-else-if="record.status === 'RETURNING'">
                  <p class="opinion-text">平台已同意退货，请寄回商品并填写退货物流。</p>
                  <button type="button" class="m-btn sm primary" @click="returnVisible = true">填写退货物流</button>
                </template>
                <p v-else class="opinion-text muted">—</p>
              </div>
            </div>
          </section>
        </div>

        <aside class="m-stack">
          <!-- 金额 -->
          <section class="m-card m-card-pad">
            <span class="muted small">申请退款金额</span>
            <div class="price lg refund"><span class="cur">¥</span>{{ money(record.amount) }}</div>
            <p class="muted small amount-note">
              退款金额以平台审核结果为准。当前商城支付为演示通道，不产生真实扣款与退款；如已实际付款，请联系客服核实到账情况。
            </p>
          </section>

          <!-- 操作 -->
          <section class="m-card m-card-pad ops">
            <h3 class="aside-title">需要帮助？</h3>
            <p class="muted small">
              售后协商与撤销都由平台运营端处理，本页不提供自助接口；联系客服时报上售后单号可更快定位。
            </p>
            <button type="button" class="m-btn primary block" @click="serviceVisible = true">联系客服</button>
            <button type="button" class="m-btn ghost block" @click="serviceVisible = true">继续协商</button>
            <el-tooltip content="撤销需由平台运营端处理，请联系客服" placement="top">
              <span class="tip-wrap">
                <button type="button" class="m-btn block" disabled>撤销申请</button>
              </span>
            </el-tooltip>
          </section>
        </aside>
      </div>
    </template>

    <!-- 退货物流 -->
    <el-dialog v-model="returnVisible" title="填写退货物流" width="460px">
      <el-form label-width="90px">
        <el-form-item label="物流公司">
          <el-input v-model="returnForm.company" maxlength="100" placeholder="如：顺丰" />
        </el-form-item>
        <el-form-item label="物流单号" required>
          <el-input v-model="returnForm.logisticsNo" maxlength="100" placeholder="填写退货快递单号" />
        </el-form-item>
      </el-form>
      <p class="muted small">提交后商家确认收到退货即完成退款；请保留寄回凭证。</p>
      <template #footer>
        <button type="button" class="m-btn" @click="returnVisible = false">取消</button>
        <button type="button" class="m-btn primary" :disabled="submittingReturn" @click="submitReturn">
          {{ submittingReturn ? '提交中…' : '提交物流' }}
        </button>
      </template>
    </el-dialog>

    <!-- 客服 -->
    <el-dialog v-model="serviceVisible" title="联系客服" width="440px">
      <p class="dlg-line">售后协商、撤销申请等问题可直接联系平台客服：</p>
      <p class="dlg-phone num">400-800-0000</p>
      <p class="muted small">
        客服工作时间 9:00–18:00。联系时报上售后单号与订单号，客服可在运营端查询处理进度。
      </p>
      <template #footer>
        <button type="button" class="m-btn" @click="serviceVisible = false">知道了</button>
        <button type="button" class="m-btn primary" @click="copyText(record?.id, '售后单号')">复制售后单号</button>
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
import { AFTER_SALE_STATUS, AFTER_SALE_TYPES, dateTime, money } from '../utils/format'
import EmptyBlock from '../components/EmptyBlock.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const record = ref(null)
const serviceVisible = ref(false)
const returnVisible = ref(false)
const submittingReturn = ref(false)
const returnForm = ref({ company: '顺丰', logisticsNo: '' })

const statusText = computed(() => AFTER_SALE_STATUS[record.value?.status]?.text || record.value?.status || '—')
const typeText = computed(() => AFTER_SALE_TYPES[record.value?.type] || record.value?.type || '—')
const isRejected = computed(() => record.value?.status === 'REJECTED')
const isCompleted = computed(() => record.value?.status === 'COMPLETED')

function statusClassOf(value) {
  if (value === 'PENDING') return 'amber'
  if (value === 'REJECTED') return 'red'
  if (value === 'RETURNING') return 'blue'
  if (value === 'CANCELLED') return 'plain'
  return ''
}
const statusClass = computed(() => statusClassOf(record.value?.status))

/** 处理进度：PENDING=1（审核中）、APPROVED/RETURNING=2（退款/换货中）、COMPLETED=3、REJECTED 终止并标红。 */
const activeStep = computed(() => {
  const map = { PENDING: 1, APPROVED: 2, RETURNING: 2, COMPLETED: 3, REJECTED: 1, CANCELLED: 1 }
  return map[record.value?.status] ?? 1
})

const auditText = computed(() => {
  const value = record.value?.status
  if (value === 'PENDING') return '审核中'
  if (value === 'REJECTED') return '未通过'
  if (value === 'CANCELLED') return '已撤销'
  return '已审核'
})

const handleText = computed(() => {
  const value = record.value?.status
  if (value === 'RETURNING') return '退货中'
  if (value === 'APPROVED') return '待退款'
  if (value === 'COMPLETED') return '已处理'
  if (value === 'REJECTED') return '已终止'
  return '—'
})

const flowAlert = computed(() => {
  const value = record.value?.status
  if (value === 'REJECTED') {
    return `平台审核未通过${record.value?.handleOpinion ? `：${record.value.handleOpinion}` : '，可联系客服了解原因并继续协商。'}`
  }
  if (value === 'CANCELLED') return '该售后申请已撤销，流程终止。'
  if (value === 'RETURNING' && !record.value?.returnShippedAt) {
    return '平台已同意退货，请寄回商品并填写退货物流。'
  }
  if (value === 'COMPLETED') return '售后已完成，退款进度可联系客服核实。'
  return ''
})

async function copyText(text, label) {
  if (!text) {
    ElMessage.warning(`没有可复制的${label}`)
    return
  }
  try {
    await navigator.clipboard.writeText(String(text))
    ElMessage.success(`${label}已复制`)
  } catch {
    ElMessage.warning('浏览器不允许自动复制，请手动选中文本复制')
  }
}

async function submitReturn() {
  if (!record.value) return
  if (!returnForm.value.logisticsNo.trim()) {
    ElMessage.warning('请填写退货物流单号')
    return
  }
  submittingReturn.value = true
  try {
    const res = await consumerApi.submitAfterSaleReturn(
      record.value.id, returnForm.value.company.trim() || '快递', returnForm.value.logisticsNo.trim())
    if (res?.success === false) {
      ElMessage.error(res.message || '提交失败')
      return
    }
    ElMessage.success(res?.message || '退货物流已提交')
    returnVisible.value = false
    await load()
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '提交失败')
  } finally {
    submittingReturn.value = false
  }
}

/** 后端没有单条售后接口：从当前消费者的售后列表里按 id 匹配。 */
async function load() {
  if (!userStore.consumerId) return
  loading.value = true
  try {
    const rows = (await consumerApi.getAfterSales(userStore.consumerId)) || []
    record.value = rows.find((row) => String(row.id) === String(route.params.id)) || null
  } catch (err) {
    record.value = null
    ElMessage.error(err.friendlyMessage || '售后记录加载失败')
  } finally {
    loading.value = false
  }
}

watch(
  () => [userStore.consumerId, route.params.id],
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

.status-card {
  display: grid;
  gap: 14px;
  padding: 20px 22px;
}

.sc-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sc-no {
  font-size: 15px;
  font-weight: 700;
}

.sc-head .m-tag {
  height: 22px;
  padding: 0 10px;
  font-size: 12px;
}

.sc-alert {
  margin: 0;
  padding: 8px 12px;
  border-radius: 8px;
  background: #fdf3e3;
  color: #a86412;
  font-size: 12.5px;
  line-height: 1.7;
}

.sc-alert.danger {
  background: #fbeeee;
  color: #c94b4b;
}

.detail-body {
  margin-top: 16px;
}

.kv {
  display: grid;
  gap: 10px;
  margin: 0;
}

.kv > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
}

.kv dt {
  flex: 0 0 76px;
  color: #6b7c72;
}

.kv dd {
  margin: 0;
  min-width: 0;
  font-weight: 500;
  text-align: right;
  overflow-wrap: anywhere;
}

.link-btn {
  padding: 0;
  border: 0;
  background: none;
  color: #12764a;
  font-size: 13px;
  cursor: pointer;
}

.link-btn:hover {
  text-decoration: underline;
}

.opinion {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px dashed #eef3ef;
}

.opinion h4 {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 700;
}

.opinion-text {
  margin: 0;
  color: #33453b;
  font-size: 13px;
  line-height: 1.8;
}

.refund {
  margin: 4px 0 8px;
  font-size: 28px;
}

.amount-note {
  margin: 0;
  line-height: 1.75;
}

.ops {
  display: grid;
  gap: 10px;
}

.aside-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
}

.ops .muted.small {
  margin: 0;
  line-height: 1.75;
}

.tip-wrap {
  display: block;
}

.tip-wrap .m-btn {
  width: 100%;
}

.dlg-line {
  margin: 0 0 8px;
  font-size: 13.5px;
  line-height: 1.7;
}

.dlg-phone {
  margin: 0 0 12px;
  color: #12764a;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: 1px;
}

@media (max-width: 1080px) {
  .sc-head { flex-wrap: wrap; }
  .sc-head .m-spacer { display: none; }
}
</style>

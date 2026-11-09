<template>
  <view class="page services-page">
    <view class="tabs">
      <view v-for="(tab, index) in tabs" :key="tab" class="tab" :class="{ active: activeTab === index }" @tap="activeTab = index">
        {{ tab }}
      </view>
    </view>

    <template v-if="activeTab === 0">
      <view class="hero">
        <text class="hero-kicker">MEMBER BENEFITS · 会员专享</text>
        <text class="hero-title">源头好货，实惠到家</text>
        <text class="hero-desc">领券、秒杀和社区拼团统一查看</text>
      </view>

      <view class="section">
        <view class="section-head"><view><text class="kicker">COUPON CENTER</text><text class="title">领券中心</text></view><text class="sub">先领券，再下单</text></view>
        <view v-for="coupon in marketing.coupons || []" :key="coupon.id" class="coupon-card">
          <view class="coupon-value">
            <b>{{ coupon.type === 'DISCOUNT' ? '折扣' : `¥${coupon.amount}` }}</b>
            <small>满 {{ coupon.minAmount }} 元可用</small>
          </view>
          <view class="coupon-copy">
            <text>{{ coupon.name }}</text>
            <small>有效期至 {{ coupon.validEnd }}</small>
            <em>仅剩 {{ coupon.remainCount }} 张</em>
          </view>
          <button class="btn btn-sm coupon-button" :class="{ received: received.includes(coupon.id) }" @tap="receiveCoupon(coupon.id)">
            {{ received.includes(coupon.id) ? '已领取' : '领取' }}
          </button>
        </view>
        <view v-if="!session.user" class="empty-mini">统一账号登录后显示可领的优惠券、秒杀与拼团；扫码溯源不需要登录。</view>
        <view v-else-if="!(marketing.coupons || []).length" class="empty-mini">暂无可领取优惠券</view>
      </view>

      <view class="section">
        <view class="section-head"><view><text class="kicker">FLASH SALE</text><text class="title">限时秒杀</text></view><text class="sub">库存有限</text></view>
        <view v-for="deal in marketing.flashSales || []" :key="deal.id" class="deal-row">
          <view class="deal-icon">⚡</view>
          <view class="deal-copy"><text>{{ deal.productName }}</text><small>{{ deal.remainStock }} / {{ deal.totalStock }} {{ deal.unit }} 可抢</small></view>
          <view class="deal-price"><b>{{ money(deal.salePrice) }}</b><small>{{ money(deal.originalPrice) }}</small></view>
        </view>
      </view>

      <view class="section">
        <view class="section-head"><view><text class="kicker">COMMUNITY GROUP</text><text class="title">社区拼团</text></view><text class="sub">邻里一起买</text></view>
        <view v-for="group in marketing.groupBuys || []" :key="group.id" class="deal-row">
          <view class="deal-icon group">团</view>
          <view class="deal-copy"><text>{{ group.name }}</text><small>{{ group.groupSize }} 人成团 · {{ group.validHours }} 小时内有效</small></view>
          <view class="deal-price"><b>{{ money(group.groupPrice) }}</b><small>{{ money(group.singlePrice) }}</small></view>
        </view>
      </view>
    </template>

    <template v-else-if="activeTab === 1">
      <view class="hero trace-hero">
        <text class="hero-kicker">TRACEABILITY · 全链路溯源</text>
        <text class="hero-title">每一份农产品，都有来处</text>
        <text class="hero-desc">查询种植、采收、加工质检和仓储记录</text>
      </view>

      <view class="section">
        <view class="section-head"><view><text class="kicker">TRACEABILITY</text><text class="title">查询溯源链路</text></view></view>
        <view class="trace-search">
          <input v-model="traceQuery" class="trace-input" placeholder="溯源码（AG…）或商品编号" />
          <button class="btn btn-sm btn-ghost" @tap="scanCode">扫码</button>
          <button class="btn btn-sm btn-primary" :loading="traceLoading" @tap="queryTrace">查询</button>
        </view>
        <text class="trace-tip">链路内容来自生产管理模块（种植 / 采收 / 加工 / 质检 / 仓储），商城只读展示。</text>
      </view>

      <view v-if="trace.unavailable" class="empty">
        <view class="empty-icon">!</view>
        <text>溯源链路暂时连不上生产管理模块</text>
        <text class="empty-sub">{{ trace.message || '请稍后重试，这不是「该商品没有溯源记录」' }}</text>
      </view>
      <view v-else-if="!trace.matched" class="empty">
        <view class="empty-icon">溯</view>
        <text>{{ trace.bound ? '绑定的批次在生产管理模块查不到' : '该商品尚未绑定生产批次' }}</text>
        <text class="empty-sub">{{ trace.reason || '供应商在商品编辑页绑定采收批次后即可展示，商城不代填批次内容。' }}</text>
      </view>

      <view v-else class="section trace-record">
        <view class="trace-batch">
          <view class="trace-mark">溯</view>
          <view>
            <text class="batch-code">{{ trace.batchNo }}</text>
            <small>{{ trace.productName || trace.cropName }} · {{ trace.origin || trace.farmName || '产地未填' }}</small>
          </view>
        </view>
        <view class="timeline">
          <view v-for="n in trace.nodes" :key="n.seq" class="timeline-item">
            <text class="timeline-dot">{{ n.seq }}</text>
            <view>
              <b>{{ n.stageName }}<text v-if="n.onChain" class="chain-tag">已上链</text></b>
              <small>{{ n.occurredAt ? String(n.occurredAt).replace('T', ' ').slice(0, 16) : '时间未记录' }} · {{ n.detail }}</small>
            </view>
          </view>
        </view>
        <text class="trace-conclusion">{{ trace.conclusion }}</text>
        <view v-if="trace.sourceBasis === 'UNIT_CODE'" class="trace-circulation">
          <text class="circulation-title">单品履约与流通记录</text>
          <text v-if="!trace.circulationRecorded" class="circulation-empty">已核验生产事实；暂无商城零售流转绑定记录。</text>
          <view v-for="(c, i) in trace.circulation || []" :key="i" class="circulation-item">
            <text>状态：{{ c.orderStatus }} · 承运：{{ c.logisticsCompany || '直发' }}</text>
            <small>绑定履约时间：{{ c.boundAt ? String(c.boundAt).replace('T', ' ').slice(0, 16) : '未记录' }}</small>
          </view>
        </view>
      </view>
    </template>

    <template v-else>
      <view class="hero after-hero">
        <text class="hero-kicker">AFTER SALES · 售后协同</text>
        <text class="hero-title">售后申请，进度随时可查</text>
        <text class="hero-desc">平台统一受理退款与售后工单</text>
      </view>

      <view class="section">
        <view class="section-head"><view><text class="kicker">MY REQUESTS</text><text class="title">我的售后</text></view><text class="sub">{{ afterSales.length }} 条记录</text></view>
        <view v-for="item in afterSales" :key="item.id" class="after-row">
          <view class="after-head">
            <view><text>{{ item.type === 'REFUND' ? '退款申请' : item.type }}</text><small>订单 {{ item.orderId }}</small></view>
            <text class="tag" :class="`tag-${statusMeta(item.status).tone}`">{{ statusMeta(item.status).label }}</text>
          </view>
          <text class="after-reason">{{ item.reason }}</text>
          <view class="after-foot"><small>{{ item.createTime?.replace('T', ' ') }}</small><b>{{ money(item.amount) }}</b></view>
        </view>
        <view v-if="!afterSales.length" class="empty-mini">暂未提交售后申请</view>
      </view>

      <view class="section">
        <view class="section-head"><view><text class="kicker">NEW REQUEST</text><text class="title">申请售后</text></view></view>
        <view class="form-item"><text class="form-label">订单编号</text><input v-model="afterForm.orderId" class="input" type="number" placeholder="请输入订单 ID" /></view>
        <view class="form-item"><text class="form-label">申请金额</text><input v-model="afterForm.amount" class="input" type="digit" placeholder="请输入退款金额" /></view>
        <view class="form-item"><text class="form-label">售后原因</text><textarea v-model="afterForm.reason" class="textarea" placeholder="请描述商品问题与期望处理方式" /></view>
        <button class="btn btn-primary btn-block" :loading="submitting" @tap="submitAfterSale">提交售后申请</button>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { mallApi, type AfterSale, type MarketingData, type TraceView } from '../../api'
import { session } from '../../session'
import { money, statusMeta, toast } from '../../utils'

const tabs = ['优惠活动', '扫码溯源', '售后服务']
const activeTab = ref(0)
const marketing = ref<MarketingData>({ coupons: [], flashSales: [], groupBuys: [] })
const received = ref<Array<string | number>>([])
const traceQuery = ref('')
const trace = ref<TraceView>({ bound: false, matched: false, nodes: [] })
const traceQueried = ref(false)
const traceLoading = ref(false)
const afterSales = ref<AfterSale[]>([])
const submitting = ref(false)
const afterForm = reactive({ orderId: '', amount: '', reason: '' })

onLoad((options) => {
  /*
   * 包装上印的码扫出来就是一个带 code 的链接：落到这一页就要直接停在「扫码溯源」并把链路查出来。
   * 以前只认 productId，扫码的人进来停在「优惠活动」页签，还得自己切页签、再手输那串码 ——
   * 而优惠活动那一屏是要登录的，于是扫码第一步变成"请先登录"。
   */
  if (options?.code) {
    activeTab.value = 1
    traceQuery.value = String(options.code)
    queryTrace()
    return
  }
  // 商品详情的「全链路溯源」入口带的是 productId，直接填进查询框并按商品号查一次
  if (options?.productId) {
    activeTab.value = 1
    traceQuery.value = String(options.productId)
    queryTrace()
  }
})

onMounted(load)

async function load() {
  if (!session.user) {
    // 优惠活动/售后都是按登录消费者取数的私域接口，未登录就别请求：
    // 请求必 401，页面会把"还没登录"弹成"登录已失效"，而扫码的人本来也不需要这两块。
    return
  }
  try {
    marketing.value = await mallApi.getMarketing()
    const [coupons, records] = await Promise.all([
      mallApi.getCoupons(session.user.id),
      mallApi.getAfterSales(session.user.id),
    ])
    received.value = coupons.map((item) => item.couponId)
    afterSales.value = records || []
  } catch (error) {
    toast((error as Error).message)
  }
}

async function receiveCoupon(id: number) {
  if (!session.user) {
    uni.navigateTo({ url: '/pages/login/index?redirect=%2Fpages%2Fservices%2Findex' })
    return
  }
  try {
    const result = await mallApi.receiveCoupon(session.user.id, id)
    if (!result.success) throw new Error(result.message || '领取失败')
    received.value.push(id)
    toast(result.message || '领取成功', 'success')
  } catch (error) {
    toast((error as Error).message)
  }
}

async function queryTrace() {
  const value = traceQuery.value.trim()
  if (!value) return toast('请输入溯源码或商品编号')
  traceLoading.value = true
  traceQueried.value = true
  try {
    // 纯数字当商品号，其余按溯源码：真实码是 AG… 形式，只取数字段必然查不到
    trace.value = /^\d+$/.test(value)
      ? await mallApi.getTrace(value)
      : await mallApi.getTraceByCode(value)
  } catch (error) {
    const failure = error as Error & { status?: number; body?: Record<string, unknown> }
    const body = failure.body
    trace.value = {
      bound: body?.bound === true,
      matched: false,
      nodes: [],
      unavailable: failure.status === 503 || body?.unavailable === true,
      message: failure.message,
      reason: typeof body?.message === 'string' ? body.message : '',
    }
    // 404（查无此码）与 503（链路不可达）都有专门的界面文案，不再叠一层 toast
    if (failure.status !== 404 && failure.status !== 503) toast(failure.message)
  } finally {
    traceLoading.value = false
  }
}

function scanCode() {
  uni.scanCode({
    success(result) {
      // 直接用扫到的原始串：溯源码是 AG + 数字，抠出数字段再按商品号查必然错
      const raw = String(result.result ?? '').trim()
      if (!raw) return toast('扫码结果为空')
      traceQuery.value = raw
      queryTrace()
    },
    fail() {
      toast('扫码未完成，可手动输入溯源码')
    },
  })
}

async function submitAfterSale() {
  if (!session.user) {
    uni.navigateTo({ url: '/pages/login/index?redirect=%2Fpages%2Fservices%2Findex' })
    return
  }
  if (!afterForm.orderId || !afterForm.amount || !afterForm.reason.trim()) return toast('请完整填写售后信息')
  submitting.value = true
  try {
    const result = await mallApi.createAfterSale({
      consumerId: session.user.id,
      orderId: Number(afterForm.orderId),
      amount: Number(afterForm.amount),
      reason: afterForm.reason,
      type: 'REFUND',
    })
    if (!result.success) throw new Error(result.message || '售后提交失败')
    toast(result.message || '售后申请已提交', 'success')
    Object.assign(afterForm, { orderId: '', amount: '', reason: '' })
    afterSales.value = await mallApi.getAfterSales(session.user.id)
  } catch (error) {
    toast((error as Error).message)
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
.trace-circulation { margin-top: 24rpx; padding-top: 20rpx; border-top: 1rpx dashed #cfe0d5; }
.circulation-title { display: block; font-size: 26rpx; font-weight: 700; color: #16462e; margin-bottom: 8rpx; }
.circulation-empty { display: block; font-size: 22rpx; color: #789082; }
.circulation-item { padding: 8rpx 0; font-size: 23rpx; color: #2d5540; display: flex; flex-direction: column; }

.services-page {
  padding-bottom: 34rpx;
}

.tabs {
  display: flex;
  padding: 18rpx 22rpx 14rpx;
  border-bottom: 1rpx solid #e3eae5;
  background: #fff;
}

.tab {
  flex: 1;
  padding: 10rpx 0;
  color: #718277;
  font-size: 24rpx;
  text-align: center;
}

.tab.active {
  color: #0e5233;
  font-weight: 700;
}

.tab.active::after {
  display: block;
  width: 34rpx;
  height: 5rpx;
  margin: 8rpx auto 0;
  border-radius: 5rpx;
  background: #159a5e;
  content: "";
}

.hero {
  margin: 20rpx 22rpx;
  padding: 32rpx;
  overflow: hidden;
  border-radius: 24rpx;
  background:
    radial-gradient(circle at 88% 0, rgba(110, 231, 162, 0.18), transparent 42%),
    linear-gradient(135deg, #073821, #12764a);
  color: #fff;
}

.hero-kicker,
.hero-title,
.hero-desc {
  display: block;
}

.hero-kicker {
  color: #9fe7b8;
  font-size: 24rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}

.hero-title {
  margin-top: 10rpx;
  font-size: 35rpx;
  font-weight: 800;
}

.hero-desc {
  margin-top: 9rpx;
  color: rgba(255, 255, 255, 0.62);
  font-size: 24rpx;
}

.trace-hero {
  background:
    radial-gradient(circle at 88% 0, rgba(77, 145, 172, 0.2), transparent 42%),
    linear-gradient(135deg, #073821, #0b5e86);
}

.after-hero {
  background:
    radial-gradient(circle at 88% 0, rgba(216, 135, 24, 0.16), transparent 42%),
    linear-gradient(135deg, #073821, #12764a);
}

.section {
  margin: 16rpx 22rpx;
  padding: 24rpx;
  border: 1rpx solid #e3eae5;
  border-radius: 22rpx;
  background: #fff;
}

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 18rpx;
}

.kicker,
.title {
  display: block;
}

.kicker {
  color: #12764a;
  font-size: 24rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}

.title {
  margin-top: 4rpx;
  color: #0b1a12;
  font-size: 28rpx;
  font-weight: 750;
}

.sub {
  color: #93a29a;
  font-size: 24rpx;
}

.coupon-card {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 17rpx 0;
  border-top: 1rpx solid #edf2ee;
}

.coupon-card:first-of-type {
  border-top: 0;
}

.coupon-value {
  width: 132rpx;
  flex: 0 0 132rpx;
  padding: 15rpx 9rpx;
  border-radius: 16rpx;
  background: #fff4e6;
  color: #c46616;
  text-align: center;
}

.coupon-value b,
.coupon-value small {
  display: block;
}

.coupon-value b {
  font-size: 30rpx;
}

.coupon-value small {
  margin-top: 5rpx;
  font-size: 24rpx;
}

.coupon-copy {
  min-width: 0;
  flex: 1;
}

.coupon-copy text,
.coupon-copy small,
.coupon-copy em {
  display: block;
}

.coupon-copy text {
  color: #0b1a12;
  font-size: 24rpx;
  font-weight: 650;
}

.coupon-copy small {
  margin-top: 6rpx;
  color: #84938a;
  font-size: 24rpx;
}

.coupon-copy em {
  margin-top: 4rpx;
  color: #c46616;
  font-size: 24rpx;
  font-style: normal;
}

.coupon-button {
  min-width: 104rpx;
  color: #12764a;
}

.coupon-button.received {
  border-color: #e3eae5;
  background: #f5f7f6;
  color: #93a29a;
}

.deal-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 16rpx 0;
  border-top: 1rpx solid #edf2ee;
}

.deal-row:first-of-type {
  border-top: 0;
}

.deal-icon {
  display: grid;
  width: 58rpx;
  height: 58rpx;
  flex: 0 0 58rpx;
  place-items: center;
  border-radius: 16rpx;
  background: #fff4e6;
  font-size: 26rpx;
}

.deal-icon.group {
  background: #eaf7ef;
  color: #12764a;
  font-size: 24rpx;
  font-weight: 800;
}

.deal-copy {
  min-width: 0;
  flex: 1;
}

.deal-copy text,
.deal-copy small {
  display: block;
}

.deal-copy text {
  color: #0b1a12;
  font-size: 24rpx;
  font-weight: 650;
}

.deal-copy small {
  margin-top: 6rpx;
  color: #84938a;
  font-size: 24rpx;
}

.deal-price {
  text-align: right;
}

.deal-price b,
.deal-price small {
  display: block;
}

.deal-price b {
  color: #d45b32;
  font-size: 26rpx;
}

.deal-price small {
  margin-top: 4rpx;
  color: #a1ada6;
  font-size: 24rpx;
  text-decoration: line-through;
}

.empty-mini {
  padding: 55rpx 0;
  color: #94a198;
  font-size: 24rpx;
  text-align: center;
}

.trace-search {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.trace-input {
  height: 68rpx;
  min-width: 0;
  flex: 1;
  padding: 0 18rpx;
  border: 1rpx solid #dfe8e2;
  border-radius: 14rpx;
  font-size: 24rpx;
}

/* 说明性文字同样守 24rpx（=12px）可读下限，不靠压字号做层级 */
.trace-tip,
.trace-conclusion {
  display: block;
  margin-top: 12rpx;
  color: #718277;
  font-size: 24rpx;
  line-height: 1.6;
}

.trace-conclusion {
  margin: 16rpx 0 0;
  padding: 14rpx 16rpx;
  border-radius: 12rpx;
  background: #f2fbf5;
  color: #0e5233;
}

.empty-sub {
  display: block;
  margin-top: 8rpx;
  color: #94a198;
  font-size: 24rpx;
  line-height: 1.6;
}

.chain-tag {
  display: inline-block;
  margin-left: 10rpx;
  padding: 2rpx 10rpx;
  border-radius: 8rpx;
  background: #e5f5eb;
  color: #0e5233;
  font-size: 24rpx;
}

.trace-record {
  padding-bottom: 18rpx;
}

.trace-batch {
  display: flex;
  align-items: center;
  gap: 13rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid #edf2ee;
}

.trace-mark {
  display: grid;
  width: 54rpx;
  height: 54rpx;
  place-items: center;
  border-radius: 15rpx;
  background: #eaf7ef;
  color: #12764a;
  font-size: 24rpx;
  font-weight: 800;
}

.batch-code,
.trace-batch small {
  display: block;
}

.batch-code {
  color: #0b1a12;
  font-size: 24rpx;
  font-weight: 700;
}

.trace-batch small {
  margin-top: 4rpx;
  color: #84938a;
  font-size: 24rpx;
}

.timeline {
  padding-top: 15rpx;
}

.timeline-item {
  position: relative;
  display: flex;
  gap: 14rpx;
  padding: 10rpx 0 18rpx;
}

.timeline-dot {
  display: grid;
  width: 34rpx;
  height: 34rpx;
  flex: 0 0 34rpx;
  place-items: center;
  border-radius: 50%;
  background: #e5f5eb;
  color: #12764a;
  font-size: 24rpx;
  font-weight: 700;
}

.timeline-item b,
.timeline-item small {
  display: block;
}

.timeline-item b {
  color: #33453b;
  font-size: 24rpx;
}

.timeline-item small {
  margin-top: 5rpx;
  color: #84938a;
  font-size: 24rpx;
  line-height: 1.5;
}

.after-row {
  padding: 17rpx 0;
  border-top: 1rpx solid #edf2ee;
}

.after-row:first-of-type {
  border-top: 0;
}

.after-head,
.after-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.after-head > view text,
.after-head > view small {
  display: block;
}

.after-head > view text {
  color: #0b1a12;
  font-size: 24rpx;
  font-weight: 700;
}

.after-head > view small {
  margin-top: 5rpx;
  color: #93a29a;
  font-size: 24rpx;
}

.after-reason {
  display: block;
  margin-top: 10rpx;
  color: #52665a;
  font-size: 24rpx;
}

.after-foot {
  margin-top: 10rpx;
}

.after-foot small {
  color: #93a29a;
  font-size: 24rpx;
}

.after-foot b {
  color: #d45b32;
  font-size: 24rpx;
}
</style>

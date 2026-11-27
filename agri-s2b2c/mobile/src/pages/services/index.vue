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

      <view class="section"><button class="btn" @tap="openNative('/pages/coupons/index')">我的优惠券</button><button class="btn" @tap="openNative('/pages/flash/index')">秒杀商品</button><button class="btn" @tap="openNative('/pages/groups/index')">拼团活动</button></view>
      <view class="section">
        <view class="section-head"><view><text class="kicker">COUPON CENTER</text><text class="title">领券中心</text></view><text class="sub">先领券，再下单</text></view>
        <view v-for="coupon in marketing.coupons || []" :key="coupon.id" class="coupon-card">
          <view class="coupon-value">
            <text class="strong-copy">{{ coupon.type === 'DISCOUNT' ? '折扣' : `¥${coupon.amount}` }}</text>
            <text class="small-copy">满 {{ coupon.minAmount }} 元可用</text>
          </view>
          <view class="coupon-copy">
            <text>{{ coupon.name }}</text>
            <text class="small-copy">有效期至 {{ coupon.validEnd }}</text>
            <text class="small-copy">仅剩 {{ coupon.remainCount }} 张</text>
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
        <view v-for="deal in marketing.flashSales || []" :key="deal.id" class="deal-row" @tap="openNative('/pages/product/detail?id='+deal.productId)">
          <view class="deal-icon">⚡</view>
          <view class="deal-copy"><text>{{ deal.productName }}</text><text class="small-copy">{{ deal.remainStock }} / {{ deal.totalStock }} {{ deal.unit }} 可抢</text></view>
          <view class="deal-price"><text class="strong-copy">{{ money(deal.salePrice) }}</text><text class="small-copy">{{ money(deal.originalPrice) }}</text></view>
        </view>
      </view>

      <view class="section">
        <view class="section-head"><view><text class="kicker">COMMUNITY GROUP</text><text class="title">社区拼团</text></view><text class="sub">邻里一起买</text></view>
        <view v-for="group in marketing.groupBuys || []" :key="group.id" class="deal-row" @tap="openNative('/pages/groups/detail?id='+group.id)">
          <view class="deal-icon group">团</view>
          <view class="deal-copy"><text>{{ group.name }}</text><text class="small-copy">{{ group.groupSize }} 人成团 · {{ group.validHours }} 小时内有效</text></view>
          <view class="deal-price"><text class="strong-copy">{{ money(group.groupPrice) }}</text><text class="small-copy">{{ money(group.singlePrice) }}</text></view>
        </view>
      </view>
    </template>

    <template v-else>
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
            <text class="small-copy">{{ trace.productName || trace.cropName }} · {{ trace.origin || trace.farmName || '产地未填' }}</text>
          </view>
        </view>
        <view class="timeline">
          <view v-for="n in trace.nodes" :key="n.seq" class="timeline-item">
            <text class="timeline-dot">{{ n.seq }}</text>
            <view>
              <text class="strong-copy">{{ n.stageName }}<text v-if="n.onChain" class="chain-tag">已上链</text></text>
              <text class="small-copy">{{ n.occurredAt ? String(n.occurredAt).replace('T', ' ').slice(0, 16) : '时间未记录' }} · {{ n.detail }}</text>
            </view>
          </view>
        </view>
        <text class="trace-conclusion">{{ trace.conclusion }}</text>
        <view v-if="trace.sourceBasis === 'UNIT_CODE'" class="trace-circulation">
          <text class="circulation-title">单品履约与流通记录</text>
          <text v-if="!trace.circulationRecorded" class="circulation-empty">已核验生产事实；暂无商城零售流转绑定记录。</text>
          <view v-for="(c, i) in trace.circulation || []" :key="i" class="circulation-item">
            <text>状态：{{ c.orderStatus }} · 承运：{{ c.logisticsCompany || '直发' }}</text>
            <text class="small-copy">绑定履约时间：{{ c.boundAt ? String(c.boundAt).replace('T', ' ').slice(0, 16) : '未记录' }}</text>
          </view>
        </view>
      </view>
    </template>

  </view>
</template>

<script setup lang="ts">
function openNative(url:string) {uni.navigateTo({url})}
import { onMounted, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { mallApi, type MarketingData, type TraceView } from '../../api'
import { session } from '../../session'
import { money, toast } from '../../utils'

/*
 * 售后已拆到「我的售后」（pages/aftersale），从订单详情发起并自动带上订单号与金额。
 * 本页只管营销（领券/秒杀/拼团）和匿名可用的溯源查询；路径不动，包装上已印的 ?code= 二维码继续有效。
 */
const tabs = ['优惠活动', '扫码溯源']
const activeTab = ref(0)
const marketing = ref<MarketingData>({ coupons: [], flashSales: [], groupBuys: [] })
const received = ref<Array<string | number>>([])
const traceQuery = ref('')
const trace = ref<TraceView>({ bound: false, matched: false, nodes: [] })
const traceQueried = ref(false)
const traceLoading = ref(false)

onLoad((options) => {
  if (options?.tab === 'after') {
    // 旧入口兼容：售后已独立成页
    uni.redirectTo({ url: '/pages/aftersale/index' })
    return
  }
  if (options?.tab === 'trace') activeTab.value = 1
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
    const [data, coupons] = await Promise.all([
      mallApi.getMarketing(),
      mallApi.getCoupons(session.user.id),
    ])
    marketing.value = data
    received.value = coupons.map((item) => item.couponId)
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

</script>

<style scoped lang="scss">
.trace-circulation { margin-top: 24rpx; padding-top: 20rpx; border-top: 1rpx dashed #cfe0d5; }
.circulation-title { display: block; font-size: 26rpx; font-weight: 700; color: #16462e; margin-bottom: 8rpx; }
.circulation-empty { display: block; font-size: 24rpx; color: #789082; }
.circulation-item { padding: 8rpx 0; font-size: 24rpx; color: #2d5540; display: flex; flex-direction: column; }

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
  color: #666666;
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
  color: #666666;
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
  color: #8f4500;
  text-align: center;
}

.coupon-value .strong-copy,
.coupon-value .small-copy {
  display: block;
}

.coupon-value .strong-copy {
  font-size: 32rpx;
}

.coupon-value .small-copy {
  margin-top: 5rpx;
  font-size: 24rpx;
}

.coupon-copy {
  min-width: 0;
  flex: 1;
}

.coupon-copy text,
.coupon-copy .small-copy,
.coupon-copy em {
  display: block;
}

.coupon-copy text {
  color: #0b1a12;
  font-size: 24rpx;
  font-weight: 650;
}

.coupon-copy .small-copy {
  margin-top: 6rpx;
  color: #666666;
  font-size: 24rpx;
}

.coupon-copy em {
  margin-top: 4rpx;
  color: #8f4500;
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
  color: #666666;
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
.deal-copy .small-copy {
  display: block;
}

.deal-copy text {
  color: #0b1a12;
  font-size: 24rpx;
  font-weight: 650;
}

.deal-copy .small-copy {
  margin-top: 6rpx;
  color: #666666;
  font-size: 24rpx;
}

.deal-price {
  text-align: right;
}

.deal-price .strong-copy,
.deal-price .small-copy {
  display: block;
}

.deal-price .strong-copy {
  color: #e53935;
  font-size: 32rpx;
}

.deal-price .small-copy {
  margin-top: 4rpx;
  color: #666666;
  font-size: 24rpx;
  text-decoration: line-through;
}

.empty-mini {
  padding: 55rpx 0;
  color: #666666;
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
  color: #666666;
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
  color: #666666;
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
.trace-batch .small-copy {
  display: block;
}

.batch-code {
  color: #0b1a12;
  font-size: 24rpx;
  font-weight: 700;
}

.trace-batch .small-copy {
  margin-top: 4rpx;
  color: #666666;
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

.timeline-item .strong-copy,
.timeline-item .small-copy {
  display: block;
}

.timeline-item .strong-copy {
  color: #33453b;
  font-size: 32rpx;
}

.timeline-item .small-copy {
  margin-top: 5rpx;
  color: #666666;
  font-size: 24rpx;
  line-height: 1.5;
}
</style>

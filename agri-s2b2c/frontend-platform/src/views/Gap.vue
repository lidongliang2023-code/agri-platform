<template>
  <div class="gap-page">
    <div class="page-head">
      <div>
        <h2>{{ info.title }}</h2>
        <p>{{ info.desc }}</p>
      </div>
      <el-tag :type="info.tagType || 'warning'" size="large">{{ info.tag || '能力未接入' }}</el-tag>
    </div>

    <div class="grid">
      <div class="card">
        <h3>能力归属</h3>
        <p class="owner">{{ info.owner }}</p>
        <p class="muted">{{ info.ownerNote }}</p>
      </div>
      <div class="card">
        <h3>当前可用</h3>
        <ul class="list">
          <li v-for="item in info.available" :key="item">{{ item }}</li>
        </ul>
        <el-button v-if="info.link" type="primary" @click="$router.push(info.link)">{{ info.linkText }}</el-button>
      </div>
    </div>

    <div class="card">
      <h3>接入还缺什么</h3>
      <el-table :data="info.gaps" border size="small">
        <el-table-column prop="item" label="缺口" width="220" />
        <el-table-column prop="detail" label="说明" />
      </el-table>
      <p class="note">本页不放演示数据，避免把「机制允许」误当成「事实可用」；缺口补齐后直接替换此页。</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const CATALOG = {
  inventory: {
    title: '库存与云仓',
    desc: '云仓共享库存与门店库存的统一视图。',
    owner: '交易撮合 · 货源库存 / S2B2C · 商品库存',
    ownerNote: '已提供商品供货侧库存视图（库存/7 日动销/可售天数/渠道在售）；云仓/门店分仓与安全库存阈值尚未建模。',
    tag: '部分接入',
    tagType: 'success',
    available: ['商品供货侧库存与货值', '7 日动销、可售天数与低库存/缺货标记', '渠道在售数量'],
    link: '/inventory',
    linkText: '去库存与云仓',
    gaps: [
      { item: '分仓库存', detail: '缺少云仓/门店库存表与调拨记录' },
      { item: '安全库存', detail: '缺少可配置阈值、预警任务与补货建议' },
      { item: '补货写入', detail: '采购/集采归交易撮合，本模块不提供补货下单' },
    ],
  },
  'group-purchase': {
    title: '集采管理',
    desc: '总部集采批次、渠道报名与到货跟踪。',
    owner: 'S2B2C · 集采需求 / 交易撮合 · 采购合同与付款',
    ownerNote: '已支持平台发起批次、渠道报名/改量/取消、截止与到货状态；合同、付款、库存入库不在本模块。',
    tag: '部分接入',
    tagType: 'success',
    available: ['创建集采批次（商品/集采价/起订/目标/时间）', '渠道报名数量汇总与进度', '截止、重新开放、到货确认'],
    link: '/group-purchases',
    linkText: '去集采管理',
    gaps: [
      { item: '采购合同', detail: '合同、账期与付款归交易撮合/财务，本模块不生成' },
      { item: '到货入库', detail: '到货只记状态，不写商品库存与批次' },
      { item: '阶梯价与分配', detail: '缺少按量阶梯价与到货分配规则' },
    ],
  },
  'activity-create': {
    title: '创建营销活动',
    desc: '拼团 / 秒杀 / 满减 / 优惠券的创建与预算。',
    owner: 'S2B2C · 平台营销',
    ownerNote: '优惠券、秒杀、拼团已支持创建、启停与预算/承担方；审批流、费用结算与组合商品尚未建模。',
    tag: '部分接入',
    tagType: 'success',
    available: ['创建优惠券（满减 / 折扣）并启停', '创建秒杀（活动价需低于商品现价）', '创建拼团（2-10 人团，团价低于单买价）',
      '活动预算（原子扣减，可设不限）与费用承担方记录'],
    link: '/activity-create',
    linkText: '去创建活动',
    gaps: [
      { item: '审批与排期', detail: '创建即生效，无审批流与冲突校验' },
      { item: '费用结算', detail: '费用承担方仅做记录，不生成结算单或分摊凭证' },
      { item: '选品与限购', detail: '活动商品仅支持单个商品，无组合与活动库存锁定' },
    ],
  },
  'activity-monitor': {
    title: '活动监控',
    desc: '活动实时 GMV、补贴消耗、爆款与区域热度。',
    owner: 'S2B2C · 平台营销',
    ownerNote: '已提供活动级监控与预算消耗：券按订单 coupon_user_id 归因，秒杀新订单按 flash_sale_id 精确归因，拼团按团订单关联。',
    tag: '部分接入',
    tagType: 'success',
    available: ['优惠券领取/核销/核销订单 GMV', '秒杀售罄与时间窗订单 GMV', '拼团成团数/参团人数/团订单 GMV'],
    link: '/activity-monitor',
    linkText: '去活动监控',
    gaps: [
      { item: '活动主键归因', detail: '券按 coupon_user_id、秒杀新订单按 flash_sale_id 精确归因；历史秒杀订单回退商品+时间窗近似' },
      { item: 'ROI 与分摊', detail: '已有预算消耗与承担方记录，缺少投资回报计算与财务分摊' },
      { item: '区域热度', detail: '订单没有收货省/市聚合接口' },
    ],
  },
  'risk-rules': {
    title: '风控规则',
    desc: '刷单、秒拍秒退、低价倾销等规则与阈值。',
    owner: '风控合规',
    ownerNote: '已支持 4 条规则阈值/启停配置；事件为规则计算，人工复核，不做自动处置。',
    tag: '部分接入',
    tagType: 'success',
    available: ['高退款买家、秒拍秒退、渠道售后率、低价销售四条规则', '阈值与启停可配置'],
    link: '/risk-rules',
    linkText: '去风控规则',
    gaps: [
      { item: '设备/支付图谱', detail: '缺少设备指纹与支付关联数据，无法识别团伙' },
      { item: '自动处置', detail: '不做自动限流/冻结/拉黑，仅提示人工复核' },
      { item: '申诉流程', detail: '缺少事件确认、处置留痕与申诉' },
    ],
  },
  'risk-events': {
    title: '风控事件中心',
    desc: '异常订单、刷单团伙、窜货与内容合规的处置。',
    owner: '风控合规',
    ownerNote: '已提供规则计算的风险信号（买家脱敏、证据与建议）；仅供人工复核，不自动处置。',
    tag: '部分接入',
    tagType: 'success',
    available: ['高退款买家、秒拍秒退、渠道售后率、低价销售信号', '按规则筛选与证据展示'],
    link: '/risk-events',
    linkText: '去风控事件',
    gaps: [
      { item: '团伙识别', detail: '缺少设备/地址/支付图谱，无法识别团伙' },
      { item: '处置留痕', detail: '缺少确认、处置与申诉流程' },
      { item: '内容合规', detail: '缺少文本/视频违规识别' },
    ],
  },
  'ai-ops': {
    title: 'AI 智能运营',
    desc: '选品推荐、动态定价、经营诊断、补货预测与内容生成。',
    owner: 'AI 中台',
    ownerNote: 'AI 能力统一由 AI 中台提供；当前未部署 AI 服务与用量计费，平台端不伪造推荐。',
    available: ['运营大盘真实经营数据（可作未来 AI 输入）'],
    link: '/',
    linkText: '回运营大盘',
    gaps: [
      { item: '模型服务', detail: '缺少选品/定价/诊断/补货模型接口' },
      { item: '用量计费', detail: '缺少配额与账单（订阅计费引擎）' },
      { item: '反馈回路', detail: '缺少采纳率与效果回流数据' },
    ],
  },
}

const info = computed(() => CATALOG[route.params.key] || {
  title: '能力未接入',
  desc: '该入口对应的能力还没有实现。',
  owner: '—',
  ownerNote: '',
  available: [],
  gaps: [],
})
</script>

<style scoped>
.gap-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.card { padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.card h3 { margin: 0 0 10px; font-size: 15px; }
.owner { margin: 0 0 6px; color: #0f6a43; font-weight: 700; }
.muted { margin: 0; color: #84938a; font-size: 12px; line-height: 1.7; }
.list { margin: 0 0 14px; padding-left: 18px; color: #52665a; font-size: 13px; line-height: 1.9; }
.note { margin: 12px 0 0; color: #84938a; font-size: 12px; }
@media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
</style>

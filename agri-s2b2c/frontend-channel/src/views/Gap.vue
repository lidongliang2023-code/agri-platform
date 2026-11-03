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
  'ai-selection': {
    title: 'AI 智能选品',
    desc: '原型中的区域偏好、季节因子与客群画像选品推荐。',
    owner: 'S2B2C · AI 中台能力',
    ownerNote: '推荐需要 AI 中台提供模型与调用配额；当前平台未部署 AI 中台服务，渠道端不自行伪造推荐结果。',
    available: ['平台商品池按销量/佣金率/分类检索', '选品上架与我的货架（真实数据）'],
    link: '/product-pool',
    linkText: '去平台商品池',
    gaps: [
      { item: '推荐接口', detail: '需要 AI 中台按区域/客群返回推荐商品与置信度，当前无服务' },
      { item: '模型配额', detail: '缺少 AI 用量与计费（主责订阅计费引擎）' },
    ],
  },
  'one-click-publish': {
    title: '一键铺货到店',
    desc: '原型中的批量选品、零售价设置与审核后上架。',
    owner: 'S2B2C · 渠道选品',
    ownerNote: '当前渠道端已支持「选品上架」单件铺货；批量铺货与渠道零售价模型尚未建表。',
    available: ['平台商品池单件选品上架', '我的货架查看已选商品'],
    link: '/product-pool',
    linkText: '去选品上架',
    gaps: [
      { item: '渠道零售价', detail: 'channel_product 无 price_override，渠道不能独立定价' },
      { item: '批量铺货', detail: '缺少批量选品/审核流接口' },
      { item: '铺货审核', detail: '当前选品直接 ACTIVE，无平台审核态' },
    ],
  },
  'product-edit': {
    title: '商品编辑',
    desc: '渠道侧的改价、上下架与商品描述维护。',
    owner: 'S2B2C · 渠道货架 / 交易撮合 · 商品主数据',
    ownerNote: '渠道零售价与上下架已落地；标题、图片、卖点属于商品主数据，仍归交易撮合。',
    tag: '部分接入',
    tagType: 'success',
    available: ['我的货架改价（实时生效）', '上架 / 下架（历史订单不受影响）'],
    link: '/listing',
    linkText: '去商品编辑',
    gaps: [
      { item: '标题/卖点/图片', detail: '商品主数据归交易撮合，渠道端不提供修改，需走对方同步协议' },
      { item: '改价审核', detail: '当前改价实时生效，无平台审核/风控阈值（仅有 5 倍上限兜底）' },
      { item: '店铺分类与分组', detail: '渠道店铺分类/货架分组尚未建模' },
    ],
  },
  'customer-ops': {
    title: '客户运营与社群',
    desc: '客户分层、名单导出与触达计划。',
    owner: 'S2B2C · 客户运营 / 用户中心 · 消息推送',
    ownerNote: '已提供真实客户分层、消费汇总与 CSV 导出；企微社群、短信与自动化触达未接入。',
    tag: '部分接入',
    tagType: 'success',
    available: ['新客/活跃/高价值/沉睡分层与人数', '客户名单 CSV 导出（手机号脱敏）'],
    link: '/customer-ops',
    linkText: '去客户运营',
    gaps: [
      { item: '触达通道', detail: '站内信/短信/企微需用户中心与外部企微接入' },
      { item: '运营计划', detail: '缺少人群包保存、触达记录与效果归因' },
    ],
  },
  marketing: {
    title: '营销工作台',
    desc: '平台优惠券、秒杀、拼团与分享推广。',
    owner: 'S2B2C · 平台营销（创建） / 渠道端（引用）',
    ownerNote: '活动由平台运营统一创建；渠道端已展示平台券与适用于本店商品的秒杀/拼团，并提供店铺分享链接。',
    tag: '部分接入',
    tagType: 'success',
    available: ['平台优惠券（只读）', '本店商品适用的秒杀/拼团（只读）', '移动端店铺分享链接复制'],
    link: '/marketing',
    linkText: '去营销中心',
    gaps: [
      { item: '渠道自建活动', detail: '渠道不能创建券/拼团/秒杀，活动统一由平台配置' },
      { item: '预算与承担方', detail: '平台活动缺预算、承担方与渠道分摊' },
      { item: '活动归因', detail: '订单无活动主键，无法统计渠道活动 ROI' },
    ],
  },
  coupon: {
    title: '优惠券管理',
    desc: '平台券与本店可用券。',
    owner: 'S2B2C · 平台营销',
    ownerNote: '平台券由运营创建与承担；渠道端只展示进行中的券，不创建、不改成本分摊。',
    tag: '部分接入',
    tagType: 'success',
    available: ['进行中平台券与门槛/有效期', '剩余数量展示'],
    link: '/marketing/coupons',
    linkText: '去优惠券',
    gaps: [
      { item: '渠道自建券', detail: '缺少渠道券归属与成本承担模型' },
      { item: '定向发券', detail: '缺少按客户分层定向发放' },
    ],
  },
  'group-buy': {
    title: '拼团活动',
    desc: '本店商品可参与的拼团活动。',
    owner: 'S2B2C · 平台营销',
    ownerNote: '拼团由平台创建；渠道端展示适用于本店在架商品的团，不创建与改价。',
    tag: '部分接入',
    tagType: 'success',
    available: ['本店商品可用拼团（团价/人数/有效期）'],
    link: '/marketing/groups',
    linkText: '去拼团活动',
    gaps: [
      { item: '渠道自建拼团', detail: '缺少渠道维度活动与库存锁定' },
      { item: '成团数据', detail: '渠道端暂不展示成团/参团明细' },
    ],
  },
  'flash-sale': {
    title: '秒杀活动',
    desc: '本店商品可参与的秒杀活动。',
    owner: 'S2B2C · 平台营销 / 交易撮合 · 价格保护',
    ownerNote: '秒杀由平台创建并按商品+时间窗生效；渠道端展示本店商品可用的秒杀。',
    tag: '部分接入',
    tagType: 'success',
    available: ['本店商品秒杀价、库存与时间窗'],
    link: '/marketing/flash',
    linkText: '去秒杀活动',
    gaps: [
      { item: '渠道自建秒杀', detail: '缺少渠道场次与活动库存配置' },
      { item: '价格保护', detail: '最低限价规则未建模' },
    ],
  },
  distribution: {
    title: '分销裂变团队',
    desc: '原型中的三级分销、团队抽成与防窜货。',
    owner: 'S2B2C · 线上分销 / 城市合伙人 · 区域分润',
    ownerNote: '三级分销需要独立的邀请关系、佣金差额与合规风控；区域授权归城市合伙人，不在本端。',
    available: ['本渠道直接订单佣金（平台等级规则）'],
    link: '/boundary',
    linkText: '查看模块边界',
    gaps: [
      { item: '分销关系', detail: '缺少邀请码、绑定关系与三级树' },
      { item: '差额分润', detail: '缺少团队抽成计算与结算' },
      { item: '合规风控', detail: '缺少刷单/跨区监测' },
    ],
  },
  'share-promo': {
    title: '分享推广素材',
    desc: '店铺链接、海报与追踪码。',
    owner: 'S2B2C · 渠道营销',
    ownerNote: '已提供移动端店铺链接复制；海报生成与追踪码依赖分销归因，未接入。',
    tag: '部分接入',
    tagType: 'success',
    available: ['移动端店铺链接复制（按渠道店铺归属成交）'],
    link: '/marketing/share',
    linkText: '去分享推广',
    gaps: [
      { item: '海报/短视频', detail: '缺少素材库与生成能力（AI 中台）' },
      { item: '追踪码', detail: '缺少分销归因与专属码' },
    ],
  },
  purchase: {
    title: '集采采购补货',
    desc: '总部集采团与智能补货。',
    owner: 'S2B2C · 集采报名 / 交易撮合 · 采购与补货',
    ownerNote: '已支持查看总部集采批次、报名/改量/取消；合同、付款与到货入库不在本端。',
    tag: '部分接入',
    tagType: 'success',
    available: ['进行中集采批次与报名进度', '报名/改量/取消与我的集采记录'],
    link: '/purchase',
    linkText: '去集采采购',
    gaps: [
      { item: '智能补货建议', detail: '缺少动销预测与安全库存模型' },
      { item: '采购合同/账期', detail: '归交易撮合与财务，本端不生成' },
    ],
  },
  inventory: {
    title: '库存管理',
    desc: '原型中的云仓共享库存与门店现货双口径。',
    owner: 'S2B2C · 商品库存 / 交易撮合 · 货源库存',
    ownerNote: '已提供本渠道在架商品的供货侧库存、7 日动销与可售天数；门店现货与安全库存阈值未建模。',
    tag: '部分接入',
    tagType: 'success',
    available: ['本渠道在架商品库存与可售天数', '渠道内 7 日动销与预警标记'],
    link: '/inventory',
    linkText: '去库存管理',
    gaps: [
      { item: '门店库存', detail: '缺少门店现货表与自提扣减' },
      { item: '安全库存', detail: '缺少可配置阈值与预警任务' },
      { item: '补货', detail: '集采/补货归交易撮合，本端不提供采购单' },
    ],
  },
  'ai-studio': {
    title: 'AI 营销与客服台',
    desc: '原型中的 AI 选品、定价、文案、客服托管、售后预审与经营日报。',
    owner: 'AI 中台',
    ownerNote: 'AI 能力统一由 AI 中台提供；本模块只应做入口与结果展示，当前 AI 中台未部署。',
    available: ['经营看板、售后与客户数据（可供后续 AI 调用）'],
    link: '/boundary',
    linkText: '查看模块边界',
    gaps: [
      { item: 'AI 服务', detail: '缺少选品/文案/客服/预审模型与接口' },
      { item: '用量计费', detail: '缺少配额、用量与账单（订阅计费引擎）' },
      { item: '托管会话', detail: '缺少客服会话存储与转人工规则' },
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

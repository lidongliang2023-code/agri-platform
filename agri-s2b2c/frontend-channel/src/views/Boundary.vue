<template>
  <div class="boundary-page">
    <div class="page-head">
      <div>
        <h2>模块边界与协同说明</h2>
        <p>S2B2C 渠道商端（小 B 店主经营工作台）的能力主责范围与跨模块协同关系。原则：一个能力域只在一个模块有完整实现，其他模块只做引用视图、摘要卡与跳转入口。</p>
      </div>
    </div>

    <div class="card">
      <h3>① 本端主责</h3>
      <el-table :data="owned" border size="small">
        <el-table-column prop="domain" label="能力域" width="260" />
        <el-table-column prop="note" label="说明" />
      </el-table>
    </div>

    <div class="card">
      <h3>② 不主责（引用 / 跳转）</h3>
      <el-table :data="notOwned" border size="small">
        <el-table-column prop="domain" label="能力域" width="260" />
        <el-table-column prop="owner" label="归属模块" width="140" />
        <el-table-column prop="note" label="本端边界" />
      </el-table>
    </div>

    <div class="card">
      <h3>③ 协同数据流</h3>
      <el-table :data="flows" border size="small">
        <el-table-column prop="target" label="协同方" width="140" />
        <el-table-column prop="direction" label="方向" width="110" />
        <el-table-column prop="content" label="数据 / 动作" />
        <el-table-column prop="status" label="当前状态" width="180" />
      </el-table>
      <p class="note">箭头方向以本端为参照：读入 = 引用对方主数据；写出 = 本端经营结果回传对方。</p>
    </div>

    <div class="card">
      <h3>④ 已落地与未接入</h3>
      <div class="gap-grid">
        <div class="gap-col">
          <b>已接真实数据</b>
          <ul>
            <li>渠道档案、商品池选品、我的货架</li>
            <li>渠道零售价与上下架（只改分销层，不改商品主数据）</li>
            <li>渠道订单、订单详情、发货回传物流、售后处理</li>
            <li>客户聚合、画像与客户运营分层/导出（本渠道口径）</li>
            <li>佣金、提现、批次结算、打款流水、月度对账</li>
            <li>经营分析（成交 / 佣金 / 商品排行）</li>
            <li>库存视图（供货侧库存 / 渠道 7 日动销）</li>
            <li>集采批次报名与我的集采记录（不接合同/付款）</li>
            <li>平台营销活动引用（券/秒杀/拼团）与店铺分享链接</li>
            <li>站内通知与通知偏好设置</li>
          </ul>
        </div>
        <div class="gap-col">
          <b>未接入（不做假数据）</b>
          <ul>
            <li>AI 选品 / 定价 / 文案 / 客服托管（无 AI 服务与用量计费）</li>
            <li>渠道自建活动与分销团队（活动由平台创建，本端只读引用）</li>
            <li>门店现货与补货预测（集采报名已接，采购合同/付款归交易撮合）</li>
            <li>商品标题/图片/卖点编辑（主数据归交易撮合）</li>
            <li>区域独家代理分润（主责城市合伙人）</li>
            <li>溯源全链（主责生产管理，当前仅商品引用）</li>
            <li>账号实名与证照审核（主责用户中心）</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const owned = [
  { domain: '小 B 店铺经营（选品、货架、店铺展示）', note: '分销视角的选品与展示；商品主数据与供货价仍引用交易撮合' },
  { domain: '渠道订单与履约', note: '渠道订单归属、发货物流回传、履约状态展示' },
  { domain: '售后处理', note: '本渠道订单的售后同意/拒绝；退款资金动作由平台财务与支付侧执行' },
  { domain: '客户与经营分析（渠道口径）', note: '只聚合在本渠道下过单的客户，不读取跨渠道客户资产' },
  { domain: '佣金、提现与对账', note: '线上分销佣金与店铺结算；区域分润不在本端' },
]

const notOwned = [
  { domain: '商品主数据、货源、供货价', owner: '交易撮合', note: '本端只引用商品池，不另建商品主数据' },
  { domain: '大额 B2B 采购（询价、合同、账期）', owner: '交易撮合', note: '本端只做小额补货与集采团' },
  { domain: '区域独家代理、行政区划授权与分润', owner: '城市合伙人', note: '本端不涉及区域授权' },
  { domain: '农产品实物溯源（地块→农事→检测）', owner: '生产管理', note: '本端只展示溯源入口，不维护溯源数据' },
  { domain: '账号、实名、身份切换', owner: '用户中心', note: '本端用统一账号登录，不重复建账号体系' },
  { domain: '套餐、计量、账单、发票', owner: '订阅计费引擎', note: '本端不生成账单' },
]

const flows = [
  { target: '交易撮合', direction: '读入', content: '货源主数据、商品池、供货价与库存引用', status: '已接（商品池 / 选品）' },
  { target: '交易撮合', direction: '写出', content: '渠道成交结果回传（订单归属渠道）', status: '已接（订单快照）' },
  { target: '消费者端商城', direction: '读入', content: 'C 端成交、会员与支付结果', status: '已接（渠道店铺与购物车归属）' },
  { target: '生产管理', direction: '读入', content: '溯源码、批次检测信息', status: '未接（商品详情仅基础信息）' },
  { target: '城市合伙人', direction: '读入', content: '区域授权与分润规则', status: '未接（当前佣金仅平台等级规则）' },
  { target: '用户中心', direction: '读入', content: '统一账号、实名与资质状态', status: '已接（统一登录）' },
  { target: '订阅计费引擎', direction: '读入', content: '套餐、用量与账单', status: '未接（无计费模块）' },
]
</script>

<style scoped>
.boundary-page { display: flex; flex-direction: column; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.7; max-width: 900px; }
.card { padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.card h3 { margin: 0 0 12px; font-size: 15px; }
.note { margin: 12px 0 0; color: #84938a; font-size: 12px; }
.gap-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.gap-col b { color: #173e2a; font-size: 13px; }
.gap-col ul { margin: 8px 0 0; padding-left: 18px; color: #52665a; font-size: 13px; line-height: 1.9; }
@media (max-width: 900px) { .gap-grid { grid-template-columns: 1fr; } }
</style>

<template>
  <div class="boundary-page">
    <div class="page-head">
      <div>
        <h2>模块边界与协同说明</h2>
        <p>S2B2C 平台运营端的能力主责与跨模块协同。原则：一个能力域只在一个模块有完整实现，其他模块只做引用视图、审核与跳转。</p>
      </div>
    </div>

    <div class="card">
      <h3>① 本端主责</h3>
      <el-table :data="owned" border size="small">
        <el-table-column prop="domain" label="能力域" width="280" />
        <el-table-column prop="note" label="说明" />
      </el-table>
    </div>

    <div class="card">
      <h3>② 不主责（引用 / 审核 / 跳转）</h3>
      <el-table :data="notOwned" border size="small">
        <el-table-column prop="domain" label="能力域" width="280" />
        <el-table-column prop="owner" label="归属模块" width="150" />
        <el-table-column prop="note" label="本端边界" />
      </el-table>
    </div>

    <div class="card">
      <h3>③ 已落地与未接入</h3>
      <div class="gap-grid">
        <div class="gap-col">
          <b>已接真实数据</b>
          <ul>
            <li>运营大盘：GMV / 订单 / 渠道 / 退款率 / 等级分布 / 待办</li>
            <li>商品审核、渠道入驻审核与渠道等级</li>
            <li>订单监控、履约发货、售后复核</li>
            <li>佣金规则、批次结算、提现审批与打款流水、佣金报表</li>
            <li>价盘只读监控（低于供货价 / 高加价）</li>
            <li>商品供货侧库存视图（库存/动销/可售天数）</li>
            <li>集采批次、渠道报名与到货状态（不接合同/付款/库存）</li>
            <li>风控规则阈值配置与风险信号（人工复核，不自动处置）</li>
            <li>营销活动：优惠券 / 秒杀 / 拼团创建与启停（预算与归因未建模）</li>
          </ul>
        </div>
        <div class="gap-col">
          <b>未接入（不做假数据）</b>
          <ul>
            <li>类目溯源模板（主责主数据/生产）</li>
            <li>活动预算、审批、实时监控与订单归因（创建已接）</li>
            <li>团伙识别、自动处置与申诉流程（风控当前只做规则信号）</li>
            <li>AI 智能运营（AI 中台未部署）</li>
            <li>云仓/门店分仓与补货写入（主责交易撮合/仓储）</li>
            <li>区域分润与保证金（主责城市合伙人）</li>
            <li>支付/网银打款通道（仅登记审核与流水号）</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const owned = [
  { domain: '平台供货运营与货源整合', note: '承接原供货商职能：维护自营与合作货源企业档案，整合货源、发布货源商品并维护供货价与库存' },
  { domain: '渠道授权网络与分销规则', note: '负责商品向分销渠道投放、渠道准入授权、限价规则与渠道招募' },
  { domain: '供货履约与协同发货', note: '统一调度与处理供货订单履约、物流发货与待办' },
  { domain: '供货收入、对账与动销分析', note: '为货源整合与渠道赋能提供统一系统支撑、数据报表及动销分析' },
  { domain: '商家入驻审核与等级管理', note: '主体实名与资质核验归用户中心，本端做经营能力与分层判断' },
  { domain: '订单监控、履约调度、售后复核', note: '渠道主责售后处理，平台做复核与兜底' },
  { domain: '佣金规则、批次结算、提现审批', note: '线上分销佣金；区域分润不在本端' },
  { domain: '价盘监控与运营大盘', note: '只读汇总与异常标记，不替代交易撮合定价' },
  { domain: '营销活动运营（创建与启停）', note: '优惠券/秒杀/拼团可创建与启停；预算、承担方与归因未建模' },
]

const notOwned = [
  { domain: '供应商独立端与自主入驻', owner: '已废弃/合并', note: '取消外部供应商独立端与自主入驻，所有供货职能由平台运营承接' },
  { domain: '类目树、条码、属性模板', owner: '主数据管理', note: '本端只做分销展示类目映射' },
  { domain: '区域独家代理、行政区划分润、保证金', owner: '城市合伙人', note: '本端不涉及区域授权与区域分润' },
  { domain: '溯源数据（地块/农事/检测）', owner: '生产管理', note: '本端只展示溯源入口与模板配置诉求' },
  { domain: '账号、实名、身份切换', owner: '用户中心', note: '平台账号由统一认证提供' },
  { domain: '套餐、计量、账单、发票', owner: '订阅计费引擎', note: '本端不生成账单' },
  { domain: '支付、银行打款通道', owner: '外部支付/财务系统', note: '本端只记录审核结论与打款流水号' },
]
</script>

<style scoped>
.boundary-page { display: flex; flex-direction: column; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.7; max-width: 900px; }
.card { padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.card h3 { margin: 0 0 12px; font-size: 15px; }
.gap-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.gap-col b { color: #173e2a; font-size: 13px; }
.gap-col ul { margin: 8px 0 0; padding-left: 18px; color: #52665a; font-size: 13px; line-height: 1.9; }
@media (max-width: 900px) { .gap-grid { grid-template-columns: 1fr; } }
</style>

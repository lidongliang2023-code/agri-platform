<template>
  <div class="boundary-page">
    <div class="page-head">
      <div>
        <h2>模块边界与协同说明</h2>
        <p>S2B2C 供应商端（分销运营台）能力主责与跨模块协同；原则：一个能力域只在一个模块有完整实现，其他模块只做引用、审核或跳转。</p>
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
            <li>分销总览、待办与预警（订单/库存/审核/渠道）</li>
            <li>可投放货源、我的分销池与驳回后重新提审</li>
            <li>投放规则（启停、零售价区间、白名单、最大渠道数与自动撤权）</li>
            <li>超低价自动下架与渠道通知</li>
            <li>分销商招募邀请码与招募关系</li>
            <li>分销商列表/详情、商品授权与撤销</li>
            <li>分销订单、订单详情、发货回传物流、售后协同（只读）</li>
            <li>供货收入估算与按商品/渠道对账</li>
            <li>动销分析与渠道贡献</li>
            <li>站内通知与按事件开关的通知偏好</li>
          </ul>
        </div>
        <div class="gap-col">
          <b>未接入（不做假数据）</b>
          <ul>
            <li>市级/区级限售与最高限价越界自动处理（省级限售、超低价自动下架已接）</li>
            <li>招募活动页与单独佣金协议（邀请码已接）</li>
            <li>AI 投放顾问（AI 中台未部署）</li>
            <li>供货合同、账期、打款与发票（交易撮合/财务）</li>
            <li>售后处理动作（渠道/平台主责，本端只读）</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const owned = [
  { domain: '供货商品与分销池', note: '商品主数据由供应商创建，平台审核后进入可投放货源' },
  { domain: '渠道授权与撤销', note: '渠道选品产生授权；供应商可按商品撤销，历史订单不变' },
  { domain: '分销订单履约', note: '供应商归属订单的发货与物流回传' },
  { domain: '供货收入估算与对账视图', note: '按当前供货价估算；合同与打款归交易撮合/财务' },
  { domain: '动销与渠道贡献分析', note: '仅统计供应商归属订单，不读取渠道内部经营数据' },
]

const notOwned = [
  { domain: '渠道经营、选品定价与客户运营', owner: '渠道商端', note: '本端只看到授权关系与订单结果' },
  { domain: '平台商品审核与风控', owner: 'S2B2C 运营端', note: '审核结论与驳回原因由平台维护' },
  { domain: '消费者购物、支付与退款', owner: '消费者端/支付系统', note: '本端只做履约与售后协同' },
  { domain: '采购合同、账期与打款', owner: '交易撮合/财务', note: '供货收入仅为估算，不代表结算金额' },
  { domain: '账号实名、主体资质', owner: '用户中心', note: '主体与证照在用户中心维护' },
  { domain: '区域分润与代理授权', owner: '城市合伙人', note: '本端不涉及区域分润' },
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

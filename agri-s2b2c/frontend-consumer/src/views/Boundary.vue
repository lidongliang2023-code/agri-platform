<template>
  <div class="m-container boundary">
    <div class="m-page-hd">
      <h1>模块边界与协同说明</h1>
      <span class="sub">消费者端只做「买」：浏览、下单、支付、收货、售后发起。货源、生产、审核、履约动作都在别的模块。</span>
    </div>

    <section class="m-card m-card-pad">
      <h3 class="blk-title">① 本模块能力主责</h3>
      <el-table :data="capabilityRows" border>
        <el-table-column prop="domain" label="能力域" width="150" />
        <el-table-column prop="owner" label="归属" width="240" />
        <el-table-column prop="scope" label="范围" min-width="240" />
        <el-table-column prop="note" label="边界说明" min-width="260" />
      </el-table>
    </section>

    <section class="m-card m-card-pad">
      <h3 class="blk-title">② 协同关系</h3>
      <div class="flow">
        <div class="flow-col">
          <div class="flow-box ext">
            <b>主数据管理</b>
            <small>商品主数据 · 品类编码 · 产地行政区划</small>
          </div>
          <div class="flow-box ext">
            <b>生产管理</b>
            <small>种植 / 采收 / 加工批次 · 全链路溯源</small>
          </div>
          <div class="flow-box ext">
            <b>交易撮合</b>
            <small>大宗供需撮合（与零售下单不同域）</small>
          </div>
        </div>

        <div class="flow-mid">
          <span class="arrow">→</span>
          <span class="arrow">→</span>
          <span class="arrow">→</span>
        </div>

        <div class="flow-col">
          <div class="flow-box core">
            <b>消费者端（本模块）</b>
            <small>商品浏览 · 购物车 · 下单支付 · 收货 · 售后发起 · 营销领取</small>
          </div>
        </div>

        <div class="flow-mid">
          <span class="arrow">↔</span>
        </div>

        <div class="flow-col">
          <div class="flow-box peer">
            <b>供应商端</b>
            <small>商品上架 · 订单发货</small>
          </div>
          <div class="flow-box peer">
            <b>商家端</b>
            <small>选品分销 · 佣金结算</small>
          </div>
          <div class="flow-box peer">
            <b>平台运营端</b>
            <small>审核 · 活动配置 · 售后处理 · 佣金</small>
          </div>
        </div>
      </div>
      <p class="muted small flow-note">
        实线关系均为接口调用或页面跳转，<b>没有跨库直连</b>：消费者端只读写自己的
        <code>s2b2c_*</code> 表，溯源与商品主数据以只读方式消费对方能力。
      </p>
    </section>

    <section class="m-card m-card-pad">
      <h3 class="blk-title">③ 跨模块跳转清单</h3>
      <el-table :data="crossModuleRows" border>
        <el-table-column prop="target" label="目标模块" width="150" />
        <el-table-column prop="page" label="跳转页面" min-width="190" />
        <el-table-column prop="scene" label="使用场景" min-width="250" />
        <el-table-column prop="entry" label="入口" width="170" />
        <el-table-column label="前往" width="90">
          <template #default="{ row }">
            <a class="go" :href="row.href" target="_blank" rel="noopener">前往</a>
          </template>
        </el-table-column>
      </el-table>
      <p class="muted small flow-note">
        供应商端、平台运营端不对消费者开放登录，链接仅用于联调核对；正式环境由网关按角色拦截。
      </p>
    </section>

    <section class="m-card m-card-pad">
      <h3 class="blk-title">④ 本模块明确不做的事</h3>
      <div class="not-do">
        <div v-for="item in notDo" :key="item.title" class="nd-item">
          <b>{{ item.title }}</b>
          <span>{{ item.desc }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { capabilityRows, crossModuleRows } from '../config/cross-module'

// 这些是「看起来能做、但按域不该做」的能力，写清楚比偷偷补一个假接口更安全
const notDo = [
  { title: '不维护商品主数据', desc: '商品档案、品类编码由主数据管理与供应商端负责，消费者端只读。' },
  { title: '不做商品审核与上下架', desc: '审核在平台运营端，上架在供应商端；消费者端只消费 APPROVED 商品。' },
  { title: '不做发货与退款打款', desc: '发货由供应商端/运营端履约，退款由运营端审核后走财务，消费者端只发起申请。' },
  { title: '不生成溯源数据', desc: '批次、检测报告由生产环节写入；消费者端只查询与展示，不回写。' },
  { title: '不做 AI 推荐模型', desc: '首页「智能选品」用的是销量/库存/产地规则打分，AI 能力属于 AI 中台，未接入前不冒充。' },
  { title: '不保存支付凭证', desc: '当前为演示支付通道，确认支付只改订单状态，不接真实支付网关、不落支付流水。' },
]
</script>

<style scoped>
.boundary {
  margin-top: 18px;
}

.blk-title {
  margin: 0 0 14px;
  font-size: 15.5px;
  font-weight: 800;
}

.boundary section + section {
  margin-top: 16px;
}

.flow {
  display: grid;
  grid-template-columns: 1fr 40px 1.1fr 40px 1fr;
  gap: 8px;
  align-items: center;
}

.flow-col {
  display: grid;
  gap: 10px;
}

.flow-mid {
  display: grid;
  gap: 14px;
  justify-items: center;
  color: #9fb3a7;
  font-size: 18px;
}

.flow-box {
  padding: 12px 14px;
  border: 1px solid #e3eae5;
  border-radius: 10px;
  background: #fff;
}

.flow-box b {
  display: block;
  font-size: 13.5px;
}

.flow-box small {
  display: block;
  margin-top: 3px;
  color: #6b7c72;
  font-size: var(--agri-font-size-micro);
  line-height: 1.6;
}

.flow-box.ext {
  background: #f7faf8;
}

.flow-box.core {
  border-color: #12764a;
  background: linear-gradient(140deg, #f1fbf5, #ffffff);
  box-shadow: 0 8px 20px rgba(18, 118, 74, .08);
}

.flow-box.core b {
  color: #12764a;
  font-size: 14.5px;
}

.flow-box.peer {
  background: #fbfdfc;
}

.flow-note {
  margin: 14px 0 0;
  line-height: 1.8;
}

.flow-note code {
  padding: 1px 5px;
  border-radius: 4px;
  background: #f1f5f2;
  color: #12764a;
}

.go {
  color: #12764a;
  font-size: 13px;
  font-weight: 600;
}

.not-do {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.nd-item {
  padding: 14px 16px;
  border: 1px solid #e3eae5;
  border-left: 3px solid #d88718;
  border-radius: 10px;
  background: #fffdf8;
}

.nd-item b {
  display: block;
  margin-bottom: 4px;
  font-size: 13.5px;
}

.nd-item span {
  color: #6b7c72;
  font-size: 12.5px;
  line-height: 1.7;
}

@media (max-width: 1080px) {
  .flow { grid-template-columns: minmax(0, 1fr); }
  .flow-mid { grid-auto-flow: column; }
  .not-do { grid-template-columns: minmax(0, 1fr); }
}
</style>

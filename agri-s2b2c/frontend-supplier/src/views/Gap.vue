<template>
  <div class="gap-page">
    <div class="page-head">
      <div>
        <h2>{{ info.title }}</h2>
        <p>{{ info.desc }}</p>
      </div>
      <el-tag type="warning" size="large">能力未接入</el-tag>
    </div>
    <div class="grid">
      <div class="card">
        <h3>能力归属</h3>
        <p class="owner">{{ info.owner }}</p>
        <p class="muted">{{ info.ownerNote }}</p>
      </div>
      <div class="card">
        <h3>当前可用</h3>
        <ul class="list"><li v-for="item in info.available" :key="item">{{ item }}</li></ul>
        <el-button v-if="info.link" type="primary" @click="$router.push(info.link)">{{ info.linkText }}</el-button>
      </div>
    </div>
    <div class="card">
      <h3>接入还缺什么</h3>
      <el-table :data="info.gaps" border size="small">
        <el-table-column prop="item" label="缺口" width="220" />
        <el-table-column prop="detail" label="说明" />
      </el-table>
      <p class="note">本页不放演示数据；缺口补齐后直接替换此页。</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const CATALOG = {
  'listing-config': {
    title: '投放规则配置',
    desc: '零售价区间、渠道白名单与授权规则。',
    owner: 'S2B2C · 供应商分销',
    ownerNote: '已支持启停投放、零售价区间（不低于供货价）、白名单、最大渠道数、省级限售区域与超低价自动下架；市级/区级限售未建模。',
    tag: '部分接入',
    tagType: 'success',
    available: ['按商品启停渠道投放', '零售价区间（最低不得低于供货价）', '白名单/最大渠道数/自动撤权', '超低价自动下架并通知'],
    link: '/listing-config',
    linkText: '去投放规则',
    gaps: [
      { item: '市级/区级限售', detail: '当前只按收货省份校验，缺少按市/区/商圈的投放限制' },
      { item: '最高限价越界', detail: '高于最高限价的在售价只提示，不自动下架/调价' },
    ],
  },
  'recruit': {
    title: '分销商招募',
    desc: '邀请渠道商、佣金协议与招募活动。',
    owner: 'S2B2C · 供应商分销',
    ownerNote: '已支持邀请码生成/停用、渠道带码入驻绑定与审核状态同步；佣金协议仍由平台统一规则。',
    tag: '部分接入',
    tagType: 'success',
    available: ['邀请码（数量上限/有效期/停用）', '渠道带码入驻自动绑定招募关系', '平台审核结果同步'],
    link: '/recruit',
    linkText: '去分销商招募',
    gaps: [
      { item: '单独佣金协议', detail: '佣金由平台规则统一，供应商不能单独签约' },
      { item: '招募活动页', detail: '缺少对外招募落地页与奖励规则' },
    ],
  },
  'ai-advisor': {
    title: 'AI 投放顾问',
    desc: '选品建议、定价与渠道匹配。',
    owner: 'AI 中台',
    ownerNote: 'AI 能力统一由 AI 中台提供；当前未部署服务，供应商端不伪造建议。',
    available: ['真实动销分析与渠道贡献数据'],
    link: '/analytics',
    linkText: '去动销分析',
    gaps: [
      { item: '模型服务', detail: '缺少选品/定价/渠道匹配接口' },
      { item: '用量计费', detail: '缺少配额与账单（订阅计费引擎）' },
    ],
  },
  'notice-settings': {
    title: '协同与通知设置',
    desc: '订单、售后与库存通知。',
    owner: '用户中心 · 消息推送 / 外部企微',
    ownerNote: '已支持站内通知按事件开关；短信、企微与订阅消息未接入。',
    tag: '部分接入',
    tagType: 'success',
    available: ['新订单/发货协同等站内通知开关', '通知偏好在通知设置页维护'],
    link: '/notice-settings',
    linkText: '去通知设置',
    gaps: [
      { item: '触达通道', detail: '短信、企业微信、小程序订阅消息未接入' },
      { item: '免打扰与频次', detail: '缺少时间段与频次限制' },
    ],
  },
}
const info = computed(() => CATALOG[route.params.key] || {
  title: '能力未接入', desc: '该入口对应的能力还没有实现。', owner: '—', ownerNote: '', available: [], gaps: [],
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

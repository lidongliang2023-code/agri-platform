<template>
  <div class="mds-page">
    <PageHeader
      title="模块边界"
      subtitle="企业端能做什么、哪些要去别的模块办：主数据负责组织 / 品类 / 客商档案，账号与实名归用户中心。"
      source="架构约定"
    />

    <NoticeBar tone="info" title="一句话判据：">
      本页能编辑的只有主数据档案；账号、实名、证照上传、消息发送都在用户中心，本端只读展示其结果。
    </NoticeBar>

    <div class="mds-card">
      <div class="mds-card-head">
        <h2 class="mds-card-title">职责划分</h2>
      </div>
      <div class="mds-card-body mds-card-body--flush">
        <table class="mds-table">
          <thead>
            <tr>
              <th style="width: 30%">能力</th>
              <th style="width: 20%">归属</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.area">
              <td class="mds-name">{{ row.area }}</td>
              <td><StatusTag :text="row.owner" :tone="row.owner === '主数据（本端）' ? 'success' : 'gray'" plain /></td>
              <td class="mds-muted">{{ row.note }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="mds-card">
      <div class="mds-card-head">
        <div>
          <h2 class="mds-card-title">去别的系统办</h2>
          <p class="mds-card-sub">按本机端口生成，生产环境替换为域名即可</p>
        </div>
      </div>
      <div class="mds-card-body">
        <div class="mds-grid mds-grid--3">
          <div v-for="link in links" :key="link.name" class="link-card">
            <div class="link-head">
              <strong>{{ link.name }}</strong>
              <button class="mds-btn mds-btn--link" @click="open(link.url)">打开 ↗</button>
            </div>
            <p class="mds-hint">{{ link.note }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import PageHeader from '@/components/ui/PageHeader.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import StatusTag from '@/components/ui/StatusTag.vue'

const rows = [
  { area: '组织 / 部门 / 成员 / 角色', owner: '主数据（本端）', note: '组织与成员档案按主体隔离维护（接口待接入，见左侧「待接入」标记）' },
  { area: '品类 / 属性模板 / 商品档案', owner: '主数据（本端）', note: '平台标准品类全租户共享，租户自定义分类隔离' },
  { area: '客户 / 供应商档案', owner: '主数据（本端）', note: '客商主数据唯一维护入口；交易模块只读引用' },
  { area: '租户信息 / 套餐 / 配额', owner: '主数据 · 订阅计费', note: '套餐与配额由平台运营配置，本端只读' },
  { area: '账号资料 / 密码 / 二次验证', owner: '用户中心', note: '统一认证账号体系，企业端不保存密码' },
  { area: '实名认证 / 资质证照', owner: '用户中心', note: '证照采集、OCR 与审核在用户中心，主数据只保留结果' },
  { area: '消息与通知', owner: '用户中心', note: '站内信与模板由用户中心发送与维护' },
  { area: '农场地块 / 农事 / 采收', owner: '生产管理', note: '生产数据归生产域，本端只引用主体与组织' },
  { area: '合同 / 订单 / 支付', owner: '交易撮合', note: '交易单据引用本端商品与客商主数据' },
]

const host = window.location.hostname
const links = [
  {
    name: '用户中心',
    url: `${window.location.protocol}//${host}:8115/user-center-ops/`,
    note: '账号、实名、证照、消息的唯一入口',
  },
  {
    name: '交易撮合（会员中心）',
    url: `${window.location.protocol}//${host}:8086/member/buyer`,
    note: '商品上架、采购需求、订单与合同',
  },
  {
    name: '主数据运营端',
    url: `${window.location.protocol}//${host}:8080/dashboard`,
    note: '平台侧管理入口（需运营权限）',
  },
  {
    name: '生产管理',
    url: `${window.location.protocol}//${host}/production/login`,
    note: '农场地块、农事与采收记录',
  },
  {
    name: '物联网管理',
    url: `${window.location.protocol}//${host}:8101/`,
    note: '设备、网关与告警规则',
  },
  {
    name: '信息资讯',
    url: `${window.location.protocol}//${host}:8104/info/`,
    note: '供需大厅与行情资讯',
  },
]

function open(url: string) {
  window.open(url, '_blank', 'noopener')
}
</script>

<style scoped>
.link-card {
  padding: 14px 16px;
  border: 1px solid var(--mds-line);
  border-radius: 8px;
  background: #fcfdfc;
}

.link-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.link-head strong {
  font-size: 13.5px;
}
</style>

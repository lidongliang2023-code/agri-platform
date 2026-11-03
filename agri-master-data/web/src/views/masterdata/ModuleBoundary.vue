<template>
  <div class="mds-page">
    <PageHeader
      title="模块边界与协同说明"
      subtitle="主数据管理 = 组织 / 租户 / 品类与属性 / 数据标准与质量 / 客商主数据的唯一主责模块。本页说明「谁主责、谁引用、怎么跳」。"
      source="架构约定"
    />

    <NoticeBar tone="info" title="判据：">
      下表「✅ 本模块主责」的数据只能在本模块写入；其它模块只做引用与只读展示。
      账号、实名、身份切换、消息归用户中心 —— 因此主数据侧的「用户 / 实名」页面全部是只读视图，
      并在页头提供跳转入口。
    </NoticeBar>

    <div class="mds-card">
      <div class="mds-card-head">
        <h2 class="mds-card-title">① 本模块职责边界</h2>
      </div>
      <div class="mds-card-body mds-card-body--flush">
        <table class="mds-table">
          <thead>
            <tr>
              <th style="width: 30%">能力域</th>
              <th style="width: 18%">归属</th>
              <th>说明 / 唯一数据源</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in boundaries" :key="row.area">
              <td class="mds-name">{{ row.area }}</td>
              <td>
                <StatusTag
                  :text="row.owned ? '本模块主责' : row.owner"
                  :tone="row.owned ? 'success' : 'gray'"
                  plain
                />
              </td>
              <td class="mds-muted">{{ row.note }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="mds-card">
      <div class="mds-card-head">
        <div>
          <h2 class="mds-card-title">② 协同关系</h2>
          <p class="mds-card-sub">实线 = 数据引用；虚线 = 上报 / 归集（跨模块一律通过接口或事件，不共享库表）</p>
        </div>
      </div>
      <div class="mds-card-body">
        <div class="mds-grid mds-grid--3">
          <div v-for="link in collaborations" :key="link.name" class="collab-card">
            <div class="collab-head">
              <span class="collab-name">{{ link.name }}</span>
              <button class="mds-btn mds-btn--link" @click="open(link.url)">打开 ↗</button>
            </div>
            <p class="mds-hint">{{ link.note }}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="mds-card">
      <div class="mds-card-head">
        <div>
          <h2 class="mds-card-title">③ 跨模块跳转清单</h2>
          <p class="mds-card-sub">地址按本机部署目录生成；生产环境替换为对应域名即可</p>
        </div>
      </div>
      <div class="mds-card-body mds-card-body--flush">
        <table class="mds-table">
          <thead>
            <tr>
              <th>目标模块</th>
              <th>页面</th>
              <th>使用场景</th>
              <th class="mds-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="link in jumps" :key="link.name">
              <td class="mds-name">{{ link.name }}</td>
              <td class="mds-mono">{{ link.url }}</td>
              <td class="mds-muted">{{ link.scene }}</td>
              <td class="mds-actions">
                <button class="mds-btn mds-btn--link" @click="open(link.url)">前往</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import PageHeader from '@/components/ui/PageHeader.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import StatusTag from '@/components/ui/StatusTag.vue'

interface BoundaryRow {
  area: string
  owned: boolean
  owner: string
  note: string
}

const boundaries: BoundaryRow[] = [
  {
    area: '组织架构 / 部门 / 岗位 / 成员角色',
    owned: true,
    owner: '',
    note: '组织节点按 tenant_id 行级隔离，层级上限由套餐约束；平台侧只读全量组织树',
  },
  {
    area: '租户（经营主体）主档与配额',
    owned: true,
    owner: '',
    note: '主体主档与统一认证一一对应；本模块只做生命周期与套餐/配额，不新建主体',
  },
  {
    area: '品类标准 / 属性模板 / SPU 编码规则',
    owned: true,
    owner: '',
    note: '平台标准品类全租户共享，租户自定义分类隔离；SKU 编码由编码规则统一生成',
  },
  {
    area: '数据字典 / 格式标准 / 质量与分发',
    owned: true,
    owner: '',
    note: '字典与格式是各业务模块字段取值的来源；质量问题工单与分发任务在本模块闭环',
  },
  {
    area: '客户 / 供应商主数据',
    owned: true,
    owner: '',
    note: '客商档案的唯一维护入口；交易撮合的客商视图为只读引用',
  },
  {
    area: '账号注册 / 实名 / 身份切换 / 消息',
    owned: false,
    owner: '用户中心',
    note: '本模块只保留「用户索引 + 实名结果」只读视图，认证审核在用户中心运营端办理',
  },
  {
    area: '农场地块 / 种植 / 农事 / 采收',
    owned: false,
    owner: '生产管理',
    note: '生产主体与地块数据归生产域；本模块只引用主体与组织节点',
  },
  {
    area: '设备 / 网关 / 告警规则 / OTA',
    owned: false,
    owner: '物联网管理',
    note: '设备归属组织与地块，由设备域引用本模块的组织与地块主数据',
  },
  {
    area: '合同 / 订单 / 支付 / 物流',
    owned: false,
    owner: '交易撮合',
    note: '交易单据引用商品 SPU 与客商主数据，不反向写入本模块',
  },
  {
    area: '授信 / 融资 / 风控',
    owned: false,
    owner: '供应链金融',
    note: '金融域引用客商信用与额度视图，不持有客商主档',
  },
  {
    area: '套餐计费 / 账单 / 发票',
    owned: false,
    owner: '订阅计费',
    note: '本模块维护套餐配额基线；计费与账单在计费引擎',
  },
]

const host = window.location.hostname

const collaborations = [
  {
    name: '用户中心',
    url: `${window.location.protocol}//${host}:8115/user-center-ops/`,
    note: '账号、实名、身份、消息的唯一入口；主数据侧只读引用用户索引与实名结果。',
  },
  {
    name: '生产管理',
    url: `${window.location.protocol}//${host}:8190/`,
    note: '组织节点向下挂接农场与地块；生产域回传主体经营规模。',
  },
  {
    name: '物联网管理',
    url: `${window.location.protocol}//${host}:8102/`,
    note: '设备与网关归属组织；本模块提供组织与品类标准。',
  },
  {
    name: '交易撮合',
    url: `${window.location.protocol}//${host}:8086/`,
    note: '商品与客商主数据的消费方；订单成交关系可用于客商画像。',
  },
  {
    name: '供应链金融',
    url: `${window.location.protocol}//${host}:8081/finance/`,
    note: '引用客商信用与授信额度视图。',
  },
  {
    name: '政府监管',
    url: `${window.location.protocol}//${host}:8110/gov-ops/`,
    note: '主体与证照信息上报；监管侧只读。',
  },
]

const jumps = [
  {
    name: '用户中心运营端',
    url: `${window.location.protocol}//${host}:8115/user-center-ops/`,
    scene: '账号冻结、重置密码、实名与资质审核、消息模板',
  },
  {
    name: '生产管理运营端',
    url: `${window.location.protocol}//${host}:8190/`,
    scene: '核查组织节点下的农场、地块与生产任务',
  },
  {
    name: '物联网运营端',
    url: `${window.location.protocol}//${host}:8102/`,
    scene: '核查设备归属与告警规则',
  },
  {
    name: '交易撮合平台端',
    url: `${window.location.protocol}//${host}:8086/`,
    scene: '商品上架、客商关系视图、订单成交数据',
  },
  {
    name: '供应链金融',
    url: `${window.location.protocol}//${host}:8081/finance/`,
    scene: '客商授信与风险名单核对',
  },
  {
    name: '信息资讯运营端',
    url: `${window.location.protocol}//${host}:8113/info-ops/`,
    scene: '供需大厅与行情数据来源核对',
  },
  {
    name: '综合服务运营端',
    url: `${window.location.protocol}//${host}:8107/service-ops/`,
    scene: '服务商资质与主体一致性核对',
  },
  {
    name: 'S2B2C 平台端',
    url: `${window.location.protocol}//${host}:8103/`,
    scene: '渠道商与供应商主数据引用核对',
  },
]

function open(url: string) {
  window.open(url, '_blank', 'noopener')
}
</script>

<style scoped>
.collab-card {
  padding: 14px 16px;
  border: 1px solid var(--mds-line);
  border-radius: 8px;
  background: #fcfdfc;
}

.collab-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.collab-name {
  font-size: 13.5px;
  font-weight: 600;
}
</style>

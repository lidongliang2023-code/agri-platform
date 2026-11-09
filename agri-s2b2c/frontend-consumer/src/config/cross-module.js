/**
 * 跨模块跳转清单（消费者端唯一出口）。
 *
 * 消费者域只做「商品浏览 → 下单 → 履约 → 售后」，货源主数据、生产溯源链、交易撮合
 * 都属于别的模块。这里集中登记目标，避免各页面散落硬编码域名；地址按当前主机名拼装，
 * 换机器/换环境不用改代码。
 */
const host = typeof window === 'undefined' ? '127.0.0.1' : window.location.hostname

function app(port, path = '/') {
  return `http://${host}:${port}${path}`
}

export const crossModule = {
  masterData: app(8080, '/'), // 主数据管理：货源主数据、品类标准
  production: app(80, '/'), // 生产管理：种植批次与全链路溯源
  trade: app(8086, '/'), // 交易撮合：大宗供需撮合
  supplier: app(8084, '/'), // S2B2C 供应商端（供货方）
  channel: app(8085, '/'), // S2B2C 商家端（小 B 分销）
  platform: app(8103, '/'), // S2B2C 平台运营端
}

/**
 * 生产端「全链路溯源」深链（消费者点开后看到同一批次在生产侧的原始登记）。
 *
 * 地址口径只认这一处，因为生产端是 createBrowserRouter（history 模式）：
 * - 网关把 /prod/ 当成静态产物目录（bucket/prod/index.html），业务路由在**根路径**上，
 *   所以写成 `…/prod/production/…` 会命中不到路由、`…/prod/#/…` 更是直接把 # 之后的部分当 hash 丢掉；
 * - 实测 `http://localhost/production/trace/full-chain?code=…` 才是渲染出链路的那一个。
 *
 * 参数名以生产端页面实际读取的为准：它读 `?code=` 与 `?batchId=`（FullChainTrace.tsx 的
 * useSearchParams），批次号也能当 batchId 传——后端 requireBatch 两个都认。
 *
 * @param {{ code?: string, batchId?: string }} params 有码优先带码（消费者手上就是这支码）
 * @returns {string} 可直接放在 <a href> 里的绝对地址
 */
export function productionChainUrl({ code = '', batchId = '' } = {}) {
  const params = new URLSearchParams()
  if (code) params.set('code', String(code))
  else if (batchId) params.set('batchId', String(batchId))
  const query = params.toString()
  const base = crossModule.production.endsWith('/') ? crossModule.production : `${crossModule.production}/`
  return `${base}production/trace/full-chain${query ? `?${query}` : ''}`
}

/** 模块边界页用的能力归属清单（与后端 /api/consumer 的职责边界一一对应）。 */
export const capabilityRows = [
  {
    domain: '商品浏览与检索',
    owner: '本模块（消费者端）',
    scope: '在架商品、分类树、搜索、商品详情、商品评价',
    note: '只读消费商品；上下架与审核归供应商端与运营端',
  },
  {
    domain: '交易与订单',
    owner: '本模块（消费者端）',
    scope: '购物车、下单（按供应商/渠道拆单）、支付、收货、取消',
    note: '拆单与佣金计算由本模块后端完成，不跨模块写库',
  },
  {
    domain: '营销与会员',
    owner: '本模块（消费者端）',
    scope: '优惠券领取、秒杀、拼团、签到、积分、会员等级',
    note: '活动配置（库存/时间/名额）由运营端维护，消费者端只领取与核销',
  },
  {
    domain: '溯源查询',
    owner: '本模块（消费者端）消费 / 生产管理模块生产',
    scope: '按商品或溯源码查批次、产地、检测报告',
    note: '溯源数据源头在生产管理模块，消费者端只做展示，不回写',
  },
  {
    domain: '货源与品类标准',
    owner: '主数据管理模块',
    scope: '商品主数据、品类编码、产地行政区划',
    note: '消费者端通过跳转查看，不复制主数据表',
  },
  {
    domain: '售后与履约',
    owner: '本模块（消费者端）发起 / 供应商端与运营端处理',
    scope: '售后申请、物流轨迹、退款协商',
    note: '处理动作在运营端，消费者端只读处理意见',
  },
]

export const crossModuleRows = [
  {
    target: '主数据管理',
    page: '货源主数据 › 商品档案',
    scene: '查看商品背后的货源主数据与品类标准',
    entry: '商品详情 / 商品列表',
    href: crossModule.masterData,
  },
  {
    target: '生产管理',
    page: '全链路溯源 › 批次详情',
    scene: '查看种植、采收、加工批次的完整溯源链',
    entry: '溯源查询 / 商品详情',
    href: crossModule.production,
  },
  {
    target: '交易撮合',
    page: '供需大厅 › 采购需求',
    scene: '大宗采购需求撮合（与小批量零售下单不同域）',
    entry: '主导航',
    href: crossModule.trade,
  },
  {
    target: 'S2B2C 供应商端',
    page: '订单履约 › 发货',
    scene: '消费者付款后由供应商发货',
    entry: '无（消费者不可进入）',
    href: crossModule.supplier,
  },
  {
    target: 'S2B2C 平台运营端',
    page: '售后审核 / 活动配置',
    scene: '售后处理、优惠券与秒杀配置',
    entry: '无（消费者不可进入）',
    href: crossModule.platform,
  },
]

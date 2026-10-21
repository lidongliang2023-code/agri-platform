/**
 * 官网门户静态字典（产业链分类、省份与认证说明）。
 *
 * 货源、行情、资讯与公告均由后端接口驱动；页面不再用本文件的演示列表兜底。
 */

export interface PortalProduct {
  name: string
  l1: string
  l2: string
  l3: string
  loc: string
  spec: string
  priceNum: string
  unit: string
  priceVal: number | null
  tag: string
  tagCls: string
  icon: string
  theme: string
}

export const TAXONOMY: Record<string, Record<string, string[]>> = {
  粮油产业: {
    '稻谷·大米': ['粳稻谷', '籼稻谷', '富硒大米', '有机大米'],
    '小麦·面粉': ['强筋小麦', '中筋小麦', '高筋面粉'],
    玉米: ['优质蛋白玉米', '鲜食玉米', '工业玉米'],
    大豆: ['黄大豆', '高蛋白大豆', '黑大豆'],
    油脂: ['一级菜籽油', '一级大豆油', '压榨花生油', '玉米胚芽油'],
  },
  果蔬产业: {
    柑橘: ['赣南脐橙', '砂糖橘', '沃柑'],
    苹果: ['洛川苹果', '红富士', '花牛苹果'],
    设施蔬菜: ['番茄', '黄瓜', '螺丝椒'],
    食用菌: ['香菇', '平菇', '金针菇'],
  },
  畜禽产业: {
    生猪: ['冷鲜猪肉(白条)', '分割猪肉', '生猪(活体)'],
    肉牛: ['冷鲜牛肉', '牛肉(分割)', '育肥牛'],
    家禽: ['白羽肉鸡', '土鸡', '蛋鸡'],
    蛋奶: ['鲜鸡蛋', '生鲜乳', '全脂奶粉'],
  },
  茶药产业: {
    茶叶: ['有机红茶', '西湖龙井', '普洱茶', '福鼎白茶'],
    中药材: ['三七', '枸杞', '当归', '黄芪'],
  },
  饲料农资: {
    饲料: ['豆粕43%', '玉米蛋白粉', '进口鱼粉', '预混料'],
    化肥: ['尿素', '复合微生物肥', '磷酸二铵', '氯化钾'],
    农药: ['生物农药', '除草剂', '杀菌剂'],
    种子: ['杂交玉米种', '水稻种子', '蔬菜种子'],
  },
  水产产业: {
    淡水鱼: ['加州鲈鱼', '草鱼', '鲫鱼'],
    海水养殖: ['大黄鱼', '石斑鱼', '大西洋鲑'],
    虾蟹: ['南美白对虾', '大闸蟹', '小龙虾'],
    贝藻: ['海参', '生蚝', '海带'],
  },
  预制菜: {
    净菜: ['免洗蔬菜', '鲜切水果', '净菜套餐'],
    即烹: ['调味牛排', '调理包', '预制汤品'],
    即食: ['卤味', '罐头', '自热米饭'],
  },
  冷链物流: {
    冷链仓储: ['冷库租赁', '低温仓配', '气调库'],
    冷链运输: ['冷藏干线', '冷链城配', '冷链零担'],
    冷链设备: ['冷藏车', '冷藏集装箱', '保温箱'],
  },
}

export interface Province {
  code: number
  name: string
  group: string
}

export const PROVINCES: Province[] = [
  { code: 11, name: '北京', group: '华北' },
  { code: 12, name: '天津', group: '华北' },
  { code: 13, name: '河北', group: '华北' },
  { code: 14, name: '山西', group: '华北' },
  { code: 15, name: '内蒙古', group: '华北' },
  { code: 21, name: '辽宁', group: '东北' },
  { code: 22, name: '吉林', group: '东北' },
  { code: 23, name: '黑龙江', group: '东北' },
  { code: 31, name: '上海', group: '华东' },
  { code: 32, name: '江苏', group: '华东' },
  { code: 33, name: '浙江', group: '华东' },
  { code: 34, name: '安徽', group: '华东' },
  { code: 35, name: '福建', group: '华东' },
  { code: 36, name: '江西', group: '华东' },
  { code: 37, name: '山东', group: '华东' },
  { code: 41, name: '河南', group: '华中' },
  { code: 42, name: '湖北', group: '华中' },
  { code: 43, name: '湖南', group: '华中' },
  { code: 44, name: '广东', group: '华南' },
  { code: 45, name: '广西', group: '华南' },
  { code: 46, name: '海南', group: '华南' },
  { code: 50, name: '重庆', group: '西南' },
  { code: 51, name: '四川', group: '西南' },
  { code: 52, name: '贵州', group: '西南' },
  { code: 53, name: '云南', group: '西南' },
  { code: 54, name: '西藏', group: '西南' },
  { code: 61, name: '陕西', group: '西北' },
  { code: 62, name: '甘肃', group: '西北' },
  { code: 63, name: '青海', group: '西北' },
  { code: 64, name: '宁夏', group: '西北' },
  { code: 65, name: '新疆', group: '西北' },
  { code: 71, name: '台湾', group: '港澳台' },
  { code: 81, name: '香港', group: '港澳台' },
  { code: 82, name: '澳门', group: '港澳台' },
]

type RawProduct = [
  string, string, string, string, string, string, string, string,
  number | null, string, string, string, string,
]

const RAW: RawProduct[] = [
  ['富硒大米', '粮油产业', '稻谷·大米', '富硒大米', '黑龙江·五常', '25kg/袋', '4680', '/吨', 4680, '基地直供', '', 'seed', 'g'],
  ['有机大米', '粮油产业', '稻谷·大米', '有机大米', '吉林·延边', '10kg/袋', '6800', '/吨', 6800, '有机认证', '', 'seed', 'g'],
  ['粳稻谷', '粮油产业', '稻谷·大米', '粳稻谷', '黑龙江·建三江', '散装', '2760', '/吨', 2760, '国标二等', 'tag-ghost', 'seed', 'g'],
  ['强筋小麦', '粮油产业', '小麦·面粉', '强筋小麦', '河南·新乡', '散装', '2860', '/吨', 2860, '高筋', 'tag-amber', 'seed', 'a'],
  ['高筋面粉', '粮油产业', '小麦·面粉', '高筋面粉', '山东·德州', '25kg/袋', '3980', '/吨', 3980, '面包专用', 'tag-amber', 'box', 'a'],
  ['优质蛋白玉米', '粮油产业', '玉米', '优质蛋白玉米', '吉林·长春', '散装', '2560', '/吨', 2560, '高蛋白', 'tag-amber', 'seed', 'a'],
  ['黄大豆', '粮油产业', '大豆', '黄大豆', '黑龙江·绥化', '散装', '4920', '/吨', 4920, '非转基因', '', 'seed', 'g'],
  ['一级菜籽油', '粮油产业', '油脂', '一级菜籽油', '湖北·荆州', '5L×4桶/箱', '10920', '/吨', 10920, '非转基因', 'tag-amber', 'drop', 'a'],
  ['一级大豆油', '粮油产业', '油脂', '一级大豆油', '山东·日照', '20L/桶', '9280', '/吨', 9280, '港口现货', 'tag-tech', 'drop', 't'],
  ['赣南脐橙', '果蔬产业', '柑橘', '赣南脐橙', '江西·赣州', '20斤/箱', '58', '/箱', 58, '当季鲜果', 'tag-red', 'sun', 'o'],
  ['砂糖橘', '果蔬产业', '柑橘', '砂糖橘', '广西·桂林', '10斤/箱', '42', '/箱', 42, '甜度高', 'tag-red', 'sun', 'o'],
  ['洛川苹果', '果蔬产业', '苹果', '洛川苹果', '陕西·洛川', '20斤/箱', '96', '/箱', 96, '脆甜多汁', 'tag-red', 'sun', 'o'],
  ['番茄', '果蔬产业', '设施蔬菜', '番茄', '山东·寿光', '15kg/箱', '6.8', '/kg', 6.8, '硬粉', '', 'leaf', 'g'],
  ['香菇', '果蔬产业', '食用菌', '香菇', '福建·古田', '5kg/箱', '12', '/kg', 12, '鲜菇冷链', '', 'leaf', 'g'],
  ['冷鲜猪肉（白条）', '畜禽产业', '生猪', '冷鲜猪肉(白条)', '河南·牧原', '冷链直发', '19.8', '/kg', 19.8, '冷链配送', 'tag-tech', 'activity', 'a'],
  ['冷鲜牛肉', '畜禽产业', '肉牛', '冷鲜牛肉', '内蒙古·通辽', '冷链直发', '46', '/kg', 46, '排酸牛肉', 'tag-tech', 'activity', 'a'],
  ['白羽肉鸡', '畜禽产业', '家禽', '白羽肉鸡', '山东·潍坊', '冷冻分割', '8.6', '/kg', 8.6, '分割鸡', 'tag-ghost', 'activity', 'a'],
  ['鲜鸡蛋', '畜禽产业', '蛋奶', '鲜鸡蛋', '河北·石家庄', '360枚/箱', '4.9', '/kg', 4.9, '无抗蛋', '', 'box', 'a'],
  ['有机红茶', '茶药产业', '茶叶', '有机红茶', '云南·临沧', '500g/罐', '286', '/罐', 286, '有机认证', '', 'leaf', 'g'],
  ['福鼎白茶', '茶药产业', '茶叶', '福鼎白茶', '福建·福鼎', '350g/饼', '468', '/饼', 468, '三年陈', '', 'leaf', 'g'],
  ['三七', '茶药产业', '中药材', '三七', '云南·文山', '20头', '860', '/kg', 860, '道地药材', 'tag-amber', 'leaf', 'g'],
  ['豆粕 43% 蛋白', '饲料农资', '饲料', '豆粕43%', '山东·日照港', '散装', '3468', '/吨', 3468, '港口现货', 'tag-tech', 'box', 't'],
  ['尿素', '饲料农资', '化肥', '尿素', '山西·晋城', '50kg/袋', '2280', '/吨', 2280, '46% 氮', 'tag-amber', 'box', 'a'],
  ['复合微生物肥', '饲料农资', '化肥', '复合微生物肥', '山东·临沂', '40kg/袋', '2380', '/吨', 2380, '减施增效', '', 'box', 'g'],
  ['杂交玉米种', '饲料农资', '种子', '杂交玉米种', '辽宁·沈阳', '4000粒/袋', '68', '/袋', 68, '高产抗倒', '', 'seed', 'g'],
  ['加州鲈鱼', '水产产业', '淡水鱼', '加州鲈鱼', '广东·佛山', '活鲜', '36', '/kg', 36, '活鲜配送', 'tag-tech', 'drop', 't'],
  ['大黄鱼', '水产产业', '海水养殖', '大黄鱼', '福建·宁德', '冰鲜', '68', '/kg', 68, '深海养殖', 'tag-tech', 'drop', 't'],
  ['南美白对虾（冻）', '水产产业', '虾蟹', '南美白对虾', '广东·湛江', '净重20kg/箱', '52', '/kg', 52, '出口级', 'tag-tech', 'drop', 't'],
  ['大闸蟹', '水产产业', '虾蟹', '大闸蟹', '江苏·阳澄湖', '3.5两公蟹', '198', '/只', 198, '礼盒装', 'tag-red', 'drop', 't'],
  ['调味牛排', '预制菜', '即烹', '调味牛排', '上海', '150g×10片', '89', '/盒', 89, '即烹', 'tag-violet', 'factory', 'v'],
  ['自热米饭', '预制菜', '即食', '自热米饭', '湖南·长沙', '270g×6盒', '49', '/箱', 49, '即食', 'tag-violet', 'factory', 'v'],
  ['免洗蔬菜', '预制菜', '净菜', '免洗蔬菜', '山东·寿光', '5kg/箱', '9.8', '/kg', 9.8, '净菜', 'tag-violet', 'factory', 'v'],
  ['冷库租赁', '冷链物流', '冷链仓储', '冷库租赁', '山东·青岛', '-18℃ 临港', '询价', '', null, '全程温控', 'tag-tech', 'truck', 't'],
  ['冷藏干线运输', '冷链物流', '冷链运输', '冷藏干线', '全国', '整车 / 零担', '询价', '', null, '全程温控', 'tag-tech', 'truck', 't'],
  ['冷藏车（4.2 米）', '冷链物流', '冷链设备', '冷藏车', '江苏·苏州', '新能源', '询价', '', null, '可租可售', 'tag-tech', 'truck', 't'],
]

export const PRODUCTS: PortalProduct[] = RAW.map((row) => ({
  name: row[0], l1: row[1], l2: row[2], l3: row[3], loc: row[4], spec: row[5],
  priceNum: row[6], unit: row[7], priceVal: row[8], tag: row[9], tagCls: row[10],
  icon: row[11], theme: row[12],
}))

export interface NewsItem {
  tag: string
  tagCls: string
  title: string
  date: string
}

export const NEWS: Record<'policy' | 'market' | 'agri', NewsItem[]> = {
  policy: [
    { tag: '政策', tagCls: 'tag-red', title: '农业农村部：加快智慧农业物联网技术推广应用的指导意见', date: '10-18' },
    { tag: '政策', tagCls: 'tag-red', title: '关于促进农产品产销对接、畅通城乡流通体系的实施意见', date: '10-16' },
    { tag: '政策', tagCls: 'tag-red', title: '农业产业互联网平台建设三年行动方案要点解读', date: '10-14' },
    { tag: '政策', tagCls: 'tag-red', title: '高标准农田建设补贴政策与申报指南', date: '10-12' },
    { tag: '政策', tagCls: 'tag-red', title: '农产品质量安全追溯体系管理办法修订公告', date: '10-10' },
    { tag: '政策', tagCls: 'tag-red', title: '农业供应链金融支持新型农业经营主体的通知', date: '10-08' },
  ],
  market: [
    { tag: '行情', tagCls: 'tag-tech', title: '2026 年全国秋粮收购价格走势周报（10.14-10.20）', date: '10-20' },
    { tag: '数据', tagCls: 'tag-amber', title: '生猪及猪肉价格周度监测：全国均价环比小幅回落', date: '10-19' },
    { tag: '行情', tagCls: 'tag-tech', title: '菜籽油与豆油价格联动分析：进口成本抬升支撑重心', date: '10-18' },
    { tag: '行情', tagCls: 'tag-tech', title: '苹果现货与期货价差走阔，关注入库进度', date: '10-17' },
    { tag: '数据', tagCls: 'tag-amber', title: '尿素与复合肥出厂价监测：秋种需求带动小幅上行', date: '10-16' },
    { tag: '行情', tagCls: 'tag-tech', title: '南美白对虾存塘量与价格月度报告', date: '10-15' },
  ],
  agri: [
    { tag: '农技', tagCls: '', title: '设施蔬菜冬季温湿度调控与病害绿色防控要点', date: '10-19' },
    { tag: '农技', tagCls: '', title: '柑橘黄龙病综合防控技术方案与示范基地成效', date: '10-17' },
    { tag: '农技', tagCls: '', title: '水稻侧深施肥与智能水肥一体化应用指南', date: '10-15' },
    { tag: '农技', tagCls: '', title: '物联网虫情测报灯的使用与数据判读方法', date: '10-13' },
    { tag: '农技', tagCls: '', title: '生猪养殖场环境监测与疫病预警体系建设', date: '10-11' },
    { tag: '农技', tagCls: '', title: '土壤墒情监测站安装与数据校准实操', date: '10-09' },
  ],
}

export const ANNOUNCEMENTS: NewsItem[] = [
  { tag: '通知', tagCls: 'tag-red', title: '2026 年秋粮集中收购期间平台交易规则调整公告', date: '10-18' },
  { tag: '业务', tagCls: 'tag-tech', title: '关于平台上线物联网设备「地块绑定」功能的公告', date: '10-16' },
  { tag: '招募', tagCls: 'tag-amber', title: '面向全国征集优质农产品供应商入驻的公告', date: '10-12' },
  { tag: '通知', tagCls: 'tag-tech', title: '平台 10 月 20 日系统升级维护安排的通知', date: '10-10' },
  { tag: '准入', tagCls: '', title: '新入驻供应商资质审核通过名单公示', date: '10-08' },
]

export interface PriceCommodity {
  name: string
  unit: string
  series: number[]
  rows: { date: string; value: string; change: string; down?: boolean; up?: boolean }[]
}

export const PRICE_COMMODITIES: PriceCommodity[] = [
  {
    name: '一级菜籽油', unit: '元/吨',
    series: [45, 58, 52, 70, 64, 82, 100],
    rows: [
      { date: '10/18', value: '10920.00', change: '0' },
      { date: '10/17', value: '10920.00', change: '0' },
      { date: '10/16', value: '10920.00', change: '0' },
      { date: '10/15', value: '10920.00', change: '-120', down: true },
      { date: '10/14', value: '11040.00', change: '+140', up: true },
    ],
  },
  {
    name: '玉米', unit: '元/吨',
    series: [62, 58, 66, 61, 72, 69, 78],
    rows: [
      { date: '10/18', value: '2560.00', change: '+12', up: true },
      { date: '10/17', value: '2548.00', change: '-6', down: true },
      { date: '10/16', value: '2554.00', change: '+8', up: true },
      { date: '10/15', value: '2546.00', change: '0' },
      { date: '10/14', value: '2546.00', change: '-10', down: true },
    ],
  },
  {
    name: '豆粕', unit: '元/吨',
    series: [70, 74, 68, 80, 76, 88, 92],
    rows: [
      { date: '10/18', value: '3468.00', change: '+18', up: true },
      { date: '10/17', value: '3450.00', change: '+6', up: true },
      { date: '10/16', value: '3444.00', change: '-12', down: true },
      { date: '10/15', value: '3456.00', change: '0' },
      { date: '10/14', value: '3456.00', change: '+22', up: true },
    ],
  },
  {
    name: '生猪', unit: '元/公斤',
    series: [88, 84, 80, 76, 72, 70, 68],
    rows: [
      { date: '10/18', value: '19.80', change: '-0.20', down: true },
      { date: '10/17', value: '20.00', change: '-0.10', down: true },
      { date: '10/16', value: '20.10', change: '+0.05', up: true },
      { date: '10/15', value: '20.05', change: '0' },
      { date: '10/14', value: '20.05', change: '-0.08', down: true },
    ],
  },
  {
    name: '苹果', unit: '元/箱',
    series: [58, 62, 60, 68, 72, 70, 76],
    rows: [
      { date: '10/18', value: '96.00', change: '+2', up: true },
      { date: '10/17', value: '94.00', change: '+1', up: true },
      { date: '10/16', value: '93.00', change: '0' },
      { date: '10/15', value: '93.00', change: '-2', down: true },
      { date: '10/14', value: '95.00', change: '+1', up: true },
    ],
  },
  {
    name: '尿素', unit: '元/吨',
    series: [52, 56, 54, 60, 58, 66, 70],
    rows: [
      { date: '10/18', value: '2280.00', change: '+15', up: true },
      { date: '10/17', value: '2265.00', change: '+5', up: true },
      { date: '10/16', value: '2260.00', change: '0' },
      { date: '10/15', value: '2260.00', change: '-8', down: true },
      { date: '10/14', value: '2268.00', change: '+12', up: true },
    ],
  },
]

export interface CertBenefit {
  icon: string
  title: string
  desc: string
}

export const CERT_BENEFITS: CertBenefit[] = [
  { icon: 'cart', title: '大宗交易准入', desc: '认证后可参与平台大宗交易、在线签约与平台担保交易。' },
  { icon: 'award', title: '认证标识展示', desc: '店铺与商品展示认证标识，提升采购方信任与转化。' },
  { icon: 'money', title: '供应链金融', desc: '凭真实订单与交易数据申请订单融资、收货融资等服务。' },
  { icon: 'truck', title: '物流与仓储权益', desc: '优先匹配冷链干线、仓储与产地直发资源。' },
]

export const CERT_STEPS = [
  { title: '选择认证类型', desc: '企业会员或个体经营者，分别进入企业认证与个人实名认证。' },
  { title: '填写主体信息', desc: '名称、统一社会信用代码/身份证、联系人等基础资料。' },
  { title: '提交证明材料', desc: '营业执照、法人身份证、开户许可证等（需登录后在认证中心上传）。' },
  { title: '平台审核', desc: '运营人员核验材料与主体信息，一般在 1-3 个工作日内完成。' },
  { title: '认证完成', desc: '审核通过后解锁交易、金融与溯源等权益。' },
]

export const CERT_MATERIALS = {
  enterprise: [
    '营业执照（副本）清晰照片或扫描件',
    '法定代表人身份证人像面、国徽面',
    '企业对公账户开户许可证或银行开户证明',
    '联系人手机号（用于接收审核通知）',
    '食品生产/经营许可证（涉及食品类目时提供）',
  ],
  personal: [
    '本人身份证人像面、国徽面',
    '本人实名手机号（用于短信验证与审核通知）',
    '人脸核验（登录后按页面指引完成）',
    '经营类型说明（家庭农场 / 合作社 / 个体采购户等）',
  ],
}

export const CERT_FAQ = [
  {
    q: '个人认证与企业认证有什么区别？',
    a: '个人认证核验自然人身份，适合家庭农场、个体采购户与经纪人；企业认证核验经营主体与对公账户，适合公司、合作社等需要开具企业票据与申请供应链金融的主体。',
  },
  {
    q: '企业认证审核需要多久？可以加急吗？',
    a: '资料齐全时通常 1-3 个工作日完成。平台暂未开放加急通道；如遇集中审核会顺延，可在认证中心查看最新状态。',
  },
  {
    q: '对公账户打款验证是什么？金额会退还吗？',
    a: '平台向企业填写的对公账户打入一笔随机小额款项，企业回填到账金额以证明账户归属。该款项用于验证，不构成收费。',
  },
  {
    q: '认证被驳回后如何重新提交？',
    a: '驳回时会给出具体原因。按原因补充或更正材料后可重新提交；同一主体同时只保留一条待审核申请。',
  },
  {
    q: '证件有效期或企业信息变更了怎么办？',
    a: '登录后在认证中心发起信息变更或更新证件有效期，运营端重新核验后生效。',
  },
]

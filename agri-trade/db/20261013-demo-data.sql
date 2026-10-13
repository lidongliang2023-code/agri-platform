-- ===========================================================================
-- 交易撮合模块 · 演示数据（2026-10-13）
--
-- 三条纪律（与主数据模块的演示数据脚本一致）：
--   1. 全部使用**显式 id**（7000-8099 段），且一律 INSERT IGNORE —— 可重复执行；
--   2. **不挂进 spring.sql.init**（schema.sql 只建表、不灌数据），需要时手工执行：
--        mysql -uroot -proot --default-character-set=utf8mb4 agri_trade -e "source <本文件>"
--   3. 文件末尾保留按 id 区间删除的清理语句（注释状态），要清空演示数据时放开即可。
--
-- 数据口径与前端/后端实际使用的取值对齐（都来自代码，不是随手编的）：
--   product.publish_status   = published / pending   （SmartMatchServiceImpl 只撮合 published）
--   demand.demand_status     = pending / matching / completed
--   order.order_status       = pending / paid / shipped / completed / cancelled
--   order.payment_status     = unpaid / paid / refunded
--   contract.contract_status = pending / signed / effective
--   logistics.logistics_status = pending / in_transit / delivered / signed
--
-- 业务主线：黑龙江禾丰农业等 6 个卖家 → 6 个货源；北京新发地等 4 个买家 → 4 条采购需求；
-- 需求撮合出 5 条匹配记录 → 3 条询价 → 3 条报价 → 4 张订单（含支付、合同、物流、评价、纠纷）。
-- ===========================================================================

/* ---------------------------- 商品分类 ---------------------------- */
INSERT IGNORE INTO `agri_trade_category` (`id`,`parent_id`,`category_name`,`category_code`,`level`,`sort_order`,`status`,`create_by`,`remark`) VALUES
 (5001, NULL, '粮食',   'grain',      1, 1, 1, 'system', NULL),
 (5002, NULL, '蔬菜',   'vegetable',  1, 2, 1, 'system', NULL),
 (5003, NULL, '水果',   'fruit',      1, 3, 1, 'system', NULL),
 (5004, NULL, '畜牧',   'livestock',  1, 4, 1, 'system', NULL),
 (5005, NULL, '水产',   'aquatic',    1, 5, 1, 'system', NULL),
 (5006, NULL, '中药材', 'herb',       1, 6, 1, 'system', NULL),
 (5101, 5001, '大米',   'grain_rice', 2, 1, 1, 'system', NULL),
 (5102, 5003, '苹果',   'fruit_apple',2, 1, 1, 'system', NULL),
 (5103, 5002, '大白菜', 'veg_cabbage',2, 1, 1, 'system', NULL),
 (5104, 5005, '大闸蟹', 'aqua_crab',  2, 1, 1, 'system', NULL);

/* ---------------------------- 货源商品 ---------------------------- */
INSERT IGNORE INTO `agri_trade_product`
 (`id`,`product_code`,`product_name`,`category_id`,`category_name`,`seller_id`,`seller_name`,`variety`,
  `origin_province`,`origin_city`,`origin_district`,`origin_address`,`spec_level`,`spec_size`,`unit`,
  `stock_quantity`,`price_min`,`price_max`,`price`,`price_type`,`min_order_quantity`,`harvest_batch_no`,
  `description`,`view_count`,`favorite_count`,`inquiry_count`,`publish_status`,`valid_until`,`status`,`create_by`) VALUES
 (7001,'P20261013001','东北五常大米 25kg/袋',5101,'大米',2001,'黑龙江禾丰农业','五常稻花香',
  '黑龙江省','哈尔滨市','五常市','五常市民乐朝鲜族乡','一级','25kg/袋','袋',
  12000,118.00,132.00,128.00,'fixed',50,'HB20260920A',
  '当季新米，产地直发，出米率 68%，可提供检测报告。',1863,126,42,'published','2027-03-31',1,'seller_2001'),
 (7002,'P20261013002','有机大白菜 5kg/件',5103,'大白菜',2002,'山东寿光绿源','北京新三号',
  '山东省','潍坊市','寿光市','寿光市田柳镇','特级','5kg/件','件',
  8600,16.50,19.80,18.80,'fixed',100,'HB20261002C',
  '温室有机种植，农残检测合格，冷链直发。',1421,98,31,'published','2026-12-31',1,'seller_2002'),
 (7003,'P20261013003','洛川红富士苹果 10kg/箱',5102,'苹果',2003,'陕西洛川果业','红富士',
  '陕西省','延安市','洛川县','洛川县凤栖镇','一级','10kg/箱','箱',
  5400,62.00,72.00,68.00,'fixed',20,'HB20260928B',
  '海拔 1100 米优生区，糖度 14 以上，单果 200g+。',2107,155,58,'published','2027-01-31',1,'seller_2003'),
 (7004,'P20261013004','草原散养牛肉（冷鲜）',NULL,'畜牧',2004,'内蒙古草原牧业','西门塔尔',
  '内蒙古自治区','锡林郭勒盟','锡林浩特市','锡林浩特市白音锡勒牧场','优级','整牛分割','kg',
  3200,82.00,96.00,89.00,'negotiable',30,'HB20261005D',
  '草原散养 24 个月以上，冷鲜排酸 48 小时，可分割定制。',1675,142,36,'published','2026-12-15',1,'seller_2004'),
 (7005,'P20261013005','阳澄湖大闸蟹 公母对装',5104,'大闸蟹',2005,'江苏江南水产','中华绒螯蟹',
  '江苏省','苏州市','昆山市','昆山市巴城镇','特级','公4两母3两','对',
  2600,158.00,188.00,168.00,'fixed',10,'HB20261008E',
  '当日捕捞顺丰冷链，可提供防伪扣与溯源码。',1320,167,49,'published','2026-11-30',1,'seller_2005'),
 (7006,'P20261013006','云贵三年生三七（干品）',5006,'中药材',2006,'云南云岭药材','文山三七',
  '云南省','文山州','文山市','文山市平坝镇','一级','20头/500g','kg',
  900,420.00,520.00,468.00,'negotiable',5,'HB20260915F',
  '三年生足头三七，皂苷含量达标，附检测报告。',764,58,17,'pending','2027-06-30',1,'seller_2006');

/* ---------------------------- 商品图片 ---------------------------- */
INSERT IGNORE INTO `agri_trade_product_image` (`id`,`product_id`,`image_url`,`image_type`,`sort_order`,`create_by`) VALUES
 (7101,7001,'/images/trade/7001-main.jpg','main',1,'seller_2001'),
 (7102,7001,'/images/trade/7001-detail.jpg','detail',2,'seller_2001'),
 (7103,7002,'/images/trade/7002-main.jpg','main',1,'seller_2002'),
 (7104,7003,'/images/trade/7003-main.jpg','main',1,'seller_2003'),
 (7105,7004,'/images/trade/7004-main.jpg','main',1,'seller_2004'),
 (7106,7005,'/images/trade/7005-main.jpg','main',1,'seller_2005');

/* ---------------------------- 采购需求 ---------------------------- */
INSERT IGNORE INTO `agri_trade_demand`
 (`id`,`demand_no`,`buyer_id`,`buyer_name`,`buyer_type`,`category_id`,`category_name`,`variety`,`quantity`,`unit`,
  `price_min`,`price_max`,`delivery_province`,`delivery_city`,`delivery_district`,`delivery_address`,
  `delivery_deadline`,`quality_requirement`,`certification_require`,`sample_require`,`demand_type`,`demand_status`,
  `expect_response_time`,`response_count`,`create_by`) VALUES
 (7201,'D20261013101',3001,'北京新发地批发市场','wholesaler',5101,'大米','五常稻花香',200,'吨',
  115.00,135.00,'北京市','北京市','丰台区','新发地农产品批发市场粮油区 3 号库',
  '2026-11-20 00:00:00','出米率不低于 66%，水分≤14.5%','需提供质检报告',1,'spot','pending',
  '2026-10-20 18:00:00',2,'buyer_3001'),
 (7202,'D20261013102',3002,'上海盒鲜生供应链','supermarket',5103,'大白菜','北京新三号',50,'吨',
  15.00,20.00,'上海市','上海市','青浦区','青浦区华新镇物流园 B2 库',
  '2026-10-25 00:00:00','单棵 1.5kg 以上，无农残超标','需有机认证',1,'long_term','matching',
  '2026-10-18 18:00:00',3,'buyer_3002'),
 (7203,'D20261013103',3003,'广州华南餐饮集团','restaurant',NULL,'畜牧','冷鲜牛肉',10,'吨',
  80.00,98.00,'广东省','广州市','白云区','白云区江高镇中央厨房冷库',
  '2026-10-28 00:00:00','冷鲜排酸，菌落总数达标，可分割','需动物检疫合格证',0,'spot','matching',
  '2026-10-19 18:00:00',1,'buyer_3003'),
 (7204,'D20261013104',3004,'成都蜀味食品','processor',5102,'苹果','红富士',30,'吨',
  58.00,70.00,'四川省','成都市','双流区','双流区西南航空港经济开发区食品产业园',
  '2026-12-10 00:00:00','糖度 13 以上，单果 180g 以上','需产地证明',1,'presale','pending',
  '2026-10-30 18:00:00',0,'buyer_3004');

/* ---------------------------- 询价 ---------------------------- */
INSERT IGNORE INTO `agri_trade_inquiry`
 (`id`,`inquiry_no`,`demand_id`,`demand_no`,`product_id`,`product_name`,`buyer_id`,`buyer_name`,
  `seller_id`,`seller_name`,`category_id`,`category_name`,`variety`,`quantity`,`unit`,`price_min`,`price_max`,
  `delivery_province`,`delivery_city`,`delivery_address`,`delivery_deadline`,`quality_requirement`,
  `inquiry_status`,`reply_deadline`,`reply_count`,`create_by`) VALUES
 (7301,'I20261013201',7201,'D20261013101',7001,'东北五常大米 25kg/袋',3001,'北京新发地批发市场',
  2001,'黑龙江禾丰农业',5101,'大米','五常稻花香',200,'吨',115.00,135.00,
  '北京市','北京市','新发地农产品批发市场粮油区 3 号库','2026-11-20 00:00:00','出米率不低于 66%，水分≤14.5%',
  'quoted','2026-10-20 18:00:00',1,'buyer_3001'),
 (7302,'I20261013202',7202,'D20261013102',7002,'有机大白菜 5kg/件',3002,'上海盒鲜生供应链',
  2002,'山东寿光绿源',5103,'大白菜','北京新三号',50,'吨',15.00,20.00,
  '上海市','上海市','青浦区华新镇物流园 B2 库','2026-10-25 00:00:00','单棵 1.5kg 以上，无农残超标',
  'quoted','2026-10-18 18:00:00',2,'buyer_3002'),
 (7303,'I20261013203',7203,'D20261013103',7004,'草原散养牛肉（冷鲜）',3003,'广州华南餐饮集团',
  2004,'内蒙古草原牧业',NULL,'畜牧','西门塔尔',10,'吨',80.00,98.00,
  '广东省','广州市','白云区江高镇中央厨房冷库','2026-10-28 00:00:00','冷鲜排酸，菌落总数达标',
  'pending','2026-10-19 18:00:00',0,'buyer_3003');

/* ---------------------------- 报价 ---------------------------- */
INSERT IGNORE INTO `agri_trade_quote`
 (`id`,`quote_no`,`inquiry_id`,`inquiry_no`,`product_id`,`product_name`,`buyer_id`,`buyer_name`,
  `seller_id`,`seller_name`,`unit_price`,`quantity`,`unit`,`total_amount`,`quote_amount`,`freight_amount`,
  `payment_terms`,`delivery_time`,`delivery_address`,`quality_description`,`valid_until`,`quote_status`,
  `create_by`) VALUES
 (7401,'Q20261013301',7301,'I20261013201',7001,'东北五常大米 25kg/袋',3001,'北京新发地批发市场',
  2001,'黑龙江禾丰农业',124.00,200,'吨',2480000.00,2504000.00,24000.00,
  '预付 30%，到货验收后 7 日内结清','2026-11-15 00:00:00','新发地农产品批发市场粮油区 3 号库',
  '当季新米，出米率 68%，含水 14.2%','2026-10-18 18:00:00','pending','seller_2001'),
 (7402,'Q20261013302',7302,'I20261013202',7002,'有机大白菜 5kg/件',3002,'上海盒鲜生供应链',
  2002,'山东寿光绿源',17.60,50,'吨',880000.00,896000.00,16000.00,
  '货到验收后 15 日内结清','2026-10-23 00:00:00','青浦区华新镇物流园 B2 库',
  '温室有机种植，农残检测合格，单棵 1.6kg 均重','2026-10-17 18:00:00','accepted','seller_2002'),
 (7403,'Q20261013303',7302,'I20261013202',7002,'有机大白菜 5kg/件',3002,'上海盒鲜生供应链',
  2003,'陕西洛川果业',18.20,50,'吨',910000.00,930000.00,20000.00,
  '预付 20%，到货验收后 10 日内结清','2026-10-24 00:00:00','青浦区华新镇物流园 B2 库',
  '同类货源代报，产地直采','2026-10-18 18:00:00','rejected','seller_2003');

/* ---------------------------- 撮合记录 ---------------------------- */
INSERT IGNORE INTO `agri_trade_match_record`
 (`id`,`match_no`,`demand_id`,`product_id`,`buyer_id`,`seller_id`,`match_score`,`match_type`,
  `match_status`,`response_time`,`accept_time`,`order_id`,`create_by`) VALUES
 (7501,'M20261013401',7201,7001,3001,2001,96.50,'auto','converted','2026-10-13 09:20:00','2026-10-13 10:05:00',7601,'system'),
 (7502,'M20261013402',7202,7002,3002,2002,93.20,'auto','converted','2026-10-13 09:35:00','2026-10-13 10:12:00',7602,'system'),
 (7503,'M20261013403',7203,7004,3003,2004,91.80,'auto','accepted','2026-10-13 11:02:00','2026-10-13 11:40:00',NULL,'system'),
 (7504,'M20261013404',7201,7002,3001,2002,72.40,'auto','rejected','2026-10-13 09:22:00',NULL,NULL,'system'),
 (7505,'M20261013405',7204,7003,3004,2003,88.60,'auto','responded','2026-10-13 14:10:00',NULL,NULL,'system');

/* ---------------------------- 订单 ---------------------------- */
INSERT IGNORE INTO `agri_trade_order`
 (`id`,`order_no`,`demand_id`,`contract_id`,`buyer_id`,`buyer_name`,`buyer_phone`,`buyer_type`,
  `seller_id`,`seller_name`,`seller_phone`,`category_id`,`category_name`,`goods_amount`,`freight_amount`,
  `discount_amount`,`total_amount`,`paid_amount`,`refund_amount`,`payment_method`,`payment_status`,`order_status`,
  `delivery_province`,`delivery_city`,`delivery_district`,`delivery_address`,`delivery_contact`,`delivery_phone`,
  `delivery_deadline`,`logistics_id`,`logistics_no`,`logistics_status`,`source`,`create_by`) VALUES
 (7601,'T20261013001',7201,7921,3001,'北京新发地批发市场','010-63001188','wholesaler',
  2001,'黑龙江禾丰农业','0451-82001166',5101,'大米',2480000.00,24000.00,8000.00,2496000.00,2496000.00,0.00,
  'transfer','paid','paid','北京市','北京市','丰台区','新发地农产品批发市场粮油区 3 号库','王建国','13801112233',
  '2026-11-20 00:00:00',7971,'L20261013501','in_transit','demand','buyer_3001'),
 (7602,'T20261013002',7202,7922,3002,'上海盒鲜生供应链','021-58001199','supermarket',
  2002,'山东寿光绿源','0536-52001133',5103,'大白菜',880000.00,16000.00,0.00,896000.00,896000.00,0.00,
  'transfer','paid','shipped','上海市','上海市','青浦区','青浦区华新镇物流园 B2 库','李海燕','13912223344',
  '2026-10-25 00:00:00',7972,'L20261013502','delivered','demand','buyer_3002'),
 (7603,'T20261013003',7203,7923,3003,'广州华南餐饮集团','020-83001177','restaurant',
  2004,'内蒙古草原牧业','0479-82001155',NULL,'畜牧',890000.00,18000.00,0.00,908000.00,272400.00,0.00,
  'transfer','partial','pending','广东省','广州市','白云区','白云区江高镇中央厨房冷库','陈志明','13600008877',
  '2026-10-28 00:00:00',NULL,NULL,NULL,'demand','buyer_3003'),
 (7604,'T20261013004',7204,7924,3004,'成都蜀味食品','028-85001122','processor',
  2003,'陕西洛川果业','0911-32001188',5102,'苹果',2040000.00,30000.00,20000.00,2050000.00,0.00,0.00,
  'transfer','unpaid','cancelled','四川省','成都市','双流区','双流区西南航空港经济开发区食品产业园','赵德胜','13908889900',
  '2026-12-10 00:00:00',NULL,NULL,NULL,'demand','buyer_3004');

/* ---------------------------- 订单明细 ---------------------------- */
INSERT IGNORE INTO `agri_trade_order_item`
 (`id`,`order_id`,`product_id`,`product_code`,`product_name`,`category_id`,`category_name`,`variety`,
  `spec_level`,`spec_size`,`unit`,`quantity`,`unit_price`,`amount`,`batch_no`,`trace_code`,`create_by`) VALUES
 (7701,7601,7001,'P20261013001','东北五常大米 25kg/袋',5101,'大米','五常稻花香','一级','25kg/袋','吨',200,12400.00,2480000.00,'HB20260920A','TR202610130001','buyer_3001'),
 (7702,7602,7002,'P20261013002','有机大白菜 5kg/件',5103,'大白菜','北京新三号','特级','5kg/件','吨',50,17600.00,880000.00,'HB20261002C','TR202610130002','buyer_3002'),
 (7703,7603,7004,'P20261013004','草原散养牛肉（冷鲜）',NULL,'畜牧','西门塔尔','优级','整牛分割','吨',10,89000.00,890000.00,'HB20261005D','TR202610130003','buyer_3003'),
 (7704,7604,7003,'P20261013003','洛川红富士苹果 10kg/箱',5102,'苹果','红富士','一级','10kg/箱','吨',30,68000.00,2040000.00,'HB20260928B','TR202610130004','buyer_3004');

/* ---------------------------- 支付流水 ---------------------------- */
INSERT IGNORE INTO `agri_trade_payment`
 (`id`,`payment_no`,`order_id`,`order_no`,`payer_id`,`payer_name`,`payee_id`,`payee_name`,`payment_type`,
  `amount`,`actual_amount`,`payment_method`,`payment_channel`,`transaction_id`,`payment_status`,`payment_time`,
  `idempotent_key`,`create_by`) VALUES
 (7801,'PAY20261013601',7601,'T20261013001',3001,'北京新发地批发市场',2001,'黑龙江禾丰农业','full',
  2496000.00,2496000.00,'transfer','bank','BANK2026101300001','paid','2026-10-13 10:30:00',
  'T20261013001-full','buyer_3001'),
 (7802,'PAY20261013602',7602,'T20261013002',3002,'上海盒鲜生供应链',2002,'山东寿光绿源','full',
  896000.00,896000.00,'transfer','bank','BANK2026101300002','paid','2026-10-13 11:05:00',
  'T20261013002-full','buyer_3002'),
 (7803,'PAY20261013603',7603,'T20261013003',3003,'广州华南餐饮集团',2004,'内蒙古草原牧业','advance',
  272400.00,272400.00,'transfer','bank','BANK2026101300003','paid','2026-10-13 15:20:00',
  'T20261013003-advance','buyer_3003');

/* ---------------------------- 退款 ---------------------------- */
INSERT IGNORE INTO `agri_trade_refund`
 (`id`,`refund_no`,`order_id`,`order_no`,`payment_id`,`refund_type`,`refund_amount`,`refund_reason`,
  `refund_description`,`applicant_type`,`applicant_id`,`applicant_name`,`reviewer`,`review_time`,`review_remark`,
  `refund_status`,`create_by`) VALUES
 (7851,'R20261013701',7604,'T20261013004',NULL,'full',0.00,'订单取消',
  '买家下单后因终端订单取消，申请撤单；订单未支付，无需实际退款。','buyer',3004,'成都蜀味食品',
  'admin','2026-10-13 16:40:00','订单未支付，直接关闭','cancelled','buyer_3004');

/* ---------------------------- 合同模板 ---------------------------- */
INSERT IGNORE INTO `agri_trade_contract_template`
 (`id`,`template_code`,`template_name`,`template_type`,`template_content`,`variables_json`,`description`,
  `sort_order`,`is_default`,`status`,`create_by`) VALUES
 (7901,'TPL_STANDARD','农产品标准购销合同','standard',
  '甲方（采购方）：${buyerName}\n乙方（供货方）：${sellerName}\n标的：${goodsName} ${quantity}${unit}\n单价：${unitPrice} 元，总额：${totalAmount} 元\n交货时间：${deliveryDeadline}\n质量标准：${qualityStandard}',
  '["buyerName","sellerName","goodsName","quantity","unit","unitPrice","totalAmount","deliveryDeadline","qualityStandard"]',
  '现货交易的默认模板，适用于当季农产品即时交割。',1,1,1,'admin'),
 (7902,'TPL_FORWARD','农产品远期购销合同','forward',
  '甲方（采购方）：${buyerName}\n乙方（供货方）：${sellerName}\n标的：${goodsName} ${quantity}${unit}\n预定单价：${unitPrice} 元\n预计交货期：${deliveryDeadline}\n定金比例：${depositRate}\n违约条款：${breachClause}',
  '["buyerName","sellerName","goodsName","quantity","unit","unitPrice","deliveryDeadline","depositRate","breachClause"]',
  '订单农业/预售场景使用，含定金与违约条款。',2,0,1,'admin'),
 (7903,'TPL_FRAMEWORK','农产品框架采购合同','framework',
  '甲方（采购方）：${buyerName}\n乙方（供货方）：${sellerName}\n框架期限：${startDate} 至 ${endDate}\n预计总量：${totalQuantity}${unit}\n结算方式：${paymentTerms}\n单次下单以订单确认为准。',
  '["buyerName","sellerName","startDate","endDate","totalQuantity","unit","paymentTerms"]',
  '长期合作客户使用，年度/季度框架 + 分批下单。',3,0,1,'admin');

/* ---------------------------- 合同 ---------------------------- */
INSERT IGNORE INTO `agri_trade_contract`
 (`id`,`contract_no`,`order_id`,`contract_template_id`,`contract_type`,`buyer_id`,`buyer_name`,`buyer_phone`,
  `seller_id`,`seller_name`,`seller_phone`,`goods_name`,`quantity`,`unit`,`unit_price`,`total_amount`,
  `payment_method`,`delivery_method`,`delivery_address`,`delivery_deadline`,`quality_standard`,`inspection_method`,
  `contract_content`,`sign_status`,`buyer_sign_time`,`seller_sign_time`,`contract_status`,`effective_date`,`expire_date`,`create_by`) VALUES
 (7921,'C20261013801',7601,7901,'standard',3001,'北京新发地批发市场','010-63001188',
  2001,'黑龙江禾丰农业','0451-82001166','东北五常大米',200,'吨',12400.00,2496000.00,
  'transfer','seller_delivery','新发地农产品批发市场粮油区 3 号库','2026-11-20 00:00:00',
  'GB/T 19266 五常大米地理标志标准','到货抽样送检',
  '双方就 200 吨五常大米购销达成一致，详见订单 T20261013001。','signed',
  '2026-10-13 10:10:00','2026-10-13 10:15:00','effective','2026-10-13','2026-11-20','buyer_3001'),
 (7922,'C20261013802',7602,7901,'standard',3002,'上海盒鲜生供应链','021-58001199',
  2002,'山东寿光绿源','0536-52001133','有机大白菜',50,'吨',17600.00,880000.00,
  'transfer','seller_delivery','青浦区华新镇物流园 B2 库','2026-10-25 00:00:00',
  'GB 2763 农残限量 + 有机认证','到货全检',
  '双方就 50 吨有机大白菜购销达成一致，详见订单 T20261013002。','signed',
  '2026-10-13 10:20:00','2026-10-13 10:24:00','effective','2026-10-13','2026-10-25','buyer_3002'),
 (7923,'C20261013803',7603,7902,'forward',3003,'广州华南餐饮集团','020-83001177',
  2004,'内蒙古草原牧业','0479-82001155','草原散养牛肉（冷鲜）',10,'吨',89000.00,890000.00,
  'transfer','seller_delivery','白云区江高镇中央厨房冷库','2026-10-28 00:00:00',
  'GB 2707 鲜（冻）畜肉标准','到货检疫证 + 抽检',
  '双方就 10 吨冷鲜牛肉达成一致，预付 30%，其余到货验收后结清。','pending',
  '2026-10-13 15:30:00',NULL,'pending',NULL,'2026-10-28','buyer_3003'),
 (7924,'C20261013804',7604,7901,'standard',3004,'成都蜀味食品','028-85001122',
  2003,'陕西洛川果业','0911-32001188','洛川红富士苹果',30,'吨',68000.00,2040000.00,
  'transfer','seller_delivery','双流区西南航空港经济开发区食品产业园','2026-12-10 00:00:00',
  '糖度≥13，单果≥180g','到货抽检',
  '订单已取消，合同随之作废。','pending',NULL,NULL,'cancelled',NULL,NULL,'buyer_3004');

/* ---------------------------- 合同签署记录 ---------------------------- */
INSERT IGNORE INTO `agri_trade_contract_signature`
 (`id`,`contract_id`,`signatory_type`,`signatory_id`,`signatory_name`,`sign_status`,`sign_time`,`sign_ip`,
  `certificate_no`,`sign_method`,`sign_result`,`create_by`) VALUES
 (7941,7921,'buyer',3001,'北京新发地批发市场','signed','2026-10-13 10:10:00','116.128.10.21','CA-BJ-2026-001','ca_cert','success','buyer_3001'),
 (7942,7921,'seller',2001,'黑龙江禾丰农业','signed','2026-10-13 10:15:00','113.5.20.66','CA-HLJ-2026-014','ca_cert','success','seller_2001'),
 (7943,7922,'buyer',3002,'上海盒鲜生供应链','signed','2026-10-13 10:20:00','101.80.30.11','CA-SH-2026-007','ca_cert','success','buyer_3002'),
 (7944,7922,'seller',2002,'山东寿光绿源','signed','2026-10-13 10:24:00','112.36.40.9','CA-SD-2026-022','ca_cert','success','seller_2002');

/* ---------------------------- 承运商 ---------------------------- */
INSERT IGNORE INTO `agri_trade_carrier`
 (`id`,`carrier_code`,`carrier_name`,`carrier_type`,`contact_person`,`contact_phone`,`service_phone`,
  `province`,`city`,`address`,`service_scope`,`coverage_cities`,`avg_delivery_hours`,`rating`,`order_count`,
  `on_time_rate`,`damage_rate`,`status`,`create_by`) VALUES
 (7951,'CAR001','顺丰冷运','cold_chain','张国强','0755-88001166','95338',
  '广东省','深圳市','深圳市福田区保税区顺丰产业园','全国冷链零担/整车·温控 0-5℃',
  '北京,上海,广州,深圳,成都,杭州,武汉,西安',48.50,4.85,1268,98.60,0.12,1,'admin'),
 (7952,'CAR002','中通快运','express','李文博','021-66001188','95311',
  '上海市','上海市','青浦区华新镇中通快递产业园','全国常温零担','北京,上海,广州,成都,济南,郑州',36.00,4.62,2410,96.30,0.35,1,'admin'),
 (7953,'CAR003','京东冷链','cold_chain','王海燕','010-88001200','950618',
  '北京市','北京市','大兴区京东亚洲一号智能物流园','全国冷链仓配一体','北京,上海,广州,深圳,武汉,沈阳',24.00,4.90,1875,99.10,0.08,1,'admin'),
 (7954,'CAR004','中铁特货','railway','赵德胜','010-51801122','95572',
  '北京市','北京市','丰台区中铁特货大厦','大宗农产品铁路专线','哈尔滨,长春,沈阳,郑州,武汉,广州',72.00,4.45,320,94.80,0.22,1,'admin');

/* ---------------------------- 物流单 ---------------------------- */
INSERT IGNORE INTO `agri_trade_logistics`
 (`id`,`logistics_no`,`order_id`,`contract_id`,`carrier_id`,`carrier_name`,`logistics_type`,`freight_amount`,
  `pickup_province`,`pickup_city`,`pickup_district`,`pickup_address`,`pickup_contact`,`pickup_phone`,
  `delivery_province`,`delivery_city`,`delivery_district`,`delivery_address`,`delivery_contact`,`delivery_phone`,
  `logistics_status`,`pickup_time`,`departure_time`,`arrival_time`,`sign_time`,`sign_person`,`insurance_amount`,`create_by`) VALUES
 (7971,'L20261013501',7601,7921,7951,'顺丰冷运','cold_chain',24000.00,
  '黑龙江省','哈尔滨市','五常市','五常市民乐朝鲜族乡禾丰仓储中心','刘庆丰','0451-82001166',
  '北京市','北京市','丰台区','新发地农产品批发市场粮油区 3 号库','王建国','13801112233',
  'in_transit','2026-10-13 12:00:00','2026-10-13 18:30:00',NULL,NULL,NULL,249600.00,'seller_2001'),
 (7972,'L20261013502',7602,7922,7953,'京东冷链','cold_chain',16000.00,
  '山东省','潍坊市','寿光市','寿光市田柳镇绿源冷链基地','孙丽华','0536-52001133',
  '上海市','上海市','青浦区','青浦区华新镇物流园 B2 库','李海燕','13912223344',
  'delivered','2026-10-13 13:10:00','2026-10-13 19:40:00','2026-10-14 08:20:00',NULL,NULL,89600.00,'seller_2002'),
 (7973,'L20261013503',7603,7923,7951,'顺丰冷运','cold_chain',18000.00,
  '内蒙古自治区','锡林郭勒盟','锡林浩特市','锡林浩特市白音锡勒牧场冷库','马俊峰','0479-82001155',
  '广东省','广州市','白云区','白云区江高镇中央厨房冷库','陈志明','13600008877',
  'pending',NULL,NULL,NULL,NULL,NULL,90800.00,'seller_2004');

/* ---------------------------- 物流轨迹 ---------------------------- */
INSERT IGNORE INTO `agri_trade_logistics_trace`
 (`id`,`logistics_id`,`logistics_no`,`trace_no`,`trace_time`,`trace_status`,`trace_location`,`trace_lat`,`trace_lng`,
  `trace_description`,`operator`,`operator_phone`,`next_location`,`temperature`,`is_significant`) VALUES
 (7981,7971,'L20261013501','TRC001','2026-10-13 12:00:00','picked','黑龙江省哈尔滨市五常市',45.0000000,126.0000000,'货物已揽收，装车完成','刘庆丰','0451-82001166','长春中转场',3.50,1),
 (7982,7971,'L20261013501','TRC002','2026-10-13 18:30:00','in_transit','黑龙江省哈尔滨市物流园',45.7500000,126.6300000,'车辆离场，预计 36 小时到达北京','刘庆丰','0451-82001166','沈阳中转场',3.20,0),
 (7983,7971,'L20261013501','TRC003','2026-10-14 06:10:00','in_transit','辽宁省沈阳市中转场',41.8000000,123.4300000,'已到沈阳中转场，分拣中','张国强','0755-88001166','北京新发地',3.80,1),
 (7984,7972,'L20261013502','TRC004','2026-10-13 13:10:00','picked','山东省潍坊市寿光市',36.8800000,118.7900000,'货物已揽收','孙丽华','0536-52001133','上海青浦',2.80,1),
 (7985,7972,'L20261013502','TRC005','2026-10-13 19:40:00','in_transit','山东省潍坊市物流园',36.7000000,119.1000000,'车辆离场，全程温控 0-5℃','王海燕','010-88001200','济南中转场',2.50,0),
 (7986,7972,'L20261013502','TRC006','2026-10-14 08:20:00','delivered','上海市青浦区华新镇物流园',31.2000000,121.1800000,'货物已到达目的地，待收货方验收','王海燕','010-88001200',NULL,3.00,1);

/* ---------------------------- 商户保证金 ---------------------------- */
INSERT IGNORE INTO `agri_trade_merchant_guarantee`
 (`id`,`merchant_id`,`merchant_name`,`guarantee_no`,`guarantee_type`,`total_amount`,`available_amount`,
  `frozen_amount`,`used_amount`,`guarantee_status`,`apply_time`,`verify_time`,`verified_by`,`expire_time`,
  `bank_name`,`bank_account`,`create_by`) VALUES
 (8071,2001,'黑龙江禾丰农业','G20261013901','bank',300000.00,300000.00,0.00,0.00,'active',
  '2026-03-01 09:00:00','2026-03-02 14:20:00','admin','2027-03-01 23:59:59',
  '中国农业银行五常市支行','6228480001234567890','seller_2001'),
 (8072,2002,'山东寿光绿源','G20261013902','cash',200000.00,180000.00,20000.00,0.00,'active',
  '2026-03-05 10:30:00','2026-03-06 09:40:00','admin','2027-03-05 23:59:59',
  '中国工商银行寿光市支行','6222020009876543210','seller_2002'),
 (8073,2004,'内蒙古草原牧业','G20261013903','insurance',150000.00,150000.00,0.00,0.00,'pending',
  '2026-10-13 16:00:00',NULL,NULL,'2027-10-13 23:59:59',
  '中国银行锡林浩特市支行','6217000001122334455','seller_2004');

/* ---------------------------- 评价 ---------------------------- */
INSERT IGNORE INTO `agri_trade_evaluation`
 (`id`,`evaluation_no`,`order_id`,`evaluator_id`,`evaluator_name`,`evaluatee_id`,`evaluatee_name`,
  `rating_overall`,`rating_quality`,`rating_service`,`rating_logistics`,`evaluation_content`,
  `evaluation_status`,`reply_content`,`reply_time`,`create_by`) VALUES
 (8001,'E20261013A01',7602,3002,'上海盒鲜生供应链',2002,'山东寿光绿源',
  5,5,5,5,'到货整齐、菜心紧实，农残报告随车带到，验收一次通过。','published',
  '感谢支持，后续继续按订单节奏稳定供货。','2026-10-14 09:10:00','buyer_3002'),
 (8002,'E20261013A02',7601,3001,'北京新发地批发市场',2001,'黑龙江禾丰农业',
  4,5,4,4,'米质没问题，出米率 67.5%，比合同略低一点点，整体可接受。','published',NULL,NULL,'buyer_3001'),
 (8003,'E20261013A03',7603,3003,'广州华南餐饮集团',2004,'内蒙古草原牧业',
  4,5,4,3,'牛肉品质好，但物流发车比约定晚了一天，已沟通。','published',
  '已协调增加一辆冷藏车，后续保证按时发车。','2026-10-15 08:30:00','buyer_3003');

/* ---------------------------- 评价申诉 ---------------------------- */
INSERT IGNORE INTO `agri_trade_evaluation_appeal`
 (`id`,`appeal_no`,`evaluation_id`,`appeal_type`,`appeal_reason`,`appeal_evidence`,`appellant_type`,
  `appellant_id`,`appellant_name`,`appeal_status`,`reviewer`,`review_time`,`review_result`,`review_remark`,`create_by`) VALUES
 (8021,'AP20261013B01',8003,'fact','物流评分一栏与实际不符：我方按合同约定时间发车，延误发生在承运商中转环节。',
 '承运商轨迹截图（顺丰冷运 L20261013503）、发车时间记录','seller',2004,'内蒙古草原牧业',
  'pending',NULL,NULL,NULL,'待仲裁员核对轨迹证据','seller_2004');

/* ---------------------------- 纠纷 ---------------------------- */
INSERT IGNORE INTO `agri_trade_dispute`
 (`id`,`dispute_no`,`order_id`,`contract_id`,`applicant_id`,`applicant_name`,`respondent_id`,`respondent_name`,
  `dispute_type`,`dispute_amount`,`claim_amount`,`dispute_content`,`dispute_status`,`mediation_result`,`create_by`) VALUES
 (8031,'DS20261013C01',7603,7923,3003,'广州华南餐饮集团',2004,'内蒙古草原牧业',
  'delay',30000.00,30000.00,'约定 10-28 交货，实际发车延迟 1 天，影响中央厨房排产，要求按日补偿。',
  'processing',NULL,'buyer_3003'),
 (8032,'DS20261013C02',7604,7924,3004,'成都蜀味食品',2003,'陕西洛川果业',
  'cancel',0.00,0.00,'买方终端订单取消，双方协商一致撤单，无金额争议。',
  'resolved','双方协商一致撤单，订单与合同作废','buyer_3004');

/* ---------------------------- 赔付 ---------------------------- */
INSERT IGNORE INTO `agri_trade_compensation`
 (`id`,`compensation_no`,`order_id`,`order_no`,`dispute_id`,`compensation_type`,`compensation_reason`,
  `applicant_type`,`applicant_id`,`applicant_name`,`recipient_id`,`recipient_name`,`compensation_amount`,
  `compensation_status`,`reviewer`,`review_time`,`review_result`,`review_remark`,`create_by`) VALUES
 (8051,'CP20261013F01',7603,'T20261013003',8031,'delay','发车延误 1 天，按合同日万分之五计赔',
  'buyer',3003,'广州华南餐饮集团',3003,'广州华南餐饮集团',3000.00,
  'reviewing','admin','2026-10-15 10:00:00','pending','待承运商责任认定后放款','buyer_3003');

-- ===========================================================================
-- 对齐补充：把值搬到「接口真正返回的字段」上
--
-- 上面的 INSERT 是按**建表语句的列名**写的，而接口返回的字段来自实体类 —— 两边有漂移：
--   · logistics 表用 delivery_* / pickup_*，实体用 receiver_* / sender_*；
--   · dispute 表用 applicant_* / dispute_content，实体用 complainant_* / dispute_description；
--   · contract 的 contract_name / contract_amount / 双方签署状态是后补的列，插入时为空。
-- 结果就是"数据在库里、接口返回的字段却是 null、页面一列列空白"。
-- 下面把这些值搬过去；可重复执行。
-- ===========================================================================
UPDATE `agri_trade_logistics` SET
    `sender_province`   = `pickup_province`,
    `sender_city`       = `pickup_city`,
    `sender_district`   = `pickup_district`,
    `sender_address`    = `pickup_address`,
    `sender_contact`    = `pickup_contact`,
    `sender_phone`      = `pickup_phone`,
    `receiver_province` = `delivery_province`,
    `receiver_city`     = `delivery_city`,
    `receiver_district` = `delivery_district`,
    `receiver_address`  = `delivery_address`,
    `receiver_contact`  = `delivery_contact`,
    `receiver_phone`    = `delivery_phone`,
    `current_location`  = CONCAT(`delivery_city`, `delivery_district`)
WHERE `id` BETWEEN 7000 AND 8099;

UPDATE `agri_trade_dispute` SET
    `complainant_id`      = `applicant_id`,
    `complainant_name`    = `applicant_name`,
    `dispute_reason`      = `dispute_type`,
    `dispute_description` = `dispute_content`
WHERE `id` BETWEEN 7000 AND 8099;

UPDATE `agri_trade_contract` SET
    `contract_name`      = CONCAT('购销合同 · ', `goods_name`),
    `contract_amount`    = `total_amount`,
    `buyer_sign_status`  = IF(`buyer_sign_time` IS NULL, 'pending', 'signed'),
    `seller_sign_status` = IF(`seller_sign_time` IS NULL, 'pending', 'signed'),
    `sign_date`          = `buyer_sign_time`,
    `delivery_date`      = `delivery_deadline`
WHERE `id` BETWEEN 7000 AND 8099;

-- is_anonymous 是页面上"是否匿名"列读的字段（0=实名 1=匿名）
UPDATE `agri_trade_evaluation` SET `is_anonymous` = 0 WHERE `id` BETWEEN 7000 AND 8099;

-- ===========================================================================
-- 清理语句（默认注释）。要清空本文件的演示数据时放开这几行执行即可 ——
-- 只删 7000-8099 段，不会碰到真实数据。
-- ===========================================================================
-- DELETE FROM `agri_trade_product_image`        WHERE `id` BETWEEN 7000 AND 8099;
-- DELETE FROM `agri_trade_order_item`           WHERE `id` BETWEEN 7000 AND 8099;
-- DELETE FROM `agri_trade_logistics_trace`      WHERE `id` BETWEEN 7000 AND 8099;
-- DELETE FROM `agri_trade_contract_signature`   WHERE `id` BETWEEN 7000 AND 8099;
-- DELETE FROM `agri_trade_evaluation_appeal`    WHERE `id` BETWEEN 7000 AND 8099;
-- DELETE FROM `agri_trade_compensation`         WHERE `id` BETWEEN 7000 AND 8099;
-- DELETE FROM `agri_trade_refund`               WHERE `id` BETWEEN 7000 AND 8099;
-- DELETE FROM `agri_trade_quote`                WHERE `id` BETWEEN 7000 AND 8099;
-- DELETE FROM `agri_trade_inquiry`              WHERE `id` BETWEEN 7000 AND 8099;
-- DELETE FROM `agri_trade_match_record`         WHERE `id` BETWEEN 7000 AND 8099;
-- DELETE FROM `agri_trade_payment`              WHERE `id` BETWEEN 7000 AND 8099;
-- DELETE FROM `agri_trade_contract`             WHERE `id` BETWEEN 7000 AND 8099;
-- DELETE FROM `agri_trade_contract_template`    WHERE `id` BETWEEN 7000 AND 8099;
-- DELETE FROM `agri_trade_logistics`            WHERE `id` BETWEEN 7000 AND 8099;
-- DELETE FROM `agri_trade_merchant_guarantee`   WHERE `id` BETWEEN 7000 AND 8099;
-- DELETE FROM `agri_trade_carrier`              WHERE `id` BETWEEN 7000 AND 8099;
-- DELETE FROM `agri_trade_evaluation`           WHERE `id` BETWEEN 7000 AND 8099;
-- DELETE FROM `agri_trade_dispute`              WHERE `id` BETWEEN 7000 AND 8099;
-- DELETE FROM `agri_trade_order`                WHERE `id` BETWEEN 7000 AND 8099;
-- DELETE FROM `agri_trade_demand`               WHERE `id` BETWEEN 7000 AND 8099;
-- DELETE FROM `agri_trade_product`              WHERE `id` BETWEEN 7000 AND 8099;
-- DELETE FROM `agri_trade_category`             WHERE `id` BETWEEN 7000 AND 8099;

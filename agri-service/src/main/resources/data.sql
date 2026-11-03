-- ============================================================================
-- 综合服务（agri-service）演示种子
--
-- 私域数据一律带 merchant_id / merchant_name：
--   2001 绿源农业合作社   —— 需求方 A（farmer / admin 账号）
--   2003 陕西洛川果业     —— 需求方 B（luochuan 账号）
-- 没有主体号的私域行等于"谁登录都看得到"，所以这里不留空。
-- 服务商侧的 service_provider.merchant_id 由运营端绑定接口写入（演示账号见
-- scripts/provision-service-access.mjs），不在种子里猜。
-- ============================================================================

INSERT IGNORE INTO service_provider (id,name,category,category_icon,rating,order_count,distance_km,response_minutes,price,unit,badge,tags,description,certifications,region,available_slots,status) VALUES
(1,'建国农机合作社','农机作业','🚜',4.9,1286,3.2,5,60,'元/亩','S级认证服务商','履带收割,机损保障,北斗轨迹','专注水稻与油菜全程机械化服务，拥有履带式收割机、旋耕机和秸秆还田设备，可按地块生成作业方案。','营业执照,农机作业许可,平台S级认证','长沙市望城区乔口镇','今日 14:00 / 明日 08:00 / 明日 14:00','available'),
(2,'绿翼飞防服务队','植保防疫','🚁',4.9,986,5.8,8,8,'元/亩起','飞防优选','夜间作业,飞防处方,药械一体','提供水稻、油菜、果树植保飞防，支持处方图导入和作业轨迹回传，夜间可作业。','航空植保资质,农药经营许可,飞手证','长沙市宁乡市双江口镇','明日 07:00 / 明日 18:30','available'),
(3,'金穗农事服务公司','粮食烘干','🔥',4.7,642,8.4,12,90,'元/吨','产能充足','湿粮烘干,水分检测,临时仓储','日处理湿粮 180 吨，提供水分检测、分品种烘干与短期仓储。','粮食收购备案,设备年检合格','长沙市望城区靖港镇','今日 全天 / 明日 全天','available'),
(4,'王新民农技工作室','农技问诊','👨‍🌾',4.9,532,8.4,3,20,'元/次','高级农艺师','水稻栽培,病虫害,上门指导','高级农艺师，擅长水稻栽培与病虫害综合防控，可在 2 小时内响应图文问诊。','高级农艺师,平台实名认证','长沙市望城区','今日可图文 / 明日下午上门','available'),
(5,'湘农检测中心','检测认证','🔬',4.8,388,12.6,20,260,'元/样','CMA资质','土壤检测,农残检测,出具报告','提供土壤、灌溉水、农产品农残与重金属检测，报告支持扫码验真。','CMA,CNAS,农产品质量安全检测机构','长沙市岳麓区','工作日 09:00-17:00','available'),
(6,'金色田野培训中心','培训服务','🎓',4.8,318,6.2,30,0,'元/人','政府合作机构','高素质农民,实操教学,结业证书','聚焦粮油种植、农机安全与农产品电商，线上课程和田间实训相结合。','民办学校办学许可,平台培训基地','长沙市望城区','每周二、周四开课','available'),
(7,'法小耘涉农法律服务','法律咨询','⚖️',4.9,276,0,10,39,'元/次起','在线服务','合同审查,土地纠纷,劳动用工','执业律师与 AI 法律助手协同，提供土地流转、劳务用工和农资合同法律服务。','律师事务所执业许可','湖南省','工作日 09:00-20:00','available'),
(8,'乔口粮安烘干中心','粮食烘干','🔥',4.6,211,4.7,15,85,'元/吨','今日可约','产地烘干,代清理,就近卸粮','产地粮食烘干服务，可代清理、分品种入仓，支持大户预约排队。','粮食产后服务中心备案','长沙市望城区乔口镇','今日 16:00 后','available');

INSERT IGNORE INTO service_item (id,provider_id,name,category,price,unit,description,duration,selected_count) VALUES
(1,1,'水稻机收（履带式）','农机作业',60,'元/亩','含收割、脱粒、运输卸粮至田头，破损率承诺不超过 2%。','约 40-60 亩/天',486),
(2,1,'深翻旋耕','农机作业',70,'元/亩','深翻 25-30cm，含平整与作业轨迹回传。','约 60 亩/天',302),
(3,1,'秸秆粉碎还田','农机作业',45,'元/亩','粉碎长度小于 10cm，均匀抛撒还田。','约 70 亩/天',268),
(4,2,'无人机植保飞防','植保防疫',8,'元/亩起','含药剂、飞防和作业轨迹，按病虫害处方执行。','10-20 亩/架次',620),
(5,5,'农产品农残检测','检测认证',260,'元/样','12 项农残指标，CMA 报告可扫码验真。','3-5 个工作日',189);

INSERT IGNORE INTO service_demand (id,demand_no,category,service_name,description,location,area,preferred_date,budget_min,budget_max,contact_name,contact_phone,status,match_count,merchant_id,merchant_name,created_at) VALUES
(1,'DM20261024001','农机作业','50亩晚稻机收','晚稻预计 10 月 25 日成熟，需要履带式收割机，含运输卸粮，破损率不超过 2%。','望城区乔口镇团头湖村','50亩','2026-10-25',55,65,'陈先生','138****1206','matching',3,2001,'绿源农业合作社','2026-10-24 08:30:00'),
(2,'DM20261024002','植保防疫','柑橘园冬季清园飞防','果园 80 亩，坡地，请带药并回传轨迹。','宁乡市双江口镇','80亩','2026-10-27',7,10,'刘女士','139****8821','quoted',5,2003,'陕西洛川果业','2026-10-24 09:20:00');

INSERT IGNORE INTO service_order (id,order_no,provider_id,provider_name,service_name,category,quantity,unit,unit_price,total_amount,deposit_amount,appointment_date,appointment_slot,location,contact_name,contact_phone,notes,status,progress,rating,review,merchant_id,merchant_name,created_at) VALUES
(1,'FW20261023009',1,'建国农机合作社','水稻机收作业','农机作业',50,'亩',60,3000,200,'2026-10-24','14:00-18:00','望城区乔口镇 3 号田','陈先生','138****1206','履带式收割机，含运输卸粮，破损率不超过 2%。','in_progress',68,NULL,NULL,2001,'绿源农业合作社','2026-10-23 10:30:00'),
(2,'FW20261022015',2,'绿翼飞防服务队','无人机植保飞防','植保防疫',86,'亩',8,688,100,'2026-10-26','07:00-09:00','宁乡市双江口镇柑橘园','刘女士','139****8821','夜间风大，调整至清晨作业。','confirmed',42,NULL,NULL,2003,'陕西洛川果业','2026-10-22 18:20:00'),
(3,'FW20261018006',5,'湘农检测中心','农产品农残检测','检测认证',2,'样',260,520,0,'2026-10-18','09:00','望城区乔口镇','陈先生','138****1206','检测辣椒和青菜各一份。','completed',100,5,'报告出得很快，扫码能查到原始记录。',2001,'绿源农业合作社','2026-10-18 08:10:00'),
(4,'FW20261012019',3,'金穗农事服务公司','稻谷烘干','粮食烘干',26,'吨',90,2340,0,'2026-10-12','全天','望城区靖港镇','陈先生','138****1206','水分 24%，分两批烘干。','completed',100,4,'烘干均匀，结算清晰。',2001,'绿源农业合作社','2026-10-12 07:00:00'),
(5,'FW20261010012',4,'王新民农技工作室','水稻病斑图文问诊','农技问诊',1,'次',20,20,0,'2026-10-10','10:30','线上','陈先生','138****1206','叶片出现红褐色斑点。','cancelled',100,NULL,NULL,2001,'绿源农业合作社','2026-10-10 09:40:00');

INSERT IGNORE INTO service_order_event (id,order_id,title,note,event_time,completed) VALUES
(1,1,'预约确认','建国农机已确认机手与机型','10-23 10:35',TRUE),
(2,1,'支付定金','平台担保支付 ¥200','10-23 10:38',TRUE),
(3,1,'进场作业','农机 NJ-001 已到达 3 号田','10-24 13:52',TRUE),
(4,1,'作业质量检测','按轨迹与机损抽检结果确认','10-24 18:10',FALSE),
(5,1,'验收结算','确认后释放尾款','待作业完成',FALSE),
(6,2,'预约确认','服务队已接单','10-22 18:30',TRUE),
(7,2,'作业方案确认','已确认 86 亩柑橘园飞防处方','10-23 09:10',TRUE),
(8,2,'等待作业','计划 10 月 26 日 07:00 到场','10-26 07:00',FALSE);

INSERT IGNORE INTO service_policy (id,title,level_name,category,amount_text,deadline,match_score,conditions_text,materials_text,status,published_at) VALUES
(1,'农机购置与应用补贴','区级','农机作业','单台最高 30%','2026-12-15',96,'从事农业生产的个人和农业生产经营组织；购置纳入补贴目录的农机具。','身份证/营业执照,购机发票,机具铭牌照片,银行账户','open','2026-09-01'),
(2,'稻油轮作试点补助','市级','种植补贴','150 元/亩','2026-11-30',92,'连片种植水稻和油菜 30 亩以上；完成规定轮作面积。','土地流转合同,种植面积证明,现场照片','open','2026-07-12'),
(3,'新型经营主体贷款贴息','省级','金融支持','最高 2% 贴息','2026-12-31',88,'家庭农场、合作社或农业企业；贷款用于生产经营。','主体认证,贷款合同,付息凭证','open','2026-06-08'),
(4,'高标准农田建设奖补','省级','基础设施','按项目核定','2027-03-31',84,'参与高标准农田建设与管护的新型经营主体。','项目方案,用地证明,预算清单','open','2026-03-20');

INSERT IGNORE INTO service_policy_application (id,application_no,policy_id,policy_title,applicant,contact_phone,amount_text,status,progress,merchant_id,merchant_name,submitted_at) VALUES
(1,'SQ20261021003',2,'稻油轮作试点补助','绿源农业合作社','138****1206','¥4,500','town_review',60,2001,'绿源农业合作社','2026-10-21 14:20:00'),
(2,'SQ20260802001',2,'稻油轮作试点补助','绿源农业合作社','138****1206','¥4,500','paid',100,2001,'绿源农业合作社','2026-08-02 09:10:00');

-- 保费/保额按 premium_rate × 面积实算，页面不再兜 1280/153600 这两个常量
INSERT IGNORE INTO insurance_product (id,name,category,premium,coverage,subsidy,icon,summary,tags,premium_rate,coverage_per_mu,unit_measure) VALUES
(1,'水稻完全成本保险','种植险','10 元/亩自缴','最高 1,200 元/亩','政府补贴 80%','🌾','覆盖物化成本、人工成本和土地租金，受灾后支持卫星遥感与无人机查勘。','水稻,灾害,政策险',10,1200,'亩'),
(2,'水稻价格指数保险','指数险','12 元/亩起','按目标价格差额','试点补贴','📉','当约定采集期价格低于目标价格时触发赔付，无需逐户定损。','价格指数,快速理赔',12,1000,'亩'),
(3,'柑橘种植保险','种植险','12 元/亩起','最高 3,000 元/亩','政府补贴 70%','🍊','覆盖暴雨、冻害、病虫害等主要风险，支持地块级投保。','柑橘,冻害,暴雨',12,3000,'亩'),
(4,'能繁母猪养殖险','养殖险','18 元/头自缴','最高 1,500 元/头','政府补贴 80%','🐖','覆盖疫病、自然灾害与意外事故，耳标信息自动关联。','养殖,疫病,耳标',18,1500,'头'),
(5,'农产品仓储险','财产险','按保额 0.08%','按仓储价值','商业险','🏬','覆盖冷库、粮仓内农产品的火灾、水渍和温湿度失控风险。','仓储,冷链,财产险',8,8500,'亩');

INSERT IGNORE INTO insurance_policy (id,policy_no,product_id,product_name,insured_subject,insured_area,premium,coverage_amount,effective_date,status,merchant_id,merchant_name) VALUES
(1,'NX20261008003',1,'水稻完全成本保险','绿源农业合作社','128 亩',1280,153600,'2026-10-09','effective',2001,'绿源农业合作社'),
(2,'NX20260618011',3,'柑橘种植保险','陕西洛川果业','86 亩',1032,258000,'2026-06-19','claiming',2003,'陕西洛川果业'),
(3,'NX20260520007',5,'农产品仓储险','绿源农业合作社','冷库 1 间',680,850000,'2026-05-21','expired',2001,'绿源农业合作社');

INSERT IGNORE INTO insurance_claim (id,claim_no,policy_id,policy_no,disaster_type,description,loss_area,status,progress,merchant_id,merchant_name,created_at) VALUES
(1,'LP20261008007',2,'NX20260618011','暴雨内涝','连续暴雨导致低洼地块积水，初步判断 12 亩柑橘受影响。','12亩','surveying',45,2003,'陕西洛川果业','2026-10-08 15:30:00');

INSERT IGNORE INTO service_course (id,title,teacher,mode,duration,learners,rating,progress,cover,summary,tags) VALUES
(1,'水稻常见病虫害识别与科学用药','李振华','录播 + 直播', '8 课时',2368,4.9,76,'🌾','从田间识别到科学用药，包含 12 个常见病害与 8 个虫害案例。','水稻,病虫害,植保员'),
(2,'一部手机管好一个农场','平台商学院','系列课','6 课时',1880,4.8,42,'📱','生产记录、库存、采收和销售协同，用数字工具减少重复劳动。','数字化,农场管理'),
(3,'稻油轮作绿色高产','周文涛等','路径课','12 课时',1264,4.9,62,'🌱','把品种、播期、施肥和机械化作业串成可执行的周年生产路径。','稻油轮作,高产'),
(4,'农业无人机植保安全操作','赵航','实操 + 考核','5 课时',968,4.7,0,'🚁','飞防前检查、航线规划、药剂配比、应急处置与安全考核。','无人机,飞防,安全');

-- 问诊必须挂到真实专家档案（service_expert），不再兜"王新民"这个字面量
INSERT IGNORE INTO service_expert (id,name,title,category,organization,service_scope,phone,rating,consult_count,tags,summary,avatar_icon,status,created_at) VALUES
(1,'王新民','高级农艺师','农技问诊','王新民农技工作室','水稻、油菜栽培与病虫害综合防控','137****2210',4.9,532,'水稻,病虫害,上门指导','从事大田作物技术推广 22 年，熟悉南方稻区主要病虫害发生规律。','👨‍🌾','available','2026-01-12 09:00:00'),
(2,'周文涛','作物栽培研究员','农技问诊','省农科院作物所','稻油轮作、播期与肥水管理','136****7712',4.8,268,'稻油轮作,肥水管理','主持稻油轮作高产攻关项目，擅长把技术要点拆成可执行的农事日历。','🧑‍🔬','available','2026-02-08 09:00:00'),
(3,'何继明','执业律师','法律咨询','法小耘涉农律师事务所','土地流转、劳务用工、农资合同纠纷','135****4408',4.9,146,'土地流转,合同纠纷','代理涉农案件 300 余件，参与起草省级土地流转合同示范文本。','⚖️','available','2026-03-01 09:00:00'),
(4,'李振华','植保员','农技问诊','金色田野培训中心','病虫草害识别与安全用药','138****9921',4.7,402,'植保,安全用药','长期从事基层植保服务，主讲病虫害识别与科学用药课程。','🌾','available','2026-01-20 09:00:00');

INSERT IGNORE INTO service_consultation (id,consult_no,type,expert_id,expert_name,subject,content,ai_level,suggestion,status,merchant_id,merchant_name,created_at) VALUES
(1,'WZ2026102106','农技图文',1,'王新民','晚稻叶片红褐色斑点','叶片从下部开始出现红褐色斑点，近期连续阴雨。','中度风险','初步判断为胡麻斑病或细菌性条斑病混合发生，建议取 3 片病叶拍摄正反面并做田间湿度记录。','answered',2001,'绿源农业合作社','2026-10-21 16:10:00'),
(2,'WZ2026092803','农技图文',2,'周文涛','油菜苗黄化原因','移栽后一周部分幼苗发黄，长势不齐。','低风险','优先排查移栽伤根、缺氮和土壤积水，可在晴天下午少量追施氮肥并开沟排水。','closed',2003,'陕西洛川果业','2026-09-28 09:20:00');

-- 收件箱按主体投递：created_at 用具体时间，"今天/昨天"这种相对写法会一直骗人
INSERT IGNORE INTO service_message (id,type,title,content,is_read,merchant_id,merchant_name,biz_type,biz_no,created_at) VALUES
(1,'order','机手已到达作业地块','建国农机：机手已到达 3 号田，预计 18:00 前完成 50 亩机收。',FALSE,2001,'绿源农业合作社','ORDER','FW20261023009','2026-10-24 13:52'),
(2,'policy','政策申报进入乡镇审核','稻油轮作试点补助申报已由区级受理，当前在乡镇审核。',FALSE,2001,'绿源农业合作社','POLICY','SQ20261021003','2026-10-24 10:20'),
(3,'insurance','查勘员已接单','柑橘种植保险案件 LP20261008007 已安排王查勘员，预计 10 月 26 日到场。',FALSE,2003,'陕西洛川果业','CLAIM','LP20261008007','2026-10-23 17:40'),
(4,'course','学习提醒','您报名的《水稻常见病虫害识别与科学用药》还有 2 课时未完成。',TRUE,2001,'绿源农业合作社','COURSE','1','2026-10-23 08:30');

INSERT IGNORE INTO service_complaint (id,complaint_no,order_no,category,description,demand,status,progress,handler,resolution,merchant_id,merchant_name,created_at) VALUES
(1,'TS20261024003','FW20261023009','作业质量','3 号田东南角有约 0.8 亩漏收，部分秸秆抛撒不均匀。','安排补收并完成作业质量复核。','processing',35,NULL,NULL,2001,'绿源农业合作社','2026-10-24 16:20:00');

INSERT IGNORE INTO service_resource (id,resource_type,title,location,area_mu,price,unit,description,contact_name,contact_phone,merchant_id,merchant_name,status,created_at) VALUES
(1,'land','乔口镇团头湖村 50 亩连片水田流转','望城区乔口镇团头湖村',50,650,'元/亩/年','水源充足、机耕道通达，适合粮油轮作；意向整体流转，可实地看田。','陈先生','138****1206',2001,'绿源农业合作社','open','2026-10-20 09:00:00'),
(2,'land','双江口镇 80 亩坡地果园出租','宁乡市双江口镇',80,900,'元/亩/年','柑橘园带滴灌与看护房，因劳动力不足整体出租，可谈三年一付。','刘女士','139****8821',2003,'陕西洛川果业','open','2026-10-21 14:00:00'),
(3,'labor','机收季节短工队（8 人）','望城区乔口镇周边',0,180,'元/人/天','有收割机辅助作业经验，可跟机卸粮、清场，接受日结。','乔口零工互助组','131****2201',2001,'绿源农业合作社','open','2026-10-22 08:30:00'),
(4,'labor','果园冬季清园托管班组','宁乡市双江口镇',0,210,'元/人/天','含修剪、涂白与清园用药，班组自带弥雾机，按天结算。','双江果农服务班组','133****7702',2003,'陕西洛川果业','open','2026-10-23 11:20:00');

INSERT IGNORE INTO service_enrollment (id,course_id,merchant_id,merchant_name,progress,note_text,cert_no,completed_at,created_at) VALUES
(1,1,2001,'绿源农业合作社',60,NULL,NULL,NULL,'2026-10-18 09:00:00'),
(2,2,2003,'陕西洛川果业',25,NULL,NULL,NULL,'2026-10-20 15:00:00');

INSERT IGNORE INTO service_provider
(id,name,category,category_icon,rating,order_count,distance_km,response_minutes,price,unit,badge,tags,description,certifications,region,available_slots,status,credit_code,contact_name,contact_phone,service_area,credit_score,cancel_rate,risk_level,audit_reason,created_at) VALUES
(9,'恒丰农机合作社','农机作业','🚜',3.2,206,7.3,18,58,'元/亩','待复审','旋耕,机收','有 8 台拖拉机与 3 台收割机，近 7 日出现多次档期冲突，待补充设备与人员证明。','营业执照,农机作业许可','豫北 2 县','待审核','pending','91410100MA9HENG26A','李恒丰','137****8210','豫北 2 县',61,15.6,'high','取消率偏高，要求补充机手排班证明','2026-10-23 09:20:00'),
(10,'大地职业培训学校','培训服务','🎓',4.45,96,0,45,0,'元/人','待复审','农民培训,电商','提交 3 门新增课程版权与讲师学历材料，等待复审。','办学许可,民办非企业登记','河北 2 市','工作日','pending','52130000MJY2026118D','赵校长','136****3126','河北 2 市',82,2.1,'medium','补充课程版权材料','2026-10-23 16:10:00'),
(11,'豫北利民合作社','农机作业','🚜',4.7,174,4.2,12,55,'元/亩','待初审','玉米直收,深松','申请新增玉米籽粒直收服务，设备清单已上传。','营业执照,设备发票','安阳市','明日上午','pending','93410500MA45LIMIN7X','王利民','139****6602','安阳市及周边',87,4.3,'low','首次入驻初审','2026-10-24 08:40:00');

INSERT IGNORE INTO service_item
(id,provider_id,name,category,price,unit,description,duration,selected_count,status,audit_status,audit_reason,ai_score) VALUES
(6,11,'玉米籽粒直收服务','农机作业',120,'元/亩','使用纵轴流联合收割机，含运输卸粮。','约 80 亩/天',0,'pending','pending','待补充机具年检证明',91),
(7,9,'深翻旋耕联合作业','农机作业',70,'元/亩','深翻 30cm 后同步旋耕平整。','约 55 亩/天',0,'pending','pending','与同类价格相比偏低，待确认服务范围',77),
(8,10,'小麦冬前管理视频课','培训服务',0,'元/人','面向家庭农场的冬前镇压与肥水管理课程。','6 课时',0,'pending','pending','版权证明材料模糊，待复审',64);

-- 需求大厅里的两条新需求：match_count 由服务端按同类目在营服务商数实算，种子里只给初值
INSERT IGNORE INTO service_demand
(id,demand_no,category,service_name,description,location,area,preferred_date,budget_min,budget_max,contact_name,contact_phone,status,match_count,accepted_provider_id,accepted_provider_name,merchant_id,merchant_name,created_at) VALUES
(3,'DM20261024003','农机作业','冬小麦深松整地','150 亩连片地块，要求深松 30cm 并同步旋耕，三天内进场。','安阳市韩陵镇','150亩','2026-10-26',55,65,'张建国','137****6108','matching',4,NULL,NULL,2001,'绿源农业合作社','2026-10-24 14:10:00'),
(4,'DM20261024004','植保防疫','大棚蔬菜冬季飞防','46 亩设施菜地，傍晚作业，需提供低毒药剂清单。','聊城市莘县','46亩','2026-10-27',9,12,'孙女士','136****9920','matching',3,NULL,NULL,2003,'陕西洛川果业','2026-10-24 15:30:00');

INSERT IGNORE INTO service_order
(id,order_no,provider_id,provider_name,service_name,category,quantity,unit,unit_price,total_amount,deposit_amount,appointment_date,appointment_slot,location,contact_name,contact_phone,notes,status,progress,rating,review,dispatch_status,risk_flag,settle_status,merchant_id,merchant_name,created_at) VALUES
(6,'FW20261024021',10,'大地职业培训学校','小麦冬前管理实训','培训服务',18,'人次',120,2160,0,'2026-10-28','09:00-16:00','安阳市韩陵镇培训点','张建国','137****6108','需要提供结业材料。','confirmed',35,NULL,NULL,'normal',NULL,'pending',2001,'绿源农业合作社','2026-10-24 12:20:00'),
(7,'FW20261024018',9,'恒丰农机合作社','冬小麦深松作业','农机作业',160,'亩',58,9280,500,'2026-10-25','全天','豫北示范区 6 号地','李经理','135****2016','需在两天内完成。','confirmed',35,NULL,NULL,'at_risk','服务商连续取消，建议改派','frozen',2003,'陕西洛川果业','2026-10-24 10:10:00');

INSERT IGNORE INTO service_complaint
(id,complaint_no,order_no,category,description,demand,status,progress,handler,resolution,merchant_id,merchant_name,created_at) VALUES
(2,'TS20261023011','FW20261022015','作业质量','飞防边界重复喷施，边缘作物出现药害。','返工并补偿受影响面积。','processing',55,'质量仲裁员','等待现场复核',2003,'陕西洛川果业','2026-10-23 14:30:00'),
(3,'TS20261022008','FW20261018006','服务时效','检测报告超过承诺时间仍未出具。','尽快出报告并说明延期原因。','resolved',100,'平台客服','报告已于当日补发，免除加急费用',2001,'绿源农业合作社','2026-10-22 11:20:00');

INSERT IGNORE INTO service_settlement
(id,batch_no,period_name,order_count,amount,commission,status,reviewed_by,reviewed_at,created_at) VALUES
(1,'ST20261023','2026-10-23 T+1 批次',1108,764200,74890,'pending',NULL,NULL,'2026-10-23 02:00:00'),
(2,'ST20261022','2026-10-22 T+1 批次',986,688400,67320,'approved','平台运营','2026-10-22 18:02:00','2026-10-22 02:00:00'),
(3,'ST20261021','2026-10-21 手工补单',27,18640,1864,'pending',NULL,NULL,'2026-10-21 17:20:00');

INSERT IGNORE INTO service_campaign
(id,name,scope_name,quota,claimed,budget,status,starts_at,ends_at) VALUES
(1,'秋收机收满减券','农机服务品类',8000,5126,400000,'running','2026-10-01','2026-11-15'),
(2,'新人首单券','全品类',12000,7840,240000,'running','2026-09-01','2026-12-31'),
(3,'政府农服务消费券','试点县 · 深松/飞防',3000,1960,180000,'government','2026-10-10','2026-12-20'),
(4,'S级服务商专属推荐位','首页猜你需要',0,0,0,'running','2026-10-15','2026-11-15'),
(5,'复购召回券（沉睡90天）','定向人群',2400,612,48000,'scheduled','2026-11-01','2026-11-30');

INSERT IGNORE INTO service_quality_alert
(id,provider_id,provider_name,alert_type,content,score,level,status,created_at) VALUES
(1,9,'恒丰农机合作社','取消率异常','近 7 日均分 3.2，取消率 15.6%，AI 质量预警提前 36 小时触发。',61.3,'high','open','2026-10-24 08:20'),
(2,2,'绿翼飞防服务队','药害争议','边界重复喷施投诉，CV 质检覆盖率 61%，建议复核作业轨迹。',78.4,'medium','processing','2026-10-23 16:40'),
(3,NULL,'平台评价池','刷单好评','检测到 3 条疑似同设备批量好评，已自动转入评价审核队列。',86.0,'medium','open','2026-10-23 11:10');

INSERT IGNORE INTO service_strategy
(config_key,label,value_text,description,updated_at) VALUES
('distance_weight','距离权重','35%','服务商与需求地块距离在匹配总分的占比','2026-10-20'),
('capability_weight','能力权重','25%','机型、资质、技能与历史履约匹配权重','2026-10-20'),
('price_weight','价格权重','15%','报价合理性及预算匹配权重','2026-10-20'),
('rating_weight','口碑权重','15%','评分、投诉、复购与真实评价权重','2026-10-20'),
('availability_weight','档期权重','10%','实时可用档期与设备在线状态权重','2026-10-20'),
('auto_dispatch','自动派单','enabled','距需求 10km 内、匹配分 85 以上自动指派','2026-10-22');

-- 运营侧人员名单：只是"谁在做这件事"的组织信息，真实留痕的操作人一律取登录令牌
INSERT IGNORE INTO service_team_member
(id,name,role_name,scope_name,permissions_text,status) VALUES
(1,'运营主管岗','运营主管','综合服务运营','审批清退,规则配置,预算管理,模型全量','active'),
(2,'服务商审核岗','服务商审核专员','入驻/资质/商品审核','审核通过,驳回补件,查看档案','active'),
(3,'调度岗','调度专员','派单/改派/看板','人工派单,改派,广播','active'),
(4,'质量仲裁岗','质量仲裁员','投诉/仲裁/评价','裁决,保障金赔付','active'),
(5,'结算岗','结算专员','对账/分账/发票','批次复核,手工批次发起','active');

INSERT IGNORE INTO service_op_log
(id,operator_name,role_name,action_name,target_name,detail,ip_address,created_at) VALUES
(1,'平台运营','审核专员','服务商品审核','水稻飞防包（绿翼）','AI 预检 93 分，人工确认验收标准已补','10.2.8.21','2026-10-23 09:52'),
(2,'AI自动','智能审核','服务商品审核','价格指数险','置信度 0.96，规则全部通过','—','2026-10-23 09:31'),
(3,'平台运营','调度专员','人工改派','FW20261024018','由恒丰改派建国农机；原因：连续取消','10.2.8.34','2026-10-23 09:12'),
(4,'平台运营','仲裁员','质量仲裁','FW20261022015','退款 ¥120 并安排返工，CV 证据 1.4 亩','10.2.8.40','2026-10-23 08:47'),
(5,'平台运营','结算专员','财务批次复核','ST20261022','986 笔 / ¥688,400；差异 0','10.2.8.27','2026-10-22 18:02');

INSERT IGNORE INTO service_daily_metric
(id,metric_date,order_count,gmv,provider_count,complaint_count) VALUES
(1,'2026-10-19',182,128600,796,4),
(2,'2026-10-20',206,143200,804,5),
(3,'2026-10-21',198,139800,811,7),
(4,'2026-10-22',224,156400,822,6),
(5,'2026-10-23',238,168900,836,8),
(6,'2026-10-24',246,174600,848,6),
(7,'2026-10-25',118,91200,854,3);

-- 问诊必须挂到真实专家档案：按姓名对齐 service_expert，对不上就留空
-- （宁可页面显示"未派专家"，也不要在数据里编一个专家名字）。
-- 放在种子末尾是因为补列脚本先于本文件执行，那时 service_expert 还是空表。
UPDATE service_consultation SET expert_id = (
  SELECT MIN(e.id) FROM service_expert e WHERE e.name = service_consultation.expert_name
) WHERE expert_id IS NULL AND expert_name IS NOT NULL;

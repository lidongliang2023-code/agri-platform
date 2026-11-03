INSERT IGNORE INTO gov_subject
(id,subject_name,credit_code,subject_type,legal_person,contact_phone,address,region,industry,scale_text,credit_score,credit_level,risk_level,supervision_status,certification_status,annual_report_status,merchant_id,updated_at) VALUES
(1,'绿源蔬菜专业合作社','91420100MA4KXXXX1X','农民专业合作社','陈建国','13800121206','寿光市稻田镇兴隆路18号','寿光市','蔬菜种植','128亩',96,'A+','low','normal','certified','completed',2001,'2026-10-24 16:20'),
(2,'寿光绿丰农资店','91370783MA3C58021R','个体工商户','刘海峰','137****6021','寿光市稻田镇兴隆路22号','寿光市','农资经营','门店1家',72,'C','high','restricted','certified','overdue',NULL,'2026-10-24 09:40'),
(3,'绿野有机农场有限公司','91370783MA7GREEN98X','企业','王春生','136****8812','寿光市洛城街道东环路6号','寿光市','蔬菜种植','620亩',92,'A','medium','normal','certified','completed',NULL,'2026-10-23 14:30'),
(4,'韩氏蔬菜购销中心','91370781MA3FARM16J','个体工商户','韩志强','135****7720','寿光市蔬菜批发市场B区','寿光市','农产品流通','摊位2个',68,'C-','high','restricted','certified','overdue',NULL,'2026-10-22 11:20'),
(5,'金穗粮食种植家庭农场','92370782MA5GRAIN32A','家庭农场','赵金穗','139****5108','青州市高柳镇东马村','青州市','粮食种植','450亩',94,'A','low','normal','certified','completed',NULL,'2026-10-21 10:10');
-- merchant_id 是"监管档案 ↔ 平台经营主体"的唯一关联口径：主体端登录后看到的一切都由它解析出来。
-- 名称按监管登记名保留（与平台侧的注册名可以不同，档案名以监管登记为准），未绑定的档案只有运营端能看。

INSERT IGNORE INTO gov_license
(id,subject_id,license_name,license_no,authority,issue_date,expire_date,status,attachment_name) VALUES
(1,1,'营业执照','91370783MA4KXXXX1X','寿光市行政审批服务局','2019-05-16','长期','valid','营业执照.pdf'),
(2,1,'食品生产许可证','SC10137078300126','潍坊市市场监督管理局','2024-06-18','2029-06-17','valid','食品生产许可证.pdf'),
(3,1,'农产品质量安全承诺书','ZX2026-0081','寿光市农业农村局','2026-01-10','2026-12-31','valid','承诺书.pdf'),
(4,1,'排污登记回执','PD2024-0318','潍坊市生态环境局','2024-03-18','2029-03-17','valid','排污登记.pdf'),
-- 双公示是跨主体的行政许可公开，只有第一家有证照就会被读成"公示了我自己的证照"
(5,2,'农药经营许可证','NYXK-370783-0216','寿光市农业农村局','2023-08-01','2028-07-31','valid','农药经营许可证.pdf'),
(6,2,'营业执照','91370783MA3C58021R','寿光市行政审批服务局','2016-03-02','长期','valid','营业执照.pdf'),
(7,3,'有机产品认证证书','134OP200897','北京中绿华夏有机产品认证中心','2025-11-20','2026-11-19','valid','有机认证证书.pdf'),
(8,3,'营业执照','91370783MA7GREEN98X','潍坊市行政审批服务局','2018-07-11','长期','valid','营业执照.pdf');

INSERT IGNORE INTO gov_report
(id,report_no,subject_id,report_type,title,description,period_name,status,ai_score,chain_hash,submitted_at) VALUES
(1,'SB20261022001',1,'农产品检测数据','10月蔬菜农残自检报告','完成12批次蔬菜农残快检，全部合格。','2026-10','verified',96,'0x7f3ab29c','2026-10-22 10:20:00'),
(2,'SB20260930002',1,'进销货台账','9月农资与农产品进销货台账','已将采购、销售及库存记录汇总上报。','2026-09','verified',92,'0x2d8ef041','2026-09-30 16:10:00'),
(3,'SB20260915003',1,'溯源数据','9月蔬菜批次溯源数据','提交24个批次种植、采收和检测节点。','2026-09','needs_fix',78,'0x9c1b77ae','2026-09-15 09:30:00');

INSERT IGNORE INTO gov_self_check
(id,subject_id,check_no,score,risk_count,result_text,items_text,status,checked_at) VALUES
(1,1,'ZC20261024001',91,2,'主体整体合规情况良好，存在2项低风险提醒。','农药采购台账缺少1张供应商资质附件|部分采收记录未关联检测批次','completed','2026-10-24 15:30:00');

INSERT IGNORE INTO gov_credit_event
(id,subject_id,event_type,title,score_change,detail,source_name,event_date,public_flag) VALUES
(1,1,'reward','连续三年监督抽检合格',4,'2023-2026年连续监督抽检合格，无有效质量投诉。','寿光市农业农村局','2026-08-12',TRUE),
(2,1,'inspection','双随机检查结果合格',2,'2026年度双随机一公开检查未发现问题。','寿光市农业农村局','2026-06-18',TRUE),
(3,1,'penalty','采收记录不完整',-2,'责令改正并按期完成整改，未造成危害后果。','寿光市农业农村局','2025-11-08',TRUE),
(4,1,'reward','承诺达标合格证规范开具',1,'连续6个月规范开具承诺达标合格证。','寿光市农业农村局','2026-09-02',TRUE);

INSERT IGNORE INTO gov_credit_repair
(id,repair_no,subject_id,repair_type,reason,attachment_name,status,progress,review_note,submitted_at) VALUES
(1,'XF20261020001',1,'整改完成修复','已完成采收记录与检测批次关联整改，提交整改报告。','整改报告.pdf','reviewing',60,'材料已通过AI预审','2026-10-20 14:20:00');

INSERT IGNORE INTO gov_inspection
(id,inspection_no,subject_id,subject_name,inspection_type,inspectors,result_text,risk_count,status,inspection_date,chain_hash) VALUES
(1,'JC20260618009',1,'绿源蔬菜专业合作社','双随机一公开','王磊、李敏','检查农产品生产记录、投入品仓库和承诺达标合格证开具情况，未发现违法行为。',0,'completed','2026-06-18','0x6a11c29d'),
(2,'JC20251017003',1,'绿源蔬菜专业合作社','日常检查','王磊、赵宁','发现部分采收记录未关联检测批次，已责令限期整改。',1,'completed','2025-10-17','0x3e2ab771');

INSERT IGNORE INTO gov_rectification
(id,rectification_no,subject_id,inspection_id,issue_text,requirement,deadline,status,progress,feedback_text,submitted_at) VALUES
(1,'ZG20250815002',1,2,'部分采收记录缺少检测批次关联。','完善采收记录并逐批关联检测编号，提交整改报告。','2025-08-25','closed',100,'已补充全部记录并完成复核。','2025-08-21 10:30:00'),
(2,'ZG20261021001',1,1,'供应商资质附件缺失。','补传农药供应商经营许可证和产品登记证。','2026-10-28','pending',30,'正在收集供应商材料。','2026-10-21 09:20:00');

INSERT IGNORE INTO gov_penalty
(id,penalty_no,subject_id,subject_name,violation_text,legal_basis,penalty_text,amount,document_date,statement_status,statement_text,public_flag,status) VALUES
(1,'CF20251017001',1,'绿源蔬菜专业合作社','生产记录不完整，未按规定保存农产品生产记录。','《农产品质量安全法》第四十七条','警告，责令限期改正',0,'2025-10-17','accepted','已按期完成整改并提交陈述材料。',TRUE,'closed'),
(2,'CF20260912003',2,'寿光绿丰农资店','销售限制使用农药未建立完整购销台账。','《农药管理条例》第五十八条','罚款并责令整改',5000,'2026-09-12','not_submitted',NULL,TRUE,'effective');

INSERT IGNORE INTO gov_policy
(id,title,policy_level,category,issuing_authority,policy_no,summary,content_text,publish_date,effective_date,deadline,status,tags_text) VALUES
(1,'山东省农产品质量安全信用管理办法','省级','信用监管','山东省农业农村厅','鲁农质监〔2026〕8号','规范农产品生产经营主体信用信息归集、评价、修复和分级分类监管。','全文围绕信用档案、评价指标、红黑名单、修复流程等内容作出规定。','2026-03-12','2026-04-01','长期','open','信用+质量安全+分级监管'),
(2,'寿光市蔬菜产业高质量发展奖补方案','县级','产业奖补','寿光市农业农村局','寿农发〔2026〕21号','支持标准化基地、数字农业和品牌建设，单个主体最高奖补30万元。','项目采取先建后补方式，需提供建设合同、发票和遥感核验结果。','2026-05-20','2026-05-20','2026-11-30','open','蔬菜+基地+品牌'),
(3,'农产品承诺达标合格证制度实施指引','国家级','质量安全','农业农村部','农质发〔2026〕3号','指导生产主体规范开具、查验和留存承诺达标合格证。','生产主体应真实记录生产过程和检测信息，并对承诺内容负责。','2026-01-18','2026-02-01','长期','open','合格证+追溯+主体责任'),
(4,'农业经营主体信用修复实施细则','市级','信用修复','潍坊市农业农村局','潍农规〔2026〕5号','明确信用修复条件、材料、审核时限和修复后监管要求。','一般失信行为整改完成且公示期满后可申请修复。','2026-06-08','2026-07-01','长期','open','信用修复+整改+公示');

INSERT IGNORE INTO gov_subsidy
(id,application_no,policy_id,subject_id,subject_name,project_name,amount,status,progress,remote_check_status,submitted_at) VALUES
(1,'BT20260928003',2,1,'绿源蔬菜专业合作社','数字化蔬菜基地提升项目',120000,'county_review',70,'遥感核查通过','2026-09-28 11:20:00'),
(2,'BT20260802001',2,1,'绿源蔬菜专业合作社','标准化育苗设施改造',45000,'paid',100,'现场核验通过','2026-08-02 09:30:00'),
(3,'BT20261018002',2,3,'绿野有机农场有限公司','有机蔬菜品牌建设项目',220000,'submitted',20,'待遥感核查','2026-10-18 15:10:00');

INSERT IGNORE INTO gov_warning
(id,warning_no,warning_type,level_name,subject_id,subject_name,location,title,content,ai_confidence,status,assigned_to,assignee_id,handle_note,created_at) VALUES
(1,'YJ20261025001','价格异常','red',NULL,NULL,'寿光市蔬菜批发市场','香菜价格异常上涨45%预警核查','近7日香菜批发均价异常上涨45%，主因产区降雨贡献度45%，建议核查囤积与哄抬价格线索。',92,'pending','张科长',1,NULL,'今天 08:15'),
(2,'YJ20261025002','质量安全','orange',2,'寿光绿丰农资店','稻田镇兴隆路18号','疑似销售禁用农药','IoT进销存交叉比对：台账无甲胺磷进货记录，但近7天扫码销售出现2条异常出库。',91,'assigned','王磊',2,NULL,'今天 08:25'),
(3,'YJ20261024003','追溯异常','orange',4,'韩氏蔬菜购销中心','蔬菜批发市场B区','溯源码冒用预警','同一溯源码在24小时内跨3个销售终端重复核销，疑似标签冒用。',87,'pending','王磊',2,NULL,'昨天 17:40'),
(4,'YJ20261024004','信用风险','yellow',NULL,NULL,'寿光市','6家主体信用分下调超过10分','信用画像模型识别近期投诉和检查结果异常集中，建议开展分级分类监管。',84,'processing','张科长',1,NULL,'昨天 14:20');

INSERT IGNORE INTO gov_task
(id,task_no,task_type,subject_id,subject_name,address,distance_km,deadline,priority,status,checklist_done,checklist_total,assigned_to,assignee_id,result_text,created_at) VALUES
(1,'RW20261025001','双随机一公开',2,'寿光绿丰农资店','寿光市稻田镇兴隆路22号',0.8,'今日 18:00','high','pending',0,8,'王磊',2,NULL,'今天 08:30'),
(2,'RW20261025002','日常巡查',3,'绿野有机农场有限公司','寿光市洛城街道东环路6号',4.1,'今日 17:00','normal','in_progress',5,8,'王磊',2,NULL,'今天 08:35'),
(3,'RW20261025003','专项检查',4,'韩氏蔬菜购销中心','寿光市蔬菜批发市场B区',2.3,'明日 12:00','high','pending',0,6,'赵宁',3,NULL,'今天 09:10'),
(4,'RW20261024004','抽样任务',5,'金穗粮食种植家庭农场','青州市高柳镇东马村',18.4,'10-26 17:00','normal','pending',0,4,'王磊',2,NULL,'昨天 16:30');

INSERT IGNORE INTO gov_case
(id,case_no,task_id,subject_id,subject_name,case_type,summary,legal_basis,status,stage_progress,penalty_amount,handler,handler_id,filed_at,closed_at) VALUES
(1,'AJ20261012001',NULL,2,'寿光绿丰农资店','农资经营', '涉嫌销售限制使用农药且购销台账不完整','《农药管理条例》第五十八条','investigating',55,5000,'王磊',2,'2026-10-12',NULL),
(2,'AJ20260928002',NULL,4,'韩氏蔬菜购销中心','追溯违法','疑似重复使用农产品承诺达标合格证标识','《农产品质量安全法》第七十二条','evidence',35,0,'赵宁',3,'2026-09-28',NULL),
(3,'AJ20250815001',NULL,1,'绿源蔬菜专业合作社','生产记录','生产记录不完整，已整改结案','《农产品质量安全法》第四十七条','closed',100,0,'王磊',2,'2025-08-15','2025-10-17');

INSERT IGNORE INTO gov_trace_event
(id,trace_code,product_name,batch_no,subject_id,subject_name,stage_name,event_title,location,event_time,evidence_text,chain_hash) VALUES
(1,'370783202610200001','西红柿','PC20261020001',1,'绿源蔬菜专业合作社','种植','定植与田间管理记录归档','1号温室','2026-08-18 09:20','智慧农场环境数据与农事记录已核验','0x1a2b3c01'),
(2,'370783202610200001','西红柿','PC20261020001',1,'绿源蔬菜专业合作社','采收','采收批次检测合格','1号温室','2026-10-20 06:30','快检12项农残指标全部合格','0x1a2b3c02'),
(3,'370783202610200001','西红柿','PC20261020001',1,'绿源蔬菜专业合作社','加工','分级包装并赋码','合作社分拣中心','2026-10-20 10:10','包装批次与检测批次关联','0x1a2b3c03'),
(4,'370783202610200001','西红柿','PC20261020001',1,'绿源蔬菜专业合作社','流通','进入批发市场','寿光蔬菜批发市场','2026-10-20 15:40','运输温湿度记录正常','0x1a2b3c04'),
(5,'370783202610200001','西红柿','PC20261020001',1,'绿源蔬菜专业合作社','销售','零售商扫码验收','丰禾生鲜门店','2026-10-21 08:15','扫码验收并生成电子销售凭证','0x1a2b3c05');

INSERT IGNORE INTO gov_sampling
(id,sampling_no,product_name,subject_id,subject_name,region,sample_date,test_items,result_text,disposition,public_flag) VALUES
(1,'CY20261015008','西红柿',1,'绿源蔬菜专业合作社','寿光市','2026-10-15','毒死蜱、甲拌磷等12项','合格','未发现问题',TRUE),
(2,'CY20261014003','韭菜',2,'寿光绿丰农资店','寿光市','2026-10-14','腐霉利、克百威等8项','不合格','责令停止销售并立案调查',TRUE),
(3,'CY20261012011','小麦',5,'金穗粮食种植家庭农场','青州市','2026-10-12','铅、镉、呕吐毒素','合格','未发现问题',TRUE);

INSERT IGNORE INTO gov_complaint
(id,complaint_no,complaint_type,title,content,reporter_name,reporter_phone,anonymous,target_name,status,priority,assigned_org,handle_note,created_at) VALUES
(1,'JB20261024005','食品质量安全','购买的西红柿疑似农残超标','消费者反映在门店购买的西红柿有异味，怀疑农残超标，希望监督抽检。','张女士','135****2026',FALSE,'丰禾生鲜门店','processing','high','寿光市农业综合执法大队','已安排专项抽检','2026-10-24 16:30:00'),
(2,'JB20261021003','农资经营','农资店疑似销售禁用农药','反映绿丰农资店出售无标签农药，希望核查仓库。','匿名用户',NULL,TRUE,'寿光绿丰农资店','accepted','high','寿光市农业综合执法大队',NULL,'2026-10-21 09:20:00'),
(3,'JB20261012002','补贴发放','合作社补贴到账金额有疑问','对补贴发放金额和公示面积存在疑问，希望核查遥感结果。','王先生','136****1718',FALSE,'绿源蔬菜专业合作社','resolved','normal','寿光市农业农村局','经核查遥感结果无误，已向申请人反馈','2026-10-12 14:20:00');

INSERT IGNORE INTO gov_message
(id,user_type,subject_id,assignee_id,message_type,title,content,biz_type,biz_no,is_read,created_at) VALUES
(1,'subject',1,NULL,'rectification','您有一条责令改正通知','供应商资质附件缺失，请在 10 月 28 日前补传材料。','RECTIFICATION','ZG20261021001',FALSE,'今天 09:20'),
(2,'subject',1,NULL,'credit','信用修复申请进入人工审核','修复编号 XF20261020001 已通过 AI 预审。','REPAIR','XF20261020001',FALSE,'昨天 15:40'),
(3,'subject',1,NULL,'subsidy','补贴项目遥感核查通过','数字化蔬菜基地提升项目已完成遥感核查。','SUBSIDY','BT20260928003',FALSE,'10-23 11:30'),
(4,'subject',1,NULL,'policy','政策更新提醒','《寿光市蔬菜产业高质量发展奖补方案》正在申报期。','POLICY',NULL,TRUE,'10-21 08:30'),
(5,'inspector',NULL,2,'task','今日新增执法任务','寿光绿丰农资店专项检查今日到期。','TASK','RW20261025001',FALSE,'今天 08:30');
-- subject_id / assignee_id 是收件人：没有它们，任何一个登录账号都能读到全站消息（原来就是这样按 user_type 一把捞）。

INSERT IGNORE INTO gov_data_share
(id,resource_name,owner_department,receiver_department,share_type,sensitive_level,status,record_count,updated_at) VALUES
(1,'农产品质量安全抽检结果','农业农村局','市场监督管理局','接口共享','三级', 'approved',12860,'2026-10-24 10:20'),
(2,'农业经营主体信用档案','农业农村局','发展改革委','批量交换','三级','pending',28642,'2026-10-24 09:30'),
(3,'农产品溯源流通节点','农业农村局','商务局','实时接口','二级','approved',85630,'2026-10-23 16:10'),
(4,'农业产业扶持项目清单','农业农村局','财政局','文件共享','三级','reviewing',326,'2026-10-22 14:00');

INSERT IGNORE INTO gov_user
(id,name,role_name,organization,grid_name,certificate_no,platform_user_id,status) VALUES
(1,'张科长','监管运营主管','市农业农村局','全市','ZF15060220240011',NULL,'active'),
(2,'王磊','执法人员','农业综合执法二大队','稻田镇网格','15060220240118',NULL,'active'),
(3,'赵宁','执法人员','农业综合执法一大队','洛城街道网格','15060220240125',NULL,'active'),
(4,'李敏','信用监管专员','市农业农村局信用科','全市','XY15060220240007',NULL,'active'),
(5,'刘审核','政策项目专员','市农业农村局产业科','全市','CY15060220240003',NULL,'active');
-- platform_user_id 由 scripts/provision-gov-inspector-account.mjs 通过平台接口开通账号后回填：
-- 移动执法端"我的任务/我的案件"要靠它把令牌解析成人，而不是在代码里写死 '王磊'。

-- 执法事项清单模板：任务详情的检查项来自这张表（原来 8 条写死在 Java 里）
INSERT IGNORE INTO gov_check_item
(id,item_name,note,sort_order,status) VALUES
(1,'主体证照与经营范围','核对营业执照与许可证是否在有效期内',1,'active'),
(2,'生产记录与投入品台账','抽查近 3 个月的生产与采购记录',2,'active'),
(3,'农业投入品仓库','检查是否存在禁用农药与过期产品',3,'active'),
(4,'承诺达标合格证','核对开具、留存与随货同行',4,'active'),
(5,'质量检测记录','核对监督抽检与企业自检结果',5,'active'),
(6,'追溯码使用','抽查 3 个产品批次的溯源码有效性',6,'active'),
(7,'整改闭环','复核历史问题整改完成情况',7,'active'),
(8,'其他风险项','现场发现的其他违法违规情形',8,'active');

-- 进行中任务已勾选的检查项（gov_task.checklist_done 要与这里的行数一致，否则页面上的进度是假的）
INSERT IGNORE INTO gov_task_check
(id,task_id,item_id,item_name,note,done,checked_at) VALUES
(1,2,1,'主体证照与经营范围','营业执照、许可证均在有效期',TRUE,'今天 09:05'),
(2,2,2,'生产记录与投入品台账','已抽查 3 个月记录，2 项待补附件',TRUE,'今天 09:20'),
(3,2,3,'农业投入品仓库','未发现禁用农药',TRUE,'今天 09:35'),
(4,2,4,'承诺达标合格证','开具与留存一致',TRUE,'今天 09:48'),
(5,2,5,'质量检测记录','抽检与自检结果已核对',TRUE,'今天 10:02'),
(6,2,6,'追溯码使用',NULL,FALSE,NULL),
(7,2,7,'整改闭环',NULL,FALSE,NULL),
(8,2,8,'其他风险项',NULL,FALSE,NULL);

INSERT IGNORE INTO gov_daily_metric
(id,metric_date,subject_count,warning_count,inspection_count,sampling_rate,case_count,trade_amount) VALUES
(1,'2026-10-19',28062,18,26,98.2,15,28200000),
(2,'2026-10-20',28126,21,31,98.5,16,29500000),
(3,'2026-10-21',28201,19,24,98.4,16,30100000),
(4,'2026-10-22',28338,22,29,98.8,17,31600000),
(5,'2026-10-23',28455,25,33,98.9,18,31900000),
(6,'2026-10-24',28542,24,28,98.6,18,32200000),
(7,'2026-10-25',28642,23,16,98.7,18,32560000);

INSERT IGNORE INTO gov_op_log
(id,operator_name,role_name,action_name,target_name,detail,ip_address,created_at) VALUES
(1,'张科长','监管运营主管','预警处置','YJ20261025001','将价格异常预警分派至市场监管联合核查','10.2.9.18','10-25 08:35'),
(2,'王磊','执法人员','现场检查','RW20261025002','绿野有机农场检查项完成5/8','10.2.9.32','10-25 09:10'),
(3,'李敏','信用监管专员','信用修复初审','XF20261020001','AI预审通过，转人工复核','10.2.9.27','10-24 15:40'),
(4,'刘审核','政策项目专员','补贴项目遥感核查','BT20260928003','遥感核验通过，转区县复核','10.2.9.44','10-23 11:30');

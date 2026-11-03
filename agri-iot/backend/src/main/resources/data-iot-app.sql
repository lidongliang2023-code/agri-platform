-- tenant_id / iot_tenant.id 一律用平台经营主体号（agri_core.platform_merchant.id）。
-- 以前这里是自增 1..4，而设备表存的是 2001，运营端 LEFT JOIN 永远解析不出租户名。
INSERT IGNORE INTO iot_tenant (id,tenant_name,tenant_code,plan_name,device_limit,device_count,region_name,status,expire_date) VALUES
(2001,'绿源农业合作社','M2001','旗舰版',2000,0,'广东省广州市','active','2027-12-31'),
(2003,'陕西洛川果业','M2003','专业版',800,0,'陕西省延安市','active','2027-06-30');

-- 农场的唯一来源是 agri-production（/api/v1/production/farms/all）。
-- id 必须与生产端农场主键一致、tenant_id 用经营主体号，否则设备列表的「所属农场」是空的；
-- 名称照抄生产端演示数据。三个计数列由应用实时算，这里给 0 而不是留着对不上的常量。
INSERT IGNORE INTO iot_farm (id,tenant_id,farm_name,manager,phone,address,area,device_count,online_count,alert_count,status,created_at) VALUES
(1,2001,'【演示】华南绿色蔬菜示范农场','李秀兰','13800121206','广东省广州市增城区永宁街道',128.50,0,0,0,'normal','2026-03-12'),
(2,2001,'【演示】华东智慧稻田农场','赵国平','13700137002','江苏省苏州市昆山市锦溪镇',86.20,0,0,0,'normal','2026-04-02'),
(3,2001,'【演示】鲁中设施果蔬农场','孙玉梅','13900139003','山东省潍坊市寿光市孙家集街道',260.00,0,0,0,'normal','2026-04-18'),
(4,2001,'【演示】西北高原生态牧场','马忠良','13600136004','甘肃省定西市安定区内官营镇',310.00,0,0,0,'normal','2026-05-06'),
(5,2001,'【演示】江汉稻渔综合种养农场','周建国','13500135005','湖北省武汉市江夏区金口街道',188.00,0,0,0,'normal','2026-05-22'),
(6,2001,'【演示】滇中花卉种苗基地','段红梅','13400134006','云南省昆明市呈贡区洛龙街道',76.00,0,0,0,'normal','2026-06-10');

-- 地块档案不再由物联网端维护：地块列表/名称/面积/作物统一走 agri-production 的
-- 租户地块接口（见 ProductionPlotClient），iot_device.plot_id 存的就是生产地块主键。
-- 原先这张 iot_plot 表只被 device_count 自增/自减写过，从未被任何查询读取，已删除。

INSERT IGNORE INTO iot_gateway (id,farm_id,gateway_code,gateway_name,gateway_model,protocol_name,firmware_version,ip_address,online_count,total_count,online_status,cpu_rate,memory_rate,last_online) VALUES
(1,1,'GW001','1号棚边缘网关','EG-200','LoRa+4G','v3.1.0','10.12.1.21',48,48,'online',28,42,'今天 10:18'),
(2,1,'GW002','2号棚边缘网关','EG-200','LoRa+4G','v3.1.0','10.12.1.22',36,37,'online',31,45,'今天 10:18'),
(3,1,'GW003','3号地块网关','EG-100','NB-IoT','v2.8.4','10.12.1.23',22,22,'online',18,33,'今天 10:17'),
(4,2,'GW101','东区连栋棚网关','EG-200','LoRa+4G','v3.0.8','10.12.2.11',64,67,'online',44,62,'今天 10:16');

INSERT IGNORE INTO iot_device_type (id,type_name,category_name,protocol_name,icon_text,manufacturer,model_name,property_text,status) VALUES
(1,'空气温湿度传感器','环境传感器','MQTT','🌡️','丰联智造','TH-200','temperature,humidity','active'),
(2,'土壤墒情传感器','环境传感器','LoRaWAN','🌱','丰联智造','SM-300','soil_moisture,soil_temp,ph','active'),
(3,'光照传感器','环境传感器','LoRaWAN','☀️','绿测科技','LI-100','light_intensity','active'),
(4,'二氧化碳传感器','环境传感器','MQTT','🌫️','绿测科技','CO2-100','co2','active'),
(5,'智能灌溉阀门','控制器','Modbus','💧','丰联智造','VALVE-8','switch,flow','active'),
(6,'水肥一体机','控制器','MQTT','🧪','润田设备','FER-500','ec,ph,flow','active'),
(7,'温室风机','控制器','Modbus','🌀','绿源温室','FAN-4','switch,speed','active'),
(8,'卷帘控制器','控制器','Modbus','🎛️','绿源温室','ROLL-2','position,switch','active'),
(9,'高清球机摄像头','视频设备','GB28181','📹','海视云','CAM-1080','stream,pan,tilt','active'),
(10,'小型气象站','环境传感器','4G','🌦️','天禾气象','WS-8','temperature,humidity,wind,rain','active'),
(11,'水质监测仪','环境传感器','NB-IoT','💦','渔安科技','WQ-7','ph,oxygen,temp','active'),
(12,'边缘网关','网关设备','MQTT','🌐','丰联智造','EG-200','online,device_count','active'),
-- 13~15 是生产端设备台账收敛过来时补齐的类型，此前生产端用自由文本写设备类型，
-- 物联网类型目录里没有对应项，设备列表按类型筛选会漏。
(13,'虫情测报灯','环境传感器','4G','🐛','佳多科工','PS-15','pest_count','active'),
(14,'水位监测仪','环境传感器','LoRaWAN','🌊','鑫源物联','WL-100','water_level','active'),
(15,'氨气监测仪','环境传感器','LoRaWAN','🧫','芯农电子','GS-110','ammonia','active');

-- 分组也是经营主体的私域数据：以前全平台共用一套，第二个租户在下拉里能挑到别家的分组。
-- 1~6 属于 2001，7~12 属于 2003（同名分组各自一套，互不影响）。
INSERT IGNORE INTO iot_device_group (id,tenant_id,group_name,icon_text,color_value,device_count,is_default) VALUES
(1,2001,'全部设备','📦','#12764a',0,TRUE),
(2,2001,'环境监测组','🌡️','#176c93',0,FALSE),
(3,2001,'灌溉控制组','💧','#159a5e',0,FALSE),
(4,2001,'温室控制组','🏠','#6b418d',0,FALSE),
(5,2001,'视频监控组','📷','#c26b27',0,FALSE),
(6,2001,'粮食仓储组','🌾','#bd7c17',0,FALSE),
(7,2003,'全部设备','📦','#12764a',0,TRUE),
(8,2003,'果园环境监测组','🌡️','#176c93',0,FALSE),
(9,2003,'节水灌溉组','💧','#159a5e',0,FALSE),
(10,2003,'防雹通风组','🏠','#6b418d',0,FALSE),
(11,2003,'视频监控组','📷','#c26b27',0,FALSE),
(12,2003,'果品仓储组','🌾','#bd7c17',0,FALSE);

-- 分组计数（device_count）以前是写死的 428/182/64…，跟设备台账（29 台）差了十几倍。
-- 现在注册/改分组会维护它，读取侧仍按台账实时聚合，这里一律从 0 起步。

-- plot_id 一律指向生产地块主键（agri_prod_plot_info.id）。原先这里写的是 1~6，
-- 那是已删除的 iot_plot 主键，跟生产地块对不上，导致「地块视角」下的设备数全是错的。
INSERT IGNORE INTO iot_device (id,tenant_id,farm_id,plot_id,gateway_id,group_id,device_code,device_name,type_id,type_name,protocol_name,online_status,status_text,last_report,signal_strength,battery_rate,firmware_version,latitude,longitude,control_capable,config_text,created_at) VALUES
(1,2001,1,238,1,2,'DEV-TEM-001','1号棚空气温湿度传感器',1,'空气温湿度传感器','MQTT','online','normal','30秒前',-62,92,'v2.3.5',36.871201,118.793401,FALSE,'{"interval":30}','2026-03-20'),
(2,2001,1,238,1,2,'DEV-SOIL-002','1号棚土壤墒情传感器',2,'土壤墒情传感器','LoRaWAN','online','normal','60秒前',-71,88,'v2.1.0',36.871202,118.793402,FALSE,'{"depth":20}','2026-03-20'),
(3,2001,1,238,1,4,'DEV-FAN-003','1号棚南侧风机',7,'温室风机','Modbus','online','normal','20秒前',-54,100,'v1.8.2',36.871203,118.793403,TRUE,'{"channel":1}','2026-03-21'),
(4,2001,1,238,1,3,'DEV-VALVE-004','1号棚灌溉电磁阀',5,'智能灌溉阀门','Modbus','online','normal','15秒前',-52,100,'v1.6.4',36.871204,118.793404,TRUE,'{"zone":"A"}','2026-03-21'),
(5,2001,1,238,1,5,'DEV-CAM-005','1号棚入口摄像头',9,'高清球机摄像头','GB28181','online','normal','实时流',-58,100,'v3.0.1',36.871205,118.793405,TRUE,'{"channel":1}','2026-03-22'),
(6,2001,1,239,2,2,'DEV-TEM-006','2号棚空气温湿度传感器',1,'空气温湿度传感器','MQTT','online','normal','25秒前',-64,90,'v2.3.5',36.871501,118.793801,FALSE,'{"interval":30}','2026-03-22'),
(7,2001,1,239,2,4,'DEV-FAN-007','2号棚东侧风机',7,'温室风机','Modbus','online','normal','18秒前',-56,100,'v1.8.2',36.871502,118.793802,TRUE,'{"channel":2}','2026-03-22'),
(8,2001,1,239,2,6,'DEV-CO2-008','2号棚二氧化碳传感器',4,'二氧化碳传感器','MQTT','online','normal','35秒前',-67,83,'v1.4.1',36.871503,118.793803,FALSE,'{}','2026-03-23'),
(9,2001,1,240,3,2,'DEV-WS-009','3号田小型气象站',10,'小型气象站','4G','online','normal','45秒前',-73,76,'v2.7.0',36.865401,118.801201,FALSE,'{}','2026-04-01'),
(10,2001,1,240,3,2,'DEV-SOIL-010','3号田土壤传感器',2,'土壤墒情传感器','LoRaWAN','online','normal','50秒前',-78,81,'v2.1.0',36.865402,118.801202,FALSE,'{"depth":30}','2026-04-01'),
(11,2001,1,241,3,3,'DEV-VALVE-011','4号田灌溉阀门',5,'智能灌溉阀门','Modbus','offline','normal','2小时前',-96,42,'v1.6.4',36.864801,118.802001,TRUE,'{"zone":"D"}','2026-04-02'),
(12,2001,2,243,4,4,'DEV-FER-012','东区水肥一体机',6,'水肥一体机','MQTT','alert','alert','15秒前',-61,100,'v2.2.1',36.812401,118.842101,TRUE,'{"zone":"east"}','2026-04-05'),
(13,2001,2,243,4,5,'DEV-CAM-013','东区连栋棚摄像头',9,'高清球机摄像头','GB28181','online','normal','实时流',-59,100,'v3.0.1',36.812402,118.842102,TRUE,'{}','2026-04-05'),
(14,2001,2,243,4,2,'DEV-TEM-014','东区温湿度传感器',1,'空气温湿度传感器','MQTT','online','normal','28秒前',-63,89,'v2.3.5',36.812403,118.842103,FALSE,'{}','2026-04-05'),
(15,2001,3,251,4,6,'DEV-WATER-015','养殖塘水质探头',11,'水质监测仪','NB-IoT','offline','normal','6小时前',NULL,18,'v1.2.8',37.421001,116.338001,FALSE,'{}','2026-05-10'),
(16,2001,3,251,4,6,'DEV-WS-016','粮田气象站',10,'小型气象站','4G','online','normal','60秒前',-70,74,'v2.7.0',37.421002,116.338002,FALSE,'{}','2026-05-10'),
-- 17~29：生产管理端原先自成一套的设备台账（agri_prod_iot_device），设备本体已收敛到本表，
-- 编码原样保留（DEV001~DEV003、DEMO-DEVC-001~010），生产端只保留「绑定关系」。
(17,2001,1,1,1,2,'DEV001','一号大棚温湿度传感器',1,'空气温湿度传感器','MQTT','online','normal','20秒前',-55,92,'v1.2.3',NULL,NULL,FALSE,'{"model":"TH-100","vendor":"农芯科技","ip":"192.168.1.21","interval":60}','2026-02-11'),
(18,2001,1,2,1,2,'DEV002','二号大棚土壤墒情仪',2,'土壤墒情传感器','MQTT','online','normal','45秒前',-61,78,'v1.1.8',NULL,NULL,FALSE,'{"model":"SM-200","vendor":"农芯科技","ip":"192.168.1.22","interval":60}','2026-02-11'),
(19,2001,2,3,4,2,'DEV003','气象站（离线备用）',10,'小型气象站','HTTP','offline','normal','3天前',NULL,NULL,'v2.0.1',NULL,NULL,FALSE,'{"model":"WS-500","vendor":"云耕智能","ip":"192.168.1.30","interval":60}','2026-02-11'),
(20,2001,1,238,1,2,'DEMO-DEVC-001','A区土壤墒情站',2,'土壤墒情传感器','LoRaWAN','online','normal','30秒前',NULL,86,'v2.4.1',NULL,NULL,FALSE,'{"model":"HW-SM200","vendor":"华维传感","interval":60}','2026-03-02'),
(21,2001,1,238,1,2,'DEMO-DEVC-002','A区环境监测站',1,'空气温湿度传感器','MQTT','online','normal','15秒前',NULL,90,'v2.4.1',NULL,NULL,FALSE,'{"model":"HW-TH500","vendor":"华维传感","interval":60}','2026-03-02'),
(22,2001,1,239,1,2,'DEMO-DEVC-003','B区虫情测报灯',13,'虫情测报灯','4G','online','normal','5分钟前',NULL,64,'v1.8.0',NULL,NULL,FALSE,'{"model":"JD-PS15","vendor":"佳多科工","interval":60}','2026-03-02'),
(23,2001,2,243,4,2,'DEMO-DEVC-004','稻田水位监测站',14,'水位监测仪','LoRaWAN','online','normal','40秒前',NULL,72,'v3.0.2',NULL,NULL,FALSE,'{"model":"XY-WL100","vendor":"鑫源物联","interval":60}','2026-03-02'),
(24,2001,3,247,NULL,2,'DEMO-DEVC-005','1号温室环境监控',1,'空气温湿度传感器','MQTT','online','normal','12秒前',NULL,88,'v2.1.7',NULL,NULL,FALSE,'{"model":"LY-GH300","vendor":"鲁仪物联网","interval":60}','2026-03-02'),
(25,2001,3,247,NULL,4,'DEMO-DEVC-006','1号温室卷帘控制器',8,'卷帘控制器','Modbus','offline','normal','1天前',NULL,55,'v1.5.3',NULL,NULL,TRUE,'{"model":"LY-CT220","vendor":"鲁仪物联网","interval":60}','2026-03-02'),
(26,2001,4,253,NULL,2,'DEMO-DEVC-007','牧草区土壤氮素站',2,'土壤墒情传感器','LoRaWAN','online','normal','50秒前',NULL,70,'v1.2.9',NULL,NULL,FALSE,'{"model":"XN-NP200","vendor":"芯农电子","interval":60}','2026-03-02'),
(27,2001,4,255,NULL,2,'DEMO-DEVC-008','舍饲区氨气监测仪',15,'氨气监测仪','LoRaWAN','offline','normal','8小时前',NULL,31,'v1.2.9',NULL,NULL,FALSE,'{"model":"XN-GS110","vendor":"芯农电子","interval":60}','2026-03-02'),
(28,2001,5,256,NULL,2,'DEMO-DEVC-009','稻渔区水质监测浮标',11,'水质监测仪','NB-IoT','online','normal','35秒前',NULL,66,'v4.0.0',NULL,NULL,FALSE,'{"model":"MC-WQ600","vendor":"淼测科技","interval":60}','2026-03-02'),
(29,2001,6,260,NULL,5,'DEMO-DEVC-010','花卉A棚摄像头',9,'高清球机摄像头','GB28181','offline','normal','12小时前',NULL,NULL,'v2.9.4',NULL,NULL,TRUE,'{"model":"HS-IP712","vendor":"海视云","interval":60}','2026-03-02');

-- 遥测时间统一存 yyyy-MM-dd HH:mm（与 iot_telemetry.recorded_at 的读取口径一致）。
-- 以前这里是"今天 10:18"这类相对文本：报表按日期聚合时用不上，大盘的趋势图只能写死常量。
-- 10-26~10-31 是补齐的历史读数，用于展示真实聚合出来的趋势（生产环境由设备上报写入）。
INSERT IGNORE INTO iot_telemetry (id,device_id,metric_key,metric_value,unit_name,recorded_at) VALUES
(1,1,'temperature',27.6,'℃','2026-11-01 10:18'),(2,1,'humidity',68,'%','2026-11-01 10:18'),
(3,2,'soil_moisture',32.5,'%','2026-11-01 10:17'),(4,2,'soil_temp',18.6,'℃','2026-11-01 10:17'),(5,2,'ph',6.8,'pH','2026-11-01 10:17'),
(6,3,'switch',1,'','2026-11-01 10:18'),(7,4,'flow',2.6,'m³/h','2026-11-01 10:18'),
(8,6,'temperature',25.4,'℃','2026-11-01 10:18'),(9,6,'humidity',71,'%','2026-11-01 10:18'),
(10,8,'co2',620,'ppm','2026-11-01 10:16'),(11,9,'temperature',23.8,'℃','2026-11-01 10:17'),(12,9,'humidity',62,'%','2026-11-01 10:17'),
(13,10,'soil_moisture',28.2,'%','2026-11-01 10:17'),(14,12,'ec',2.8,'mS/cm','2026-11-01 10:18'),(15,12,'ph',5.2,'pH','2026-11-01 10:18'),
(16,14,'temperature',26.2,'℃','2026-11-01 10:18'),(17,14,'humidity',66,'%','2026-11-01 10:18'),(18,16,'rain',0,'mm','2026-11-01 10:18'),
(19,1,'temperature',22.6,'℃','2026-10-26 08:00'),(20,1,'humidity',74,'%','2026-10-26 08:00'),(21,2,'soil_moisture',35.1,'%','2026-10-26 08:00'),
(22,1,'temperature',29.4,'℃','2026-10-26 14:00'),(23,1,'humidity',61,'%','2026-10-26 14:00'),(24,2,'soil_moisture',33.8,'%','2026-10-26 14:00'),
(25,1,'temperature',23.1,'℃','2026-10-27 08:00'),(26,1,'humidity',73,'%','2026-10-27 08:00'),(27,2,'soil_moisture',34.2,'%','2026-10-27 08:00'),
(28,1,'temperature',30.2,'℃','2026-10-27 14:00'),(29,1,'humidity',58,'%','2026-10-27 14:00'),(30,2,'soil_moisture',31.6,'%','2026-10-27 14:00'),
(31,1,'temperature',21.8,'℃','2026-10-28 08:00'),(32,1,'humidity',78,'%','2026-10-28 08:00'),(33,2,'soil_moisture',37.4,'%','2026-10-28 08:00'),
(34,1,'temperature',26.5,'℃','2026-10-28 14:00'),(35,1,'humidity',67,'%','2026-10-28 14:00'),(36,2,'soil_moisture',36.1,'%','2026-10-28 14:00'),
(37,1,'temperature',20.4,'℃','2026-10-29 08:00'),(38,1,'humidity',81,'%','2026-10-29 08:00'),(39,2,'soil_moisture',38.9,'%','2026-10-29 08:00'),
(40,1,'temperature',24.9,'℃','2026-10-29 14:00'),(41,1,'humidity',70,'%','2026-10-29 14:00'),(42,2,'soil_moisture',37.2,'%','2026-10-29 14:00'),
(43,1,'temperature',22.2,'℃','2026-10-30 08:00'),(44,1,'humidity',76,'%','2026-10-30 08:00'),(45,2,'soil_moisture',36.8,'%','2026-10-30 08:00'),
(46,1,'temperature',28.7,'℃','2026-10-30 14:00'),(47,1,'humidity',63,'%','2026-10-30 14:00'),(48,2,'soil_moisture',34.5,'%','2026-10-30 14:00'),
(49,1,'temperature',23.5,'℃','2026-10-31 08:00'),(50,1,'humidity',75,'%','2026-10-31 08:00'),(51,2,'soil_moisture',35.9,'%','2026-10-31 08:00'),
(52,1,'temperature',31.2,'℃','2026-10-31 14:00'),(53,1,'humidity',57,'%','2026-10-31 14:00'),(54,2,'soil_moisture',33.1,'%','2026-10-31 14:00'),
(55,1,'temperature',24.1,'℃','2026-11-01 08:00'),(56,1,'humidity',72,'%','2026-11-01 08:00'),(57,2,'soil_moisture',34.7,'%','2026-11-01 08:00'),
(58,9,'co2',540,'ppm','2026-10-30 10:00'),(59,9,'co2',610,'ppm','2026-10-31 10:00'),(60,9,'co2',655,'ppm','2026-11-01 09:00');

-- 6/7 属于 2003（陕西洛川果业）：用来验证「告警按经营主体隔离」。
-- 平台目前没有到设备的采集链路，告警只能由种子/运营侧写入，这一点在 README 的已知边界里写明。
INSERT IGNORE INTO iot_alert (id,alert_no,tenant_id,farm_id,device_id,device_name,alert_type,level_name,title,content,trigger_value,threshold_value,status,handled_by,handle_note,created_at) VALUES
(1,'AL20261101001',2001,1,1,'1号棚空气温湿度传感器','环境阈值','critical','大棚温度过高','当前温度 36.5℃，连续5分钟超过阈值35℃。','36.5','35','pending',NULL,NULL,'2026-11-01 10:01'),
(2,'AL20261101002',2001,1,11,'4号田灌溉阀门','设备离线','major','灌溉阀门离线超过2小时','设备连续离线2小时12分钟，可能为供电或通信异常。','132分钟','120分钟','pending',NULL,NULL,'2026-11-01 09:43'),
(3,'AL20261031003',2001,2,12,'东区水肥一体机','数据异常','major','EC值异常波动','EC值5分钟内由1.8升高至2.8 mS/cm。','2.8','2.2','handling','王工','已远程停止施肥泵，等待现场核查','2026-10-31 09:36'),
(4,'AL20261030004',2001,1,9,'3号田小型气象站','信号弱','normal','气象站信号强度偏低','最近10分钟平均信号强度-88dBm。','-88','-80','resolved','陈工','已调整天线并恢复','2026-10-30 16:42'),
(5,'AL20261030005',2001,1,2,'1号棚土壤墒情传感器','土壤缺水','major','土壤含水率低于25%','当前土壤含水率24.1%，低于作物适宜区间。','24.1','25','resolved','系统','已触发自动灌溉场景','2026-10-30 14:20'),
(6,'AL20261101006',2003,NULL,NULL,'果园3号墒情站','土壤缺水','major','果园土壤含水率偏低','当前土壤含水率 18.7%，低于苹果树适宜区间下限。','18.7','20','pending',NULL,NULL,'2026-11-01 08:12'),
(7,'AL20261031007',2003,NULL,NULL,'果园气象站','霜冻预警','critical','夜间最低气温接近霜冻线','预报夜间最低气温 1.2℃，需提前启用防霜风机。','1.2','0','resolved','洛川果业运维','已安排夜间防霜作业','2026-10-31 18:05');

-- 阈值规则是平台预置（这张表没有租户列，enabled 是全局开关），用户端只读。
-- 作用范围以前写的是"绿源果蔬合作社"这种查不到主体的文本，统一编号后改成"全部经营主体"口径。
INSERT IGNORE INTO iot_alert_rule (id,rule_name,device_type,metric_key,metric_name,operator_text,threshold_value,duration_seconds,level_name,enabled,tenant_scope) VALUES
(1,'大棚高温告警','空气温湿度传感器','temperature','温度','>',35,300,'critical',TRUE,'全部经营主体'),
(2,'大棚低湿告警','空气温湿度传感器','humidity','湿度','<',40,300,'major',TRUE,'全部经营主体'),
(3,'土壤缺水告警','土壤墒情传感器','soil_moisture','土壤含水率','<',25,600,'major',TRUE,'全部经营主体'),
(4,'CO2浓度过高','二氧化碳传感器','co2','CO₂浓度','>',1200,300,'major',TRUE,'全部经营主体');

-- 主体自定义阈值：同一个指标上覆盖平台预置，不同经营主体各用各的。
-- 2001 是蔬菜大棚（怕热、怕闷），2003 是洛川苹果园（既要防高温也要防霜冻，还多一条光照上限）。
-- 两条 temperature 规则同时存在是故意的：判定要能分别命中上下限。
INSERT IGNORE INTO iot_alert_rule_tenant
(id,tenant_id,rule_name,device_type,metric_key,metric_name,operator_text,threshold_value,duration_seconds,level_name,enabled,remark,source_rule_id,created_by,created_at,updated_at) VALUES
(1,2001,'蔬菜棚高温（比平台更敏感）','空气温湿度传感器','temperature','温度','>',32,300,'critical',TRUE,'叶菜超过 32℃ 即需通风，比平台预置的 35℃ 提前 3℃。',1,'演示初始化','2026-11-01 09:00','2026-11-01 09:00'),
(2,2001,'土壤含水率下限','土壤墒情传感器','soil_moisture','土壤含水率','<',28,600,'major',TRUE,'设施蔬菜适宜区间下限设为 28%。',3,'演示初始化','2026-11-01 09:00','2026-11-01 09:00'),
(3,2001,'棚内 CO₂ 偏高','二氧化碳传感器','co2','CO₂浓度','>',900,300,'major',TRUE,NULL,NULL,'演示初始化','2026-11-01 09:00','2026-11-01 09:00'),
(4,2003,'果园高温','空气温湿度传感器','temperature','温度','>',33,300,'major',TRUE,'果实日灼风险阈值低于平台预置值。',1,'演示初始化','2026-11-01 09:05','2026-11-01 09:05'),
(5,2003,'果园霜冻','空气温湿度传感器','temperature','温度','<',2,900,'critical',TRUE,'花期内夜间低于 2℃ 需启用防霜风机。',NULL,'演示初始化','2026-11-01 09:05','2026-11-01 09:05'),
(6,2003,'果园缺水','土壤墒情传感器','soil_moisture','土壤含水率','<',20,600,'critical',TRUE,'苹果树适宜区间下限 20%。',3,'演示初始化','2026-11-01 09:05','2026-11-01 09:05'),
(7,2003,'光照过强','光照传感器','light_intensity','光照强度','>',60000,600,'normal',FALSE,'夏季正午需遮阳网，演示中默认停用。',NULL,'演示初始化','2026-11-01 09:05','2026-11-01 09:05');

-- 场景/自动化规则同样是经营主体私域：以前一个租户「启用」会把别家正在跑的场景顶掉。
INSERT IGNORE INTO iot_scene (id,tenant_id,scene_code,scene_name,icon_text,category_name,description,config_text,is_active,plot_count) VALUES
(1,2001,'SCENE-VENT','高温通风','🌬️','环境控制','温度超过32℃时开启南侧风机并关闭加热设备。','temperature>32 -> fan=on,heater=off',TRUE,2),
(2,2001,'SCENE-IRRIGATE','精准灌溉','💧','水肥管理','土壤含水率低于25%且未来24小时无降雨时启动滴灌。','soil_moisture<25 && rain=0 -> valve=on',FALSE,3),
(3,2001,'SCENE-NIGHT','夜间保温','🌙','环境控制','日落前30分钟关闭通风口并放下保温帘。','sunset-30m -> vent=off,curtain=down',FALSE,2),
(4,2001,'SCENE-STERILIZE','棚内消毒','🧪','植保管理','无人时段开启臭氧消毒设备30分钟，完成后通风。','ozone=on,30m -> fan=on',FALSE,1);

INSERT IGNORE INTO iot_rule (id,tenant_id,rule_code,rule_name,trigger_text,action_text,enabled,last_trigger,trigger_count) VALUES
(1,2001,'RULE-TEMP-32','高温自动通风','温度 > 32℃ 持续5分钟','开启南侧风机；温度回落至28℃以下后关闭',TRUE,'2026-11-01 09:58',18),
(2,2001,'RULE-SOIL-25','低含水率自动灌溉','土壤含水率 < 25% 且无降雨','开启A区滴灌15分钟，完成后回传流量',TRUE,'2026-10-31 14:20',7),
(3,2001,'RULE-RAIN-STOP','降雨自动停灌','降雨量 > 2mm','关闭所有灌溉阀门并发送通知',TRUE,'2026-10-29 16:10',3),
(4,2001,'RULE-NIGHT-NO-WATER','夜间禁灌','22:00-06:00','拦截自动灌溉指令，保留应急手动控制',FALSE,'2026-10-28 23:12',1);

INSERT IGNORE INTO iot_rule_config
(rule_id,rule_type,trigger_metric,operator_text,threshold_value,duration_seconds,schedule_text,
 action_device_id,action_device_name,action_command,action_value,cooldown_seconds,config_json,updated_at) VALUES
(1,'automation','temperature','>','32',300,'',3,'1号棚南侧风机','on','',300,'{"executionMode":"edge","actionDeviceName":"1号棚南侧风机"}','2026-10-26 10:00'),
(2,'automation','soil_moisture','<','25',0,'',4,'1号棚灌溉电磁阀','irrigate','15分钟',600,'{"executionMode":"edge","actionDeviceName":"1号棚灌溉电磁阀"}','2026-10-26 10:00'),
(3,'automation','rain','>','2',0,'',4,'1号棚灌溉电磁阀','close','',300,'{"executionMode":"cloud","actionDeviceName":"1号棚灌溉电磁阀"}','2026-10-26 10:00'),
(4,'schedule','','','',0,'每天 22:00-06:00',4,'1号棚灌溉电磁阀','close','',0,'{"executionMode":"cloud","actionDeviceName":"1号棚灌溉电磁阀"}','2026-10-26 10:00');

-- 控制留痕：时间同样统一成 yyyy-MM-dd HH:mm，大盘"今日控制"和报表的控制趋势才有据可查。
INSERT IGNORE INTO iot_control_log (id,device_id,device_name,action_name,operator_name,result_text,created_at) VALUES
(1,3,'1号棚南侧风机','开启风机','陈建国','指令已执行','2026-11-01 09:59'),
(2,4,'1号棚灌溉电磁阀','开启灌溉 15分钟','水肥自动化规则','执行成功','2026-11-01 08:40'),
(3,12,'东区水肥一体机','停止施肥泵','王工','执行成功','2026-10-31 09:38'),
(4,7,'2号棚东侧风机','关闭风机','系统场景','执行成功','2026-10-30 18:20'),
(5,4,'1号棚灌溉电磁阀','关闭灌溉','陈建国','执行成功','2026-10-30 09:15'),
(6,3,'1号棚南侧风机','开启风机','高温自动通风','执行成功','2026-10-29 13:02'),
(7,12,'东区水肥一体机','开始施肥 20分钟','陈建国','执行成功','2026-10-28 10:20'),
(8,4,'1号棚灌溉电磁阀','开启灌溉 10分钟','低含水率自动灌溉','执行成功','2026-10-27 15:40'),
(9,3,'1号棚南侧风机','关闭风机','陈建国','执行成功','2026-10-26 19:05');

-- 工单要能看出属于哪个主体（4 号是 2003 的），否则运营端和租户端看到的是同一锅粥
INSERT IGNORE INTO iot_work_order (id,tenant_id,order_no,source_name,device_name,order_type,priority,status,technician,description,created_at,completed_at) VALUES
(1,2001,'WO20261101001','设备离线告警','4号田灌溉阀门','供电/通信故障','high','assigned','张工','阀门连续离线 2 小时以上，现场需检查供电线路与 NB 模块天线','2026-11-01 09:50',NULL),
(2,2001,'WO20261101002','数据异常告警','东区水肥一体机','设备故障','normal','processing','李工','EC 值 5 分钟内从 1.8 升至 2.8 mS/cm，需核查施肥泵比例阀','2026-10-31 09:40',NULL),
(3,2001,'WO20261022003','预防性维保','1号棚边缘网关','季度维保','normal','completed','张工','季度巡检：清洁散热、检查 PoE 供电、升级固件至 v3.1.0','2026-10-22 09:00','2026-10-22 15:20'),
(4,2003,'WO20261101003','土壤缺水告警','果园3号墒情站','管路检修','high','pending','待智能派单','滴灌主管压力偏低，需现场检查过滤器与电磁阀','2026-11-01 08:20',NULL);

INSERT IGNORE INTO iot_firmware (id,product_name,version_name,file_size,sha256_text,status,release_at) VALUES
(1,'空气温湿度传感器','v2.3.5','2.1MB','a4f9...e81c','stable','2026-09-12'),
(2,'边缘网关 EG-200','v3.1.0','18.6MB','9c31...f02a','stable','2026-10-08'),
(3,'智能灌溉阀门','v1.6.4','1.2MB','2e82...b14d','beta','2026-10-20');

INSERT IGNORE INTO iot_ota_task (id,tenant_id,task_no,firmware_id,firmware_version,target_count,success_count,failed_count,target_scope,status,execute_window,created_at) VALUES
(1,2001,'OTA20261020001',2,'v3.1.0',12,11,0,'绿源农业合作社','running','00:00-04:00','2026-10-20 22:00'),
(2,2003,'OTA20261018002',1,'v2.3.5',48,47,1,'陕西洛川果业','completed','00:00-04:00','2026-10-18 22:00');

-- 站内消息也是私域：以前所有主体共用一个收件箱，2003 能看到 2001 的告警通知。
INSERT IGNORE INTO iot_message (id,tenant_id,message_type,title,content,is_read,created_at) VALUES
(1,2001,'alert','大棚温度过高告警','1号棚温度36.5℃，已超过35℃阈值，请及时处理。',FALSE,'2026-11-01 10:01'),
(2,2001,'device','灌溉阀门离线','4号田灌溉阀门已离线2小时，系统已自动生成运维工单。',FALSE,'2026-11-01 09:43'),
(3,2001,'scene','精准灌溉已执行','1号棚完成15分钟滴灌，累计用水3.2m³。',TRUE,'2026-11-01 08:55'),
(4,2001,'ota','网关固件升级完成','GW001-GW003 已升级至 v3.1.0。',TRUE,'2026-10-31 23:40'),
(5,2003,'alert','果园土壤含水率偏低','3号墒情站读数 18.7%，低于适宜区间，已生成运维工单。',FALSE,'2026-11-01 08:12');

INSERT IGNORE INTO iot_product (id,product_name,product_key,category_name,protocol_name,model_name,property_count,device_count,status) VALUES
(1,'空气温湿度传感器','p_air_temp','环境传感器','MQTT','TH-200',2,186,'published'),
(2,'土壤墒情传感器','p_soil','环境传感器','LoRaWAN','SM-300',3,142,'published'),
(3,'智能灌溉阀门','p_valve','控制器','Modbus','VALVE-8',3,64,'published'),
(4,'边缘网关 EG-200','p_gateway','网关设备','MQTT','EG-200',5,12,'published');

INSERT IGNORE INTO iot_protocol (id,protocol_name,protocol_type,endpoint_text,port_text,status,connections) VALUES
(1,'MQTT 设备接入','MQTT','mqtt.iot.agri.local','1883 / 8883','running',8642),
(2,'LoRaWAN 网络服务','LoRaWAN','lora.iot.agri.local','1700','running',3280),
(3,'视频国标接入','GB28181','sip.iot.agri.local','5060','running',126),
(4,'Modbus 网关采集','Modbus','gateway.iot.agri.local','502','running',864);

INSERT IGNORE INTO iot_access_audit (id,device_code,device_name,tenant_name,request_type,status,submitted_at,auditor,note) VALUES
(1,'DEV-NEW-0712','4号田无线阀门','绿源农业合作社','自动注册','pending','2026-11-01 09:26',NULL,'等待SN与产品认证匹配'),
(2,'GW-NEW-009','东区备用网关','陕西洛川果业','人工接入','pending','2026-11-01 08:50',NULL,NULL),
(3,'DEV-NEW-0708','温室补光灯','陕西洛川果业','自动注册','approved','2026-10-31 16:20','运维平台','物模型校验通过'),
(4,'DEV-BAD-002','未知型号传感器','外部租户','自动注册','rejected','2026-10-31 14:10','运维平台','品牌型号不在认证白名单');

-- 审计留痕补 ip_address：以前"谁做的"是代码里写死的名字，现在操作人来自令牌、来源 IP 来自网关头。
INSERT IGNORE INTO iot_ops_log (id,operator_name,action_name,target_name,detail_text,ip_address,created_at) VALUES
(1,'张运营','设备接入审核','DEV-NEW-0712','物模型校验通过，等待租户确认归属','10.20.1.15','2026-11-01 09:32'),
(2,'王工','告警处置','AL20261031003','远程停止水肥机并生成现场工单','10.20.1.31','2026-11-01 09:38'),
(3,'李运维','OTA任务排期','OTA20261020001','网关固件分批升级排入 00:00-04:00 窗口','10.20.1.18','2026-10-31 22:00'),
(4,'系统','自动派单','WO20261101001','根据设备位置与技能自动匹配张工','127.0.0.1','2026-11-01 09:50');

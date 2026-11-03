-- ------------------------------------------------ V52 用户中心运营端 · 初始数据
--
-- 只放**参考数据**与**可演示的最小样例**：
--   platform_uc_system_config      账号侧参数的出厂值（运营改之前，页面得有东西可看）
--   platform_uc_message_template   5 个内置模板（认证审核/安全提醒/资质临期/身份变更/隐私请求）
--   platform_uc_third_party_app    3 个示例应用（2 个已上架、1 个待审）
--   platform_uc_third_party_auth_record  若干授权流水
--   platform_identity_application 3 条待审身份申请
--
-- 最后一条是有意为之：身份申请审核页如果一条数据都没有，"审核"这个功能就没法验收。
-- 这 3 条挂在真实账号上（farmer 等），审核动作会真实改变单据状态，不是假数据。
-- 若要清空演示数据，见 core-platform/scripts/clean-demo-data.sql 的 uc 段。

-- ---------- 参数配置（出厂值） ----------
INSERT INTO `platform_uc_system_config`
  (`id`, `config_group`, `config_key`, `label`, `config_value`, `value_type`, `options`, `remark`, `sort_no`,
   `market_id`, `tenant_id`, `created_at`, `updated_at`, `deleted`)
SELECT * FROM (
  SELECT 900000000000000101 AS id, 'register' AS g, 'register.mode' AS k, '注册开关' AS l,
         'open' AS v, 'select' AS t, 'open,invt,closed' AS o, 'open=开放注册 invt=邀请制 closed=暂停' AS r, 1 AS s,
         1 AS m, 0 AS tn, NOW() AS c, NOW() AS u, 0 AS d
  UNION ALL SELECT 900000000000000102, 'register', 'register.channels', '注册方式', 'phone,wechat', 'multi',
         'phone,wechat,email,credit', '可多选；credit 指企业工商注册号', 2, 1, 0, NOW(), NOW(), 0
  UNION ALL SELECT 900000000000000103, 'register', 'register.phone.limit', '同一手机号注册上限', '1', 'number',
         NULL, '含历史注销账号', 3, 1, 0, NOW(), NOW(), 0
  UNION ALL SELECT 900000000000000104, 'register', 'register.ip.daily.limit', '同一 IP 日注册上限', '20', 'number',
         NULL, '超过即触发人机校验', 4, 1, 0, NOW(), NOW(), 0
  UNION ALL SELECT 900000000000000105, 'register', 'register.default.role', '新用户默认身份', 'FARMER', 'select',
         'NONE,FARMER', 'NONE=无身份需申请；FARMER=农户免审', 5, 1, 0, NOW(), NOW(), 0
  UNION ALL SELECT 900000000000000201, 'realname', 'realname.level', '实名要求级别', 'L2', 'select',
         'L1,L2,L3', 'L1 手机核验 / L2 二要素+活体 / L3 加对公账户', 1, 1, 0, NOW(), NOW(), 0
  UNION ALL SELECT 900000000000000202, 'realname', 'realname.liveness', '人脸活体检测', '1', 'switch',
         NULL, '活体动作 + 静默检测', 2, 1, 0, NOW(), NOW(), 0
  UNION ALL SELECT 900000000000000203, 'realname', 'realname.police', '公安库二要素比对', '1', 'switch',
         NULL, '姓名 + 身份证号', 3, 1, 0, NOW(), NOW(), 0
  UNION ALL SELECT 900000000000000204, 'realname', 'realname.id.max.account', '同一证件最多绑定账号', '3', 'number',
         NULL, '防止一号多用', 4, 1, 0, NOW(), NOW(), 0
  UNION ALL SELECT 900000000000000205, 'realname', 'realname.valid.years', '实名有效期（年）', '5', 'number',
         NULL, '到期需重新核验', 5, 1, 0, NOW(), NOW(), 0
  UNION ALL SELECT 900000000000000301, 'password', 'password.policy', '密码复杂度', 'mix_digit', 'select',
         'letter_digit,mix_digit,mix_special', 'mix_digit=8-20 位大小写+数字', 1, 1, 0, NOW(), NOW(), 0
  UNION ALL SELECT 900000000000000302, 'password', 'password.weak.block', '禁止弱口令', '1', 'switch',
         NULL, '手机号 / 生日 / 连续字符', 2, 1, 0, NOW(), NOW(), 0
  UNION ALL SELECT 900000000000000303, 'password', 'password.expire.days', '强制更换周期（天）', '90', 'number',
         NULL, '仅管理员账号生效', 3, 1, 0, NOW(), NOW(), 0
  UNION ALL SELECT 900000000000000304, 'password', 'password.fail.lock', '连续失败锁定', '5', 'number',
         NULL, '连续失败次数阈值', 4, 1, 0, NOW(), NOW(), 0
  UNION ALL SELECT 900000000000000305, 'password', 'password.lock.minutes', '锁定时长（分钟）', '30', 'number',
         NULL, NULL, 5, 1, 0, NOW(), NOW(), 0
  UNION ALL SELECT 900000000000000401, 'session', 'session.idle.minutes', '会话空闲超时（分钟）', '120', 'number',
         NULL, '无操作自动退出', 1, 1, 0, NOW(), NOW(), 0
  UNION ALL SELECT 900000000000000402, 'session', 'session.remember.days', '记住我时长（天）', '7', 'number',
         NULL, NULL, 2, 1, 0, NOW(), NOW(), 0
  UNION ALL SELECT 900000000000000403, 'session', 'session.remote.2fa', '异地登录强制二次验证', '1', 'switch',
         NULL, NULL, 3, 1, 0, NOW(), NOW(), 0
  UNION ALL SELECT 900000000000000501, 'captcha', 'captcha.login.enabled', '登录图形验证码', '1', 'switch',
         NULL, '连续失败 3 次后强制', 1, 1, 0, NOW(), NOW(), 0
  UNION ALL SELECT 900000000000000502, 'captcha', 'captcha.sms.ttl', '短信验证码有效期（秒）', '300', 'number',
         NULL, NULL, 2, 1, 0, NOW(), NOW(), 0
  UNION ALL SELECT 900000000000000503, 'captcha', 'captcha.sms.daily.limit', '同一号码日发上限', '10', 'number',
         NULL, NULL, 3, 1, 0, NOW(), NOW(), 0
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM `platform_uc_system_config` WHERE `config_key` = 'register.mode');

-- ---------- 消息模板 ----------
INSERT INTO `platform_uc_message_template`
  (`id`, `code`, `scene`, `channels`, `title`, `content`, `variables`, `status`,
   `market_id`, `tenant_id`, `created_at`, `updated_at`, `deleted`)
SELECT * FROM (
  SELECT 900000000000000601 AS id, 'TPL_IDENTITY_AUDIT' AS code, 'cert_audit' AS scene, 'station,wechat' AS ch,
         '身份申请审核结果' AS title,
         '您提交的身份申请（申请单号 {applyNo}）已{result}。{remark}' AS content,
         'applyNo,result,remark' AS vars, 'enabled' AS st, 1 AS m, 0 AS tn, NOW() AS c, NOW() AS u, 0 AS d
  UNION ALL SELECT 900000000000000602, 'TPL_REALNAME_PASS', 'cert_audit', 'station,sms',
         '实名认证已通过', '您的实名认证已通过审核，现在可以使用交易与金融服务。', 'realName', 'enabled', 1, 0, NOW(), NOW(), 0
  UNION ALL SELECT 900000000000000603, 'TPL_CERT_EXPIRE', 'cert_expire', 'station,wechat,sms',
         '资质证照临期提醒',
         '尊敬的 {contactName}，您名下「{orgName}」的{licenceType}将于 {expireDate} 到期，请及时上传新证照，逾期将暂停交易权限。',
         'contactName,orgName,licenceType,expireDate', 'enabled', 1, 0, NOW(), NOW(), 0
  UNION ALL SELECT 900000000000000604, 'TPL_SECURITY_ALERT', 'security', 'station,sms',
         '账号安全提醒',
         '您的账号于 {time} 在 {place} 登录，如非本人操作请立即修改密码并联系客服。',
         'time,place', 'enabled', 1, 0, NOW(), NOW(), 0
  UNION ALL SELECT 900000000000000605, 'TPL_PRIVACY_RESULT', 'privacy', 'station',
         '隐私请求处理结果',
         '您提交的{requestType}请求已{result}，{remark}', 'requestType,result,remark', 'enabled', 1, 0, NOW(), NOW(), 0
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM `platform_uc_message_template` WHERE `code` = 'TPL_IDENTITY_AUDIT');

-- ---------- 第三方应用 ----------
INSERT INTO `platform_uc_third_party_app`
  (`id`, `app_key`, `app_name`, `app_type`, `applicant`, `contact_name`, `contact_phone`, `scopes`,
   `redirect_uri`, `status`, `call_count`, `last_call_at`, `reviewer_name`, `review_time`, `review_remark`,
   `market_id`, `tenant_id`, `created_at`, `updated_at`, `deleted`)
SELECT * FROM (
  SELECT 900000000000000701 AS id, 'agri-finance' AS app_key, '供应链金融授信查询' AS name, 'internal' AS t,
         '平台金融事业部' AS app, '李金融' AS cn, '13800001001' AS cp,
         'user:read,order:read,finance:read' AS sc, 'https://finance.agri.local/sso/callback' AS ru,
         'online' AS st, 42860 AS cc, DATE_SUB(NOW(), INTERVAL 2 HOUR) AS lc,
         '平台管理员' AS rv, DATE_SUB(NOW(), INTERVAL 40 DAY) AS rt, '内部系统，走白名单' AS rr,
         1 AS m, 0 AS tn, DATE_SUB(NOW(), INTERVAL 41 DAY) AS c, NOW() AS u, 0 AS d
  UNION ALL SELECT 900000000000000702, 'gov-exchange', '政府监管数据交换', 'partner',
         '市农业农村局信息中心', '王监管', '13800001002',
         'user:read,org:read,production:read,trace:read', 'https://gov.agri.local/exchange/callback',
         'online', 128400, DATE_SUB(NOW(), INTERVAL 30 MINUTE),
         '平台管理员', DATE_SUB(NOW(), INTERVAL 22 DAY), '监管数据交换协议已签',
         1, 0, DATE_SUB(NOW(), INTERVAL 25 DAY), NOW(), 0
  UNION ALL SELECT 900000000000000703, 'trace-open', '溯源小程序开放接口', 'open',
         '山东寿光蔬菜集团', '张技术', '13800001003',
         'trace:read,product:read', 'https://trace.example.com/cb',
         'pending', 0, NULL, NULL, NULL, NULL,
         1, 0, DATE_SUB(NOW(), INTERVAL 3 DAY), NOW(), 0
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM `platform_uc_third_party_app` WHERE `app_key` = 'agri-finance');

-- ---------- 授权流水 ----------
INSERT INTO `platform_uc_third_party_auth_record`
  (`id`, `user_id`, `user_name`, `app_id`, `app_name`, `scopes`, `action`, `ip`,
   `market_id`, `tenant_id`, `created_at`, `updated_at`, `deleted`)
SELECT 900000000000000801, u.id, u.nickname, 900000000000000701, '供应链金融授信查询',
       'user:read,order:read,finance:read', 'grant', '192.168.0.31', 1, 0,
       DATE_SUB(NOW(), INTERVAL 6 DAY), NOW(), 0
FROM `platform_user` u WHERE u.username = 'farmer'
  AND NOT EXISTS (SELECT 1 FROM `platform_uc_third_party_auth_record` WHERE `id` = 900000000000000801);

INSERT INTO `platform_uc_third_party_auth_record`
  (`id`, `user_id`, `user_name`, `app_id`, `app_name`, `scopes`, `action`, `ip`,
   `market_id`, `tenant_id`, `created_at`, `updated_at`, `deleted`)
SELECT 900000000000000802, u.id, u.nickname, 900000000000000701, '供应链金融授信查询',
       'user:read,order:read,finance:read', 'revoke', '192.168.0.31', 1, 0,
       DATE_SUB(NOW(), INTERVAL 2 DAY), NOW(), 0
FROM `platform_user` u WHERE u.username = 'farmer'
  AND NOT EXISTS (SELECT 1 FROM `platform_uc_third_party_auth_record` WHERE `id` = 900000000000000802);

-- ---------- 待审身份申请（演示审核闭环） ----------
INSERT INTO `platform_identity_application`
  (`id`, `user_id`, `identity_type`, `merchant_id`, `subject_name`, `credit_code`, `business_place`,
   `business_category`, `annual_volume`, `contact_name`, `contact_phone`, `apply_note`, `status`,
   `market_id`, `tenant_id`, `created_at`, `updated_at`, `deleted`)
SELECT 900000000000000901, u.id, 'PURCHASER', NULL, '寿光金穗果蔬购销中心', '91370783MA3C8XXX1A',
       '山东省潍坊市寿光市洛城街道', '蔬菜购销', '8000 吨/年', '张农户', '13900001111',
       '已有稳定商超渠道，申请收购商身份以发布采购需求', 'pending',
       1, 0, DATE_SUB(NOW(), INTERVAL 20 HOUR), NOW(), 0
FROM `platform_user` u WHERE u.username = 'farmer'
  AND NOT EXISTS (SELECT 1 FROM `platform_identity_application` WHERE `id` = 900000000000000901);

INSERT INTO `platform_identity_application`
  (`id`, `user_id`, `identity_type`, `merchant_id`, `subject_name`, `credit_code`, `business_place`,
   `business_category`, `annual_volume`, `contact_name`, `contact_phone`, `apply_note`, `status`,
   `market_id`, `tenant_id`, `created_at`, `updated_at`, `deleted`)
SELECT 900000000000000902, u.id, 'WHOLESALER', NULL, '临沂嘉兴农产品批发商行', '91371302MA3D9XXX2B',
       '山东省临沂市兰山区', '农产品批发', '15000 吨/年', '联调个人会员', '13761881051',
       '在临沂嘉兴市场有固定档口，申请批发商身份', 'pending',
       1, 0, DATE_SUB(NOW(), INTERVAL 8 HOUR), NOW(), 0
FROM `platform_user` u WHERE u.username = '13761881051'
  AND NOT EXISTS (SELECT 1 FROM `platform_identity_application` WHERE `id` = 900000000000000902);

INSERT INTO `platform_identity_application`
  (`id`, `user_id`, `identity_type`, `merchant_id`, `subject_name`, `credit_code`, `business_place`,
   `business_category`, `annual_volume`, `contact_name`, `contact_phone`, `apply_note`, `status`,
   `market_id`, `tenant_id`, `created_at`, `updated_at`, `deleted`)
SELECT 900000000000000903, u.id, 'SERVICE_PROVIDER', NULL, '寿光农技服务专业合作社', '91370783MA3E1XXX3C',
       '山东省潍坊市寿光市孙家集街道', '农技服务', NULL, '联调个人会员', '13762031653',
       '提供测土配方与病虫害统防统治服务', 'pending',
       1, 0, DATE_SUB(NOW(), INTERVAL 3 HOUR), NOW(), 0
FROM `platform_user` u WHERE u.username = '13762031653'
  AND NOT EXISTS (SELECT 1 FROM `platform_identity_application` WHERE `id` = 900000000000000903);

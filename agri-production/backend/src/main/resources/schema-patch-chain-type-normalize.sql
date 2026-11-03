-- 补丁：把存证表 target_type 里的数字枚举值归一成字符串词表（可重复执行）。
--
-- 背景：POST /blockchain/records 的 bizType 一度被声明成 Integer，控制器 String.valueOf 之后
-- 原样落库。投入品使用页按旧数字词表传 bizType=2（=投入品使用），于是 agri_prod_chain_record
-- 里出现 target_type='2' 这种不属于任何词表的值。后果不是"报错"，而是**静默失效**：
--   · 读侧按 HARVEST/QUALITY/TRACE/INPUT 对号，'2' 永远对不到 → 那条存证等于没写过；
--   · 存证列表页却照旧把它显示成一条 SUCCESS 的"已上链"记录。
-- 写侧现在拒绝数字枚举（ChainRecordServiceImpl#normalizeType），这里把历史值归一。
--
-- 归一不是靠"数字 2 大概是投入品"这种猜测，而是**要求业务键能在对应业务表里查到**：
-- 实测这两条 target_code='102'，而 agri_prod_input_usage.id=102（稻瘟灵乳油，tenant 2001）
-- 确实存在，与投入品页面提交时传的 usageId 一致 —— 对不上的值一律不动，留给人看。
--
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-chain-type-normalize.sql

-- 1) target_type='2' 且 target_code 能对上本主体名下真实投入品使用记录 → INPUT（并把主键补进 target_id）
UPDATE agri_prod_chain_record c
   SET c.target_type = 'INPUT',
       c.target_id = CAST(c.target_code AS UNSIGNED)
 WHERE c.target_type = '2'
   AND c.target_code REGEXP '^[0-9]+$'
   AND EXISTS (SELECT 1 FROM agri_prod_input_usage u
                WHERE u.id = CAST(c.target_code AS UNSIGNED)
                  AND u.tenant_id = c.tenant_id
                  AND u.deleted = 0);

-- 2) 同理，若历史上还写过 '3'（质检），只有能对上真实质检单的才归一成 QUALITY
UPDATE agri_prod_chain_record c
   SET c.target_type = 'QUALITY',
       c.target_id = (SELECT i.id FROM agri_prod_inspection i
                       WHERE (i.inspection_no = c.target_code OR (c.target_code REGEXP '^[0-9]+$'
                               AND i.id = CAST(c.target_code AS UNSIGNED)))
                         AND i.tenant_id = c.tenant_id AND i.deleted = 0 LIMIT 1)
 WHERE c.target_type = '3'
   AND EXISTS (SELECT 1 FROM agri_prod_inspection i
                WHERE (i.inspection_no = c.target_code OR (c.target_code REGEXP '^[0-9]+$'
                        AND i.id = CAST(c.target_code AS UNSIGNED)))
                  AND i.tenant_id = c.tenant_id AND i.deleted = 0);

-- 3) 剩下的非词表值：只列出来给人看，**不自动删、不自动归类**。
--    对不上真实业务的存证本来就是一条无效凭证，但"把它藏起来"和"把它标成某个类型"一样是替业务编事实，
--    要处理也得由人看完这份清单再决定（本补丁跑完应当是 0 行）。
SELECT c.id, c.record_no, c.target_type, c.target_code, c.chain_status, c.tenant_id
  FROM agri_prod_chain_record c
 WHERE c.del_flag = 0
   AND c.target_type NOT IN ('HARVEST', 'QUALITY', 'TRACE', 'INPUT');

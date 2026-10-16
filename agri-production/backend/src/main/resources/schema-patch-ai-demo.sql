-- 补丁：AI 诊断记录演示数据（可重复执行）。
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-ai-demo.sql
--
-- 内容由 agri_core.prod_ai_diagnosis 的 4 条 DEMO- 行机械转换而来（脚本生成，非手抄）：
--   diagnosis_id / plot_id / crop_id / crop_name / image_url / diagnosis_type / result_label /
--   confidence / suggestion / model_name / diagnosed_at / status 照抄。
--   · plot_id 仍是平台侧地块标识（DEMO-PLOT-xxx）—— 地块主数据收敛属另一轮（见处置方案第六节）；
--   · 平台侧该表没有 farm_id，故留空（不拿地块反查个农场填进去）；
--   · **排除了探针空体写入的垃圾行**（该表 42 行里 38 行 diagnosis_id 形如 AI2026…、无地块无结论）。
--
-- 会话与消息**不预置**：那是使用者自己聊出来的内容。预置几条"演示对话"等于伪造问答记录，
-- 与"AI 助手不能编答案"的口径直接冲突；页面上点「新对话」发一句话就能看到规则式应答。

INSERT IGNORE INTO agri_prod_ai_diagnosis
    (diagnosis_id, plot_id, crop_id, crop_name, image_url, diagnosis_type, result_label,
     confidence, suggestion, model_name, diagnosed_at, status, tenant_id)
VALUES
    ('DEMO-AI-001', 'DEMO-PLOT-002', 'DEMO-CROP-002', '黄瓜', 'https://demo.example.com/ai/cucumber-001.jpg', 'PEST', '黄瓜霜霉病', 92.50, '立即摘除病叶，选用烯酰吗啉或吡唑醚菌酯叶面喷施，7 天后复诊', 'agri-pest-v3', '2026-07-02 08:15:00', 'SUCCESS', '2001'),
    ('DEMO-AI-002', 'DEMO-PLOT-001', 'DEMO-CROP-001', '番茄', 'https://demo.example.com/ai/tomato-002.jpg', 'GROWTH', '长势良好', 88.30, '维持现行水肥方案，注意整枝打杈', 'agri-growth-v2', '2026-06-10 09:30:00', 'SUCCESS', '2001'),
    ('DEMO-AI-003', 'DEMO-PLOT-001', 'DEMO-CROP-001', '番茄', 'https://demo.example.com/ai/tomato-003.jpg', 'MATURITY', '八成熟，可采收', 95.10, '建议 3 日内分批采收，采收后预冷至 10 度以下', 'agri-maturity-v2', '2026-07-14 07:45:00', 'SUCCESS', '2001'),
    ('DEMO-AI-004', 'DEMO-PLOT-006', 'DEMO-CROP-003', '水稻', 'https://demo.example.com/ai/rice-004.jpg', 'PEST', '稻瘟病（叶瘟）', 81.60, '破口前统一施药一次，选用三环唑或稻瘟灵', 'agri-pest-v3', '2026-08-12 10:20:00', 'SUCCESS', '2001');

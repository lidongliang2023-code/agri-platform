-- 检测机构：资质等级 + 准入驳回原因
--
-- 背景：运营端「检测机构管理」页（agri-production/frontend/src/pages/admin/quality/LabManage.tsx）
-- 长期使用 labLevel（1国家级 2省级 3市级）字段，但 prod_quality_lab 表与 QualityLabEntity 均无该列，
-- 前端接真接口后「资质等级」列会全部退化为「未定级」；同时运营端「驳回」按钮无后端端点，
-- 运营填写的驳回理由无处落库。
--
-- 纪律：两列均允许 NULL —— 历史机构无等级来源、无驳回记录，不做任何编造值回填（缺失即未知）。

ALTER TABLE prod_quality_lab
    ADD COLUMN lab_level TINYINT NULL COMMENT '机构等级 1国家级 2省级 3市级（历史数据无来源，允许 NULL）' AFTER lab_type;

ALTER TABLE prod_quality_lab
    ADD COLUMN reject_reason VARCHAR(255) NULL COMMENT '准入驳回原因（运营端驳回时填写）' AFTER status;

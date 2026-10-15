-- 补丁：运营端「知识库」与「SOP 规程库」两张表 + 演示数据（可重复执行）。
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-knowledge-sop.sql
--
-- 背景（2026-10-15 切运营端 admin/knowledge 与 admin/sop 时）：
--   这两块的内容此前只存在于平台侧（agri_core.prod_knowledge_article / prod_sop_library），
--   本服务一张表都没有 —— 直接切过去，两个页面会从"有数据"变成"空列表"。
--   表结构按前端契约定字段（见各页面注释：知识库读 articleId/categoryCode/title/summary/
--   contentUrl/author/source/readCount/publishAt/status；SOP 读 sopId/sopCode/sopName/sopType/
--   versionNo/contentUrl/stageSeq/applicableRegion/publisher/status/createdAt）。
--
-- 演示数据说明：内容沿用平台侧那 3 篇 / 3 条真实演示行（编号也保持一致，页面上看起来是同一批）。
--   平台侧的 prod_knowledge_article 里另有 6 条 KNWL2026… 的行 —— 那是历史契约验证脚本建出来的垃圾
--   （标题写着"BT57探针"/"CORS探针"），**没有搬过来**。

CREATE TABLE IF NOT EXISTS agri_prod_knowledge_article (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    article_code VARCHAR(64) NOT NULL UNIQUE COMMENT '文章编号（页面上显示的「文章编号」，也是接口的 {articleId}）',
    category_code VARCHAR(32) COMMENT '分类：PLANT 种植 / PEST 植保 / POLICY 政策',
    title VARCHAR(128) NOT NULL,
    summary VARCHAR(500),
    content_url VARCHAR(255) COMMENT '正文链接（后端没有正文内容列，页面按此说明显示）',
    author VARCHAR(50),
    source VARCHAR(100),
    read_count INT DEFAULT 0,
    publish_at DATETIME,
    status TINYINT DEFAULT 0 COMMENT '1 已发布 / 0 草稿',
    tenant_id VARCHAR(191) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted BIGINT DEFAULT 0,
    INDEX `idx_knowledge_tenant_id` (tenant_id),
    INDEX `idx_knowledge_status` (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agri_prod_sop_library (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    sop_code VARCHAR(64) NOT NULL UNIQUE COMMENT '规程编码',
    crop_id VARCHAR(64) COMMENT '适用作物编号（平台侧是 DEMO-CROP-xxx 这类业务码）',
    sop_name VARCHAR(100) NOT NULL,
    sop_type VARCHAR(20) COMMENT 'PLANT 种植 / PEST 植保 / HARVEST 收获',
    version_no VARCHAR(16),
    content_url VARCHAR(255),
    stage_seq INT COMMENT '作业阶段序号',
    applicable_region VARCHAR(100),
    publisher VARCHAR(50),
    status TINYINT DEFAULT 0 COMMENT '1 已发布 / 0 草稿',
    tenant_id VARCHAR(191) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted BIGINT DEFAULT 0,
    INDEX `idx_sop_library_tenant_id` (tenant_id),
    INDEX `idx_sop_library_status` (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 演示文章（3 篇，内容与平台侧演示行一致）
INSERT IGNORE INTO agri_prod_knowledge_article
    (article_code, category_code, title, summary, content_url, author, source, read_count, publish_at, status, tenant_id, create_time, update_time)
VALUES
    ('DEMO-ART-001', 'PLANT', '设施番茄越夏栽培关键技术要点',
     '高温季节设施番茄保花保果、遮阳降温与水肥调控的实操要点',
     'https://demo.example.com/kb/tomato-summer.html', '李研究员', '省农业技术推广总站', 386,
     '2026-05-20 10:00:00', 1, '2001', '2026-05-20 10:00:00', '2026-05-20 10:00:00'),
    ('DEMO-ART-002', 'PEST', '稻瘟病识别与统防统治技术',
     '叶瘟、穗颈瘟的田间识别特征与破口期统防统治施药窗口',
     'https://demo.example.com/kb/rice-blast.html', '王植保', '全国农技推广中心', 512,
     '2026-07-08 09:30:00', 1, '2001', '2026-07-08 09:30:00', '2026-07-08 09:30:00'),
    ('DEMO-ART-003', 'POLICY', '绿色食品标志许可审查要点解读',
     '新版审查细则中关于产地环境、投入品管理的关键条款解读',
     'https://demo.example.com/kb/green-food.html', '张科长', '绿色食品发展中心', 174,
     '2026-08-30 14:00:00', 1, '2001', '2026-08-30 14:00:00', '2026-08-30 14:00:00');

-- 演示规程（3 条，内容与平台侧演示行一致）
INSERT IGNORE INTO agri_prod_sop_library
    (sop_code, crop_id, sop_name, sop_type, version_no, content_url, stage_seq, applicable_region, publisher, status, tenant_id, create_time, update_time)
VALUES
    ('DEMO-SOPC-001', 'DEMO-CROP-001', '设施番茄绿色生产操作规程', 'PLANT', 'V1.2',
     'https://demo.example.com/sop/tomato-v1.2.pdf', 1, '华南设施蔬菜主产区', '省农科院', 1, '2001',
     '2026-10-10 09:00:00', '2026-10-10 09:00:00'),
    ('DEMO-SOPC-002', 'DEMO-CROP-002', '黄瓜主要病虫害防控规程', 'PEST', 'V2.0',
     'https://demo.example.com/sop/cucumber-v2.0.pdf', 3, '华东及黄淮海地区', '省植保站', 1, '2001',
     '2026-10-10 09:00:00', '2026-10-10 09:00:00'),
    ('DEMO-SOPC-003', 'DEMO-CROP-003', '水稻机插收获作业规程', 'HARVEST', 'V1.5',
     'https://demo.example.com/sop/rice-v1.5.pdf', 4, '长江中下游稻区', '农业农村厅', 1, '2001',
     '2026-10-10 09:00:00', '2026-10-10 09:00:00');

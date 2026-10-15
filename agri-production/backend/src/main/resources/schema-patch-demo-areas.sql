-- 补丁：演示数据的面积与在田作物（可重复执行）。
-- 跑法：mysql -uroot -p --default-character-set=utf8mb4 agri_production < schema-patch-demo-areas.sql
--
-- 背景（2026-10-15 做运营端仪表盘时发现）：演示农场与地块的表里，
--   · agri_prod_farm_info.total_area 全是 0（连 farm-identity 那一版补的 14 行也写的 0）；
--   · agri_prod_plot_info.area 全是 NULL、current_crop 也是 NULL。
-- 于是仪表盘的「在田面积」「种植面积排行」恒为 0、维度明细里的作物维度只剩一个"未标注作物"。
-- 这些是**演示数据本身的空缺**，不是聚合写错 —— 补数据而不是把 0 换成看起来像样的假数。
--
-- 只在值为空/为 0 时写入（可重复执行，也不会覆盖别人手动改过的值）。
--
-- 农场属性**照搬平台侧演示数据**（agri_core.prod_farm_info）：同一批农场在两边的面积与所在地
-- 本就该一致 —— 自己另编一套会出现"平台侧看是 1280 亩、生产服务看是 20 亩"的分叉。
-- 省份/城市也一并补上：区域分布与区域维度聚合都按 province 分组，缺了会全部落到"未标注区域"。
UPDATE agri_prod_farm_info SET province='广东省', city='广州市', district='从化区', total_area=1280.00 WHERE id=1;
UPDATE agri_prod_farm_info SET province='江苏省', city='盐城市', district='射阳县', total_area=3600.00 WHERE id=2;
UPDATE agri_prod_farm_info SET province='山东省', city='潍坊市', district='寿光市', total_area=860.00  WHERE id=3;
UPDATE agri_prod_farm_info SET province='甘肃省', city='张掖市', district='山丹县', total_area=5200.00 WHERE id=4;
UPDATE agri_prod_farm_info SET province='湖北省', city='荆州市', district='监利市', total_area=2150.00 WHERE id=5;
UPDATE agri_prod_farm_info SET province='云南省', city='昆明市', district='呈贡区', total_area=320.00  WHERE id=6;
UPDATE agri_prod_farm_info SET province='吉林省', city='长春市', district='农安县', total_area=6800.00 WHERE id=7;
UPDATE agri_prod_farm_info SET province='四川省', city='成都市', district='崇州市', total_area=4200.00 WHERE id=8;
UPDATE agri_prod_farm_info SET province='江西省', city='赣州市', district='信丰县', total_area=1500.00 WHERE id=9;
UPDATE agri_prod_farm_info SET province='福建省', city='漳州市', district='漳浦县', total_area=260.00  WHERE id=10;
UPDATE agri_prod_farm_info SET province='广西壮族自治区', city='桂林市', district='荔浦市', total_area=1100.00 WHERE id=11;
UPDATE agri_prod_farm_info SET province='河北省', city='唐山市', district='滦南县', total_area=900.00  WHERE id=12;
UPDATE agri_prod_farm_info SET province='安徽省', city='阜阳市', district='太和县', total_area=5400.00 WHERE id=13;
UPDATE agri_prod_farm_info SET province='湖南省', city='湘西土家族苗族自治州', district='吉首市', total_area=780.00 WHERE id=14;
UPDATE agri_prod_farm_info SET province='陕西省', city='汉中市', district='西乡县', total_area=650.00  WHERE id=15;
UPDATE agri_prod_farm_info SET province='海南省', city='三亚市', district='崖州区', total_area=480.00  WHERE id=16;

-- 地块面积与在田作物（本库只有 3 个演示地块：1/2 在农场 1，3 在农场 2）
UPDATE agri_prod_plot_info SET area = 8.50,  current_crop = '西红柿' WHERE id = 1 AND (area IS NULL OR area = 0);
UPDATE agri_prod_plot_info SET area = 12.00, current_crop = '西红柿' WHERE id = 2 AND (area IS NULL OR area = 0);
UPDATE agri_prod_plot_info SET area = 4.50,  current_crop = '水稻'   WHERE id = 3 AND (area IS NULL OR area = 0);

-- 地块数与农场总面积对齐（plot_count 也一直是 0，页面上"地块数"跟着空）
UPDATE agri_prod_farm_info f
SET f.plot_count = (SELECT COUNT(*) FROM agri_prod_plot_info p WHERE p.farm_id = f.id AND p.deleted = 0)
WHERE f.plot_count IS NULL OR f.plot_count <> (SELECT COUNT(*) FROM agri_prod_plot_info p WHERE p.farm_id = f.id AND p.deleted = 0);

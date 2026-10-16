package com.agri.production.service.impl;

import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.GrowthRecord;
import com.agri.production.mapper.GrowthRecordMapper;
import com.agri.production.service.FarmIdResolver;
import com.agri.production.service.IGrowthService;
import com.agri.production.vo.GrowthRecordVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 生长监测实现。
 *
 * <p>租户由控制器传入，本类只负责查询、字段校验与实体↔出参转换。</p>
 */
@Slf4j
@Service
public class GrowthServiceImpl implements IGrowthService {

    /** 长势评级取值（页面 GrowthLevel：1 弱 / 2 偏弱 / 3 正常 / 4 旺盛） */
    private static final List<Integer> GROWTH_LEVELS = List.of(1, 2, 3, 4);
    /** 病虫害等级取值（0 无 / 1 轻 / 2 中 / 3 重） */
    private static final List<Integer> PEST_LEVELS = List.of(0, 1, 2, 3);
    private static final int TEXT_SHORT = 32;
    private static final int TEXT_NAME = 100;
    private static final int TEXT_REMARK = 500;
    private static final DateTimeFormatter ID_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS");
    private static final ObjectMapper JSON = new ObjectMapper();

    private final GrowthRecordMapper growthMapper;
    private final FarmIdResolver farmIdResolver;

    public GrowthServiceImpl(GrowthRecordMapper growthMapper, FarmIdResolver farmIdResolver) {
        this.growthMapper = growthMapper;
        this.farmIdResolver = farmIdResolver;
    }

    @Override
    public PageResult<GrowthRecordVO> page(int pageNum, int pageSize, String tenantId, Long farmId, String plotId,
                                           String planId, String growthStage, String startDate, String endDate) {
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        LambdaQueryWrapper<GrowthRecord> w = baseWrapper(tenantId);
        if (farmId != null) {
            w.eq(GrowthRecord::getFarmId, farmId);
        }
        if (!isBlank(plotId)) {
            w.eq(GrowthRecord::getPlotId, plotId.trim());
        }
        if (!isBlank(planId)) {
            w.eq(GrowthRecord::getPlanId, planId.trim());
        }
        if (!isBlank(growthStage)) {
            w.eq(GrowthRecord::getGrowthStage, growthStage.trim());
        }
        LocalDate from = parseDate(startDate, "startDate");
        LocalDate to = parseDate(endDate, "endDate");
        if (from != null) {
            w.ge(GrowthRecord::getRecordDate, from);
        }
        if (to != null) {
            w.le(GrowthRecord::getRecordDate, to);
        }
        // 记录日期倒序（最近的在最前）；同一天用编号兜底，避免分页翻页时同一天的记录在页间串位
        w.orderByDesc(GrowthRecord::getRecordDate).orderByDesc(GrowthRecord::getRecordId);
        Page<GrowthRecord> result = growthMapper.selectPage(new Page<>(p, s), w);
        List<GrowthRecordVO> rows = result.getRecords().stream().map(GrowthRecordVO::of).toList();
        return PageResult.of(rows, result.getTotal(), p, s);
    }

    @Override
    public GrowthRecordVO detail(String tenantId, String recordId) {
        return GrowthRecordVO.of(requireRecord(tenantId, recordId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String create(String tenantId, GrowthPayload payload) {
        if (payload == null) {
            throw new BusinessException(400, "请求体不能为空");
        }
        String plotId = requireText(payload.plotId(), "地块标识", 64);
        String growthStage = requireText(payload.growthStage(), "生育期", TEXT_SHORT);
        LocalDate recordDate = requireDate(payload.recordDate(), "记录日期");
        Integer growthLevel = requireGrowthLevel(payload.growthLevel());

        GrowthRecord entity = new GrowthRecord();
        entity.setRecordId(newRecordId());
        entity.setTenantId(tenantId);
        entity.setPlotId(plotId);
        entity.setPlotName(optionalText(payload.plotName(), "地块名称", TEXT_NAME));
        entity.setFarmId(resolveFarmId(payload.farmId(), tenantId));
        entity.setPlanId(optionalText(payload.planId(), "计划标识", 64));
        entity.setCropId(optionalText(payload.cropId(), "作物标识", 64));
        entity.setCropName(optionalText(payload.cropName(), "作物名称", TEXT_NAME));
        entity.setGrowthStage(growthStage);
        entity.setRecordDate(recordDate);
        entity.setPlantHeight(decimal(payload.plantHeight(), "株高", 2));
        entity.setLeafCount(intValue(payload.leafCount(), "叶片数", 0));
        entity.setLeafAreaIndex(decimal(payload.leafAreaIndex(), "叶面积指数", 2));
        entity.setGrowthLevel(growthLevel);
        entity.setPestLevel(optionalPestLevel(payload.pestLevel()));
        entity.setPestInfo(optionalText(payload.pestInfo(), "病虫害描述", 200));
        entity.setWeather(optionalText(payload.weather(), "天气", 50));
        entity.setPhotos(photosOf(payload));
        entity.setRecorderId(optionalText(payload.recorderId(), "记录人标识", 64));
        entity.setRecorderName(optionalText(payload.recorderName(), "记录人", TEXT_NAME));
        entity.setRemark(optionalText(payload.remark(), "备注", TEXT_REMARK));
        entity.setStatus(payload.status() == null ? 1 : requireStatus(payload.status()));
        growthMapper.insert(entity);
        log.info("生长记录新增：{}（地块 {} / 生育期 {} / 长势 {}）",
                entity.getRecordId(), plotId, growthStage, growthLevel);
        return entity.getRecordId();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public GrowthRecordVO update(String tenantId, String recordId, GrowthPayload payload) {
        if (payload == null) {
            throw new BusinessException(400, "请求体不能为空");
        }
        GrowthRecord entity = requireRecord(tenantId, recordId);
        if (payload.plotId() != null) {
            entity.setPlotId(requireText(payload.plotId(), "地块标识", 64));
        }
        if (payload.plotName() != null) {
            entity.setPlotName(optionalText(payload.plotName(), "地块名称", TEXT_NAME));
        }
        if (payload.farmId() != null) {
            entity.setFarmId(resolveFarmId(payload.farmId(), tenantId));
        }
        if (payload.planId() != null) {
            entity.setPlanId(optionalText(payload.planId(), "计划标识", 64));
        }
        if (payload.cropId() != null) {
            entity.setCropId(optionalText(payload.cropId(), "作物标识", 64));
        }
        if (payload.cropName() != null) {
            entity.setCropName(optionalText(payload.cropName(), "作物名称", TEXT_NAME));
        }
        if (payload.growthStage() != null) {
            entity.setGrowthStage(requireText(payload.growthStage(), "生育期", TEXT_SHORT));
        }
        if (payload.recordDate() != null) {
            entity.setRecordDate(requireDate(payload.recordDate(), "记录日期"));
        }
        if (payload.plantHeight() != null) {
            entity.setPlantHeight(decimal(payload.plantHeight(), "株高", 2));
        }
        if (payload.leafCount() != null) {
            entity.setLeafCount(intValue(payload.leafCount(), "叶片数", 0));
        }
        if (payload.leafAreaIndex() != null) {
            entity.setLeafAreaIndex(decimal(payload.leafAreaIndex(), "叶面积指数", 2));
        }
        if (payload.growthLevel() != null) {
            entity.setGrowthLevel(requireGrowthLevel(payload.growthLevel()));
        }
        if (payload.pestLevel() != null) {
            entity.setPestLevel(optionalPestLevel(payload.pestLevel()));
        }
        if (payload.pestInfo() != null) {
            entity.setPestInfo(optionalText(payload.pestInfo(), "病虫害描述", 200));
        }
        if (payload.weather() != null) {
            entity.setWeather(optionalText(payload.weather(), "天气", 50));
        }
        if (payload.photoUrls() != null || payload.photos() != null) {
            entity.setPhotos(photosOf(payload));
        }
        if (payload.recorderId() != null) {
            entity.setRecorderId(optionalText(payload.recorderId(), "记录人标识", 64));
        }
        if (payload.recorderName() != null) {
            entity.setRecorderName(optionalText(payload.recorderName(), "记录人", TEXT_NAME));
        }
        if (payload.remark() != null) {
            entity.setRemark(optionalText(payload.remark(), "备注", TEXT_REMARK));
        }
        if (payload.status() != null) {
            entity.setStatus(requireStatus(payload.status()));
        }
        growthMapper.updateById(entity);
        log.info("生长记录更新：{}", entity.getRecordId());
        return GrowthRecordVO.of(growthMapper.selectById(entity.getId()));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void delete(String tenantId, String recordId) {
        GrowthRecord entity = requireRecord(tenantId, recordId);
        growthMapper.deleteById(entity.getId());
        log.info("生长记录删除：{}", entity.getRecordId());
    }

    @Override
    public List<GrowthRecordVO> byPlot(String tenantId, String plotId) {
        if (isBlank(plotId)) {
            // 平台侧这个端点的 plotId 是必填（@RequestParam String plotId）—— 缺参返 400 而不是"全量记录"，
            // 否则空参调用会拿到整个租户的数据，看起来像是"这个地块的记录真多"。
            throw new BusinessException(400, "缺少请求参数: plotId");
        }
        List<GrowthRecord> rows = growthMapper.selectList(baseWrapper(tenantId)
                .eq(GrowthRecord::getPlotId, plotId.trim())
                .orderByAsc(GrowthRecord::getRecordDate)
                .orderByAsc(GrowthRecord::getRecordId));
        return rows.stream().map(GrowthRecordVO::of).toList();
    }

    @Override
    public List<GrowthRecordVO> pest(String tenantId, int level) {
        if (!PEST_LEVELS.contains(level)) {
            throw new BusinessException(400, "病虫害等级应为 0 无 / 1 轻 / 2 中 / 3 重：" + level);
        }
        List<GrowthRecord> rows = growthMapper.selectList(baseWrapper(tenantId)
                .ge(GrowthRecord::getPestLevel, level)
                .orderByDesc(GrowthRecord::getRecordDate)
                .orderByDesc(GrowthRecord::getRecordId));
        return rows.stream().map(GrowthRecordVO::of).toList();
    }

    @Override
    public Map<String, Object> overview(String tenantId, String plotId) {
        List<GrowthRecord> rows = isBlank(plotId)
                ? growthMapper.selectList(baseWrapper(tenantId))
                : growthMapper.selectList(baseWrapper(tenantId).eq(GrowthRecord::getPlotId, plotId.trim()));

        BigDecimal heightSum = BigDecimal.ZERO;
        int heightCount = 0;
        int pestCount = 0;
        GrowthRecord latest = null;
        for (GrowthRecord row : rows) {
            if (row.getPlantHeight() != null) {
                heightSum = heightSum.add(row.getPlantHeight());
                heightCount++;
            }
            if (row.getPestLevel() != null && row.getPestLevel() > 0) {
                pestCount++;
            }
            if (row.getRecordDate() != null
                    && (latest == null || latest.getRecordDate() == null
                        || row.getRecordDate().isAfter(latest.getRecordDate()))) {
                latest = row;
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("plotId", isBlank(plotId) ? null : plotId.trim());
        result.put("plotName", latest == null ? null : latest.getPlotName());
        result.put("recordCount", rows.size());
        result.put("pestCount", pestCount);
        // 平均株高：没有任何株高记录时给 null 而不是 0 —— 0cm 的株高是一个具体的（且错误的）观测值
        result.put("avgHeight", heightCount == 0 ? null
                : heightSum.divide(BigDecimal.valueOf(heightCount), 2, RoundingMode.HALF_UP));
        result.put("latestStage", latest == null ? null : latest.getGrowthStage());
        result.put("latestPestLevel", latest == null ? null : latest.getPestLevel());
        result.put("latestPestInfo", latest == null ? null : latest.getPestInfo());
        result.put("latestRecordDate",
                latest == null || latest.getRecordDate() == null ? null
                        : latest.getRecordDate().format(DateTimeFormatter.ISO_LOCAL_DATE));
        result.put("latestGrowthLevel", latest == null ? null : latest.getGrowthLevel());
        return result;
    }

    /* ==================== 内部工具 ==================== */

    private LambdaQueryWrapper<GrowthRecord> baseWrapper(String tenantId) {
        if (tenantId == null || tenantId.isBlank()) {
            throw new BusinessException(500, "租户上下文为空，无法查询生长记录");
        }
        return new LambdaQueryWrapper<GrowthRecord>().eq(GrowthRecord::getTenantId, tenantId);
    }

    private GrowthRecord requireRecord(String tenantId, String recordId) {
        if (isBlank(recordId)) {
            throw new BusinessException(400, "缺少记录编号");
        }
        GrowthRecord entity = growthMapper.selectOne(baseWrapper(tenantId)
                .eq(GrowthRecord::getRecordId, recordId.trim())
                .last("LIMIT 1"));
        if (entity == null) {
            throw new BusinessException(404, "生长记录不存在：" + recordId.trim());
        }
        return entity;
    }

    /**
     * 新记录编号：前缀 + 毫秒时间戳 + 4 位随机后缀。
     *
     * <p>后缀不是装饰：同一毫秒内两次新增（脚本连发、页面连点）会撞上 uk_growth_record_id 唯一键，
     * 表现出来是 500 而不是"本来应该成功"。</p>
     */
    private String newRecordId() {
        return "GROW" + LocalDateTime.now().format(ID_FORMAT)
                + String.format("%04d", ThreadLocalRandom.current().nextInt(10000));
    }

    /**
     * 农场标识换算（页面传的是平台侧标识 DEMO-FARM-xxx）。
     *
     * <p>换算不出来时 {@link FarmIdResolver} 会抛 400 并说明收到的是什么 —— 不静默丢弃，
     * 否则记录会落到 farm_id = NULL，之后"按农场筛选"永远看不到它。</p>
     */
    private Long resolveFarmId(String rawFarmId, String tenantId) {
        if (isBlank(rawFarmId)) {
            log.warn("生长记录未带农场标识，farm_id 将为空（按农场筛选时不会被命中）");
            return null;
        }
        return farmIdResolver.resolveFilter(rawFarmId, tenantId);
    }

    /**
     * 照片字段归一成 JSON 数组字符串。
     *
     * <p>页面同时发 photoUrls（数组）与 photos（JSON 字符串），优先用数组重排一次：
     * 两者不一致时以结构化字段为准，免得把一串手写的非法 JSON 存进库、页面解析失败显示"无照片"。</p>
     */
    private String photosOf(GrowthPayload payload) {
        List<String> urls = payload.photoUrls();
        if (urls == null) {
            return optionalText(payload.photos(), "照片", 4000);
        }
        List<String> cleaned = new ArrayList<>();
        for (String url : urls) {
            if (url != null && !url.isBlank()) {
                cleaned.add(url.trim());
            }
        }
        if (cleaned.isEmpty()) {
            return "[]";
        }
        try {
            return JSON.writeValueAsString(cleaned);
        } catch (Exception e) {
            throw new BusinessException(400, "照片地址无法序列化：" + e.getMessage());
        }
    }

    private String requireText(String value, String field, int maxLength) {
        String trimmed = optionalText(value, field, maxLength);
        if (trimmed == null) {
            throw new BusinessException(400, field + "为必填");
        }
        return trimmed;
    }

    private String optionalText(String value, String field, int maxLength) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        if (trimmed.length() > maxLength) {
            throw new BusinessException(400, field + "不得超过 " + maxLength + " 字");
        }
        return trimmed;
    }

    private LocalDate requireDate(String text, String field) {
        LocalDate date = parseDate(text, field);
        if (date == null) {
            throw new BusinessException(400, field + "为必填（yyyy-MM-dd）");
        }
        return date;
    }

    private LocalDate parseDate(String text, String field) {
        if (isBlank(text)) {
            return null;
        }
        try {
            return LocalDate.parse(text.trim());
        } catch (DateTimeParseException e) {
            throw new BusinessException(400, field + "格式应为 yyyy-MM-dd：" + text.trim());
        }
    }

    private Integer requireGrowthLevel(Integer level) {
        if (level == null) {
            // 长势是页面列表的核心列，也是"长势对比"的量化依据。缺省填 3「正常」看着无害，
            // 但那等于把"没录入"变成"记录为正常" —— 页面上的评分会因此虚高。
            throw new BusinessException(400, "长势评级不能为空（1 弱 / 2 偏弱 / 3 正常 / 4 旺盛）");
        }
        if (!GROWTH_LEVELS.contains(level)) {
            throw new BusinessException(400, "长势评级应为 1 弱 / 2 偏弱 / 3 正常 / 4 旺盛：" + level);
        }
        return level;
    }

    private Integer optionalPestLevel(Integer level) {
        if (level == null) {
            return null;
        }
        if (!PEST_LEVELS.contains(level)) {
            throw new BusinessException(400, "病虫害等级应为 0 无 / 1 轻 / 2 中 / 3 重：" + level);
        }
        return level;
    }

    private Integer requireStatus(Integer status) {
        if (status != 0 && status != 1) {
            throw new BusinessException(400, "状态应为 1 有效 / 0 停用：" + status);
        }
        return status;
    }

    private BigDecimal decimal(BigDecimal value, String field, int maxScale) {
        if (value == null) {
            return null;
        }
        if (value.signum() < 0) {
            throw new BusinessException(400, field + "不能为负数：" + value);
        }
        if (value.scale() > maxScale) {
            throw new BusinessException(400, field + "最多保留 " + maxScale + " 位小数：" + value);
        }
        return value;
    }

    private Integer intValue(Integer value, String field, int min) {
        if (value == null) {
            return null;
        }
        if (value < min) {
            throw new BusinessException(400, field + "不能小于 " + min + "：" + value);
        }
        return value;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}

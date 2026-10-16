package com.agri.production.service.impl;

import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.Plot;
import com.agri.production.entity.SoilRecord;
import com.agri.production.mapper.PlotMapper;
import com.agri.production.mapper.SoilRecordMapper;
import com.agri.production.service.PlotIdResolver;
import com.agri.production.vo.SoilTestRecordVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 地块土壤检测档案（页面「地块详情 → 土壤检测」）。
 *
 * <p>口径：地块标识经 {@link PlotIdResolver} 换算，换不出来 404；写操作只写"有来源"的列，
 * 平台侧没有的项（检测机构 / 电导率 / 结论 / 报告附件）留空并可后续人工补录。</p>
 */
@Slf4j
@Service
public class PlotSoilServiceImpl {

    private static final DateTimeFormatter ID_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS");

    private final SoilRecordMapper soilMapper;
    private final PlotMapper plotMapper;
    private final PlotIdResolver plotIdResolver;

    public PlotSoilServiceImpl(SoilRecordMapper soilMapper, PlotMapper plotMapper, PlotIdResolver plotIdResolver) {
        this.soilMapper = soilMapper;
        this.plotMapper = plotMapper;
        this.plotIdResolver = plotIdResolver;
    }

    /** 分页（按检测日期倒序）。 */
    public PageResult<SoilTestRecordVO> page(String tenantId, String rawPlotId, int pageNum, int pageSize) {
        Long plotId = plotIdResolver.require(rawPlotId, tenantId);
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        Page<SoilRecord> page = soilMapper.selectPage(new Page<>(p, s), baseWrapper(tenantId, plotId)
                .orderByDesc(SoilRecord::getSampleDate).orderByDesc(SoilRecord::getId));
        String plotName = plotName(plotId);
        return PageResult.of(page.getRecords().stream().map(row -> SoilTestRecordVO.of(row, plotName)).toList(),
                page.getTotal(), p, s);
    }

    /** 裸数组（页面 `/soil-tests` 明确不吃 page/size）。 */
    public List<SoilTestRecordVO> listAll(String tenantId, String rawPlotId) {
        Long plotId = plotIdResolver.require(rawPlotId, tenantId);
        String plotName = plotName(plotId);
        return soilMapper.selectList(baseWrapper(tenantId, plotId)
                        .orderByDesc(SoilRecord::getSampleDate).orderByDesc(SoilRecord::getId))
                .stream().map(row -> SoilTestRecordVO.of(row, plotName)).toList();
    }

    /** 最近一次；无记录返回 null（页面按"未接入"渲染，不是空对象）。 */
    public SoilTestRecordVO latest(String tenantId, String rawPlotId) {
        Long plotId = plotIdResolver.require(rawPlotId, tenantId);
        List<SoilRecord> rows = soilMapper.selectList(baseWrapper(tenantId, plotId)
                .orderByDesc(SoilRecord::getSampleDate).orderByDesc(SoilRecord::getId).last("LIMIT 1"));
        return rows.isEmpty() ? null : SoilTestRecordVO.of(rows.get(0), plotName(plotId));
    }

    /** 新增档案，返回新编号（页面按主键字符串消费）。 */
    @Transactional(rollbackFor = Exception.class)
    public String create(String tenantId, String rawPlotId, Map<String, Object> payload) {
        Long plotId = plotIdResolver.require(rawPlotId, tenantId);
        if (payload == null || payload.isEmpty()) {
            throw new BusinessException(400, "请求体不能为空");
        }
        SoilRecord entity = new SoilRecord();
        entity.setSoilId("SOIL" + LocalDateTime.now().format(ID_FORMAT)
                + String.format("%04d", ThreadLocalRandom.current().nextInt(10000)));
        entity.setPlotId(plotId);
        entity.setTenantId(tenantId);
        Plot plot = plotMapper.selectById(plotId);
        entity.setFarmId(plot == null ? null : plot.getFarmId());
        // 检测日期：页面的 testDate 是必填；不传就报 400 而不是默默填今天（今天 ≠ 检测日）
        entity.setSampleDate(requireDate(str(payload.get("testDate")), "testDate"));
        entity.setPhValue(decimal(payload.get("ph"), "ph"));
        entity.setOrganicMatter(decimal(payload.get("organicMatter"), "organicMatter"));
        entity.setNitrogen(decimal(payload.get("totalNitrogen"), "totalNitrogen"));
        entity.setPhosphorus(decimal(payload.get("availablePhosphorus"), "availablePhosphorus"));
        entity.setPotassium(decimal(payload.get("availablePotassium"), "availablePotassium"));
        entity.setMoistureContent(decimal(payload.get("moisture"), "moisture"));
        entity.setConductivity(decimal(payload.get("conductivity"), "conductivity"));
        entity.setTester(str(payload.get("tester")));
        entity.setTestOrg(str(payload.get("testOrg")));
        entity.setConclusion(str(payload.get("conclusion")));
        entity.setReportUrl(str(payload.get("reportUrl")));
        entity.setRemark(str(payload.get("remark")));
        soilMapper.insert(entity);
        log.info("土壤档案新增：{}（地块 {} / {}）", entity.getSoilId(), plotId, entity.getSampleDate());
        return entity.getSoilId();
    }

    private LambdaQueryWrapper<SoilRecord> baseWrapper(String tenantId, Long plotId) {
        if (tenantId == null || tenantId.isBlank()) {
            throw new BusinessException(500, "租户上下文为空，无法查询土壤档案");
        }
        return new LambdaQueryWrapper<SoilRecord>().eq(SoilRecord::getTenantId, tenantId)
                .eq(SoilRecord::getPlotId, plotId);
    }

    private String plotName(Long plotId) {
        Plot plot = plotMapper.selectById(plotId);
        return plot == null ? null : plot.getPlotName();
    }

    private static LocalDate requireDate(String text, String field) {
        if (text == null) {
            throw new BusinessException(400, field + " 为必填（yyyy-MM-dd）");
        }
        try {
            return LocalDate.parse(text);
        } catch (DateTimeParseException e) {
            throw new BusinessException(400, field + " 格式应为 yyyy-MM-dd：" + text);
        }
    }

    private static BigDecimal decimal(Object value, String field) {
        if (value == null) {
            return null;
        }
        if (value instanceof BigDecimal decimal) {
            return decimal;
        }
        if (value instanceof Number number) {
            return new BigDecimal(number.toString());
        }
        String text = String.valueOf(value).trim();
        if (text.isEmpty()) {
            return null;
        }
        try {
            return new BigDecimal(text);
        } catch (NumberFormatException e) {
            throw new BusinessException(400, field + " 应为数字：" + text);
        }
    }

    private static String str(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }
}

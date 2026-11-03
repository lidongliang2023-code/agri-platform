package com.agri.production.service.impl;

import com.agri.production.common.exception.BusinessException;
import com.agri.production.dto.PlotCropSaveDTO;
import com.agri.production.entity.CropInfo;
import com.agri.production.entity.Plot;
import com.agri.production.entity.PlotCrop;
import com.agri.production.mapper.CropInfoMapper;
import com.agri.production.mapper.PlotCropMapper;
import com.agri.production.mapper.PlotMapper;
import com.agri.production.service.PlotIdResolver;
import com.agri.production.vo.PlotCropVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

/**
 * 地块种养品种台账（页面「地块详情 → 种养品种」）。
 *
 * <p>一个地块可登记多个品种；地块标识经 {@link PlotIdResolver} 换算（数字 id / 地块编码 / 平台侧标识都认），
 * 换不出来 404。种类必须能在作物主数据里找到 —— 与地块「当前作物」同一口径，不往台账写主数据里没有的作物名。</p>
 */
@Slf4j
@Service
public class PlotCropServiceImpl {

    private static final Set<String> STANDARD_VALUES = Set.of("ORGANIC", "GREEN", "NORMAL");
    private static final Set<String> PLANTING_METHOD_VALUES = Set.of("TRANSPLANT", "DIRECT");
    private static final Set<String> OPERATION_METHOD_VALUES = Set.of("MANUAL", "MECHANICAL");

    private final PlotCropMapper plotCropMapper;
    private final PlotMapper plotMapper;
    private final CropInfoMapper cropMapper;
    private final PlotIdResolver plotIdResolver;

    public PlotCropServiceImpl(PlotCropMapper plotCropMapper,
                               PlotMapper plotMapper,
                               CropInfoMapper cropMapper,
                               PlotIdResolver plotIdResolver) {
        this.plotCropMapper = plotCropMapper;
        this.plotMapper = plotMapper;
        this.cropMapper = cropMapper;
        this.plotIdResolver = plotIdResolver;
    }

    /** 查询地块下的全部种养品种（按登记顺序）。 */
    public List<PlotCropVO> list(String tenantId, String rawPlotId) {
        Long plotId = plotIdResolver.require(rawPlotId, tenantId);
        return PlotCropVO.listOf(plotCropMapper.selectList(new LambdaQueryWrapper<PlotCrop>()
                .eq(PlotCrop::getTenantId, tenantId)
                .eq(PlotCrop::getPlotId, plotId)
                .orderByAsc(PlotCrop::getId)));
    }

    /** 新增种养品种。 */
    @Transactional(rollbackFor = Exception.class)
    public PlotCropVO create(String tenantId, String rawPlotId, PlotCropSaveDTO dto) {
        Long plotId = plotIdResolver.require(rawPlotId, tenantId);
        Plot plot = plotMapper.selectById(plotId);
        if (plot == null || !tenantId.equals(plot.getTenantId())) {
            throw new BusinessException(404, "地块不存在：" + rawPlotId);
        }
        PlotCrop entity = new PlotCrop();
        entity.setPlotId(plotId);
        entity.setTenantId(tenantId);
        entity.setFarmId(plot.getFarmId());
        apply(entity, dto, tenantId);
        plotCropMapper.insert(entity);
        syncCurrentCropToPlot(plotId, tenantId);
        log.info("地块种养品种新增：地块 {} / {}（{}）", plotId, entity.getCropName(), entity.getId());
        return PlotCropVO.of(entity);
    }

    /** 编辑种养品种。 */
    @Transactional(rollbackFor = Exception.class)
    public PlotCropVO update(String tenantId, String rawPlotId, Long cropRecordId, PlotCropSaveDTO dto) {
        Long plotId = plotIdResolver.require(rawPlotId, tenantId);
        PlotCrop entity = getOwned(tenantId, plotId, cropRecordId);
        apply(entity, dto, tenantId);
        plotCropMapper.updateById(entity);
        syncCurrentCropToPlot(plotId, tenantId);
        return PlotCropVO.of(entity);
    }

    /** 删除种养品种（逻辑删除）。 */
    @Transactional(rollbackFor = Exception.class)
    public void delete(String tenantId, String rawPlotId, Long cropRecordId) {
        Long plotId = plotIdResolver.require(rawPlotId, tenantId);
        getOwned(tenantId, plotId, cropRecordId);
        plotCropMapper.deleteById(cropRecordId);
        syncCurrentCropToPlot(plotId, tenantId);
    }

    /**
     * 台账里最早登记的一条品种（无记录返回 null）。
     *
     * <p>这是「地块当前作物」的唯一出处：录入入口已从新增/编辑地块表单收进这份台账，
     * 地块表的 {@code crop_id} / {@code current_crop} 只是它的派生缓存（列表「作物」列直接读缓存列）。</p>
     */
    public PlotCrop earliest(Long plotId, String tenantId) {
        if (plotId == null) {
            return null;
        }
        return plotCropMapper.selectOne(new LambdaQueryWrapper<PlotCrop>()
                .eq(PlotCrop::getPlotId, plotId)
                .eq(PlotCrop::getTenantId, tenantId)
                .orderByAsc(PlotCrop::getId)
                .last("LIMIT 1"));
    }

    /** 把台账最早一条品种回写进地块的 {@code crop_id} + {@code current_crop}；台账空了就把两列一起清掉。 */
    private void syncCurrentCropToPlot(Long plotId, String tenantId) {
        PlotCrop first = earliest(plotId, tenantId);
        // 必须用 UpdateWrapper 显式 set：实体走 updateById 时 null 字段被 MP 的 NOT_NULL 策略跳过，
        // "台账清空"这一步会静默什么都不写。
        plotMapper.update(null, new LambdaUpdateWrapper<Plot>()
                .eq(Plot::getId, plotId)
                .set(Plot::getCropId, first == null ? null : first.getCropId())
                .set(Plot::getCurrentCrop, first == null ? null : first.getCropName()));
    }

    private PlotCrop getOwned(String tenantId, Long plotId, Long cropRecordId) {
        PlotCrop entity = plotCropMapper.selectOne(new LambdaQueryWrapper<PlotCrop>()
                .eq(PlotCrop::getTenantId, tenantId)
                .eq(PlotCrop::getPlotId, plotId)
                .eq(PlotCrop::getId, cropRecordId)
                .last("LIMIT 1"));
        if (entity == null) {
            throw new BusinessException(404, "种养品种记录不存在：" + cropRecordId);
        }
        return entity;
    }

    /**
     * 把弹窗字段落到实体。
     *
     * <p>编辑是整表单保存：可选字段（预计采收 / 亩产 / 株数 / 株间距）清空时要真的清掉，
     * 实体上这几个字段用了 {@code FieldStrategy.IGNORED}，null 也会写进 UPDATE。</p>
     */
    private void apply(PlotCrop entity, PlotCropSaveDTO dto, String tenantId) {
        CropInfo crop = resolveCrop(dto == null ? null : dto.getCropId(), tenantId);
        entity.setCropId(crop.getId());
        entity.setCropName(crop.getCropName());
        entity.setCropVariety(trim(dto.getCropVariety()));
        entity.setPlantingStandard(requireValue(dto.getPlantingStandard(), STANDARD_VALUES,
                "种植标准", "ORGANIC / GREEN / NORMAL"));
        entity.setPlantingMethod(requireValue(dto.getPlantingMethod(), PLANTING_METHOD_VALUES,
                "种植方式", "TRANSPLANT / DIRECT"));
        entity.setOperationMethod(requireValue(dto.getOperationMethod(), OPERATION_METHOD_VALUES,
                "作业方式", "MANUAL / MECHANICAL"));
        if (dto.getTransplantDate() == null) {
            throw new BusinessException(400, "移栽时间不能为空");
        }
        if (dto.getExpectedHarvestDate() != null
                && dto.getExpectedHarvestDate().isBefore(dto.getTransplantDate())) {
            throw new BusinessException(400, "预计采收时间不能早于移栽时间");
        }
        entity.setTransplantDate(dto.getTransplantDate());
        entity.setExpectedHarvestDate(dto.getExpectedHarvestDate());
        entity.setExpectedYieldPerMu(dto.getExpectedYieldPerMu());
        entity.setPlantCount(dto.getPlantCount());
        entity.setPlantSpacing(dto.getPlantSpacing());
    }

    /** 种类：作物主数据主键或作物名，认不出 400。 */
    private CropInfo resolveCrop(String raw, String tenantId) {
        String text = raw == null ? null : raw.trim();
        if (text == null || text.isEmpty()) {
            throw new BusinessException(400, "种类不能为空");
        }
        Long pk = parseLong(text);
        CropInfo crop = pk != null
                ? cropMapper.selectById(pk)
                : cropMapper.selectOne(new LambdaQueryWrapper<CropInfo>()
                        .eq(CropInfo::getTenantId, tenantId)
                        .eq(CropInfo::getCropName, text)
                        .last("LIMIT 1"));
        if (crop == null || !tenantId.equals(crop.getTenantId())) {
            throw new BusinessException(400, "作物不存在（请先在「作物管理」里维护）：" + text);
        }
        return crop;
    }

    private static String requireValue(String value, Set<String> allowed, String field, String expected) {
        String text = value == null ? null : value.trim().toUpperCase();
        if (text == null || !allowed.contains(text)) {
            throw new BusinessException(400, field + "取值应为 " + expected + "：" + value);
        }
        return text;
    }

    private static Long parseLong(String text) {
        if (!text.chars().allMatch(Character::isDigit)) {
            return null;
        }
        try {
            return Long.valueOf(text);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String trim(String value) {
        if (value == null) {
            return null;
        }
        String text = value.trim();
        return text.isEmpty() ? null : text;
    }
}

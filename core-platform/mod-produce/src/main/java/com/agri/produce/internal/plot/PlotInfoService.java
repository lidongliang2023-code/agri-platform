package com.agri.produce.internal.plot;

import com.agri.produce.internal.common.ProduceIds;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 地块/棚（生产底册，溯源链路起点） 应用服务。
 */
@Service
@RequiredArgsConstructor
public class PlotInfoService {

    private static final String ID_PREFIX = "PLOT";

    private final PlotInfoMapper plotInfoMapper;

    /**
     * 分页查询。
     *
     * <p>所有筛选条件都是真实生效的 SQL 条件。此前前端 {@code src/api/plots.ts}
     * 的 {@code PlotListParams} 声明了 {@code farmId}，但方法签名里没有该参数，
     * Spring 不会报错、参数被静默丢弃，页面「切了农场但列表没变」，显示的是全局数据。
     * 现补齐 {@code farmId}（对应 {@code prod_plot_info.farm_id}，V2 建表即存在）
     * 与 {@code plantingType}（对应 {@code prod_plot_info.planting_type}）；
     * 两者均为可空，为空时不加条件，保持未传参时的原有行为。</p>
     *
     * @param farmId       所属农场过滤，为空不过滤
     * @param keyword      plotName 模糊关键字
     * @param plantingType 种植方式过滤 1露天 2大棚 3水田 4山地，为空不过滤
     * @param status       状态过滤
     * @return 分页结果
     */
    public PageResult<PlotInfoEntity> page(long page, long size, String farmId, String keyword,
                                           Integer plantingType, Integer status) {
        Page<PlotInfoEntity> result = plotInfoMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<PlotInfoEntity>()
                        .eq(farmId != null && !farmId.isBlank(), PlotInfoEntity::getFarmId, farmId)
                        .like(keyword != null && !keyword.isBlank(), PlotInfoEntity::getPlotName, keyword)
                        .eq(plantingType != null, PlotInfoEntity::getPlantingType, plantingType)
                        .eq(status != null, PlotInfoEntity::getStatus, status)
                        .orderByDesc(PlotInfoEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public PlotInfoEntity detail(String id) {
        PlotInfoEntity entity = plotInfoMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        return entity;
    }

    /**
     * 新增，缺省业务主键时自动生成。
     *
     * @param entity 实体
     * @return 落库后的实体
     */
    @Transactional
    public PlotInfoEntity create(PlotInfoEntity entity) {
        if (entity.getPlotId() == null || entity.getPlotId().isBlank()) {
            entity.setPlotId(ProduceIds.newId(ID_PREFIX));
        }
        plotInfoMapper.insert(entity);
        return entity;
    }

    /**
     * 更新（以路径上的业务主键为准）。
     *
     * @param id     业务主键
     * @param entity 待更新内容
     * @return 更新后的实体
     */
    @Transactional
    public PlotInfoEntity update(String id, PlotInfoEntity entity) {
        entity.setPlotId(id);
        plotInfoMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        plotInfoMapper.deleteById(id);
    }

    /** 绑定种养计划：地块转入「在种」 */
    @Transactional
    public PlotInfoEntity bindPlan(String plotId, String planId) {
        PlotInfoEntity plot = detail(plotId);
        plot.setCurrentPlanId(planId);
        plot.setStatus(2);
        plotInfoMapper.updateById(plot);
        return plot;
    }

    /** 解除种养计划：地块转入「休耕」 */
    @Transactional
    public PlotInfoEntity unbindPlan(String plotId) {
        PlotInfoEntity plot = detail(plotId);
        plot.setCurrentPlanId(null);
        plot.setStatus(4);
        plotInfoMapper.updateById(plot);
        return plot;
    }

    /** 按农场统计地块数量与面积 */
    public Map<String, Object> stats(String farmId) {
        List<PlotInfoEntity> list = plotInfoMapper.selectList(new LambdaQueryWrapper<PlotInfoEntity>()
                .eq(farmId != null && !farmId.isBlank(), PlotInfoEntity::getFarmId, farmId));
        BigDecimal area = BigDecimal.ZERO;
        long idle = 0L;
        for (PlotInfoEntity plot : list) {
            if (plot.getArea() != null) {
                area = area.add(plot.getArea());
            }
            if (plot.getStatus() != null && plot.getStatus() == 1) {
                idle++;
            }
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("plotCount", list.size());
        result.put("areaTotal", area);
        result.put("idleCount", idle);
        return result;
    }
}

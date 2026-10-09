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
 * 地块土壤检测记录 应用服务。
 */
@Service
@RequiredArgsConstructor
public class PlotSoilService {

    private static final String ID_PREFIX = "SOIL";

    private final PlotSoilMapper plotSoilMapper;

    /**
     * 分页查询。
     *
     * @return 分页结果
     */
    public PageResult<PlotSoilEntity> page(long page, long size) {
        Page<PlotSoilEntity> result = plotSoilMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<PlotSoilEntity>()
                        .orderByDesc(PlotSoilEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public PlotSoilEntity detail(String id) {
        PlotSoilEntity entity = plotSoilMapper.selectById(id);
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
    public PlotSoilEntity create(PlotSoilEntity entity) {
        if (entity.getSoilId() == null || entity.getSoilId().isBlank()) {
            entity.setSoilId(ProduceIds.newId(ID_PREFIX));
        }
        plotSoilMapper.insert(entity);
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
    public PlotSoilEntity update(String id, PlotSoilEntity entity) {
        entity.setSoilId(id);
        plotSoilMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        plotSoilMapper.deleteById(id);
    }

    /** 地块最新一次土壤检测 */
    public PlotSoilEntity latest(String plotId) {
        List<PlotSoilEntity> list = plotSoilMapper.selectList(new LambdaQueryWrapper<PlotSoilEntity>()
                .eq(PlotSoilEntity::getPlotId, plotId)
                .orderByDesc(PlotSoilEntity::getSampleDate)
                .last("LIMIT 1"));
        return list.isEmpty() ? null : list.get(0);
    }

    /** 地块土壤检测列表 */
    public List<PlotSoilEntity> listByPlot(String plotId) {
        return plotSoilMapper.selectList(new LambdaQueryWrapper<PlotSoilEntity>()
                .eq(PlotSoilEntity::getPlotId, plotId)
                .orderByDesc(PlotSoilEntity::getSampleDate));
    }
}

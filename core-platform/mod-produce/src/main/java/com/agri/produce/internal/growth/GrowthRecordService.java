package com.agri.produce.internal.growth;

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
import java.math.RoundingMode;

/**
 * 作物生长监测记录（株高/叶片/病虫害/气象） 应用服务。
 */
@Service
@RequiredArgsConstructor
public class GrowthRecordService {

    private static final String ID_PREFIX = "GRWD";

    private final GrowthRecordMapper growthRecordMapper;

    /**
     * 分页查询。
     *
     * @param status  状态过滤
     * @return 分页结果
     */
    public PageResult<GrowthRecordEntity> page(long page, long size, Integer status) {
        Page<GrowthRecordEntity> result = growthRecordMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<GrowthRecordEntity>()
                        .eq(status != null, GrowthRecordEntity::getStatus, status)
                        .orderByDesc(GrowthRecordEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public GrowthRecordEntity detail(String id) {
        GrowthRecordEntity entity = growthRecordMapper.selectById(id);
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
    public GrowthRecordEntity create(GrowthRecordEntity entity) {
        if (entity.getRecordId() == null || entity.getRecordId().isBlank()) {
            entity.setRecordId(ProduceIds.newId(ID_PREFIX));
        }
        growthRecordMapper.insert(entity);
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
    public GrowthRecordEntity update(String id, GrowthRecordEntity entity) {
        entity.setRecordId(id);
        growthRecordMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        growthRecordMapper.deleteById(id);
    }

    /** 地块生长曲线（按日期升序） */
    public List<GrowthRecordEntity> listByPlot(String plotId) {
        return growthRecordMapper.selectList(new LambdaQueryWrapper<GrowthRecordEntity>()
                .eq(GrowthRecordEntity::getPlotId, plotId)
                .orderByAsc(GrowthRecordEntity::getRecordDate));
    }

    /** 病虫害记录（等级 >= level） */
    public List<GrowthRecordEntity> listPest(int level) {
        return growthRecordMapper.selectList(new LambdaQueryWrapper<GrowthRecordEntity>()
                .ge(GrowthRecordEntity::getPestLevel, level)
                .orderByDesc(GrowthRecordEntity::getRecordDate));
    }

    /** 生长总览：记录数 / 病虫害数 / 平均株高 */
    public Map<String, Object> overview(String plotId) {
        List<GrowthRecordEntity> list = plotId == null || plotId.isBlank()
                ? growthRecordMapper.selectList(new LambdaQueryWrapper<GrowthRecordEntity>())
                : listByPlot(plotId);
        BigDecimal height = BigDecimal.ZERO;
        int pest = 0;
        for (GrowthRecordEntity record : list) {
            if (record.getHeight() != null) {
                height = height.add(record.getHeight());
            }
            if (record.getPestLevel() != null && record.getPestLevel() > 0) {
                pest++;
            }
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("recordCount", list.size());
        result.put("pestCount", pest);
        result.put("avgHeight", list.isEmpty() ? BigDecimal.ZERO
                : height.divide(BigDecimal.valueOf(list.size()), 2, RoundingMode.HALF_UP));
        return result;
    }
}

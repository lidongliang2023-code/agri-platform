package com.agri.produce.internal.harvest;

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
 * 采收作业记录（每次下地采收的原始登记） 应用服务。
 */
@Service
@RequiredArgsConstructor
public class HarvestRecordService {

    private static final String ID_PREFIX = "HRVD";

    private final HarvestRecordMapper harvestRecordMapper;

    /**
     * 分页查询。
     *
     * @param status  状态过滤
     * @return 分页结果
     */
    public PageResult<HarvestRecordEntity> page(long page, long size, Integer status) {
        Page<HarvestRecordEntity> result = harvestRecordMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<HarvestRecordEntity>()
                        .eq(status != null, HarvestRecordEntity::getStatus, status)
                        .orderByDesc(HarvestRecordEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public HarvestRecordEntity detail(String id) {
        HarvestRecordEntity entity = harvestRecordMapper.selectById(id);
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
    public HarvestRecordEntity create(HarvestRecordEntity entity) {
        if (entity.getRecordId() == null || entity.getRecordId().isBlank()) {
            entity.setRecordId(ProduceIds.newId(ID_PREFIX));
        }
        harvestRecordMapper.insert(entity);
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
    public HarvestRecordEntity update(String id, HarvestRecordEntity entity) {
        entity.setRecordId(id);
        harvestRecordMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        harvestRecordMapper.deleteById(id);
    }

    /** 地块采收流水 */
    public List<HarvestRecordEntity> listByPlot(String plotId) {
        return harvestRecordMapper.selectList(new LambdaQueryWrapper<HarvestRecordEntity>()
                .eq(HarvestRecordEntity::getPlotId, plotId)
                .orderByDesc(HarvestRecordEntity::getHarvestDate));
    }

    /** 区间采收总量 */
    public Map<String, Object> sumByPlot(String plotId) {
        List<HarvestRecordEntity> list = listByPlot(plotId);
        BigDecimal total = BigDecimal.ZERO;
        for (HarvestRecordEntity record : list) {
            if (record.getQuantity() != null) {
                total = total.add(record.getQuantity());
            }
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("recordCount", list.size());
        result.put("quantityTotal", total);
        return result;
    }
}

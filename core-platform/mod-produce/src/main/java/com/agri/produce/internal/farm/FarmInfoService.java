package com.agri.produce.internal.farm;

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
import com.agri.produce.internal.plot.PlotInfoEntity;
import com.agri.produce.internal.plot.PlotInfoMapper;

/**
 * 农场档案（生产基地主数据） 应用服务。
 */
@Service
@RequiredArgsConstructor
public class FarmInfoService {

    private static final String ID_PREFIX = "FARM";

    private final FarmInfoMapper farmInfoMapper;
    private final PlotInfoMapper plotInfoMapper;

    /**
     * 分页查询。
     *
     * @param keyword farmName 模糊关键字
     * @param status  状态过滤
     * @return 分页结果
     */
    public PageResult<FarmInfoEntity> page(long page, long size, String keyword, Integer status) {
        Page<FarmInfoEntity> result = farmInfoMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<FarmInfoEntity>()
                        .like(keyword != null && !keyword.isBlank(), FarmInfoEntity::getFarmName, keyword)
                        .eq(status != null, FarmInfoEntity::getStatus, status)
                        .orderByDesc(FarmInfoEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public FarmInfoEntity detail(String id) {
        FarmInfoEntity entity = farmInfoMapper.selectById(id);
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
    public FarmInfoEntity create(FarmInfoEntity entity) {
        if (entity.getFarmId() == null || entity.getFarmId().isBlank()) {
            entity.setFarmId(ProduceIds.newId(ID_PREFIX));
        }
        farmInfoMapper.insert(entity);
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
    public FarmInfoEntity update(String id, FarmInfoEntity entity) {
        entity.setFarmId(id);
        farmInfoMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        farmInfoMapper.deleteById(id);
    }

    /** 汇总统计：农场数量 + 总面积（看板聚合用） */
    public Map<String, Object> summary() {
        List<FarmInfoEntity> all = farmInfoMapper.selectList(new LambdaQueryWrapper<FarmInfoEntity>()
                .eq(FarmInfoEntity::getStatus, 1));
        BigDecimal area = BigDecimal.ZERO;
        for (FarmInfoEntity farm : all) {
            if (farm.getAreaTotal() != null) {
                area = area.add(farm.getAreaTotal());
            }
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("farmCount", all.size());
        result.put("areaTotal", area);
        return result;
    }

    /** 全量启用农场（下拉选择） */
    public List<FarmInfoEntity> listAll() {
        return farmInfoMapper.selectList(new LambdaQueryWrapper<FarmInfoEntity>()
                .eq(FarmInfoEntity::getStatus, 1)
                .orderByAsc(FarmInfoEntity::getFarmCode));
    }

    /** 启停农场 */
    @Transactional
    public FarmInfoEntity changeStatus(String farmId, Integer status) {
        FarmInfoEntity farm = detail(farmId);
        farm.setStatus(status == null ? 0 : status);
        farmInfoMapper.updateById(farm);
        return farm;
    }

    /** 单农场汇总：地块数 + 总面积 */
    public Map<String, Object> farmSummary(String farmId) {
        FarmInfoEntity farm = detail(farmId);
        List<PlotInfoEntity> plots = plotInfoMapper.selectList(new LambdaQueryWrapper<PlotInfoEntity>()
                .eq(PlotInfoEntity::getFarmId, farmId));
        BigDecimal area = BigDecimal.ZERO;
        for (PlotInfoEntity plot : plots) {
            if (plot.getArea() != null) {
                area = area.add(plot.getArea());
            }
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("farmId", farm.getFarmId());
        result.put("farmName", farm.getFarmName());
        result.put("areaTotal", farm.getAreaTotal());
        result.put("plotCount", plots.size());
        result.put("plotAreaTotal", area);
        return result;
    }
}

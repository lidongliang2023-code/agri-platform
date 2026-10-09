package com.agri.produce.internal.analytics;

import com.agri.produce.internal.common.ProduceIds;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 分析指标快照（产量/成本/达标率，T+1 汇聚） 应用服务。
 */
@Service
@RequiredArgsConstructor
public class AnalyticsSnapshotService {

    private static final String ID_PREFIX = "ANLS";

    private final AnalyticsSnapshotMapper analyticsSnapshotMapper;

    /**
     * 分页查询。
     *
     * @param status  状态过滤
     * @return 分页结果
     */
    public PageResult<AnalyticsSnapshotEntity> page(long page, long size, Integer status) {
        Page<AnalyticsSnapshotEntity> result = analyticsSnapshotMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<AnalyticsSnapshotEntity>()
                        .eq(status != null, AnalyticsSnapshotEntity::getStatus, status)
                        .orderByDesc(AnalyticsSnapshotEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public AnalyticsSnapshotEntity detail(String id) {
        AnalyticsSnapshotEntity entity = analyticsSnapshotMapper.selectById(id);
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
    public AnalyticsSnapshotEntity create(AnalyticsSnapshotEntity entity) {
        if (entity.getSnapshotId() == null || entity.getSnapshotId().isBlank()) {
            entity.setSnapshotId(ProduceIds.newId(ID_PREFIX));
        }
        analyticsSnapshotMapper.insert(entity);
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
    public AnalyticsSnapshotEntity update(String id, AnalyticsSnapshotEntity entity) {
        entity.setSnapshotId(id);
        analyticsSnapshotMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        analyticsSnapshotMapper.deleteById(id);
    }

    /** 单指标趋势 */
    public List<AnalyticsSnapshotEntity> trend(String metricCode, LocalDate from, LocalDate to) {
        return analyticsSnapshotMapper.selectList(new LambdaQueryWrapper<AnalyticsSnapshotEntity>()
                .eq(AnalyticsSnapshotEntity::getMetricCode, metricCode)
                .ge(from != null, AnalyticsSnapshotEntity::getBizDate, from)
                .le(to != null, AnalyticsSnapshotEntity::getBizDate, to)
                .orderByAsc(AnalyticsSnapshotEntity::getBizDate));
    }

    /** 概览：按指标编码汇总最新值 */
    public Map<String, Object> overview(String farmId) {
        List<AnalyticsSnapshotEntity> list = analyticsSnapshotMapper.selectList(
                new LambdaQueryWrapper<AnalyticsSnapshotEntity>()
                        .eq(farmId != null && !farmId.isBlank(), AnalyticsSnapshotEntity::getFarmId, farmId)
                        .orderByDesc(AnalyticsSnapshotEntity::getBizDate));
        Map<String, Object> result = new LinkedHashMap<>();
        for (AnalyticsSnapshotEntity snapshot : list) {
            if (snapshot.getMetricCode() == null) {
                continue;
            }
            result.putIfAbsent(snapshot.getMetricCode(), snapshot.getMetricValue());
        }
        result.put("metricCount", list.size());
        return result;
    }

    /** 报表：按指标分组汇总 */
    public List<Map<String, Object>> reports(String metricCode) {
        List<AnalyticsSnapshotEntity> list = analyticsSnapshotMapper.selectList(
                new LambdaQueryWrapper<AnalyticsSnapshotEntity>()
                        .eq(metricCode != null && !metricCode.isBlank(),
                                AnalyticsSnapshotEntity::getMetricCode, metricCode)
                        .orderByDesc(AnalyticsSnapshotEntity::getBizDate));
        List<Map<String, Object>> result = new java.util.ArrayList<>();
        for (AnalyticsSnapshotEntity snapshot : list) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("metricCode", snapshot.getMetricCode());
            row.put("metricName", snapshot.getMetricName());
            row.put("metricValue", snapshot.getMetricValue());
            row.put("unit", snapshot.getUnit());
            row.put("bizDate", snapshot.getBizDate());
            result.add(row);
        }
        return result;
    }
}

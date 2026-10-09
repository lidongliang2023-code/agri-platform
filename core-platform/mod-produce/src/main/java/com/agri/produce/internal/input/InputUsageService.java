package com.agri.produce.internal.input;

import com.agri.core.infra.event.DomainEventPublisher;
import com.agri.produce.api.event.ProduceEvents;
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
 * 投入品使用记录（农事任务落地，溯源关键证据） 应用服务。
 */
@Service
@RequiredArgsConstructor
public class InputUsageService {

    private static final String ID_PREFIX = "IUSG";

    private final InputUsageMapper inputUsageMapper;
    private final DomainEventPublisher eventPublisher;

    /**
     * 分页查询。
     *
     * @param status  状态过滤
     * @return 分页结果
     */
    public PageResult<InputUsageEntity> page(long page, long size, Integer status) {
        Page<InputUsageEntity> result = inputUsageMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<InputUsageEntity>()
                        .eq(status != null, InputUsageEntity::getStatus, status)
                        .orderByDesc(InputUsageEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public InputUsageEntity detail(String id) {
        InputUsageEntity entity = inputUsageMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        return entity;
    }

    /**
     * 新增，缺省业务主键时自动生成；缺省使用时间取当前时间。
     *
     * <p>新增成功后在同一本地事务内发布 {@code prod.input.usage.recorded}
     * （经 Outbox 落库，ADR-003 唯一通道），驱动溯源档案、监管报送与库存扣减。</p>
     *
     * @param entity 实体
     * @return 落库后的实体
     */
    @Transactional
    public InputUsageEntity create(InputUsageEntity entity) {
        if (entity.getUsageId() == null || entity.getUsageId().isBlank()) {
            entity.setUsageId(ProduceIds.newId(ID_PREFIX));
        }
        if (entity.getUsedAt() == null) {
            entity.setUsedAt(LocalDateTime.now());
        }
        inputUsageMapper.insert(entity);

        eventPublisher.publish(ProduceEvents.PROD_INPUT_USAGE_RECORDED, entity.getUsageId(),
                new ProduceEvents.InputUsageRecorded(
                        entity.getUsageId(),
                        entity.getInputId(),
                        entity.getInputName(),
                        entity.getBatchNo(),
                        entity.getPlotId(),
                        entity.getDosage(),
                        entity.getUnit(),
                        entity.getUsedAt() == null ? null : entity.getUsedAt().toString(),
                        entity.getOperatorId(),
                        entity.getMarketId()));
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
    public InputUsageEntity update(String id, InputUsageEntity entity) {
        entity.setUsageId(id);
        inputUsageMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        inputUsageMapper.deleteById(id);
    }

    /** 任务关联的投入品使用明细 */
    public List<InputUsageEntity> listByTask(String taskId) {
        return inputUsageMapper.selectList(new LambdaQueryWrapper<InputUsageEntity>()
                .eq(InputUsageEntity::getTaskId, taskId)
                .orderByDesc(InputUsageEntity::getUsedAt));
    }

    /** 地块用药台账（溯源码回看） */
    public List<InputUsageEntity> listByPlot(String plotId) {
        return inputUsageMapper.selectList(new LambdaQueryWrapper<InputUsageEntity>()
                .eq(InputUsageEntity::getPlotId, plotId)
                .orderByDesc(InputUsageEntity::getUsedAt));
    }
}

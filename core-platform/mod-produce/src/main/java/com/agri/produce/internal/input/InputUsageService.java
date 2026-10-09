package com.agri.produce.internal.input;

import com.agri.core.infra.event.DomainEventPublisher;
import com.agri.produce.api.event.ProduceEvents;
import com.agri.produce.internal.common.ProduceIds;
import com.agri.produce.internal.plot.PlotInfoEntity;
import com.agri.produce.internal.plot.PlotInfoMapper;
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
    private final PlotInfoMapper plotInfoMapper;
    private final DomainEventPublisher eventPublisher;

    /**
     * 分页查询。
     *
     * <p>{@code farmId} 此前不在方法签名里，Spring 不报错、参数被静默丢弃，
     * 运营端农场监管详情看到的是全局数据。V10 为 {@code prod_input_usage} 补了
     * {@code farm_id} 列后落成真实 SQL 条件，为空时不加条件（行为不变）。</p>
     *
     * @param farmId 所属农场过滤，为空不过滤
     * @param status 状态过滤
     * @return 分页结果
     */
    public PageResult<InputUsageEntity> page(long page, long size, String farmId, Integer status) {
        Page<InputUsageEntity> result = inputUsageMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<InputUsageEntity>()
                        .eq(farmId != null && !farmId.isBlank(), InputUsageEntity::getFarmId, farmId)
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
     * <p><b>farmId 兜底推导。</b>前端 {@code src/api/inputs.ts createUsage} 的入参里
     * 没有 farmId，若只等前端传，V10 新增的 {@code farm_id} 列会永远填不上、按农场筛选
     * 永远查不到 —— 等于加了个死列。因此在落库前用 {@code plotId} 反查
     * {@code prod_plot_info.farm_id} 补上；显式传了 farmId 就以传入值为准，
     * 推导不到（未挂地块或地块已逻辑删除）保持 null，不报错、不猜、不填占位值。</p>
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
        if ((entity.getFarmId() == null || entity.getFarmId().isBlank())
                && entity.getPlotId() != null && !entity.getPlotId().isBlank()) {
            PlotInfoEntity plot = plotInfoMapper.selectById(entity.getPlotId());
            if (plot != null) {
                entity.setFarmId(plot.getFarmId());
            }
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

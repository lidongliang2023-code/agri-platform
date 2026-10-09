package com.agri.produce.internal.iot;

import com.agri.produce.internal.common.ProduceIds;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * IoT 设备绑定关系 应用服务。
 *
 * <p>绑定对象支持 {@code PLOT}（地块）/ {@code GREENHOUSE}（大棚）/ {@code FARM}（农场）；
 * 采集指标在库内逗号分隔存放，对外经 {@link IotBindingVO} 暴露为数组。</p>
 *
 * <p><b>删除语义约定：</b>绑定关系<strong>只做状态流转（BOUND/UNBOUND/PAUSED），永不删除</strong>，
 * 解绑记录保留以便审计。库表唯一键为 {@code (device_id, bind_type, bind_target_id, deleted)}，
 * 带上 {@code deleted} 是为了让「解绑后重新绑定同一对象」或「软删后重建」不撞唯一键冲突。</p>
 */
@Service
@RequiredArgsConstructor
public class IotBindingService {

    private static final String ID_PREFIX = "BIND";

    private final IotBindingMapper iotBindingMapper;
    private final IotDeviceService iotDeviceService;
    private final com.agri.produce.internal.plot.PlotInfoService plotInfoService;
    private final com.agri.produce.internal.farm.FarmInfoService farmInfoService;

    /**
     * 建立（或重新激活）绑定关系。
     *
     * <p>同一「设备 + 绑定类型 + 绑定对象」唯一；若已存在历史绑定则重新置为 BOUND，
     * 避免唯一键冲突。</p>
     *
     * @param deviceId      设备业务主键
     * @param bindType      绑定对象类型 PLOT/GREENHOUSE/FARM
     * @param bindTargetId  绑定对象ID
     * @param bindTargetName 绑定对象名称，可为空（缺省回退为对象ID）
     * @param metrics       采集指标，可为空
     * @param frequency     采集频率（分钟），可为空
     * @return 绑定关系视图对象
     */
    @Transactional
    public IotBindingVO bind(String deviceId, String bindType, String bindTargetId,
                             String bindTargetName, String metrics, Integer frequency) {
        // 校验一：设备必须存在（不存在时 detail 抛 NOT_FOUND）
        IotDeviceEntity device = iotDeviceService.detail(deviceId);
        // 校验二：绑定对象必须存在，避免把设备绑到一个不存在的地块/农场上
        assertTargetExists(bindType, bindTargetId);

        IotBindingEntity existing = iotBindingMapper.selectOne(new LambdaQueryWrapper<IotBindingEntity>()
                .eq(IotBindingEntity::getDeviceId, device.getDeviceId())
                .eq(IotBindingEntity::getBindType, bindType)
                .eq(IotBindingEntity::getBindTargetId, bindTargetId)
                .last("LIMIT 1"));

        IotBindingEntity entity = existing != null ? existing : new IotBindingEntity();
        if (existing == null) {
            entity.setBindingId(ProduceIds.newId(ID_PREFIX));
            entity.setDeviceId(device.getDeviceId());
            entity.setBindType(bindType);
            entity.setBindTargetId(bindTargetId);
        }
        entity.setDeviceCode(device.getDeviceCode());
        entity.setDeviceName(device.getDeviceName());
        entity.setBindTargetName(bindTargetName == null || bindTargetName.isBlank()
                ? bindTargetId : bindTargetName);
        entity.setMetrics(metrics);
        entity.setFrequency(frequency);
        entity.setStatus(IotBindingEntity.STATUS_BOUND);
        entity.setBoundAt(LocalDateTime.now());

        if (existing == null) {
            iotBindingMapper.insert(entity);
        } else {
            iotBindingMapper.updateById(entity);
        }
        return IotBindingVO.of(entity);
    }

    /**
     * 批量绑定：整批一个事务，逐条复用 {@link #bind} 的完整校验，逐条返回结果。
     *
     * <p>单条失败<strong>不影响</strong>其余条目——运营一次绑 20 台，不应因为第 17 台重复
     * 就把前 16 台一起作废。这里捕获每条的异常转成失败原因，因此不会触发整批回滚。</p>
     *
     * @param bindType     绑定对象类型 PLOT/GREENHOUSE/FARM
     * @param bindTargetId 绑定对象ID
     * @param deviceIds    设备业务主键列表
     * @param targetName   绑定对象名称，可为空
     * @param metrics      采集指标，可为空
     * @param frequency    采集频率（分钟），可为空
     * @return 逐条结果（顺序与入参一致）
     */
    @Transactional
    public java.util.List<IotBindingBatchResult> batchBind(String bindType, String bindTargetId,
                                                           java.util.List<String> deviceIds,
                                                           String targetName, String metrics,
                                                           Integer frequency) {
        if (deviceIds == null || deviceIds.isEmpty()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "deviceIds 不能为空");
        }
        // 目标存在性先于逐条执行校验一次即可，避免同一错误重复 N 遍
        assertTargetExists(bindType, bindTargetId);

        java.util.List<IotBindingBatchResult> results = new java.util.ArrayList<>(deviceIds.size());
        for (String deviceId : deviceIds) {
            if (deviceId == null || deviceId.isBlank()) {
                results.add(IotBindingBatchResult.fail(deviceId, "设备ID为空"));
                continue;
            }
            try {
                IotBindingVO vo = bind(deviceId, bindType, bindTargetId, targetName, metrics, frequency);
                results.add(IotBindingBatchResult.ok(deviceId, vo.getBindingId()));
            } catch (BusinessException ex) {
                results.add(IotBindingBatchResult.fail(deviceId, ex.getMessage()));
            } catch (RuntimeException ex) {
                results.add(IotBindingBatchResult.fail(deviceId, "绑定失败：" + ex.getMessage()));
            }
        }
        return results;
    }

    /**
     * 校验绑定对象是否存在。
     *
     * <p>{@code PLOT} 校验权威地块表 {@code prod_plot_info}（<b>不是</b>遗留孤儿表 {@code prod_plot}）；
     * {@code FARM} 校验 {@code prod_farm_info}；
     * {@code GREENHOUSE} 当前<strong>无对应档案表</strong>，无法校验，直接放行（不误杀）。</p>
     *
     * @param bindType     绑定对象类型
     * @param bindTargetId 绑定对象ID
     */
    private void assertTargetExists(String bindType, String bindTargetId) {
        if (bindType == null || bindType.isBlank() || bindTargetId == null || bindTargetId.isBlank()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "bindType 与 bindTargetId 不能为空");
        }
        String type = bindType.trim().toUpperCase(java.util.Locale.ROOT);
        switch (type) {
            case IotBindingEntity.BIND_TYPE_PLOT -> plotInfoService.detail(bindTargetId);
            case IotBindingEntity.BIND_TYPE_FARM -> farmInfoService.detail(bindTargetId);
            case IotBindingEntity.BIND_TYPE_GREENHOUSE -> {
                // 大棚暂无档案表，无法校验存在性，放行
            }
            default -> throw new BusinessException(ErrorCode.BAD_REQUEST,
                    "不支持的绑定对象类型：" + bindType + "，可选 PLOT / GREENHOUSE / FARM");
        }
    }

    /**
     * 解绑：状态置为 UNBOUND（记录保留，便于审计）。
     *
     * @param bindingId 绑定关系业务主键
     * @return 更新后的视图对象
     */
    @Transactional
    public IotBindingVO unbind(String bindingId) {
        return changeStatus(bindingId, IotBindingEntity.STATUS_UNBOUND);
    }

    /**
     * 变更绑定状态（BOUND/UNBOUND/PAUSED）。
     *
     * @param bindingId 绑定关系业务主键
     * @param status    目标状态
     * @return 更新后的视图对象
     */
    @Transactional
    public IotBindingVO changeStatus(String bindingId, String status) {
        IotBindingEntity entity = detail(bindingId);
        entity.setStatus(status);
        iotBindingMapper.updateById(entity);
        return IotBindingVO.of(entity);
    }

    /**
     * 绑定关系详情，不存在抛 NOT_FOUND。
     *
     * @param bindingId 绑定关系业务主键
     * @return 实体
     */
    public IotBindingEntity detail(String bindingId) {
        IotBindingEntity entity = iotBindingMapper.selectById(bindingId);
        if (entity == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        return entity;
    }

    /**
     * 绑定关系查询（视图对象，采集指标为数组）。
     *
     * @param deviceId     设备业务主键，可为空
     * @param bindType     绑定对象类型，可为空
     * @param bindTargetId 绑定对象ID，可为空
     * @param status       状态过滤，为空时默认只返回 BOUND
     * @return 绑定关系列表
     */
    public List<IotBindingVO> list(String deviceId, String bindType, String bindTargetId, String status) {
        String effectiveStatus = (status == null || status.isBlank())
                ? IotBindingEntity.STATUS_BOUND : status;
        List<IotBindingEntity> entities = iotBindingMapper.selectList(
                new LambdaQueryWrapper<IotBindingEntity>()
                        .eq(deviceId != null && !deviceId.isBlank(),
                                IotBindingEntity::getDeviceId, deviceId)
                        .eq(bindType != null && !bindType.isBlank(),
                                IotBindingEntity::getBindType, bindType)
                        .eq(bindTargetId != null && !bindTargetId.isBlank(),
                                IotBindingEntity::getBindTargetId, bindTargetId)
                        .eq(IotBindingEntity::getStatus, effectiveStatus)
                        .orderByAsc(IotBindingEntity::getDeviceCode));
        return IotBindingVO.ofList(entities);
    }

    /**
     * 绑定关系分页查询（视图对象）。
     *
     * @param page     页码
     * @param size     每页条数
     * @param deviceId 设备业务主键，可为空
     * @param bindType 绑定对象类型，可为空
     * @param status   状态过滤，可为空
     * @return 分页结果
     */
    public PageResult<IotBindingVO> page(long page, long size, String deviceId, String bindType, String status) {
        Page<IotBindingEntity> result = iotBindingMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<IotBindingEntity>()
                        .eq(deviceId != null && !deviceId.isBlank(),
                                IotBindingEntity::getDeviceId, deviceId)
                        .eq(bindType != null && !bindType.isBlank(),
                                IotBindingEntity::getBindType, bindType)
                        .eq(status != null && !status.isBlank(),
                                IotBindingEntity::getStatus, status)
                        .orderByAsc(IotBindingEntity::getDeviceCode));
        return PageResult.of(IotBindingVO.ofList(result.getRecords()), result.getTotal(), page, size);
    }
}

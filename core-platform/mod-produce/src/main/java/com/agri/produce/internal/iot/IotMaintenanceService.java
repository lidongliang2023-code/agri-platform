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
 * IoT 设备维修记录 应用服务。
 */
@Service
@RequiredArgsConstructor
public class IotMaintenanceService {

    private static final String ID_PREFIX = "MNTN";

    private final IotMaintenanceMapper iotMaintenanceMapper;
    private final IotDeviceService iotDeviceService;

    /**
     * 新增维修记录（自动补齐设备编码与缺省维修时间）。
     *
     * @param deviceId 设备业务主键
     * @param entity   维修记录内容
     * @return 落库后的实体
     */
    @Transactional
    public IotMaintenanceEntity create(String deviceId, IotMaintenanceEntity entity) {
        IotDeviceEntity device = iotDeviceService.detail(deviceId);
        if (entity.getMaintainId() == null || entity.getMaintainId().isBlank()) {
            entity.setMaintainId(ProduceIds.newId(ID_PREFIX));
        }
        entity.setDeviceId(device.getDeviceId());
        if (entity.getDeviceCode() == null || entity.getDeviceCode().isBlank()) {
            entity.setDeviceCode(device.getDeviceCode());
        }
        if (entity.getMaintainAt() == null) {
            entity.setMaintainAt(LocalDateTime.now());
        }
        iotMaintenanceMapper.insert(entity);
        return entity;
    }

    /**
     * 维修记录详情，不存在抛 NOT_FOUND。
     *
     * @param maintainId 维修记录业务主键
     * @return 实体
     */
    public IotMaintenanceEntity detail(String maintainId) {
        IotMaintenanceEntity entity = iotMaintenanceMapper.selectById(maintainId);
        if (entity == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        return entity;
    }

    /**
     * 更新维修记录（以路径上的业务主键为准）。
     *
     * @param maintainId 维修记录业务主键
     * @param entity     待更新内容
     * @return 更新后的实体
     */
    @Transactional
    public IotMaintenanceEntity update(String maintainId, IotMaintenanceEntity entity) {
        entity.setMaintainId(maintainId);
        iotMaintenanceMapper.updateById(entity);
        return detail(maintainId);
    }

    /**
     * 逻辑删除维修记录。
     *
     * @param maintainId 维修记录业务主键
     */
    @Transactional
    public void delete(String maintainId) {
        iotMaintenanceMapper.deleteById(maintainId);
    }

    /**
     * 指定设备的维修记录（按维修时间倒序）。
     *
     * @param deviceId 设备业务主键
     * @param limit    返回条数上限，默认 100
     * @return 维修记录列表
     */
    public List<IotMaintenanceEntity> listByDevice(String deviceId, Integer limit) {
        int max = (limit == null || limit <= 0) ? 100 : Math.min(limit, 500);
        return iotMaintenanceMapper.selectList(new LambdaQueryWrapper<IotMaintenanceEntity>()
                .eq(IotMaintenanceEntity::getDeviceId, deviceId)
                .orderByDesc(IotMaintenanceEntity::getMaintainAt)
                .last("LIMIT " + max));
    }

    /**
     * 维修记录分页查询。
     *
     * @param page     页码
     * @param size     每页条数
     * @param deviceId 设备业务主键，可为空
     * @return 分页结果
     */
    public PageResult<IotMaintenanceEntity> page(long page, long size, String deviceId) {
        Page<IotMaintenanceEntity> result = iotMaintenanceMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<IotMaintenanceEntity>()
                        .eq(deviceId != null && !deviceId.isBlank(),
                                IotMaintenanceEntity::getDeviceId, deviceId)
                        .orderByDesc(IotMaintenanceEntity::getMaintainAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }
}

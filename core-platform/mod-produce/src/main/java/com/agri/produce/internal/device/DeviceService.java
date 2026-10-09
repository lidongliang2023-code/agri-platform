package com.agri.produce.internal.device;

import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 设备档案应用服务（连接与采集在 satellite-iot，此处只维护档案与在线状态）。
 */
@Service
@RequiredArgsConstructor
public class DeviceService {

    private final DeviceMapper deviceMapper;

    /**
     * 分页查询设备档案。
     *
     * @param page   页码
     * @param size   每页条数
     * @param type   设备类型过滤（SENSOR/CONTROLLER/CAMERA）
     * @param status 在线状态过滤
     * @return 分页结果
     */
    public PageResult<DeviceEntity> page(long page, long size, String type, Integer status) {
        Page<DeviceEntity> result = deviceMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<DeviceEntity>()
                        .eq(type != null && !type.isBlank(), DeviceEntity::getType, type)
                        .eq(status != null, DeviceEntity::getStatus, status)
                        .orderByDesc(DeviceEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 设备详情。
     *
     * @param id 主键
     * @return 设备档案
     */
    public DeviceEntity detail(Long id) {
        DeviceEntity device = deviceMapper.selectById(id);
        if (device == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        return device;
    }

    /**
     * 登记设备档案，默认离线。
     *
     * @param deviceNo 设备编号
     * @param name     设备名称
     * @param type     设备类型
     * @param plotId   绑定地块
     * @return 落库后的设备档案
     */
    @Transactional
    public DeviceEntity create(String deviceNo, String name, String type, Long plotId) {
        DeviceEntity device = new DeviceEntity();
        device.setDeviceNo(deviceNo);
        device.setName(name);
        device.setType(type);
        device.setPlotId(plotId);
        device.setStatus(0);
        deviceMapper.insert(device);
        return device;
    }

    /**
     * 更新设备档案。
     *
     * @param id     主键
     * @param device 待更新内容
     * @return 更新后的档案
     */
    @Transactional
    public DeviceEntity update(Long id, DeviceEntity device) {
        detail(id);
        device.setId(id);
        deviceMapper.updateById(device);
        return detail(id);
    }

    /**
     * 删除设备档案。
     *
     * @param id 主键
     */
    @Transactional
    public void delete(Long id) {
        deviceMapper.deleteById(id);
    }

    /**
     * 在线状态变更（卫星服务回传）。
     *
     * @param id     主键
     * @param online 是否在线
     * @return 更新后的档案
     */
    @Transactional
    public DeviceEntity online(Long id, boolean online) {
        DeviceEntity device = detail(id);
        device.setStatus(online ? 1 : 0);
        deviceMapper.updateById(device);
        return device;
    }

    /**
     * 地块下的设备清单。
     *
     * @param plotId 地块ID
     * @return 设备列表
     */
    public List<DeviceEntity> listByPlot(Long plotId) {
        return deviceMapper.selectList(new LambdaQueryWrapper<DeviceEntity>()
                .eq(DeviceEntity::getPlotId, plotId)
                .orderByAsc(DeviceEntity::getDeviceNo));
    }
}

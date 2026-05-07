package com.agri.iot.service.impl;

import com.agri.common.entity.PageResult;
import com.agri.common.exception.BusinessException;
import com.agri.common.security.SecurityUtils;
import com.agri.common.util.BeanCopyUtils;
import com.agri.iot.dto.DevicePageDTO;
import com.agri.iot.dto.DeviceSaveDTO;
import com.agri.iot.dto.DeviceUpdateDTO;
import com.agri.iot.entity.Device;
import com.agri.iot.mapper.DeviceMapper;
import com.agri.iot.service.IDeviceService;
import com.agri.iot.vo.DeviceVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class DeviceServiceImpl implements IDeviceService {

    private final DeviceMapper deviceMapper;

    @Override
    public PageResult<DeviceVO> page(DevicePageDTO dto) {
        dto.setPageNum((dto.getPageNum() - 1) * dto.getPageSize());
        List<DeviceVO> list = deviceMapper.selectDevicePage(dto);
        long count = deviceMapper.selectDeviceCount(dto);
        return new PageResult<>(list, count, (long) (dto.getPageNum() / dto.getPageSize() + 1), (long) dto.getPageSize());
    }

    @Override
    public DeviceVO getById(Long id) {
        return deviceMapper.selectDeviceById(id);
    }

    @Override
    @Transactional
    public void save(DeviceSaveDTO dto) {
        Device existing = deviceMapper.selectByDeviceCode(dto.getDeviceCode());
        if (existing != null) {
            throw new BusinessException("设备编码已存在");
        }

        Device device = BeanCopyUtils.copy(dto, Device.class);
        device.setTenantId(SecurityUtils.getTenantId());
        device.setCreateBy(SecurityUtils.getUsername());
        device.setDelFlag(0);
        deviceMapper.insert(device);
    }

    @Override
    @Transactional
    public void update(Long id, DeviceUpdateDTO dto) {
        Device device = deviceMapper.selectById(id);
        if (device == null || device.getDelFlag() == 1) {
            throw new BusinessException("设备不存在");
        }

        if (dto.getDeviceCode() != null && !dto.getDeviceCode().equals(device.getDeviceCode())) {
            Device existing = deviceMapper.selectByDeviceCode(dto.getDeviceCode());
            if (existing != null && !existing.getId().equals(id)) {
                throw new BusinessException("设备编码已存在");
            }
        }

        BeanCopyUtils.copyProperties(dto, device);
        device.setUpdateBy(SecurityUtils.getUsername());
        deviceMapper.updateById(device);
    }

    @Override
    @Transactional
    public void delete(Long id) {
        Device device = deviceMapper.selectById(id);
        if (device == null || device.getDelFlag() == 1) {
            throw new BusinessException("设备不存在");
        }

        device.setDelFlag(1);
        device.setUpdateBy(SecurityUtils.getUsername());
        deviceMapper.updateById(device);
    }
}

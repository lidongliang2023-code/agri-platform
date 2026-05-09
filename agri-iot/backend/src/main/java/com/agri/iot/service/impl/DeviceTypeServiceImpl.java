package com.agri.iot.service.impl;

import com.agri.common.entity.PageResult;
import com.agri.common.exception.BusinessException;
import com.agri.common.security.SecurityUtils;
import com.agri.common.util.BeanCopyUtils;
import com.agri.iot.dto.DeviceTypePageDTO;
import com.agri.iot.dto.DeviceTypeSaveDTO;
import com.agri.iot.dto.DeviceTypeUpdateDTO;
import com.agri.iot.entity.DeviceType;
import com.agri.iot.mapper.DeviceTypeMapper;
import com.agri.iot.service.IDeviceTypeService;
import com.agri.iot.vo.DeviceTypeVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class DeviceTypeServiceImpl implements IDeviceTypeService {

    private final DeviceTypeMapper deviceTypeMapper;

    @Override
    public PageResult<DeviceTypeVO> page(DeviceTypePageDTO dto) {
        dto.setPageNum((dto.getPageNum() - 1) * dto.getPageSize());
        List<DeviceTypeVO> list = deviceTypeMapper.selectPageVO(dto);
        long count = deviceTypeMapper.selectCount(dto);
        return new PageResult<>(list, count, (long) (dto.getPageNum() / dto.getPageSize() + 1), (long) dto.getPageSize());
    }

    @Override
    public DeviceTypeVO getById(Long id) {
        return deviceTypeMapper.selectVOById(id);
    }

    @Override
    @Transactional
    public void save(DeviceTypeSaveDTO dto) {
        DeviceType existing = deviceTypeMapper.selectByTypeCode(dto.getTypeCode());
        if (existing != null) {
            throw new BusinessException("类型编码已存在");
        }

        DeviceType deviceType = BeanCopyUtils.copy(dto, DeviceType.class);
        deviceType.setTenantId(SecurityUtils.getTenantId());
        deviceType.setCreateBy(SecurityUtils.getUsername());
        deviceType.setDelFlag(0);
        deviceTypeMapper.insert(deviceType);
    }

    @Override
    @Transactional
    public void update(Long id, DeviceTypeUpdateDTO dto) {
        DeviceType deviceType = deviceTypeMapper.selectById(id);
        if (deviceType == null || deviceType.getDelFlag() == 1) {
            throw new BusinessException("设备类型不存在");
        }

        if (dto.getTypeCode() != null && !dto.getTypeCode().equals(deviceType.getTypeCode())) {
            DeviceType existing = deviceTypeMapper.selectByTypeCode(dto.getTypeCode());
            if (existing != null && !existing.getId().equals(id)) {
                throw new BusinessException("类型编码已存在");
            }
        }

        BeanCopyUtils.copyProperties(dto, deviceType);
        deviceType.setUpdateBy(SecurityUtils.getUsername());
        deviceTypeMapper.updateById(deviceType);
    }

    @Override
    @Transactional
    public void delete(Long id) {
        DeviceType deviceType = deviceTypeMapper.selectById(id);
        if (deviceType == null || deviceType.getDelFlag() == 1) {
            throw new BusinessException("设备类型不存在");
        }

        deviceType.setDelFlag(1);
        deviceType.setUpdateBy(SecurityUtils.getUsername());
        deviceTypeMapper.updateById(deviceType);
    }

    @Override
    public List<DeviceTypeVO> listAll() {
        return deviceTypeMapper.selectAllVO();
    }
}
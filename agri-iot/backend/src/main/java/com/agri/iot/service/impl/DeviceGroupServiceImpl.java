
package com.agri.iot.service.impl;

import com.agri.common.exception.BusinessException;
import com.agri.common.security.SecurityUtils;
import com.agri.common.util.BeanCopyUtils;
import com.agri.iot.dto.DeviceGroupSaveDTO;
import com.agri.iot.dto.DeviceGroupUpdateDTO;
import com.agri.iot.entity.DeviceGroup;
import com.agri.iot.entity.DeviceGroupRelation;
import com.agri.iot.mapper.DeviceGroupMapper;
import com.agri.iot.service.IDeviceGroupService;
import com.agri.iot.vo.DeviceGroupVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class DeviceGroupServiceImpl implements IDeviceGroupService {

    private final DeviceGroupMapper deviceGroupMapper;

    @Override
    public List<DeviceGroupVO> list() {
        return deviceGroupMapper.selectGroupList(SecurityUtils.getTenantId());
    }

    @Override
    public DeviceGroupVO getById(Long id) {
        return deviceGroupMapper.selectGroupById(id);
    }

    @Override
    @Transactional
    public void save(DeviceGroupSaveDTO dto) {
        DeviceGroup group = BeanCopyUtils.copy(dto, DeviceGroup.class);
        group.setTenantId(SecurityUtils.getTenantId());
        group.setCreateBy(SecurityUtils.getUsername());
        group.setIsPreset(0);
        group.setStatus(1);
        deviceGroupMapper.insert(group);

        if (dto.getDeviceIds() != null && !dto.getDeviceIds().isEmpty()) {
            for (Long deviceId : dto.getDeviceIds()) {
                DeviceGroupRelation relation = new DeviceGroupRelation();
                relation.setGroupId(group.getId());
                relation.setDeviceId(deviceId);
                relation.setTenantId(SecurityUtils.getTenantId());
                relation.setCreateBy(SecurityUtils.getUsername());
                deviceGroupMapper.insertRelation(relation);
            }
        }
    }

    @Override
    @Transactional
    public void update(Long id, DeviceGroupUpdateDTO dto) {
        DeviceGroup group = new DeviceGroup();
        group.setId(id);
        BeanCopyUtils.copyProperties(dto, group);
        group.setUpdateBy(SecurityUtils.getUsername());
        deviceGroupMapper.update(group);
    }

    @Override
    @Transactional
    public void delete(Long id) {
        DeviceGroupVO group = deviceGroupMapper.selectGroupById(id);
        if (group == null) {
            throw new BusinessException("分组不存在");
        }
        if (group.getIsPreset() == 1) {
            throw new BusinessException("系统预置分组不能删除");
        }
        deviceGroupMapper.deleteRelationByGroupId(id);
        deviceGroupMapper.deleteById(id);
    }

    @Override
    @Transactional
    public void addDevices(Long groupId, List<Long> deviceIds) {
        DeviceGroupVO group = deviceGroupMapper.selectGroupById(groupId);
        if (group == null) {
            throw new BusinessException("分组不存在");
        }
        for (Long deviceId : deviceIds) {
            DeviceGroupRelation relation = new DeviceGroupRelation();
            relation.setGroupId(groupId);
            relation.setDeviceId(deviceId);
            relation.setTenantId(SecurityUtils.getTenantId());
            relation.setCreateBy(SecurityUtils.getUsername());
            deviceGroupMapper.insertRelation(relation);
        }
    }

    @Override
    @Transactional
    public void removeDevices(Long groupId, List<Long> deviceIds) {
        for (Long deviceId : deviceIds) {
            deviceGroupMapper.deleteRelationByDeviceId(deviceId);
        }
    }

    @Override
    public void batchControl(Long groupId, String command) {
        DeviceGroupVO group = deviceGroupMapper.selectGroupById(groupId);
        if (group == null) {
            throw new BusinessException("分组不存在");
        }
    }
}

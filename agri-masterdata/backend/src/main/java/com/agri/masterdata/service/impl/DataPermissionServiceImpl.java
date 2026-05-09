package com.agri.masterdata.service.impl;

import com.agri.common.util.BeanCopyUtils;
import com.agri.masterdata.dto.DataPermissionSaveDTO;
import com.agri.masterdata.entity.DataPermission;
import com.agri.masterdata.mapper.DataPermissionMapper;
import com.agri.masterdata.service.IDataPermissionService;
import com.agri.masterdata.vo.DataPermissionVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DataPermissionServiceImpl implements IDataPermissionService {

    private final DataPermissionMapper dataPermissionMapper;

    @Override
    @Transactional
    public void save(DataPermissionSaveDTO dto) {
        DataPermission dataPermission = BeanCopyUtils.copy(dto, DataPermission.class);
        dataPermission.setDpId(UUID.randomUUID().toString());
        dataPermission.setCreateTime(LocalDateTime.now());
        dataPermissionMapper.insert(dataPermission);
    }

    @Override
    @Transactional
    public void update(String dpId, DataPermissionSaveDTO dto) {
        DataPermission dataPermission = dataPermissionMapper.selectById(dpId);
        if (dataPermission == null) {
            throw new IllegalArgumentException("数据权限配置不存在");
        }
        BeanCopyUtils.copyProperties(dto, dataPermission);
        dataPermissionMapper.update(dataPermission);
    }

    @Override
    @Transactional
    public void delete(String dpId) {
        dataPermissionMapper.deleteById(dpId);
    }

    @Override
    @Transactional
    public void deleteByRoleId(String roleId) {
        dataPermissionMapper.deleteByRoleId(roleId);
    }

    @Override
    public DataPermissionVO getById(String dpId) {
        DataPermission dataPermission = dataPermissionMapper.selectById(dpId);
        if (dataPermission == null) {
            return null;
        }
        return BeanCopyUtils.copy(dataPermission, DataPermissionVO.class);
    }

    @Override
    public List<DataPermissionVO> getByRoleId(String roleId) {
        List<DataPermission> list = dataPermissionMapper.selectByRoleId(roleId);
        return BeanCopyUtils.copyList(list, DataPermissionVO.class);
    }

    @Override
    public List<DataPermissionVO> getByModuleType(String moduleType) {
        List<DataPermission> list = dataPermissionMapper.selectByModuleType(moduleType);
        return BeanCopyUtils.copyList(list, DataPermissionVO.class);
    }

    @Override
    @Transactional
    public void saveBatch(List<DataPermissionSaveDTO> list) {
        for (DataPermissionSaveDTO dto : list) {
            save(dto);
        }
    }
}
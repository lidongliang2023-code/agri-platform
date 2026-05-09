package com.agri.masterdata.service;

import com.agri.masterdata.dto.DataPermissionSaveDTO;
import com.agri.masterdata.vo.DataPermissionVO;

import java.util.List;

public interface IDataPermissionService {

    void save(DataPermissionSaveDTO dto);

    void update(String dpId, DataPermissionSaveDTO dto);

    void delete(String dpId);

    void deleteByRoleId(String roleId);

    DataPermissionVO getById(String dpId);

    List<DataPermissionVO> getByRoleId(String roleId);

    List<DataPermissionVO> getByModuleType(String moduleType);

    void saveBatch(List<DataPermissionSaveDTO> list);
}
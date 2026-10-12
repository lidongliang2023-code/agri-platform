package com.agri.masterdata.service;

import com.agri.common.entity.PageResult;
import com.agri.masterdata.dto.RolePageDTO;
import com.agri.masterdata.dto.RoleSaveDTO;
import com.agri.masterdata.dto.RoleUpdateDTO;
import com.agri.masterdata.vo.RoleVO;

import java.util.List;

public interface IRoleService {

    PageResult<RoleVO> page(RolePageDTO dto);

    RoleVO getById(Long id);

    void save(RoleSaveDTO dto);

    void update(Long id, RoleUpdateDTO dto);

    void delete(Long id);

    void changeStatus(Long id, Integer status);

    List<Long> getRoleMenus(Long id);

    void assignMenus(Long id, List<Long> menuIds);

    List<RoleVO> list();
}

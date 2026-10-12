package com.agri.masterdata.service;

import com.agri.masterdata.dto.DeptSaveDTO;
import com.agri.masterdata.vo.DepartmentVO;

import java.util.List;

public interface IDepartmentService {

    List<DepartmentVO> listByOrgId(String orgId);

    List<DepartmentVO> getDeptTree(String orgId);

    DepartmentVO getById(String deptId);

    void save(String orgId, DeptSaveDTO dto);

    void update(String deptId, DeptSaveDTO dto);

    void delete(String deptId);
}
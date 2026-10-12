package com.agri.masterdata.mapper;

import com.agri.masterdata.entity.Department;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface DepartmentMapper extends BaseMapper<Department> {

    List<Department> selectByOrgId(String orgId);

    List<Department> selectByParentDeptId(String parentDeptId);

    List<Department> selectDeptTree(String orgId);
}
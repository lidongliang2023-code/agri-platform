package com.agri.masterdata.service.impl;

import com.agri.common.exception.BusinessException;
import com.agri.masterdata.dto.DeptSaveDTO;
import com.agri.masterdata.entity.Department;
import com.agri.masterdata.mapper.DepartmentMapper;
import com.agri.masterdata.service.IDepartmentService;
import com.agri.masterdata.vo.DepartmentVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DepartmentServiceImpl implements IDepartmentService {

    private final DepartmentMapper departmentMapper;

    private static final Map<String, String> STATUS_MAP = Map.of(
            "active", "正常",
            "inactive", "停用"
    );

    @Override
    public List<DepartmentVO> listByOrgId(String orgId) {
        List<Department> departments = departmentMapper.selectByOrgId(orgId);
        return departments.stream().map(this::convertToVO).collect(Collectors.toList());
    }

    @Override
    public List<DepartmentVO> getDeptTree(String orgId) {
        List<Department> departments = departmentMapper.selectByOrgId(orgId);
        return buildTree(departments, null);
    }

    @Override
    public DepartmentVO getById(String deptId) {
        Department department = departmentMapper.selectById(deptId);
        if (department == null) {
            throw new BusinessException("部门不存在");
        }
        return convertToVO(department);
    }

    @Override
    @Transactional
    public void save(String orgId, DeptSaveDTO dto) {
        LambdaQueryWrapper<Department> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Department::getOrgId, orgId)
                .eq(Department::getDeptCode, dto.getDeptCode());
        if (departmentMapper.exists(wrapper)) {
            throw new BusinessException("部门编码已存在");
        }

        Department department = new Department();
        department.setDeptCode(dto.getDeptCode());
        department.setDeptName(dto.getDeptName());
        department.setParentDeptId(dto.getParentDeptId());
        department.setOrgId(orgId);
        department.setDeptManager(dto.getDeptManager());
        department.setContactPhone(dto.getContactPhone());
        department.setDeptCount(0);
        department.setStatus("active");

        departmentMapper.insert(department);
    }

    @Override
    @Transactional
    public void update(String deptId, DeptSaveDTO dto) {
        Department department = departmentMapper.selectById(deptId);
        if (department == null) {
            throw new BusinessException("部门不存在");
        }

        LambdaQueryWrapper<Department> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Department::getDeptCode, dto.getDeptCode())
                .ne(Department::getDeptId, deptId);
        if (departmentMapper.exists(wrapper)) {
            throw new BusinessException("部门编码已存在");
        }

        department.setDeptCode(dto.getDeptCode());
        department.setDeptName(dto.getDeptName());
        department.setParentDeptId(dto.getParentDeptId());
        department.setDeptManager(dto.getDeptManager());
        department.setContactPhone(dto.getContactPhone());

        departmentMapper.updateById(department);
    }

    @Override
    @Transactional
    public void delete(String deptId) {
        Department department = departmentMapper.selectById(deptId);
        if (department == null) {
            throw new BusinessException("部门不存在");
        }

        LambdaQueryWrapper<Department> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Department::getParentDeptId, deptId);
        if (departmentMapper.exists(wrapper)) {
            throw new BusinessException("存在子部门，无法删除");
        }

        departmentMapper.deleteById(deptId);
    }

    private List<DepartmentVO> buildTree(List<Department> departments, String parentDeptId) {
        List<DepartmentVO> tree = new ArrayList<>();
        for (Department dept : departments) {
            if ((parentDeptId == null && dept.getParentDeptId() == null) ||
                    (parentDeptId != null && parentDeptId.equals(dept.getParentDeptId()))) {
                DepartmentVO vo = convertToVO(dept);
                vo.setChildren(buildTree(departments, dept.getDeptId()));
                tree.add(vo);
            }
        }
        return tree;
    }

    private DepartmentVO convertToVO(Department entity) {
        DepartmentVO vo = new DepartmentVO();
        vo.setDeptId(entity.getDeptId());
        vo.setDeptCode(entity.getDeptCode());
        vo.setDeptName(entity.getDeptName());
        vo.setParentDeptId(entity.getParentDeptId());
        vo.setOrgId(entity.getOrgId());
        vo.setDeptManager(entity.getDeptManager());
        vo.setContactPhone(entity.getContactPhone());
        vo.setDeptCount(entity.getDeptCount());
        vo.setStatus(entity.getStatus());
        vo.setStatusName(STATUS_MAP.getOrDefault(entity.getStatus(), entity.getStatus()));
        vo.setCreateTime(entity.getCreateTime());
        return vo;
    }
}
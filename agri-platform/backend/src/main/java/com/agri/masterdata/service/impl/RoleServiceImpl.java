package com.agri.masterdata.service.impl;

import com.agri.common.entity.PageResult;
import com.agri.common.exception.BusinessException;
import com.agri.common.security.SecurityUtils;
import com.agri.common.util.BeanCopyUtils;
import com.agri.masterdata.dto.RolePageDTO;
import com.agri.masterdata.dto.RoleSaveDTO;
import com.agri.masterdata.dto.RoleUpdateDTO;
import com.agri.masterdata.entity.Role;
import com.agri.masterdata.mapper.RoleMapper;
import com.agri.masterdata.service.IRoleService;
import com.agri.masterdata.vo.RoleVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class RoleServiceImpl implements IRoleService {

    private final RoleMapper roleMapper;

    @Override
    public PageResult<RoleVO> page(RolePageDTO dto) {
        dto.setPageNum((dto.getPageNum() - 1) * dto.getPageSize());
        List<RoleVO> list = roleMapper.selectRolePage(dto);
        long count = roleMapper.selectRoleCount(dto);
        return new PageResult<>(list, count, (long) (dto.getPageNum() / dto.getPageSize() + 1), (long) dto.getPageSize());
    }

    @Override
    public RoleVO getById(Long id) {
        return roleMapper.selectRoleById(id);
    }

    @Override
    @Transactional
    public void save(RoleSaveDTO dto) {
        Role existing = roleMapper.selectByRoleCode(dto.getRoleCode());
        if (existing != null) {
            throw new BusinessException("角色编码已存在");
        }

        Role role = BeanCopyUtils.copy(dto, Role.class);
        role.setTenantId(SecurityUtils.getTenantId());
        role.setCreateBy(SecurityUtils.getUsername());
        role.setStatus(dto.getStatus() != null ? dto.getStatus() : 1);
        role.setDelFlag(0);
        roleMapper.insert(role);
    }

    @Override
    @Transactional
    public void update(Long id, RoleUpdateDTO dto) {
        Role role = roleMapper.selectById(id);
        if (role == null || role.getDelFlag() == 1) {
            throw new BusinessException("角色不存在");
        }

        BeanCopyUtils.copyProperties(dto, role);
        role.setUpdateBy(SecurityUtils.getUsername());
        roleMapper.updateById(role);
    }

    @Override
    @Transactional
    public void delete(Long id) {
        Role role = roleMapper.selectById(id);
        if (role == null || role.getDelFlag() == 1) {
            throw new BusinessException("角色不存在");
        }

        role.setDelFlag(1);
        role.setUpdateBy(SecurityUtils.getUsername());
        roleMapper.updateById(role);
    }

    @Override
    @Transactional
    public void changeStatus(Long id, Integer status) {
        Role role = roleMapper.selectById(id);
        if (role == null || role.getDelFlag() == 1) {
            throw new BusinessException("角色不存在");
        }

        role.setStatus(status);
        role.setUpdateBy(SecurityUtils.getUsername());
        roleMapper.updateById(role);
    }

    @Override
    public List<Long> getRoleMenus(Long id) {
        return roleMapper.selectMenuIdsByRoleId(id);
    }

    @Override
    @Transactional
    public void assignMenus(Long roleId, List<Long> menuIds) {
        roleMapper.deleteRoleMenus(roleId);
        for (Long menuId : menuIds) {
            roleMapper.insertRoleMenu(roleId, menuId);
        }
    }

    @Override
    public List<RoleVO> list() {
        return roleMapper.selectRolePage(new RolePageDTO());
    }
}

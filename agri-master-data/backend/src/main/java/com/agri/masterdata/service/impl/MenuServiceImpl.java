package com.agri.masterdata.service.impl;

import com.agri.common.exception.BusinessException;
import com.agri.common.security.SecurityUtils;
import com.agri.common.util.BeanCopyUtils;
import com.agri.masterdata.dto.MenuSaveDTO;
import com.agri.masterdata.dto.MenuUpdateDTO;
import com.agri.masterdata.entity.Menu;
import com.agri.masterdata.mapper.MenuMapper;
import com.agri.masterdata.service.IMenuService;
import com.agri.masterdata.vo.MenuVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MenuServiceImpl implements IMenuService {

    private final MenuMapper menuMapper;

    @Override
    public List<MenuVO> getTree() {
        String tenantId = SecurityUtils.getTenantId();
        List<MenuVO> menus = menuMapper.selectMenuTree(tenantId);
        return buildTree(0L, menus);
    }

    private List<MenuVO> buildTree(Long parentId, List<MenuVO> menus) {
        return menus.stream()
                .filter(m -> m.getParentId().equals(parentId))
                .peek(m -> m.setChildren(buildTree(m.getId(), menus)))
                .collect(Collectors.toList());
    }

    @Override
    public List<String> getUserPermissions() {
        Long userId = SecurityUtils.getUserId();
        return menuMapper.selectUserPermissions(userId);
    }

    @Override
    @Transactional
    public void save(MenuSaveDTO dto) {
        Menu menu = BeanCopyUtils.copy(dto, Menu.class);
        menu.setTenantId(SecurityUtils.getTenantId());
        menu.setCreateBy(SecurityUtils.getUsername());
        menu.setStatus(dto.getStatus() != null ? dto.getStatus() : 1);
        menu.setDelFlag(0);
        menu.setParentId(dto.getParentId() != null ? dto.getParentId() : 0L);
        menuMapper.insert(menu);
    }

    @Override
    @Transactional
    public void update(Long id, MenuUpdateDTO dto) {
        Menu menu = menuMapper.selectById(id);
        if (menu == null || menu.getDelFlag() == 1) {
            throw new BusinessException("菜单不存在");
        }

        BeanCopyUtils.copyProperties(dto, menu);
        menu.setUpdateBy(SecurityUtils.getUsername());
        menuMapper.updateById(menu);
    }

    @Override
    @Transactional
    public void delete(Long id) {
        Menu menu = menuMapper.selectById(id);
        if (menu == null || menu.getDelFlag() == 1) {
            throw new BusinessException("菜单不存在");
        }

        menu.setDelFlag(1);
        menu.setUpdateBy(SecurityUtils.getUsername());
        menuMapper.updateById(menu);
    }
}

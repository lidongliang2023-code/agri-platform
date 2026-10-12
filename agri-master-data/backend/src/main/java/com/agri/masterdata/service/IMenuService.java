package com.agri.masterdata.service;

import com.agri.masterdata.dto.MenuSaveDTO;
import com.agri.masterdata.dto.MenuUpdateDTO;
import com.agri.masterdata.vo.MenuVO;

import java.util.List;

public interface IMenuService {

    List<MenuVO> getTree();

    List<String> getUserPermissions();

    void save(MenuSaveDTO dto);

    void update(Long id, MenuUpdateDTO dto);

    void delete(Long id);
}

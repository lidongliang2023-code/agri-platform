package com.agri.masterdata.service;

import com.agri.masterdata.dto.DictItemSaveDTO;
import com.agri.masterdata.dto.DictSaveDTO;
import com.agri.masterdata.vo.DictItemVO;
import com.agri.masterdata.vo.DictVO;

import java.util.List;

public interface IDictService {

    List<DictVO> list();

    DictVO getById(Long id);

    void save(DictSaveDTO dto);

    void update(Long id, DictSaveDTO dto);

    void delete(Long id);

    List<DictItemVO> getItemsByDictId(Long dictId);

    List<DictItemVO> getItemsByDictCode(String dictCode);

    void saveItem(DictItemSaveDTO dto);

    void updateItem(Long id, DictItemSaveDTO dto);

    void deleteItem(Long id);
}

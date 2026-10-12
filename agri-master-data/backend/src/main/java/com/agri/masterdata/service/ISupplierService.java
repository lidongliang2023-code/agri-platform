package com.agri.masterdata.service;

import com.agri.masterdata.dto.SupplierSaveDTO;
import com.agri.masterdata.vo.SupplierVO;

import java.util.List;

public interface ISupplierService {

    List<SupplierVO> list();

    SupplierVO getById(Long id);

    void save(SupplierSaveDTO dto);

    void update(Long id, SupplierSaveDTO dto);

    void delete(Long id);
}

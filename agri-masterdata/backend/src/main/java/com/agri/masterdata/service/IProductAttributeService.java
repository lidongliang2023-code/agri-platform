package com.agri.masterdata.service;

import com.agri.masterdata.dto.ProductAttributeSaveDTO;
import com.agri.masterdata.dto.ProductAttributeUpdateDTO;
import com.agri.masterdata.vo.ProductAttributeVO;

import java.util.List;

public interface IProductAttributeService {

    List<ProductAttributeVO> list(Long categoryId);

    ProductAttributeVO getById(Long id);

    void save(ProductAttributeSaveDTO dto);

    void update(Long id, ProductAttributeUpdateDTO dto);

    void delete(Long id);

    void changeStatus(Long id, Integer status);
}
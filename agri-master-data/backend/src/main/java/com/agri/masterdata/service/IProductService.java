package com.agri.masterdata.service;

import com.agri.common.entity.PageResult;
import com.agri.masterdata.dto.ProductPageDTO;
import com.agri.masterdata.dto.ProductSaveDTO;
import com.agri.masterdata.dto.ProductUpdateDTO;
import com.agri.masterdata.vo.ProductVO;

public interface IProductService {

    PageResult<ProductVO> page(ProductPageDTO dto);

    ProductVO getById(Long id);

    void save(ProductSaveDTO dto);

    void update(Long id, ProductUpdateDTO dto);

    void delete(Long id);
}

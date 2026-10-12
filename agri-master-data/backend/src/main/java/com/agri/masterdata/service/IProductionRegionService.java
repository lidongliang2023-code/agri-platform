package com.agri.masterdata.service;

import com.agri.common.entity.PageResult;
import com.agri.masterdata.dto.ProductionRegionSaveDTO;
import com.agri.masterdata.dto.ProductionRegionUpdateDTO;
import com.agri.masterdata.vo.ProductionRegionVO;

import java.util.List;

public interface IProductionRegionService {

    PageResult<ProductionRegionVO> page(Integer pageNum, Integer pageSize, String regionName, String regionType);

    List<ProductionRegionVO> listByParentCode(String parentCode);

    List<ProductionRegionVO> listByRegionType(String regionType);

    List<ProductionRegionVO> listByProvince(String province);

    ProductionRegionVO getById(Long id);

    ProductionRegionVO getByRegionCode(String regionCode);

    void save(ProductionRegionSaveDTO dto);

    void update(Long id, ProductionRegionUpdateDTO dto);

    void delete(Long id);

    void changeStatus(Long id, Integer status);
}
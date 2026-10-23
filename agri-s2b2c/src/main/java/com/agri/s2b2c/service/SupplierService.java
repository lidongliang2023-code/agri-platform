package com.agri.s2b2c.service;

import com.agri.s2b2c.entity.Supplier;
import com.agri.s2b2c.vo.ProductVO;
import com.agri.s2b2c.vo.SupplierVO;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;

public interface SupplierService extends IService<Supplier> {
    SupplierVO getById(Long id);
    IPage<SupplierVO> pageList(int page, int size, String keyword, String auditStatus);
    boolean apply(Supplier supplier);
    boolean updateAudit(Long id, String auditStatus, String auditOpinion);
    boolean updateInfo(Supplier supplier);
    IPage<ProductVO> getProducts(Long supplierId, int page, int size, String status);
}
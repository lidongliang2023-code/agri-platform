package com.agri.s2b2c.service;

import com.agri.s2b2c.entity.Product;
import com.agri.s2b2c.vo.ProductVO;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;

public interface ProductService extends IService<Product> {
    ProductVO getDetail(Long id);
    IPage<ProductVO> pageList(int page, int size, String keyword, Long categoryId, Long supplierId, String status);
    boolean create(Product product);
    boolean update(Product product);
    boolean updateAudit(Long id, String status, String opinion);
    boolean updateStock(Long id, Integer quantity);
}
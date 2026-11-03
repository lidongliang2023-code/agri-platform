package com.agri.s2b2c.service;

import com.agri.s2b2c.entity.Product;
import com.agri.s2b2c.vo.ProductVO;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;

import java.math.BigDecimal;

public interface ProductService extends IService<Product> {
    ProductVO getDetail(Long id);
    IPage<ProductVO> pageList(int page, int size, String keyword, Long categoryId, Long supplierId, String status);

    /**
     * 消费者侧商品检索：在通用分页之上增加排序与价格区间（商城筛选栏需要）。
     *
     * <p>只给 /api/consumer/products 用；供应商端、运营端的列表仍走上面那个不带排序的方法，
     * 免得商城侧的排序口径影响审核台。</p>
     */
    IPage<ProductVO> pageListForConsumer(int page, int size, String keyword, Long categoryId,
                                         String sort, BigDecimal minPrice, BigDecimal maxPrice);
    boolean create(Product product);
    boolean update(Product product);
    boolean updateAudit(Long id, String status, String opinion);
    boolean updateStock(Long id, Integer quantity);
}
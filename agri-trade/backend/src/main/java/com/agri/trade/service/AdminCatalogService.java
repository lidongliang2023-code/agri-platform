package com.agri.trade.service;

import com.agri.trade.entity.ProductViolation;
import com.agri.trade.entity.TradeProduct;
import com.agri.trade.entity.TradeProductCategory;
import com.agri.trade.mapper.ProductViolationMapper;
import com.agri.trade.mapper.TradeProductCategoryMapper;
import com.agri.trade.mapper.TradeProductMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;

/**
 * 品类管理 + 商品违规处置（运营端）。
 *
 * <p>品类的增删改原本挂在用户侧路径下且没有角色校验（品类是全平台的分类体系），
 * 已移到运营端；这里同时补上删除前的引用检查。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminCatalogService {

    /** 下架后的上架状态。 */
    private static final String STATUS_OFFLINE = "offline";

    private final TradeProductCategoryMapper categoryMapper;
    private final TradeProductMapper productMapper;
    private final ProductViolationMapper violationMapper;

    // ------------------------------ 品类 ------------------------------

    /** 品类列表（运营端看全部，包括停用的）。 */
    public IPage<TradeProductCategory> categoryPage(int pageNum, int pageSize, Long parentId, Integer status) {
        LambdaQueryWrapper<TradeProductCategory> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TradeProductCategory::getDelFlag, 0);
        if (parentId != null) {
            wrapper.eq(TradeProductCategory::getParentId, parentId);
        }
        if (status != null) {
            wrapper.eq(TradeProductCategory::getStatus, status);
        }
        wrapper.orderByAsc(TradeProductCategory::getLevel).orderByAsc(TradeProductCategory::getSortOrder);
        return categoryMapper.selectPage(new Page<>(pageNum, pageSize), wrapper);
    }

    /** 新建品类。层级按父级推出来，不由前端随便填。 */
    @Transactional
    public String createCategory(TradeProductCategory category) {
        if (category.getCategoryName() == null || category.getCategoryName().isEmpty()) {
            return "品类名称不能为空";
        }
        if (category.getParentId() != null) {
            TradeProductCategory parent = categoryMapper.selectById(category.getParentId());
            if (parent == null) {
                return "上级品类不存在";
            }
            category.setLevel(parent.getLevel() == null ? 2 : parent.getLevel() + 1);
        } else {
            category.setLevel(1);
        }
        category.setDelFlag(0);
        if (category.getStatus() == null) {
            category.setStatus(1);
        }
        category.setCreateTime(new Date());
        category.setUpdateTime(new Date());
        categoryMapper.insert(category);
        return null;
    }

    /** 修改品类。 */
    @Transactional
    public String updateCategory(Long id, TradeProductCategory patch) {
        TradeProductCategory exist = categoryMapper.selectById(id);
        if (exist == null || (exist.getDelFlag() != null && exist.getDelFlag() == 1)) {
            return "品类不存在";
        }
        patch.setId(id);
        // 不允许把品类挂到自己下面（会形成环）；层级也不允许由前端直接改
        if (id.equals(patch.getParentId())) {
            return "不能把品类挂到自己下面";
        }
        patch.setLevel(null);
        patch.setDelFlag(null);
        patch.setUpdateTime(new Date());
        categoryMapper.updateById(patch);
        return null;
    }

    /**
     * 删除品类（软删）。
     *
     * <p>有下级品类或还有货源引用时不允许删 —— 品类是全平台共用的，
     * 删掉之后那些货源的 categoryId 就成了悬空引用，页面上只剩一个空白品类。</p>
     */
    @Transactional
    public String deleteCategory(Long id) {
        TradeProductCategory exist = categoryMapper.selectById(id);
        if (exist == null) {
            return "品类不存在";
        }
        Long children = categoryMapper.selectCount(new LambdaQueryWrapper<TradeProductCategory>()
                .eq(TradeProductCategory::getParentId, id)
                .eq(TradeProductCategory::getDelFlag, 0));
        if (children != null && children > 0) {
            return "该品类下还有 " + children + " 个子品类，请先处理子品类";
        }
        Long products = productMapper.selectCount(new LambdaQueryWrapper<TradeProduct>()
                .eq(TradeProduct::getCategoryId, id)
                .eq(TradeProduct::getDelFlag, 0));
        if (products != null && products > 0) {
            return "还有 " + products + " 个货源在使用该品类，不能删除（可改为停用）";
        }
        categoryMapper.deleteById(id);
        return null;
    }

    // ------------------------------ 违规处置 ------------------------------

    public IPage<ProductViolation> violationPage(int pageNum, int pageSize, String violationStatus, String productName) {
        LambdaQueryWrapper<ProductViolation> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ProductViolation::getDelFlag, 0);
        if (violationStatus != null && !violationStatus.isEmpty()) {
            wrapper.eq(ProductViolation::getViolationStatus, violationStatus);
        }
        if (productName != null && !productName.isEmpty()) {
            wrapper.like(ProductViolation::getProductName, productName);
        }
        wrapper.orderByDesc(ProductViolation::getCreateTime);
        return violationMapper.selectPage(new Page<>(pageNum, pageSize), wrapper);
    }

    /**
     * 违规下架。
     *
     * @return 失败原因；成功时返回 null
     */
    @Transactional
    public String takeDown(Long productId, String violationType, String reason, String operator) {
        if (reason == null || reason.trim().isEmpty()) {
            return "违规处置必须填写原因";
        }
        TradeProduct product = productMapper.selectById(productId);
        if (product == null || (product.getDelFlag() != null && product.getDelFlag() == 1)) {
            return "货源不存在";
        }
        if (STATUS_OFFLINE.equals(product.getPublishStatus())) {
            return "该货源已经是下架状态";
        }
        Long active = violationMapper.selectCount(new LambdaQueryWrapper<ProductViolation>()
                .eq(ProductViolation::getProductId, productId)
                .eq(ProductViolation::getViolationStatus, "active"));
        if (active != null && active > 0) {
            return "该货源存在未撤销的违规处置";
        }

        Date now = new Date();
        ProductViolation violation = new ProductViolation();
        violation.setViolationNo("VI" + System.currentTimeMillis());
        violation.setProductId(product.getId());
        violation.setProductName(product.getProductName());
        violation.setSellerId(product.getSellerId());
        violation.setSellerName(product.getSellerName());
        violation.setViolationType(violationType);
        violation.setReason(reason);
        violation.setAction("offline");
        violation.setViolationStatus("active");
        violation.setPreviousPublishStatus(product.getPublishStatus());
        violation.setOperator(operator);
        violation.setDelFlag(0);
        violation.setCreateTime(now);
        violation.setUpdateTime(now);
        violationMapper.insert(violation);

        product.setPublishStatus(STATUS_OFFLINE);
        product.setUpdateTime(now);
        productMapper.updateById(product);

        log.info("商品违规下架：productId={} type={} operator={} reason={}",
                productId, violationType, operator, reason);
        return null;
    }

    /** 撤销违规处置（恢复上架）。 */
    @Transactional
    public String revoke(Long violationId, String revokeReason, String operator) {
        ProductViolation violation = violationMapper.selectById(violationId);
        if (violation == null || (violation.getDelFlag() != null && violation.getDelFlag() == 1)) {
            return "处置记录不存在";
        }
        if (!"active".equals(violation.getViolationStatus())) {
            return "该处置已经撤销过了";
        }
        Date now = new Date();
        violation.setViolationStatus("revoked");
        violation.setRevokeTime(now);
        violation.setRevokeReason(revokeReason);
        violation.setUpdateTime(now);
        violationMapper.updateById(violation);

        // 恢复上架：回到处置前的状态；那个状态本身如果是 draft/pending，就照原样回去，
        // 而不是一律置成 published（否则等于运营替商家把货重新上架了）。
        TradeProduct product = productMapper.selectById(violation.getProductId());
        if (product != null) {
            String back = violation.getPreviousPublishStatus();
            product.setPublishStatus(back == null || back.isEmpty() ? "published" : back);
            product.setUpdateTime(now);
            productMapper.updateById(product);
        }
        log.info("商品违规撤销：violationId={} operator={} back={}", violationId, operator, violation.getPreviousPublishStatus());
        return null;
    }
}

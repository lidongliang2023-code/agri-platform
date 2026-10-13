package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.entity.TradeProduct;
import com.agri.trade.entity.TradeProductCategory;
import com.agri.trade.entity.ProductImage;
import com.agri.trade.mapper.ProductImageMapper;
import com.agri.trade.mapper.TradeProductMapper;
import com.agri.trade.mapper.TradeProductCategoryMapper;
import com.agri.trade.service.PlatformIdentityService;
import com.agri.trade.service.TradeConfigService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Date;
import java.util.List;

@RestController
@RequestMapping("/api/trade/product")
@RequiredArgsConstructor
public class TradeProductController {

    private final TradeProductMapper productMapper;
    private final TradeProductCategoryMapper categoryMapper;
    private final ProductImageMapper productImageMapper;
    private final PlatformIdentityService identityService;
    private final TradeConfigService configService;

    /**
     * 商品图片。
     *
     * <p>商品详情页要展示主图与详情图，而 agri_trade_product_image 表此前没有任何读接口 ——
     * 详情页只能显示一个占位框。这里按 product_id 取，主图排在前。</p>
     */
    @GetMapping("/{id}/images")
    public ApiResponse<List<ProductImage>> getProductImages(@PathVariable Long id) {
        LambdaQueryWrapper<ProductImage> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ProductImage::getDelFlag, 0)
               .eq(ProductImage::getProductId, id)
               .orderByAsc(ProductImage::getSortOrder);
        return ApiResponse.success(productImageMapper.selectList(wrapper));
    }

    @GetMapping("/category/page")
    public ApiResponse<IPage<TradeProductCategory>> getCategoryPage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) Long parentId) {
        Page<TradeProductCategory> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<TradeProductCategory> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TradeProductCategory::getDelFlag, 0);
        wrapper.eq(TradeProductCategory::getStatus, 1);
        if (parentId != null) {
            wrapper.eq(TradeProductCategory::getParentId, parentId);
        }
        wrapper.orderByAsc(TradeProductCategory::getSortOrder);
        return ApiResponse.success(categoryMapper.selectPage(page, wrapper));
    }

    @GetMapping("/category/list")
    public ApiResponse<List<TradeProductCategory>> getCategoryList() {
        LambdaQueryWrapper<TradeProductCategory> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TradeProductCategory::getDelFlag, 0);
        wrapper.eq(TradeProductCategory::getStatus, 1);
        wrapper.orderByAsc(TradeProductCategory::getLevel).orderByAsc(TradeProductCategory::getSortOrder);
        return ApiResponse.success(categoryMapper.selectList(wrapper));
    }

    /*
     * 品类的增删改（POST/PUT/DELETE /category）已移出本控制器。
     *
     * 它们原本挂在**用户侧**路径 /api/trade/product/category 下，且没有任何角色校验 ——
     * 品类是全平台的分类体系，任何一个登录用户都能新增、改名、删掉它，
     * 而删除会直接影响所有引用该品类的货源。现在归到运营端
     * /api/trade/admin/category/**，自动受运营角色校验保护。
     *
     * 上面的两个读接口保留：给货源的筛选与发布表单取品类用，属于正常的用户侧读取。
     */

    @GetMapping("/page")
    public ApiResponse<IPage<TradeProduct>> getProductPage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) String productName,
            @RequestParam(required = false) String publishStatus,
            // 供应商店铺页需要"该店铺的全部货源"，原先没有 sellerId 过滤条件，
            // 只能把全部商品拉回来在前端筛 —— 现在下推到 SQL。
            @RequestParam(required = false) Long sellerId,
            // 列表页的价格排序。取值 price / priceMin / createTime，order 取 asc / desc。
            @RequestParam(required = false) String sortField,
            @RequestParam(required = false) String sortOrder) {
        Page<TradeProduct> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<TradeProduct> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TradeProduct::getDelFlag, 0);
        if (categoryId != null) wrapper.eq(TradeProduct::getCategoryId, categoryId);
        if (productName != null) wrapper.like(TradeProduct::getProductName, productName);
        if (publishStatus != null) wrapper.eq(TradeProduct::getPublishStatus, publishStatus);
        if (sellerId != null) wrapper.eq(TradeProduct::getSellerId, sellerId);
        // 白名单式排序：只认三个已知字段，其他一律回落默认排序 ——
        // 直接把请求参数拼进 orderBy 是 SQL 注入面
        boolean asc = "asc".equalsIgnoreCase(sortOrder);
        if ("price".equals(sortField)) {
            wrapper.orderBy(true, asc, TradeProduct::getPrice);
        } else if ("priceMin".equals(sortField)) {
            wrapper.orderBy(true, asc, TradeProduct::getPriceMin);
        } else if ("createTime".equals(sortField)) {
            wrapper.orderBy(true, asc, TradeProduct::getCreateTime);
        } else {
            wrapper.orderByDesc(TradeProduct::getCreateTime);
        }
        return ApiResponse.success(productMapper.selectPage(page, wrapper));
    }

    @GetMapping("/{id}")
    public ApiResponse<TradeProduct> getProductById(@PathVariable Long id) {
        TradeProduct product = productMapper.selectById(id);
        if (product == null) return ApiResponse.error("商品不存在");
        return ApiResponse.success(product);
    }

    @PostMapping
    public ApiResponse<Boolean> createProduct(@RequestBody TradeProduct product) {
        // 供应商由服务端按登录用户绑定的经营主体决定。
        // 这里原先既不看身份、也不读请求体里的 sellerId —— 而表里 seller_id 是 NOT NULL，
        // 于是"发布货源"每次都直接 500（Field 'seller_id' doesn't have a default value）。
        PlatformIdentityService.MerchantSelection seller = identityService.selectMerchant(product.getSellerId());
        if (!seller.ok()) {
            return ApiResponse.error(seller.error());
        }
        product.setSellerId(seller.merchantId());
        if (product.getSellerName() == null || product.getSellerName().isEmpty()) {
            product.setSellerName(seller.merchantName());
        }
        product.setProductCode("P" + System.currentTimeMillis());
        product.setDelFlag(0);
        product.setStatus(1);
        // 是否先送审由运营配置决定（默认 true，与原先行为一致）：
        // 关了之后新货源直接上架，适合运营自己替商家代发的场景。
        boolean requiresAudit = configService.getBoolean("product.publish-requires-audit", true);
        product.setPublishStatus(requiresAudit ? "pending" : "published");
        product.setCreateTime(new Date());
        product.setUpdateTime(new Date());
        int result = productMapper.insert(product);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("创建失败");
    }

    @PutMapping("/{id}")
    public ApiResponse<Boolean> updateProduct(@PathVariable Long id, @RequestBody TradeProduct product) {
        TradeProduct exist = productMapper.selectById(id);
        if (exist == null) return ApiResponse.error("商品不存在");
        String denied = denyIfNotOwner(exist);
        if (denied != null) return ApiResponse.error(denied);
        product.setId(id);
        // 不允许改归属：请求体里带 sellerId 就能把别人的货源挂到自己名下（或反过来）。
        product.setSellerId(null);
        product.setUpdateTime(new Date());
        int result = productMapper.updateById(product);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("更新失败");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Boolean> deleteProduct(@PathVariable Long id) {
        TradeProduct product = productMapper.selectById(id);
        if (product == null) return ApiResponse.error("商品不存在");
        String denied = denyIfNotOwner(product);
        if (denied != null) return ApiResponse.error(denied);
        // 同上：必须用 deleteById，否则接口成功而记录还在。
        int result = productMapper.deleteById(id);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("删除失败");
    }

    /**
     * 判权：只有货源所属的经营主体能改/删它。
     *
     * <p>读（列表 / 详情）不设范围 —— 货源本来就是要给买家浏览的；
     * 但改与删此前**谁都能调**，换个 id 就能下架别人的货源。</p>
     *
     * @return 拒绝原因；允许时返回 null
     */
    private String denyIfNotOwner(TradeProduct product) {
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return scope.error();
        }
        if (product.getSellerId() != null && scope.merchantIds().contains(product.getSellerId())) {
            return null;
        }
        return "只能操作自己发布的货源";
    }

    @PostMapping("/{id}/audit")
    public ApiResponse<Boolean> auditProduct(@PathVariable Long id, @RequestBody java.util.Map<String, String> params) {
        TradeProduct product = productMapper.selectById(id);
        if (product == null) return ApiResponse.error("商品不存在");
        product.setPublishStatus(params.get("status"));
        product.setAuditRemark(params.get("remark"));
        product.setAuditTime(new Date());
        product.setAuditor(params.get("auditor"));
        product.setUpdateTime(new Date());
        int result = productMapper.updateById(product);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("审核失败");
    }
}

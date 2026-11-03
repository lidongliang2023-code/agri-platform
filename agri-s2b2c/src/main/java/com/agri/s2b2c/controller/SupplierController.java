package com.agri.s2b2c.controller;

import com.agri.s2b2c.entity.ChannelPartner;
import com.agri.s2b2c.entity.ChannelProduct;
import com.agri.s2b2c.entity.Product;
import com.agri.s2b2c.entity.Supplier;
import com.agri.s2b2c.mapper.ChannelPartnerMapper;
import com.agri.s2b2c.mapper.ChannelProductMapper;
import com.agri.s2b2c.mapper.ProductMapper;
import com.agri.s2b2c.security.CapabilityGuard;
import com.agri.s2b2c.security.SecurityUtils;
import com.agri.s2b2c.service.DistributionRuleService;
import com.agri.s2b2c.service.PriceGuardService;
import com.agri.s2b2c.service.SupplierStatementService;
import com.agri.s2b2c.service.ProductService;
import com.agri.s2b2c.service.SupplierIdentityService;
import com.agri.s2b2c.service.SupplierService;
import com.agri.s2b2c.vo.ProductVO;
import com.agri.s2b2c.vo.SupplierVO;
import com.agri.common.rbac.OperatorOnly;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/supplier")
@OperatorOnly("s2b2c:supplier")
public class SupplierController {

    private final SupplierService supplierService;
    private final ProductService productService;
    private final SupplierIdentityService supplierIdentityService;
    private final CapabilityGuard capabilityGuard;
    private final ProductMapper productMapper;
    private final ChannelProductMapper channelProductMapper;
    private final ChannelPartnerMapper channelPartnerMapper;
    private final DistributionRuleService distributionRuleService;
    private final PriceGuardService priceGuardService;
    private final SupplierStatementService supplierStatementService;

    public SupplierController(SupplierService supplierService, ProductService productService,
                              SupplierIdentityService supplierIdentityService,
                              CapabilityGuard capabilityGuard, ProductMapper productMapper,
                              ChannelProductMapper channelProductMapper,
                              ChannelPartnerMapper channelPartnerMapper,
                              DistributionRuleService distributionRuleService,
                              PriceGuardService priceGuardService,
                              SupplierStatementService supplierStatementService) {
        this.supplierService = supplierService;
        this.productService = productService;
        this.supplierIdentityService = supplierIdentityService;
        this.capabilityGuard = capabilityGuard;
        this.productMapper = productMapper;
        this.channelProductMapper = channelProductMapper;
        this.channelPartnerMapper = channelPartnerMapper;
        this.distributionRuleService = distributionRuleService;
        this.priceGuardService = priceGuardService;
        this.supplierStatementService = supplierStatementService;
    }

    @GetMapping("/statements")
    public ResponseEntity<List<Map<String, Object>>> statements() {
        Supplier mine = supplierIdentityService.requireCurrent();
        return ResponseEntity.ok(supplierStatementService.list(mine.getId(), null));
    }

    @GetMapping("/statement/{id}")
    public ResponseEntity<Map<String, Object>> statementDetail(@PathVariable Long id) {
        Supplier mine = supplierIdentityService.requireCurrent();
        Map<String, Object> detail = supplierStatementService.detail(id);
        if (detail == null || !String.valueOf(mine.getId()).equals(String.valueOf(detail.get("supplierId")))) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.FORBIDDEN, "该对账单不属于当前供应商");
        }
        return ResponseEntity.ok(detail);
    }

    @PutMapping("/statement/{id}/confirm")
    public ResponseEntity<Map<String, Object>> confirmStatement(@PathVariable Long id,
                                                                @RequestParam(required = false) String remark) {
        Supplier mine = supplierIdentityService.requireCurrent();
        boolean success = supplierStatementService.confirm(id, mine.getId(), remark);
        return ResponseEntity.ok(Map.of("success", success,
                "message", success ? "对账单已确认" : "当前对账单不能确认"));
    }

    @PutMapping("/statement/{id}/dispute")
    public ResponseEntity<Map<String, Object>> disputeStatement(@PathVariable Long id,
                                                                @RequestParam String remark) {
        Supplier mine = supplierIdentityService.requireCurrent();
        if (remark == null || remark.isBlank()) {
            return ResponseEntity.ok(Map.of("success", false, "message", "请填写差异说明"));
        }
        boolean success = supplierStatementService.dispute(id, mine.getId(), remark.trim());
        return ResponseEntity.ok(Map.of("success", success,
                "message", success ? "已提交差异" : "当前对账单不能提交差异"));
    }

    /**
     * 我的商品被哪些渠道选中（含已撤销）。
     *
     * <p>供应商据此决定撤不撤授权；渠道侧选品是"渠道自己声明"，但商品归属始终在供应商。</p>
     */
    @GetMapping("/channel-authorizations")
    public ResponseEntity<List<Map<String, Object>>> channelAuthorizations(
            @RequestParam(required = false) Long productId) {
        Supplier mine = supplierIdentityService.requireCurrent();
        List<ChannelProduct> relations = channelProductMapper.selectList(
                new LambdaQueryWrapper<ChannelProduct>()
                        .eq(ChannelProduct::getSupplierId, mine.getId())
                        .eq(productId != null, ChannelProduct::getProductId, productId)
                        .orderByDesc(ChannelProduct::getPickedAt));
        List<Map<String, Object>> rows = new ArrayList<>();
        for (ChannelProduct relation : relations) {
            Product product = productMapper.selectById(relation.getProductId());
            ChannelPartner channel = channelPartnerMapper.selectById(relation.getChannelId());
            Map<String, Object> row = new HashMap<>();
            row.put("id", relation.getId());
            row.put("productId", relation.getProductId());
            row.put("productName", product == null ? null : product.getName());
            row.put("channelId", relation.getChannelId());
            row.put("channelName", channel == null ? null
                    : (channel.getShopName() == null ? channel.getContactName() : channel.getShopName()));
            row.put("status", relation.getStatus());
            row.put("pickedAt", relation.getPickedAt());
            rows.add(row);
        }
        return ResponseEntity.ok(rows);
    }

    /**
     * 撤销某渠道对本供应商商品的授权（幂等）。
     *
     * <p>撤销后：渠道选品列表立即不再包含该商品，新订单也不能再走该渠道；
     * 已产生的订单保留渠道快照，不受影响。</p>
     */
    @PutMapping("/channel-authorization/{id}/revoke")
    public ResponseEntity<Map<String, Object>> revokeChannelAuthorization(@PathVariable Long id) {
        capabilityGuard.require("s2b2c.supplier", "撤销渠道授权");
        Supplier mine = supplierIdentityService.requireCurrent();
        ChannelProduct relation = channelProductMapper.selectById(id);
        Map<String, Object> result = new HashMap<>();
        if (relation == null) {
            return ResponseEntity.status(404).body(Map.of("success", false, "message", "渠道授权记录不存在"));
        }
        if (!mine.getId().equals(relation.getSupplierId())) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", "无权撤销其他供应商的授权"));
        }
        if ("REVOKED".equals(relation.getStatus())) {
            result.put("success", true);
            result.put("message", "该授权已经是撤销状态");
            return ResponseEntity.ok(result);
        }
        relation.setStatus("REVOKED");
        relation.setUpdateTime(LocalDateTime.now());
        result.put("success", channelProductMapper.updateById(relation) > 0);
        result.put("message", "已撤销该渠道的选品授权");
        return ResponseEntity.ok(result);
    }

    /** 当前账号的供应商档案（前端不再写死 supplierId=1）。 */
    @GetMapping("/profile")
    public ResponseEntity<Map<String, Object>> profile() {
        Supplier mine = supplierIdentityService.currentOrNull();
        Map<String, Object> data = new HashMap<>();
        data.put("applied", mine != null);
        if (mine != null) {
            data.put("id", mine.getId());
            data.put("companyName", mine.getCompanyName());
            data.put("shopName", mine.getShopName());
            data.put("auditStatus", mine.getAuditStatus());
            data.put("auditOpinion", mine.getAuditOpinion());
            data.put("auditTime", mine.getAuditTime());
            data.put("createTime", mine.getCreateTime());
            java.util.Map<String, Object> capability = capabilityGuard.check("s2b2c.supplier");
            data.put("capabilityGranted", capability.get("granted"));
            data.put("capabilityReason", capability.get("reason"));
        }
        return ResponseEntity.ok(data);
    }

    @PostMapping("/apply")
    public ResponseEntity<Map<String, Object>> apply(@RequestBody Supplier supplier) {
        Supplier existing = supplierIdentityService.currentOrNull();
        if (existing != null) {
            String auditStatus = existing.getAuditStatus() == null ? "" : existing.getAuditStatus();
            if ("APPROVED".equalsIgnoreCase(auditStatus)) {
                return ResponseEntity.ok(Map.of("success", false, "message", "已入驻商城，无需重复申请"));
            }
            if ("REJECTED".equalsIgnoreCase(auditStatus)) {
                String error = validateApplication(supplier);
                if (error != null) {
                    return ResponseEntity.ok(Map.of("success", false, "message", error));
                }
                supplier.setId(existing.getId());
                boolean success = supplierService.reapply(supplier);
                return ResponseEntity.ok(Map.of("success", success,
                        "message", success ? "已重新提交入驻申请，等待审核" : "重新提交失败"));
            }
            return ResponseEntity.ok(Map.of("success", false, "message", "入驻申请正在审核中"));
        }
        String error = validateApplication(supplier);
        if (error != null) {
            return ResponseEntity.ok(Map.of("success", false, "message", error));
        }
        // 入驻申请绑定到当前登录账号，不信任请求体里的 userId
        supplier.setUserId(SecurityUtils.getUserId());
        Map<String, Object> result = new HashMap<>();
        boolean success = supplierService.apply(supplier);
        result.put("success", success);
        result.put("message", success ? "申请提交成功，等待审核" : "申请提交失败");
        return ResponseEntity.ok(result);
    }

    private String validateApplication(Supplier supplier) {
        if (supplier.getCompanyName() == null || supplier.getCompanyName().isBlank()) {
            return "请填写公司名称";
        }
        String creditCode = supplier.getCreditCode() == null ? "" : supplier.getCreditCode().trim();
        if (!creditCode.matches("[0-9A-Za-z]{6,30}")) {
            return "统一信用代码应为 6-30 位字母或数字";
        }
        String phone = supplier.getContactPhone() == null ? "" : supplier.getContactPhone().trim();
        if (!phone.matches("1[3-9]\\d{9}")) {
            return "请输入正确的 11 位联系电话";
        }
        if (supplier.getShopName() == null || supplier.getShopName().isBlank()) {
            supplier.setShopName(supplier.getCompanyName().trim());
        }
        supplier.setCompanyName(supplier.getCompanyName().trim());
        supplier.setCreditCode(creditCode);
        supplier.setContactPhone(phone);
        return null;
    }

    @GetMapping("/detail/{id}")
    public ResponseEntity<SupplierVO> getDetail(@PathVariable Long id) {
        return ResponseEntity.ok(supplierService.getById(id));
    }

    @GetMapping("/products")
    public ResponseEntity<IPage<ProductVO>> getProducts(
            @RequestParam Long supplierId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(supplierService.getProducts(supplierId, page, size, status));
    }

    @PostMapping("/product/create")
    public ResponseEntity<Map<String, Object>> createProduct(@RequestBody Product product) {
        // 上架要 s2b2c.supplier（主体 + 交易类业务身份），且商品必须挂在自己的供应商档案下
        capabilityGuard.require("s2b2c.supplier", "上架商品");
        if (product.getSupplierId() == null) {
            product.setSupplierId(supplierIdentityService.requireCurrent().getId());
        } else {
            supplierIdentityService.requireOwnSupplier(product.getSupplierId());
        }
        Map<String, Object> result = new HashMap<>();
        boolean success = productService.create(product);
        result.put("success", success);
        result.put("message", success ? "商品创建成功，等待审核" : "商品创建失败");
        return ResponseEntity.ok(result);
    }

    @PutMapping("/product/update")
    public ResponseEntity<Map<String, Object>> updateProduct(@RequestBody Product product) {
        capabilityGuard.require("s2b2c.supplier", "修改商品");
        Product existing = product.getId() == null ? null : productMapper.selectById(product.getId());
        if (existing == null) {
            return ResponseEntity.status(404).body(Map.of("success", false, "message", "商品不存在"));
        }
        supplierIdentityService.requireOwnSupplier(existing.getSupplierId());
        product.setSupplierId(existing.getSupplierId());
        Map<String, Object> result = new HashMap<>();
        boolean success = productService.update(product);
        Product refreshed = success ? productMapper.selectById(product.getId()) : null;
        int autoOffShelf = refreshed == null ? 0 : priceGuardService.enforceProduct(refreshed, "PRODUCT_UPDATE");
        result.put("success", success);
        result.put("autoOffShelf", autoOffShelf);
        result.put("message", success
                ? "商品更新成功" + (autoOffShelf > 0 ? "，已自动下架 " + autoOffShelf + " 个超低价渠道货架" : "")
                : "商品更新失败");
        return ResponseEntity.ok(result);
    }

    /** 驳回后重新提交审核：仅允许 REJECTED → PENDING，清空上次审核意见。 */
    @PutMapping("/product/{id}/resubmit")
    public ResponseEntity<Map<String, Object>> resubmitProduct(@PathVariable Long id) {
        capabilityGuard.require("s2b2c.supplier", "重新提交商品");
        Product product = productMapper.selectById(id);
        if (product == null) {
            return ResponseEntity.status(404).body(Map.of("success", false, "message", "商品不存在"));
        }
        supplierIdentityService.requireOwnSupplier(product.getSupplierId());
        if (!"REJECTED".equals(product.getStatus())) {
            return ResponseEntity.ok(Map.of("success", false, "message",
                    "只有已拒绝商品可以重新提交（当前：" + product.getStatus() + "）"));
        }
        product.setStatus("PENDING");
        product.setAuditOpinion(null);
        product.setAuditTime(null);
        product.setUpdateTime(java.time.LocalDateTime.now());
        productMapper.updateById(product);
        return ResponseEntity.ok(Map.of("success", true, "message", "已重新提交审核"));
    }

    /** 投放规则：是否允许渠道投放 + 最大授权渠道数（0=不限）。 */
    @PutMapping("/product/{id}/distribution")
    public ResponseEntity<Map<String, Object>> updateDistribution(@PathVariable Long id,
                                                                  @RequestParam Boolean enabled,
                                                                  @RequestParam(required = false) Integer maxChannels) {
        capabilityGuard.require("s2b2c.supplier", "配置投放规则");
        Product product = productMapper.selectById(id);
        if (product == null) {
            return ResponseEntity.status(404).body(Map.of("success", false, "message", "商品不存在"));
        }
        supplierIdentityService.requireOwnSupplier(product.getSupplierId());
        if (maxChannels != null && maxChannels < 0) {
            return ResponseEntity.ok(Map.of("success", false, "message", "最大渠道数不能为负数"));
        }
        product.setDistributionEnabled(enabled);
        product.setMaxChannels(maxChannels == null ? 0 : maxChannels);
        product.setUpdateTime(java.time.LocalDateTime.now());
        productMapper.updateById(product);
        int revoked = distributionRuleService.autoRevoke(product);
        return ResponseEntity.ok(Map.of("success", true, "message", "投放规则已更新",
                "revoked", revoked));
    }

    /** 查询商品投放规则（白名单 + 启停 + 渠道数上限）。 */
    @GetMapping("/product/{id}/distribution-rule")
    public ResponseEntity<Map<String, Object>> distributionRule(@PathVariable Long id) {
        Product product = productMapper.selectById(id);
        if (product == null) {
            return ResponseEntity.status(404).body(Map.of("success", false, "message", "商品不存在"));
        }
        supplierIdentityService.requireOwnSupplier(product.getSupplierId());
        Map<String, Object> result = new java.util.LinkedHashMap<>(distributionRuleService.rule(id));
        result.put("enabled", product.getDistributionEnabled() == null || product.getDistributionEnabled());
        result.put("maxChannels", product.getMaxChannels() == null ? 0 : product.getMaxChannels());
        result.put("minRetailPrice", product.getMinRetailPrice());
        result.put("maxRetailPrice", product.getMaxRetailPrice());
        return ResponseEntity.ok(result);
    }

    /** 保存投放规则（启停/渠道数/白名单），并按新规则自动撤销不符合的授权。 */
    @PutMapping("/product/{id}/distribution-rule")
    public ResponseEntity<Map<String, Object>> saveDistributionRule(@PathVariable Long id,
                                                                    @RequestBody Map<String, Object> body) {
        capabilityGuard.require("s2b2c.supplier", "配置投放规则");
        Product product = productMapper.selectById(id);
        if (product == null) {
            return ResponseEntity.status(404).body(Map.of("success", false, "message", "商品不存在"));
        }
        supplierIdentityService.requireOwnSupplier(product.getSupplierId());
        boolean enabled = body.get("enabled") == null
                || Boolean.parseBoolean(String.valueOf(body.get("enabled")));
        int maxChannels = 0;
        if (body.get("maxChannels") != null && !String.valueOf(body.get("maxChannels")).isBlank()) {
            try {
                maxChannels = Integer.parseInt(String.valueOf(body.get("maxChannels")).trim());
            } catch (RuntimeException e) {
                return ResponseEntity.ok(Map.of("success", false, "message", "最大渠道数必须是整数"));
            }
        }
        if (maxChannels < 0) {
            return ResponseEntity.ok(Map.of("success", false, "message", "最大渠道数不能为负数"));
        }
        java.math.BigDecimal minPrice = product.getMinRetailPrice();
        java.math.BigDecimal maxPrice = product.getMaxRetailPrice();
        if (body.containsKey("minRetailPrice")) {
            String raw = body.get("minRetailPrice") == null ? "" : String.valueOf(body.get("minRetailPrice")).trim();
            if (raw.isEmpty()) {
                minPrice = null;
            } else {
                try {
                    minPrice = new java.math.BigDecimal(raw);
                } catch (RuntimeException e) {
                    return ResponseEntity.ok(Map.of("success", false, "message", "最低零售价必须是数字"));
                }
            }
        }
        if (body.containsKey("maxRetailPrice")) {
            String raw = body.get("maxRetailPrice") == null ? "" : String.valueOf(body.get("maxRetailPrice")).trim();
            if (raw.isEmpty()) {
                maxPrice = null;
            } else {
                try {
                    maxPrice = new java.math.BigDecimal(raw);
                } catch (RuntimeException e) {
                    return ResponseEntity.ok(Map.of("success", false, "message", "最高零售价必须是数字"));
                }
            }
        }
        if (minPrice != null && minPrice.signum() <= 0) {
            return ResponseEntity.ok(Map.of("success", false, "message", "最低零售价必须大于 0"));
        }
        if (maxPrice != null && maxPrice.signum() <= 0) {
            return ResponseEntity.ok(Map.of("success", false, "message", "最高零售价必须大于 0"));
        }
        if (minPrice != null && maxPrice != null && minPrice.compareTo(maxPrice) > 0) {
            return ResponseEntity.ok(Map.of("success", false, "message", "最低零售价不能高于最高零售价"));
        }
        if (product.getPrice() != null && minPrice != null && minPrice.compareTo(product.getPrice()) < 0) {
            return ResponseEntity.ok(Map.of("success", false,
                    "message", "最低零售价不能低于供货价 ¥" + product.getPrice()));
        }
        if (product.getPrice() != null && maxPrice != null && maxPrice.compareTo(product.getPrice()) < 0) {
            return ResponseEntity.ok(Map.of("success", false,
                    "message", "最高零售价不能低于供货价 ¥" + product.getPrice()));
        }
        product.setDistributionEnabled(enabled);
        product.setMaxChannels(maxChannels);
        product.setMinRetailPrice(minPrice);
        product.setMaxRetailPrice(maxPrice);
        product.setUpdateTime(java.time.LocalDateTime.now());
        productMapper.updateById(product);
        long outOfRange = 0;
        if (minPrice != null || maxPrice != null) {
            for (ChannelProduct relation : channelProductMapper.selectList(new LambdaQueryWrapper<ChannelProduct>()
                    .eq(ChannelProduct::getProductId, id)
                    .eq(ChannelProduct::getStatus, "ACTIVE"))) {
                java.math.BigDecimal retail = relation.getRetailPrice();
                if (retail == null) continue;
                if ((minPrice != null && retail.compareTo(minPrice) < 0)
                        || (maxPrice != null && retail.compareTo(maxPrice) > 0)) {
                    outOfRange++;
                }
            }
        }
        if (body.containsKey("channelIds")) {
            List<Long> channelIds = new ArrayList<>();
            if (body.get("channelIds") instanceof List<?> list) {
                for (Object raw : list) {
                    if (raw == null) continue;
                    try {
                        channelIds.add(Long.parseLong(String.valueOf(raw).trim()));
                    } catch (RuntimeException ignored) {
                    }
                }
            }
            distributionRuleService.replaceWhitelist(id, channelIds);
        }
        if (body.containsKey("regionNames")) {
            List<String> regionNames = new ArrayList<>();
            if (body.get("regionNames") instanceof List<?> list) {
                for (Object raw : list) {
                    if (raw == null) continue;
                    String name = String.valueOf(raw).trim();
                    if (name.isEmpty()) continue;
                    if (name.length() > 50) {
                        return ResponseEntity.ok(Map.of("success", false, "message", "限售区域名称过长"));
                    }
                    if (!regionNames.contains(name)) regionNames.add(name);
                }
            }
            if (regionNames.size() > 34) {
                return ResponseEntity.ok(Map.of("success", false, "message", "限售区域最多选择 34 个"));
            }
            distributionRuleService.replaceRegions(id, regionNames);
        }
        int revoked = distributionRuleService.autoRevoke(product);
        int autoOffShelf = priceGuardService.enforceProduct(product, "RULE");
        Map<String, Object> saved = new HashMap<>();
        saved.put("success", true);
        saved.put("message", "投放规则已保存");
        saved.put("revoked", revoked);
        saved.put("outOfRange", outOfRange);
        saved.put("autoOffShelf", autoOffShelf);
        saved.put("regionNames", distributionRuleService.regions(id));
        return ResponseEntity.ok(saved);
    }

    /** 扫描当前供应商全部商品，自动下架低于底价的渠道货架。 */
    @PostMapping("/products/price-guard")
    public ResponseEntity<Map<String, Object>> scanPriceGuard() {
        Supplier supplier = supplierIdentityService.requireCurrent();
        int total = 0;
        for (Product product : productMapper.selectList(new LambdaQueryWrapper<Product>()
                .eq(Product::getSupplierId, supplier.getId()))) {
            total += priceGuardService.enforceProduct(product, "MANUAL");
        }
        return ResponseEntity.ok(Map.of("success", true, "count", total,
                "message", total > 0 ? "已自动下架 " + total + " 个超低价商品" : "没有需要下架的超低价商品"));
    }

    /** 可加入白名单的渠道（已审核通过）。 */
    @GetMapping("/available-channels")
    public ResponseEntity<List<Map<String, Object>>> availableChannels() {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (ChannelPartner channel : channelPartnerMapper.selectList(new LambdaQueryWrapper<ChannelPartner>()
                .eq(ChannelPartner::getAuditStatus, "APPROVED"))) {
            Map<String, Object> item = new HashMap<>();
            item.put("channelId", channel.getId());
            item.put("shopName", channel.getShopName());
            item.put("grade", channel.getGrade());
            rows.add(item);
        }
        return ResponseEntity.ok(rows);
    }

    @PutMapping("/update")
    public ResponseEntity<Map<String, Object>> updateInfo(@RequestBody Supplier supplier) {
        supplierIdentityService.requireOwnSupplier(supplier.getId());
        supplier.setUserId(SecurityUtils.getUserId());
        Map<String, Object> result = new HashMap<>();
        boolean success = supplierService.updateInfo(supplier);
        result.put("success", success);
        result.put("message", success ? "信息更新成功" : "信息更新失败");
        return ResponseEntity.ok(result);
    }
}

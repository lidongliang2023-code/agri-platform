package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.common.security.SecurityUtils;
import com.agri.trade.entity.ProductImage;
import com.agri.trade.entity.TradeProduct;
import com.agri.trade.mapper.ProductImageMapper;
import com.agri.trade.mapper.TradeProductMapper;
import com.agri.trade.service.PlatformIdentityService;
import com.agri.trade.service.TradeConfigService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * 卖家中心商品管理。
 *
 * <p>与主数据运营端共用 {@code agri_trade_product} / {@code agri_trade_product_image}，
 * 差异只在数据范围：卖家端由服务端从 SSO 主体绑定推导，永远只能读写自己的商品；
 * 主数据端才允许查看全平台商品。</p>
 */
@RestController
@RequestMapping("/api/trade/seller/product")
@RequiredArgsConstructor
public class SellerProductController {

    private static final long MAX_IMAGE_BYTES = 5L * 1024 * 1024;

    private final TradeProductMapper productMapper;
    private final ProductImageMapper imageMapper;
    private final PlatformIdentityService identityService;
    private final TradeConfigService configService;
    private final ObjectMapper objectMapper;

    @Value("${agri.trade.upload-dir:uploads}")
    private String uploadDir;

    public record ProductRequest(
            Long sellerId,
            String productCode,
            String productName,
            Long categoryId,
            String categoryName,
            String barcode,
            String variety,
            String originProvince,
            String originCity,
            String originDistrict,
            String originAddress,
            String specLevel,
            String qualityLevel,
            String specSize,
            String unit,
            BigDecimal stockQuantity,
            BigDecimal price,
            BigDecimal priceMin,
            BigDecimal priceMax,
            String priceType,
            BigDecimal minOrderQuantity,
            String harvestBatchNo,
            List<String> certifications,
            String qualityReportUrl,
            String description,
            String videoUrl,
            List<String> images,
            Integer status) {
    }

    public record ProductView(
            Long id,
            String productCode,
            String productName,
            Long categoryId,
            String categoryName,
            String sellerId,
            String sellerName,
            String barcode,
            String variety,
            String originProvince,
            String originCity,
            String originDistrict,
            String originAddress,
            String specLevel,
            String qualityLevel,
            String specSize,
            String unit,
            BigDecimal stockQuantity,
            BigDecimal price,
            BigDecimal priceMin,
            BigDecimal priceMax,
            String priceType,
            BigDecimal minOrderQuantity,
            String harvestBatchNo,
            List<String> certifications,
            String qualityReportUrl,
            String description,
            String videoUrl,
            String publishStatus,
            Integer status,
            Date createTime,
            List<String> images,
            String portalUrl) {
    }

    public record PageView(List<ProductView> records, long total, long pageNum, long pageSize) {
    }

    @GetMapping("/mine/page")
    public ApiResponse<PageView> page(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) Long sellerId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String publishStatus) {
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return ApiResponse.error(scope.error());
        }
        if (scope.merchantIds().isEmpty()) {
            return ApiResponse.success(new PageView(List.of(), 0, pageNum, pageSize));
        }
        if (sellerId != null && !scope.merchantIds().contains(sellerId)) {
            return ApiResponse.error("无权查看该供应商的商品");
        }
        Page<TradeProduct> page = new Page<>(Math.max(pageNum, 1), Math.min(Math.max(pageSize, 1), 100));
        LambdaQueryWrapper<TradeProduct> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TradeProduct::getDelFlag, 0)
                .in(TradeProduct::getSellerId, sellerId == null ? scope.merchantIds() : List.of(sellerId));
        if (keyword != null && !keyword.isBlank()) {
            String value = keyword.trim();
            wrapper.and(w -> w.like(TradeProduct::getProductName, value)
                    .or().like(TradeProduct::getProductCode, value)
                    .or().like(TradeProduct::getVariety, value));
        }
        if (publishStatus != null && !publishStatus.isBlank()) {
            wrapper.eq(TradeProduct::getPublishStatus, publishStatus.trim());
        }
        wrapper.orderByDesc(TradeProduct::getCreateTime);
        Page<TradeProduct> result = productMapper.selectPage(page, wrapper);
        return ApiResponse.success(new PageView(result.getRecords().stream().map(this::toView).toList(),
                result.getTotal(), result.getCurrent(), result.getSize()));
    }

    @GetMapping("/mine/{id}")
    public ApiResponse<ProductView> detail(@PathVariable Long id) {
        TradeProduct product = requireOwnedProduct(id);
        return ApiResponse.success(toView(product));
    }

    @PostMapping("/mine")
    @Transactional(rollbackFor = Exception.class)
    public ApiResponse<ProductView> create(@RequestBody ProductRequest request) {
        validate(request);
        PlatformIdentityService.MerchantSelection seller = identityService.selectMerchant(request.sellerId());
        if (!seller.ok()) {
            return ApiResponse.error(seller.error());
        }
        TradeProduct product = new TradeProduct();
        apply(product, request);
        product.setSellerId(seller.merchantId());
        product.setSellerName(seller.merchantName());
        product.setProductCode(blank(request.productCode()) ? "P" + System.currentTimeMillis() : request.productCode().trim());
        boolean requiresAudit = configService.getBoolean("product.publish-requires-audit", true);
        product.setPublishStatus(requiresAudit ? "pending" : "published");
        product.setStatus(request.status() != null && request.status() == 0 ? 0 : 1);
        product.setDelFlag(0);
        product.setViewCount(0);
        product.setFavoriteCount(0);
        product.setInquiryCount(0);
        product.setCreateBy(SecurityUtils.getUsername());
        product.setCreateTime(new Date());
        product.setUpdateTime(new Date());
        productMapper.insert(product);
        replaceImages(product.getId(), request.images());
        return ApiResponse.success(toView(product));
    }

    @PutMapping("/mine/{id}")
    @Transactional(rollbackFor = Exception.class)
    public ApiResponse<ProductView> update(@PathVariable Long id, @RequestBody ProductRequest request) {
        validate(request);
        TradeProduct product = requireOwnedProduct(id);
        apply(product, request);
        product.setStatus(request.status() != null && request.status() == 0 ? 0 : 1);
        product.setUpdateTime(new Date());
        productMapper.updateById(product);
        replaceImages(id, request.images());
        return ApiResponse.success(toView(product));
    }

    @PutMapping("/mine/{id}/status")
    public ApiResponse<Void> status(@PathVariable Long id, @RequestParam Integer status) {
        TradeProduct product = requireOwnedProduct(id);
        product.setStatus(status != null && status == 0 ? 0 : 1);
        product.setUpdateTime(new Date());
        productMapper.updateById(product);
        return ApiResponse.success();
    }

    @PostMapping(value = "/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<ImageUploadView> upload(@RequestPart("file") MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) return ApiResponse.error("请选择图片文件");
        if (file.getSize() > MAX_IMAGE_BYTES) return ApiResponse.error("图片不能超过 5MB");
        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        String extension = switch (contentType) {
            case "image/jpeg", "image/jpg" -> ".jpg";
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            default -> null;
        };
        if (extension == null) return ApiResponse.error("仅支持 JPG、PNG、WEBP 图片");
        Path directory = Paths.get(uploadDir, "trade").toAbsolutePath().normalize();
        Files.createDirectories(directory);
        String filename = UUID.randomUUID().toString().replace("-", "") + extension;
        Path target = directory.resolve(filename).normalize();
        if (!target.startsWith(directory)) return ApiResponse.error("非法文件名");
        file.transferTo(target);
        return ApiResponse.success(new ImageUploadView("/uploads/trade/" + filename, file.getOriginalFilename()));
    }

    public record ImageUploadView(String url, String originalName) {
    }

    private TradeProduct requireOwnedProduct(Long id) {
        TradeProduct product = productMapper.selectById(id);
        if (product == null || Integer.valueOf(1).equals(product.getDelFlag())) {
            throw new IllegalArgumentException("商品不存在");
        }
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) throw new IllegalArgumentException(scope.error());
        if (!scope.merchantIds().contains(product.getSellerId())) {
            throw new IllegalArgumentException("只能操作自己发布的商品");
        }
        return product;
    }

    private void apply(TradeProduct product, ProductRequest request) {
        product.setProductName(request.productName().trim());
        product.setCategoryId(request.categoryId());
        product.setCategoryName(trim(request.categoryName()));
        product.setVariety(trim(request.variety()));
        product.setOriginProvince(trim(request.originProvince()));
        product.setOriginCity(trim(request.originCity()));
        product.setOriginDistrict(trim(request.originDistrict()));
        product.setOriginAddress(trim(request.originAddress()));
        product.setSpecLevel(trim(request.specLevel()));
        product.setQualityLevel(trim(request.qualityLevel()));
        product.setSpecSize(trim(request.specSize()));
        product.setUnit(request.unit().trim());
        product.setStockQuantity(request.stockQuantity() == null ? BigDecimal.ZERO : request.stockQuantity());
        product.setPrice(request.price());
        product.setPriceMin(request.priceMin() == null ? request.price() : request.priceMin());
        product.setPriceMax(request.priceMax() == null ? request.price() : request.priceMax());
        product.setPriceType(blank(request.priceType()) ? "fixed" : request.priceType().trim());
        product.setMinOrderQuantity(request.minOrderQuantity() == null ? BigDecimal.ONE : request.minOrderQuantity());
        product.setHarvestBatchNo(trim(request.harvestBatchNo()));
        product.setCertificationJson(writeCertifications(request.certifications()));
        product.setQualityReportUrl(trim(request.qualityReportUrl()));
        product.setDescription(trim(request.description()));
        product.setVideoUrl(trim(request.videoUrl()));
        product.setRemark(trim(request.barcode()));
    }

    private void validate(ProductRequest request) {
        if (request == null || blank(request.productName())) throw new IllegalArgumentException("商品名称不能为空");
        if (request.categoryId() == null || blank(request.categoryName())) throw new IllegalArgumentException("请选择商品分类");
        if (blank(request.unit())) throw new IllegalArgumentException("商品单位不能为空");
        if (request.price() == null || request.price().signum() <= 0) throw new IllegalArgumentException("商品价格必须大于 0");
        if (request.stockQuantity() == null || request.stockQuantity().signum() < 0) throw new IllegalArgumentException("库存不能小于 0");
        if (request.minOrderQuantity() != null && request.minOrderQuantity().signum() <= 0) throw new IllegalArgumentException("起订量必须大于 0");
        if (request.images() == null || request.images().isEmpty()) throw new IllegalArgumentException("请至少上传一张商品图片");
        if (request.images().size() > 9) throw new IllegalArgumentException("商品图片最多 9 张");
        for (String url : request.images()) {
            if (blank(url) || url.length() > 500 || (!url.startsWith("/uploads/trade/") && !url.startsWith("https://"))) {
                throw new IllegalArgumentException("商品图片地址无效");
            }
        }
    }

    private void replaceImages(Long productId, List<String> urls) {
        imageMapper.delete(new LambdaQueryWrapper<ProductImage>().eq(ProductImage::getProductId, productId));
        for (int i = 0; i < urls.size(); i++) {
            ProductImage image = new ProductImage();
            image.setProductId(productId);
            image.setImageUrl(urls.get(i).trim());
            image.setImageType(i == 0 ? "main" : "detail");
            image.setSortOrder(i + 1);
            image.setDelFlag(0);
            image.setCreateBy(SecurityUtils.getUsername());
            image.setCreateTime(new Date());
            imageMapper.insert(image);
        }
    }

    private ProductView toView(TradeProduct product) {
        List<String> images = imageMapper.selectList(new LambdaQueryWrapper<ProductImage>()
                        .eq(ProductImage::getProductId, product.getId())
                        .eq(ProductImage::getDelFlag, 0)
                        .orderByAsc(ProductImage::getSortOrder))
                .stream().map(ProductImage::getImageUrl).toList();
        List<String> certifications = List.of();
        if (product.getCertificationJson() != null && !product.getCertificationJson().isBlank()) {
            try {
                certifications = objectMapper.readValue(product.getCertificationJson(),
                        objectMapper.getTypeFactory().constructCollectionType(List.class, String.class));
            } catch (JsonProcessingException ignored) {
                // 历史数据非 JSON 时保持空数组。
            }
        }
        return new ProductView(product.getId(), product.getProductCode(), product.getProductName(),
                product.getCategoryId(), product.getCategoryName(),
                product.getSellerId() == null ? null : String.valueOf(product.getSellerId()), product.getSellerName(),
                product.getRemark(), product.getVariety(), product.getOriginProvince(), product.getOriginCity(),
                product.getOriginDistrict(), product.getOriginAddress(), product.getSpecLevel(), product.getQualityLevel(),
                product.getSpecSize(), product.getUnit(), product.getStockQuantity(), product.getPrice(),
                product.getPriceMin(), product.getPriceMax(), product.getPriceType(), product.getMinOrderQuantity(),
                product.getHarvestBatchNo(), certifications, product.getQualityReportUrl(), product.getDescription(),
                product.getVideoUrl(), product.getPublishStatus(), product.getStatus(), product.getCreateTime(), images,
                "http://localhost:8086/product/detail/" + product.getId());
    }

    private String writeCertifications(List<String> values) {
        if (values == null || values.isEmpty()) return null;
        try {
            return objectMapper.writeValueAsString(values.stream().filter(v -> !blank(v)).map(String::trim).toList());
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("认证信息格式不正确", e);
        }
    }

    private static String trim(String value) {
        return blank(value) ? null : value.trim();
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }
}

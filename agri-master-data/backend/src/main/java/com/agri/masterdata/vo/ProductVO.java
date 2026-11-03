package com.agri.masterdata.vo;

import com.agri.masterdata.entity.Product;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductVO {

    private Long id;

    private String productCode;

    private String productName;

    private Long categoryId;

    private String categoryName;

    private String brand;

    private String unit;

    private String origin;

    private String specJson;

    private BigDecimal price;

    private String imageUrls;

    private Integer status;

    /** SPU 准入审核状态：PENDING / APPROVED / REJECTED（agri_md_product.audit_status）。 */
    private String auditStatus;

    private String tenantId;

    private String createBy;

    private LocalDateTime createTime;

    private String remark;

    public static ProductVO fromEntity(Product product) {
        if (product == null) {
            return null;
        }
        return ProductVO.builder()
                .id(product.getId())
                .productCode(product.getProductCode())
                .productName(product.getProductName())
                .categoryId(product.getCategoryId())
                .brand(product.getBrand())
                .unit(product.getUnit())
                .origin(product.getOrigin())
                .specJson(product.getSpecJson())
                .price(product.getPrice())
                .imageUrls(product.getImageUrls())
                // status 在实体里是 String、库里是 INT：非数字值解析失败时给 null，
                // 不能让它把整个详情接口打成 500（一次脏数据毁掉整页）
                .status(parseIntOrNull(product.getStatus()))
                .auditStatus(product.getAuditStatus())
                .tenantId(product.getTenantId())
                .createBy(product.getCreateBy())
                .createTime(product.getCreateTime())
                .build();
    }

    private static Integer parseIntOrNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Integer.valueOf(value.trim());
        } catch (NumberFormatException ignored) {
            return null;
        }
    }
}

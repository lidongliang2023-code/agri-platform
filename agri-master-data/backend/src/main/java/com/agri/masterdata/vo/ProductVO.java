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
                .tenantId(product.getTenantId())
                .createBy(product.getCreateBy())
                .createTime(product.getCreateTime())
                .build();
    }
}

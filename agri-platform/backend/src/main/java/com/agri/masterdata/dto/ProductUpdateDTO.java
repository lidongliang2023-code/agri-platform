package com.agri.masterdata.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ProductUpdateDTO {

    @Size(max = 200, message = "商品名称长度不能超过200")
    private String productName;

    private Long categoryId;

    @Size(max = 100, message = "品牌长度不能超过100")
    private String brand;

    @Size(max = 20, message = "单位长度不能超过20")
    private String unit;

    @Size(max = 100, message = "产地长度不能超过100")
    private String origin;

    private String specJson;

    private java.math.BigDecimal price;

    private String imageUrls;

    private Integer status;

    private String remark;
}

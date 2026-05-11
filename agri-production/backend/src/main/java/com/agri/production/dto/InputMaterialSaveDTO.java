package com.agri.production.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class InputMaterialSaveDTO {

    private Long id;

    @NotBlank(message = "投入品名称不能为空")
    private String materialName;

    @NotBlank(message = "投入品类型不能为空")
    private String materialType;

    private String specification;

    private String unit;

    private String brand;

    private Long supplierId;

    private String supplierName;

    private String batchNumber;

    private java.time.LocalDate productionDate;

    private java.time.LocalDate expireDate;

    private BigDecimal purchasePrice;

    private String storageLocation;

    private BigDecimal initialStock;

    private BigDecimal minStock;

    private BigDecimal maxStock;

    private String remark;
}
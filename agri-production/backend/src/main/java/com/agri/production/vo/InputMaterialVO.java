package com.agri.production.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class InputMaterialVO {

    private Long id;

    private String materialCode;

    private String materialName;

    private String materialType;

    private String specification;

    private String unit;

    private String brand;

    private Long supplierId;

    private String supplierName;

    private String batchNumber;

    private LocalDate productionDate;

    private LocalDate expireDate;

    private BigDecimal purchasePrice;

    private String storageLocation;

    private BigDecimal initialStock;

    private BigDecimal currentStock;

    private BigDecimal minStock;

    private BigDecimal maxStock;

    private String status;

    private String remark;

    private String tenantId;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}
package com.agri.production.dto;

import lombok.Data;

@Data
public class InputMaterialPageDTO {

    private String materialName;

    private String materialType;

    private String supplierName;

    private String batchNumber;

    private String status;

    private Integer pageNum = 1;

    private Integer pageSize = 10;
}
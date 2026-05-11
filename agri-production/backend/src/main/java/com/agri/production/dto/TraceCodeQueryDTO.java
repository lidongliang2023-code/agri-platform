package com.agri.production.dto;

import lombok.Data;

@Data
public class TraceCodeQueryDTO {

    private String traceCode;

    private String batchNumber;

    private String productName;

    private String farmCode;

    private String status;

    private Integer pageNum = 1;

    private Integer pageSize = 10;
}
package com.agri.s2b2c.vo;

import lombok.Data;

import java.time.LocalDate;

@Data
public class TraceabilityVO {
    private Long id;
    private String batchCode;
    private String origin;
    private LocalDate plantingDate;
    private LocalDate harvestDate;
    private String processingInfo;
    private String qualityReport;
    private String storageInfo;
}
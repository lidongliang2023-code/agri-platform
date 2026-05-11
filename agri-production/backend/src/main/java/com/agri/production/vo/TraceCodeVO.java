package com.agri.production.vo;

import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class TraceCodeVO {

    private Long id;

    private String traceCode;

    private Long harvestId;

    private String harvestCode;

    private String batchNumber;

    private String productName;

    private String productCode;

    private Long farmId;

    private String farmCode;

    private String farmName;

    private Long plotId;

    private String plotCode;

    private String cropName;

    private String qualityGrade;

    private LocalDate harvestDate;

    private String status;

    private LocalDateTime activateTime;

    private LocalDateTime firstQueryTime;

    private Integer queryCount;

    private String blockchainTxHash;

    private Long blockchainBlockHeight;

    private String remark;

    private String tenantId;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;

    private List<TraceRecordVO> traceRecords;
}
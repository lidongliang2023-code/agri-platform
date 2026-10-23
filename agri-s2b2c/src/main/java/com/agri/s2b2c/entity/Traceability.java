package com.agri.s2b2c.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("s2b2c_traceability")
public class Traceability {
    @TableId(type = IdType.ASSIGN_ID)
    private Long id;
    private Long productId;
    private String batchCode;
    private String origin;
    private LocalDate plantingDate;
    private LocalDate harvestDate;
    private String processingInfo;
    private String qualityReport;
    private String storageInfo;
    private LocalDateTime createTime;
}
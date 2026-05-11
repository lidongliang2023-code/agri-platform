package com.agri.production.entity;

import com.agri.production.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_prod_trace_code")
public class TraceCode extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("trace_code")
    private String traceCode;

    @TableField("harvest_id")
    private Long harvestId;

    @TableField("harvest_code")
    private String harvestCode;

    @TableField("batch_number")
    private String batchNumber;

    @TableField("product_name")
    private String productName;

    @TableField("product_code")
    private String productCode;

    @TableField("farm_id")
    private Long farmId;

    @TableField("farm_code")
    private String farmCode;

    @TableField("farm_name")
    private String farmName;

    @TableField("plot_id")
    private Long plotId;

    @TableField("plot_code")
    private String plotCode;

    @TableField("crop_name")
    private String cropName;

    @TableField("quality_grade")
    private String qualityGrade;

    @TableField("harvest_date")
    private java.time.LocalDate harvestDate;

    @TableField("status")
    private String status;

    @TableField("activate_time")
    private java.time.LocalDateTime activateTime;

    @TableField("first_query_time")
    private java.time.LocalDateTime firstQueryTime;

    @TableField("query_count")
    private Integer queryCount;

    @TableField("blockchain_tx_hash")
    private String blockchainTxHash;

    @TableField("blockchain_block_height")
    private Long blockchainBlockHeight;

    @TableField("remark")
    private String remark;
}
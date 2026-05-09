package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("agri_prod_trace_code")
public class TraceCode {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("trace_code")
    private String traceCode;

    @TableField("batch_id")
    private Long batchId;

    @TableField("batch_no")
    private String batchNo;

    @TableField("farm_id")
    private Long farmId;

    @TableField("farm_name")
    private String farmName;

    @TableField("product_name")
    private String productName;

    @TableField("variety_name")
    private String varietyName;

    @TableField("quality_grade")
    private String qualityGrade;

    @TableField("harvest_date")
    private Date harvestDate;

    @TableField("production_date")
    private Date productionDate;

    @TableField("shelf_life_days")
    private Integer shelfLifeDays;

    @TableField("expire_date")
    private Date expireDate;

    @TableField("status")
    private String status;

    @TableField("activate_time")
    private Date activateTime;

    @TableField("activate_location_lat")
    private BigDecimal activateLocationLat;

    @TableField("activate_location_lng")
    private BigDecimal activateLocationLng;

    @TableField("activate_location_name")
    private String activateLocationName;

    @TableField("trace_json")
    private String traceJson;

    @TableField("chain_status")
    private String chainStatus;

    @TableField("chain_tx_hash")
    private String chainTxHash;

    @TableField("del_flag")
    private Integer delFlag;

    @TableField("tenant_id")
    private String tenantId;

    @TableField("create_by")
    private String createBy;

    @TableField("create_time")
    private Date createTime;

    @TableField("update_by")
    private String updateBy;

    @TableField("update_time")
    private Date updateTime;

    @TableField("remark")
    private String remark;
}
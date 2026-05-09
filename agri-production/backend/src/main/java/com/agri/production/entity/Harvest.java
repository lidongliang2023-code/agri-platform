package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("agri_prod_harvest")
public class Harvest {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("harvest_no")
    private String harvestNo;

    @TableField("farm_id")
    private Long farmId;

    @TableField("plot_id")
    private Long plotId;

    @TableField("plot_name")
    private String plotName;

    @TableField("crop_name")
    private String cropName;

    @TableField("variety_name")
    private String varietyName;

    @TableField("harvest_date")
    private Date harvestDate;

    @TableField("harvest_type")
    private String harvestType;

    @TableField("harvest_quantity")
    private BigDecimal harvestQuantity;

    @TableField("unit")
    private String unit;

    @TableField("quality_grade")
    private String qualityGrade;

    @TableField("harvest_method")
    private String harvestMethod;

    @TableField("harvester")
    private String harvester;

    @TableField("harvest_location_lat")
    private BigDecimal harvestLocationLat;

    @TableField("harvest_location_lng")
    private BigDecimal harvestLocationLng;

    @TableField("photos_json")
    private String photosJson;

    @TableField("status")
    private String status;

    @TableField("warehousing_quantity")
    private BigDecimal warehousingQuantity;

    @TableField("qualified_rate")
    private BigDecimal qualifiedRate;

    @TableField("reject_quantity")
    private BigDecimal rejectQuantity;

    @TableField("reject_reason")
    private String rejectReason;

    @TableField("chain_status")
    private String chainStatus;

    @TableField("chain_tx_hash")
    private String chainTxHash;

    @TableField("remark")
    private String remark;

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
}
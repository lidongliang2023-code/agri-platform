package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("agri_prod_facility")
public class Facility {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("farm_id")
    private Long farmId;

    @TableField("facility_code")
    private String facilityCode;

    @TableField("facility_name")
    private String facilityName;

    @TableField("facility_type")
    private String facilityType;

    @TableField("spec_model")
    private String specModel;

    @TableField("manufacturer")
    private String manufacturer;

    @TableField("build_date")
    private Date buildDate;

    @TableField("area")
    private BigDecimal area;

    @TableField("area_unit")
    private String areaUnit;

    @TableField("location")
    private String location;

    @TableField("capacity")
    private Integer capacity;

    @TableField("linked_plot_id")
    private Long linkedPlotId;

    @TableField("linked_device_ids")
    private String linkedDeviceIds;

    @TableField("install_date")
    private Date installDate;

    @TableField("maintenance_date")
    private Date maintenanceDate;

    @TableField("depreciation_years")
    private Integer depreciationYears;

    @TableField("original_value")
    private BigDecimal originalValue;

    @TableField("status")
    private String status;

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
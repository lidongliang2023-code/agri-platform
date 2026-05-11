package com.agri.production.entity;

import com.agri.production.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_prod_farm_info")
public class Farm extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("farm_code")
    private String farmCode;

    @TableField("farm_name")
    private String farmName;

    @TableField("farm_type")
    private String farmType;

    @TableField("legal_person")
    private String legalPerson;

    @TableField("contact_phone")
    private String contactPhone;

    @TableField("province")
    private String province;

    @TableField("city")
    private String city;

    @TableField("district")
    private String district;

    @TableField("address")
    private String address;

    @TableField("longitude")
    private BigDecimal longitude;

    @TableField("latitude")
    private BigDecimal latitude;

    @TableField("total_area")
    private BigDecimal totalArea;

    @TableField("plot_count")
    private Integer plotCount;

    @TableField("farm_type_detail")
    private String farmTypeDetail;

    @TableField("main_products")
    private String mainProducts;

    @TableField("certifications")
    private String certifications;

    @TableField("certification_expire_date")
    private java.time.LocalDate certificationExpireDate;

    @TableField("certifications_json")
    private String certificationsJson;

    @TableField("logo_url")
    private String logoUrl;

    @TableField("intro")
    private String intro;

    @TableField("register_date")
    private java.time.LocalDate registerDate;

    @TableField("audit_status")
    private String auditStatus;

    @TableField("status")
    private String status;

    @TableField("remark")
    private String remark;
}
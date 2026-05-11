package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("agri_prod_tenant_info")
public class Tenant {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("tenant_code")
    private String tenantCode;

    @TableField("tenant_name")
    private String tenantName;

    @TableField("tenant_type")
    private String tenantType;

    @TableField("legal_person")
    private String legalPerson;

    @TableField("contact_phone")
    private String contactPhone;

    @TableField("email")
    private String email;

    @TableField("province")
    private String province;

    @TableField("city")
    private String city;

    @TableField("district")
    private String district;

    @TableField("address")
    private String address;

    @TableField("business_license")
    private String businessLicense;

    @TableField("status")
    private String status;

    @TableField("audit_status")
    private String auditStatus;

    @TableField("audit_time")
    private LocalDateTime auditTime;

    @TableField("audit_by")
    private String auditBy;

    @TableField("audit_comment")
    private String auditComment;

    @TableField("expire_time")
    private LocalDateTime expireTime;

    @TableField("max_farms")
    private Integer maxFarms;

    @TableField("max_users")
    private Integer maxUsers;

    @TableField("storage_quota")
    private Long storageQuota;

    @TableField("create_by")
    private String createBy;

    @TableField("create_time")
    private LocalDateTime createTime;

    @TableField("update_by")
    private String updateBy;

    @TableField("update_time")
    private LocalDateTime updateTime;

    @TableField("deleted")
    private Integer deleted;
}

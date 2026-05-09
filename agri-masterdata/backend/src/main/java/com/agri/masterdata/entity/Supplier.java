package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_md_supplier")
public class Supplier extends BaseEntity {

    private String supplierCode;

    private String supplierName;

    private String supplierType;

    private Long orgId;

    private String creditCode;

    private String legalPerson;

    private String contactPerson;

    private String contactPhone;

    private String address;

    private String level;

    private Integer status;

    private Integer delFlag;

    private String tenantId;
}

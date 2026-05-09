package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_md_customer")
public class Customer extends BaseEntity {

    private String customerCode;

    private String customerName;

    private String customerType;

    private Long orgId;

    private String creditCode;

    private String legalPerson;

    private String contactPhone;

    private String address;

    private String level;

    private Integer status;

    private Integer delFlag;

    private String tenantId;
}
